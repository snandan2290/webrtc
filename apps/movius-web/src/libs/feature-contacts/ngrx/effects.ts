import { Injectable } from '@angular/core';
import { NavigationEnd, Router , RoutesRecognized } from '@angular/router';
import { Contact, serverDateToISO } from '@movius/domain';
import { MSGraphService } from '@movius/msgraph';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import { SipService } from '@scalio/sip';
// import { concat, flatMap } from 'lodash';
import { NzModalService } from 'ng-zorro-antd/modal';
import { Location } from '@angular/common';
import {
    combineLatest,
    EMPTY,
    merge,
    NEVER,
    Observable,
    of,
    timer,
} from 'rxjs';
import {
    delay,
    filter,
    map,
    mapTo,
    switchMap,
    tap,
    withLatestFrom,
    take,
    mergeMap,
    pairwise
} from 'rxjs/operators';
import {
    cleanPhoneNumber,
    ConfirmDialogComponent,
    DbContext,
    deleteMSGraphContacts,
    getFeatureEnabled,
    isHighZoomedScreen,
    loginMsGraphSuccess,
    loginSuccess,
    logoutMsGraph,
    mapFromMsGraphContact,
    mapToMsGraphContact,
    PhoneNumberService,
    SelectContactsDialogComponent,
    selectIsMsGraphSyncEnabled,
    selectUserExchangeSettings,
    selectUserId,
    updateUserExchangeSyncSettingsSuccess,
} from '../../shared';
import {
    createUserContact,
    createUserContactSuccess,
    deleteContact,
    deleteContactsSuccess,
    deleteContactSuccess,
    importFromMsGraph,
    importFromMsGraphSuccess,
    rehydrateContactsSuccess,
    scheduleImportFromMsGraph,
    setContactImage,
    startAddToExistentContact,
    startCreateUserContact,
    updateUserContact,
    updateUserContactSuccess,
    onNewContactSaveSuccess,
    sendCustomerOptInRequest,
    customerOptInSuccess,
    customerOptInReEngageSuccess,
    customerOptInError,
    contactAlreadyInConversartion,
    contactCannotCreateNewConveration,
    routeBack,
} from './actions';
import { addIncomingSessionMessage, updateRequestCount, updateThreadIdOnReEngage } from './../../feature-messaging/ngrx/actions';

import { selectAllContactNumbers, selectContactGhosts, selectContacts } from './selectors';
import { AuthDataAccessService } from '../../../../src/libs/shared/services/auth.data-access.service';
import { MessagingService } from './../../feature-messaging/services/messaging.service';
import { LoggerFactory } from '@movius/ts-logger';
import { selectPeersMessages } from '../../feature-messaging/ngrx/selectors';
import { uniqBy } from 'lodash/fp';
import { OptInWhatsappTemplateComponent } from '../../feature-messaging/components/optIn-whatsapp-template/optIn-whatsapp-template.component';
const logger = LoggerFactory.getLogger("")

const chooseContact = (
    modalService: NzModalService,
    contacts: Contact[]
): Observable<string> =>
    modalService
        .create({
            nzContent: SelectContactsDialogComponent,
            nzComponentParams: {
                headerTitle: 'Add number to contact',
                okBtnTitle: 'Add to contact',
                cancelBtnTitle: 'Cancel',
                sourceContacts: contacts,
                mode: 'single',
                actionTriggeredFrom: 'forward',
                heightMode: isHighZoomedScreen() ? 'Limited' : 'Normal',
            },
            nzMask: true,
            nzFooter: null,
            nzClosable: false,
            nzCentered: true,
        })
        .afterClose.pipe(map((m) => (!m || m.length === 0 ? null : m[0].id)));

@Injectable()
export class ContactsEffects {
    appEmbededStatus: string;
    getContactPeerId: string;
    contactDetailsPeerNumber: string;
    routerURL: string;
    loadFirstThreadMsg: any;
    previousUrl:any;
    peerMessages: any;
    cnts: any;
    messagingThreadList:any = [];
    savedContacts = [];

    constructor(
        private readonly actions$: Actions,
        private readonly dbContext: DbContext,
        private readonly store: Store,
        private readonly router: Router,
        private readonly modalService: NzModalService,
        private readonly msgraphService: MSGraphService,
        private readonly sipService: SipService,
        private readonly authDataAccess: AuthDataAccessService,
        private readonly messagingService: MessagingService,
        private location: Location,
        private phoneService: PhoneNumberService
    ) {
        this.appEmbededStatus = getFeatureEnabled();
        // get previous and current url
        this.router.events
        .pipe(filter((evt: any) => evt instanceof RoutesRecognized), pairwise())
        .subscribe((events: RoutesRecognized[]) => {
            this.previousUrl = events[0].urlAfterRedirects
          console.log('previous url', events[0].urlAfterRedirects);
          console.log('current url', events[1].urlAfterRedirects);
        });
        
        router.events
            .pipe(filter(event => event instanceof NavigationEnd))
            .subscribe((event: NavigationEnd) => {
                this.routerURL = event.url
                if (event.url.split('/')[4] === 'details') {
                    this.contactDetailsPeerNumber = event.url.split('/')[3];
                }
            });

        const peerMessages$ = store
            .select(selectPeersMessages(sipService.getUserUri))
            .pipe(
                map((m) => m.filter((f) => f.messages.length > 0)),
                //map((m) => uniqBy((x) => x.peer.multiLine, m))
            );
        peerMessages$.subscribe(peers => {
            this.peerMessages = peers;
            if (peers.length > 0) {
                this.loadFirstThreadMsg = peers[0]?.peer?.id.includes('whatsapp:') ? peers[0]?.threadId : peers[0]?.peer?.id;
            } else {
                this.loadFirstThreadMsg = null;
            }
        });

        const cnts$ = this.store.select(selectContactGhosts(sipService.getUserUri))
        cnts$.subscribe((peers) => {
            this.savedContacts = peers;
        });

    }

    private readonly userId$ = this.store.select(selectUserId);
    private readonly isMsGraphSyncEnabled$ = this.store.select(
        selectIsMsGraphSyncEnabled
    );
    private readonly allContactNumbers$ = this.store.select(
        selectAllContactNumbers
    );

    rehydrateContacts$ = createEffect(() =>
        this.actions$.pipe(
            ofType(loginSuccess),
            withLatestFrom(this.userId$),
            switchMap(([_, userId]) =>
                this.dbContext.contact.getContacts(userId)
            ),
            map((result) =>
                rehydrateContactsSuccess({
                    result: result,
                })
            )
        )
    );

    startCreateUserContact$ = createEffect(() =>
        this.actions$.pipe(
            ofType(startCreateUserContact),
            withLatestFrom(this.userId$),
            mergeMap(async ([{ contact, imageFile, contactCreatedFrom }, userId]) => {
                 let existentContact: any;
                 if(contactCreatedFrom != 'addingGalCnctViaMsging'){
                    existentContact = this.savedContacts.length
                    ? this.savedContacts.find(
                          (obj) =>
                              contact.phones &&
                              contact.phones[0] &&
                              obj.multiLine ==
                                  cleanPhoneNumber(contact.phones[0].phone)
                      )
                    : null;
                 }
                return { existentContact, contact, userId, imageFile, contactCreatedFrom };
            }),
            mergeMap(({ existentContact, contact, userId, imageFile, contactCreatedFrom }) => {
                if (existentContact) {
                    if (contactCreatedFrom && contactCreatedFrom =='AddedGroupParticipants') {
                        return EMPTY;
                    }
                    this.modalService.create({
                        nzContent: ConfirmDialogComponent,
                        nzComponentParams: {
                            titleTxt: 'Error',
                            subTitleTxt:
                                'Contact with the same number already exists',
                            applyBtnTxt: 'Ok',
                            onOkAction: () => {
                                this.phoneService.isContactCreated.next(false);
                            },
                            type: 'Error',
                        },
                        nzBodyStyle: {
                            width: '26rem',
                        },
                        nzWidth: '26rem',
                        nzFooter: null,
                    });
                    return EMPTY;
                } else {
                    return of(createUserContact({ contact, imageFile, contactCreatedFrom }));
                }
            })
        )
    );

    createUserContact$ = createEffect(() =>
        this.actions$.pipe(
            ofType(createUserContact),
            withLatestFrom(
                this.userId$,
                this.isMsGraphSyncEnabled$,
                this.allContactNumbers$
            ),
            filter(
                ([{ contact, isImplicit }, _, __, numbers]) =>
                    !isImplicit ||
                    !(contact.phones || []).find(({ phone }) =>
                        numbers.includes(phone)
                    )
            ),
            mergeMap(
                async ([
                    { contact: newContact, imageFile, isImplicit, contactCreatedFrom },
                    userId,
                    isMsGraphSyncEnabled,
                ]) => {
                    let profile = newContact;
                    let img = imageFile?.img || profile.img;
                    // verifyDuplicate - means it's already from exchange
                    if (isMsGraphSyncEnabled != undefined) {
                        if ((isMsGraphSyncEnabled.email != undefined || localStorage.getItem('contactSync')) && !isImplicit) {
                            if (profile.type == 'personal' || profile.type == 'organization') {
                                const dto = mapToMsGraphContact(profile as Contact);

                                let msGraphContact: any;
                                try {
                                    sessionStorage.removeItem('calledRefreshSsoToken');
                                    msGraphContact = await this.msgraphService.createContactAndPhoto(
                                        dto,
                                        imageFile?.file
                                    );
                                    profile = mapFromMsGraphContact(msGraphContact);
                                } catch (error) {
                                    console.log('create contact error log1::', error);
                                    const errorcode = error.body ? JSON.parse(error.body).code : JSON.parse(error.code);
                                    //if (errorcode === "InvalidAuthenticationToken") {
                                        if (this.appEmbededStatus === 'messaging' && sessionStorage.getItem("isLogingViaTeams") === "true") {
                                            console.log('create contact inside log1');
                                            const refereshTokenResponse = await this.authDataAccess.refresh_token_on_expiry().toPromise();
                                            //logger.debug('refresh token response:', refereshTokenResponse);

                                            if (refereshTokenResponse.root.desc == 'Success' && refereshTokenResponse.root.sso_access_token != null) {
                                                sessionStorage.setItem('ssoToken', refereshTokenResponse.root.sso_access_token);
                                            }

                                            if (refereshTokenResponse.root.desc == 'Success' && refereshTokenResponse.root.refresh_token != null) {
                                                sessionStorage.setItem('refreshToken', refereshTokenResponse.root.refresh_token);
                                            }

                                            if (refereshTokenResponse.root.return == 13002) {
                                                this.router.navigate([
                                                    '/auth/login',
                                                    { info: 'timeoutExpired' },
                                                ]);
                                            } else if (sessionStorage.getItem('calledRefreshSsoToken') == undefined) {
                                                sessionStorage.setItem('calledRefreshSsoToken', 'true');
                                                logger.debug('create Contact from exception block');
                                                msGraphContact = await this.msgraphService.createContactAndPhoto(
                                                    dto,
                                                    imageFile?.file
                                                );
                                                profile = mapFromMsGraphContact(msGraphContact);
                                            }

                                        }
                                    //}  
                                }
                            }
                        }
                    } else if (isMsGraphSyncEnabled == undefined && localStorage.getItem('contactSync') == 'true' && !isImplicit) {    
                        if (profile.type == 'personal' || profile.type == 'organization') {
                            const dto = mapToMsGraphContact(profile as Contact);

                            let msGraphContact: any;
                            try {
                                sessionStorage.removeItem('calledRefreshSsoToken');
                                msGraphContact = await this.msgraphService.createContactAndPhoto(
                                    dto,
                                    imageFile?.file
                                );
                                profile = mapFromMsGraphContact(msGraphContact);
                            } catch (error) {
                                console.log('create contact error log2::', error);
                                const errorcode = error.body ? JSON.parse(error.body).code : JSON.parse(error.code);
                                //if (errorcode === "InvalidAuthenticationToken") {
                                    if (this.appEmbededStatus === 'messaging' && sessionStorage.getItem("isLogingViaTeams") === "true") {
                                        console.log('create contact inside log2');
                                        const refereshTokenResponse = await this.authDataAccess.refresh_token_on_expiry().toPromise();
                                        //logger.debug('refresh token response:', refereshTokenResponse);

                                        if (refereshTokenResponse.root.desc == 'Success' && refereshTokenResponse.root.sso_access_token != null) {
                                            sessionStorage.setItem('ssoToken', refereshTokenResponse.root.sso_access_token);
                                        }

                                        if (refereshTokenResponse.root.desc == 'Success' && refereshTokenResponse.root.refresh_token != null) {
                                            sessionStorage.setItem('refreshToken', refereshTokenResponse.root.refresh_token);
                                        }

                                        if (refereshTokenResponse.root.return == 13002) {
                                            this.router.navigate([
                                                '/auth/login',
                                                { info: 'timeoutExpired' },
                                            ]);
                                        } else if (sessionStorage.getItem('calledRefreshSsoToken') == undefined) {
                                            sessionStorage.setItem('calledRefreshSsoToken', 'true');
                                            logger.debug('create Contact from exception block');
                                            msGraphContact = await this.msgraphService.createContactAndPhoto(
                                                dto,
                                                imageFile?.file
                                            );
                                            profile = mapFromMsGraphContact(msGraphContact);
                                        }
                                    }

                                //}  
                            }
                        }
                    }
                    let contactNew: any = JSON.parse(JSON.stringify(profile));
                    // contactNew.type = 'personal';
                    const newContactNumber = sessionStorage.getItem("exDirContIntNum");
                    if (newContactNumber !== null) {
                        contactNew.phones[0].phone = newContactNumber;
                        sessionStorage.removeItem("exDirContIntNum");
                    }

                    const createContact = {
                        ...contactNew,
                        isPersistedAsContact: true,
                        img,
                    };

                    let contactExists: any;
                    if(contactCreatedFrom != 'addingGalCnctViaMsging' && contactCreatedFrom != 'AddedGroupParticipants'){
                        contactExists = await this.dbContext.contact.getContact(userId,createContact);
                    }

                    let contactId;
                    if(contactExists){
                        contactId = contactExists;
                    }else{
                        contactId = await this.dbContext.contact.addContact(
                            userId,
                            createContact
                        );
                    }
                    const contact = {
                        ...createContact,
                        id: contactId.valueOf() as number,
                    };

                    if(sessionStorage.getItem("addGalCnctViaMsging")==="true"){
                        sessionStorage.removeItem("addGalCnctViaMsging")
                        return onNewContactSaveSuccess({contact})
                    }

                    
                    if ((newContact.msGraphId === undefined && isImplicit === undefined) || sessionStorage.getItem("addContactfromExchange") === "true") {
                        if (sessionStorage.getItem("addContactfromExchange") === "true")
                            sessionStorage.removeItem("addContactfromExchange");
                            logger.debug("[Contacts] Create User Contact Success")
                        return createUserContactSuccess({
                            contact,
                            isFromGalContact: false,
                            isImplicit: true,
                            contactCreatedFrom: contactCreatedFrom,
                        });
                    } else {
                        logger.debug("[Contacts] Create User Contact Success")
                        return createUserContactSuccess({
                            contact,
                            isFromGalContact: !!newContact.msGraphId,
                            isImplicit,
                            contactCreatedFrom: contactCreatedFrom,
                        });
                    }
                }
            )
        )
    );

    updateUserContact$ = createEffect(() =>
        this.actions$.pipe(
            ofType(updateUserContact),
            withLatestFrom(this.userId$, this.isMsGraphSyncEnabled$),
            switchMap(
                async ([
                    { contact, imageFile },
                    userId,
                    isMsGraphSyncEnabled,
                ]) => {
                    let img = imageFile?.img || contact.img;
                    if (isMsGraphSyncEnabled || localStorage.getItem('contactSync') == 'true') {
                        if (!contact.msGraphId) {
                            // create contact from existent call or message
                            const error =
                                "MS graph contact sync enabled but updated contact doesn't have msGraphId";
                            console.warn(error);
                        }
                        const dto = mapToMsGraphContact(contact);
                        try {
                            if (contact.type == 'personal' || contact.type == 'organization') {

                                let msGraphContact: any;
                                if(!contact.msGraphId){

                                    try {
                                        sessionStorage.removeItem('calledRefreshSsoToken');
                                        msGraphContact = await this.msgraphService.createContactAndPhoto(
                                            dto,
                                            imageFile?.file
                                        );
                                    } catch (error) {
                                        console.log('create contact error log3::', error);
                                        const errorcode = error.body ? JSON.parse(error.body).code : JSON.parse(error.code);
                                        //if (errorcode === "InvalidAuthenticationToken") {
                                            if (this.appEmbededStatus === 'messaging' && sessionStorage.getItem("isLogingViaTeams") === "true") {
                                                console.log('create contact inside log3');
                                                const refereshTokenResponse = await this.authDataAccess.refresh_token_on_expiry().toPromise();
                                                //logger.debug('refresh token response:', refereshTokenResponse);

                                                if (refereshTokenResponse.root.desc == 'Success' && refereshTokenResponse.root.sso_access_token != null) {
                                                    sessionStorage.setItem('ssoToken', refereshTokenResponse.root.sso_access_token);
                                                }

                                                if (refereshTokenResponse.root.desc == 'Success' && refereshTokenResponse.root.refresh_token != null) {
                                                    sessionStorage.setItem('refreshToken', refereshTokenResponse.root.refresh_token);
                                                }

                                                if (refereshTokenResponse.root.return == 13002) {
                                                    this.router.navigate([
                                                        '/auth/login',
                                                        { info: 'timeoutExpired' },
                                                    ]);
                                                } else if (sessionStorage.getItem('calledRefreshSsoToken') == undefined) {
                                                    sessionStorage.setItem('calledRefreshSsoToken', 'true');
                                                    logger.debug('create Contact from exception block');
                                                    msGraphContact = await this.msgraphService.createContactAndPhoto(
                                                        dto,
                                                        imageFile?.file
                                                    );
                                                }
                                            }
                                        //}  
                                    }

                                } else {
                                    try{
                                        sessionStorage.removeItem('calledRefreshSsoToken');
                                        msGraphContact = await this.msgraphService.updateContactAndPhoto(
                                            contact.msGraphId,
                                            dto,
                                            imageFile?.file
                                        );
                                    } catch (error) {
                                        console.log('create contact error log4::', error);
                                        const errorcode = error.body ? JSON.parse(error.body).code : JSON.parse(error.code);
                                        //if (errorcode === "InvalidAuthenticationToken") {
                                            if (this.appEmbededStatus === 'messaging' && sessionStorage.getItem("isLogingViaTeams") === "true") {
                                                console.log('create contact inside log4');
                                                const refereshTokenResponse = await this.authDataAccess.refresh_token_on_expiry().toPromise();
                                                //logger.debug('refresh token response:', refereshTokenResponse);

                                                if (refereshTokenResponse.root.desc == 'Success' && refereshTokenResponse.root.sso_access_token != null) {
                                                    sessionStorage.setItem('ssoToken', refereshTokenResponse.root.sso_access_token);
                                                }

                                                if (refereshTokenResponse.root.desc == 'Success' && refereshTokenResponse.root.refresh_token != null) {
                                                    sessionStorage.setItem('refreshToken', refereshTokenResponse.root.refresh_token);
                                                }

                                                if (refereshTokenResponse.root.return == 13002) {
                                                    this.router.navigate([
                                                        '/auth/login',
                                                        { info: 'timeoutExpired' },
                                                    ]);
                                                } else if (sessionStorage.getItem('calledRefreshSsoToken') == undefined) {
                                                    sessionStorage.setItem('calledRefreshSsoToken', 'true');
                                                    logger.debug('Update Contact from exception block');
                                                    msGraphContact = await this.msgraphService.updateContactAndPhoto(
                                                        contact.msGraphId,
                                                        dto,
                                                        imageFile?.file
                                                    );
                                                }
                                            }

                                        //}  
                                    }

                                }
                                const updContact = mapFromMsGraphContact(
                                    msGraphContact
                                );
                                contact = { ...contact, ...updContact };
                            }
                        } catch (err) {
                            logger.debug("Error occured when updating the contact", err);
                            if (JSON.parse(err.body).code === "ErrorItemNotFound") {
                                if (contact.type == 'personal' || contact.type == 'organization') {
                                    const msGraphContact = await this.msgraphService.createContactAndPhoto(
                                        dto,
                                        imageFile?.file
                                    )
                                    const updContact = mapFromMsGraphContact(
                                        msGraphContact
                                    );
                                    contact = { ...contact, ...updContact };
                                }
                            }
                        }
                    }
                    const updContact = {
                        ...contact,
                        img,
                    };
                    logger.debug("[Contacts] Update User Contact")
                    await this.dbContext.contact.updateContact(
                        userId,
                        updContact
                    );

                    return updateUserContactSuccess({ contact: updContact });
                }
            )
        )
    );

    routeBack$ = createEffect(
        () =>
            this.actions$.pipe(
                ofType(routeBack),
                map(()=>{
                    if (this.appEmbededStatus === 'messaging') {
                        try{
                            let index = this.previousUrl.indexOf('?')
                            if (index !== -1) {
                                let url = this.previousUrl.substring(0, index);
                                this.router.navigate([url]);
                            }else{
                                this.router.navigate([this.previousUrl]);
                            }
                        }catch(e){
                            console.log("Exceptioin on route",e)
                        }
                    }
                })
            ),
        { dispatch: false }
    );

    updateUserContactSuccess$ = createEffect(
        () =>
            this.actions$.pipe(
                ofType(updateUserContactSuccess),
                tap(({ contact: userContact }) => {
                    this.phoneService.isContactCreated.next(false);
                    const getContactNumber = cleanPhoneNumber(userContact.phones[0].phone) || cleanPhoneNumber(userContact.phones[0].orgPhone);
                    if (sessionStorage.getItem('operator') == "null") {
                        if (this.appEmbededStatus === 'messaging') {
                            // add logic to navigate the user to the same number from where the user clicked on "Edit"
                            // check if the contact in part of group
                            if(this.previousUrl.includes('?group=')){
                                // get group id from previous url
                                let group = this.previousUrl.split('?group=')[1]
                                this.router.navigate([ `/messaging/chat/${getContactNumber}/details` ], { queryParams: {group:`${group}`} })
                            }else {
                                // if contact if not part of the group route to details page of the respactive contact
                                this.router.navigate([`/messaging/chat/${this.previousUrl.split('/')[3]}/details`]);
                            }
                        
                        } else {
                            this.router.navigate(['/contacts', userContact.id]);
                        }
                    }
                    logger.debug("[Contacts] Update User Contact Success");
                })
            ),
        { dispatch: false }
    );

    createUserContactSuccess$ = createEffect(
        () =>
            this.actions$.pipe(
                ofType(createUserContactSuccess),
                filter(({ isImplicit}) => !!isImplicit),
                tap(({ contact: userContact, isFromGalContact, contactCreatedFrom }) => {
                    this.phoneService.isContactCreated.next(false);
                    const firstPhoneNumber = (userContact.phones || [])[0];
                    if (contactCreatedFrom && contactCreatedFrom =='AddedGroupParticipants') {
                        return EMPTY;
                    }
                    const getContactNumber = cleanPhoneNumber(firstPhoneNumber.phone) || cleanPhoneNumber(firstPhoneNumber.orgPhone);
                    if (firstPhoneNumber && isFromGalContact) {
                        /*
                        this.router.navigate([
                            '/messaging/chat',
                            firstPhoneNumber.phone,
                        ]);
                      */
                        if (this.appEmbededStatus === 'messaging') {
                            this.router.navigate(['/messaging/chat', getContactNumber]);
                        } else {
                            this.router.navigate(['/contacts', userContact.id]);
                        }
                    } else {
                        if (this.appEmbededStatus === 'messaging') {
                            // check if the contact in part of group
                            if(this.previousUrl.includes('?group=')) {
                                // get group id from previous url
                                let group = this.previousUrl.split('?group=')[1]
                                this.router.navigate([ `/messaging/chat/${getContactNumber}/details` ], { queryParams: {group:`${group}`} })
                            }else{
                                // if contact if not part of the group route to details page of the respactive contact
                                this.router.navigate([`/messaging/chat/${this.previousUrl.split('/')[3]}/details`]);
                            }

                        } else {
                            this.router.navigate(['/contacts', userContact.id]);
                        }
                    }
                    logger.debug("[Contacts] Create User Contact Success");
                })
            ),
        { dispatch: false }
    );

    deleteContact$ = createEffect(() =>
        this.actions$.pipe(
            ofType(deleteContact),
            switchMap(({ id, peerId }) => {
                this.getContactPeerId = peerId
                let ok = false;
                const ref = this.modalService.create({
                    nzContent: ConfirmDialogComponent,
                    nzComponentParams: {
                        titleTxt: 'Delete Contact',
                        subTitleTxt: 'Do you want to delete contact ?',
                        cancelBtnTxt: 'Cancel',
                        applyBtnTxt: 'Delete',
                        onOkAction: () => {
                            ok = true;
                        },
                    },
                    nzBodyStyle: {
                        width: '26rem',
                    },
                    nzWidth: '26rem',
                    nzFooter: null,
                });
                return ref.afterClose.pipe(map(() => ({ ok, id })));
            }),
            switchMap(({ ok, id }) => (ok ? of(id) : EMPTY)),
            withLatestFrom(this.store.select(selectIsMsGraphSyncEnabled)),
            switchMap(async ([id, isMsGraphSyncEnabled]) => {
                id = +id;
                if (isMsGraphSyncEnabled || localStorage.getItem('contactSync') == 'true') {
                    const contact = await this.dbContext.contact.findContact(
                        id
                    );
                    if (!contact || !contact.msGraphId) {
                        const error =
                            "contact not found or doesn't have msGraphId";
                        console.warn(error);
                    } else {
                        try{
                            sessionStorage.removeItem('calledRefreshSsoToken');
                            await this.msgraphService.deleteContact(
                                contact.msGraphId
                            );
                        }catch(err){
                            const errorcode = err.body ? JSON.parse(err.body).code : JSON.parse(err.code);
                            if(errorcode === "ErrorItemNotFound"){
                                logger.debug("Contact not found error in MS Graph.. so deleting in local");
                            }
                            console.log('create contact error log5::', err);
                            //if (errorcode === "InvalidAuthenticationToken") {
                                if (this.appEmbededStatus === 'messaging' && sessionStorage.getItem("isLogingViaTeams") === "true") {
                                    console.log('create contact inside log5');
                                    const refereshTokenResponse = await this.authDataAccess.refresh_token_on_expiry().toPromise();
                                    //logger.debug('refresh token response:', refereshTokenResponse);

                                    if (refereshTokenResponse.root.desc == 'Success' && refereshTokenResponse.root.sso_access_token != null) {
                                        sessionStorage.setItem('ssoToken', refereshTokenResponse.root.sso_access_token);
                                    }

                                    if (refereshTokenResponse.root.desc == 'Success' && refereshTokenResponse.root.refresh_token != null) {
                                        sessionStorage.setItem('refreshToken', refereshTokenResponse.root.refresh_token);
                                    }

                                    if (refereshTokenResponse.root.return == 13002) {
                                        this.router.navigate([
                                            '/auth/login',
                                            { info: 'timeoutExpired' },
                                        ]);
                                    } else if (sessionStorage.getItem('calledRefreshSsoToken') == undefined) {
                                        sessionStorage.setItem('calledRefreshSsoToken', 'true');
                                        logger.debug('Delete Contact from exception block');
                                        await this.msgraphService.deleteContact(
                                            contact.msGraphId
                                        );
                                    }

                                }

                            //} 
                        }
                    }
                }
                await this.dbContext.contact.removeContact(id);
                logger.debug("[Contacts] Delete Contact");
                return deleteContactSuccess({ id });
            })
        )
    );

    deleteContactSuccess$ = createEffect(
        () =>
            this.actions$.pipe(
                ofType(deleteContactSuccess),
                switchMap(() => this.store.select(selectContacts)),
                tap((contacts) => {
                    if (sessionStorage.getItem('operator') == "null") {
                        const contact = contacts[0];
                        if (contact) {
                            if (this.appEmbededStatus === 'messaging') {
                                // check if the contact in part of group
                                if (this.routerURL.includes('?group=')) {
                                    // update contact details in shared details workspace component
                                    this.router.navigate([`/messaging/chat/${this.routerURL.split('?group=')[1]}`]);
                                } else {
                                    // if contact if not part of the group route to details page of the respactive contact
                                    // update contact details in shared details workspace component
                                    if(!this.routerURL.includes('participants')){
                                        this.router.navigate([`/messaging/chat/${this.routerURL.split('/')[3]}`]);
                                    }
                                }
                            } else {
                            if(this.router.url.includes('/messaging/chat/new?id=') === false){
                                this.router.navigate(['/contacts', contact.id]);
                            }
                            }

                        } else {
                            if (this.appEmbededStatus === 'messaging') {
                                this.router.navigate(['/messaging', 'chat', this.contactDetailsPeerNumber])
                            } else {
                                this.router.navigate(['/contacts']);
                            }
                        }
                    }
                    logger.debug("[Contacts] Delete Contact Success");
                })
            ),
        { dispatch: false }
    );

    customOptInRequest$ = createEffect(() =>
        this.actions$.pipe(
            ofType(sendCustomerOptInRequest),
            switchMap(({ peerId, showConfirmPopup = true, threadId}) => {
                logger.debug('PeerId::' + peerId + ' Processing:: sendCustomerOptInRequest');
                this.getContactPeerId = peerId
                let ok = false;
                if(showConfirmPopup){
                    const ref = this.modalService.create({
                        nzContent: ConfirmDialogComponent,
                        nzComponentParams: {
                            titleTxt: 'Send Contact Opt-in',
                            subTitleTxt: 'This request permission from the contact to start messaging with WhatsApp.',
                            cancelBtnTxt: 'Cancel',
                            applyBtnTxt: 'Confirm',
                            onOkAction: () => {
                                ok = true;
                            },
                            onCancelAction: () => {
                                if (this.routerURL == '/messaging/chat/new') {
                                    if (this.loadFirstThreadMsg !== null) {
                                        this.router.navigate([`/messaging/chat/${this.loadFirstThreadMsg}`]);
                                    } else {
                                        this.router.navigate([`/messaging`]);
                                    }
                                }
                            },
                        },
                        nzClosable: false,
                        nzMaskClosable: false,
                        nzBodyStyle: {
                            width: '26rem',
                        },
                        nzWidth: '26rem',
                        nzFooter: null,
                    });
                    return ref.afterClose.pipe(map(() => ({ ok,showConfirmPopup, threadId })));
                }else{
                    ok = true;
                    return of({ ok,showConfirmPopup, threadId });
                }
                
            }),
            switchMap(({ ok, showConfirmPopup, threadId }) => (ok ? of({showConfirmPopup, threadId}) : EMPTY)),
            withLatestFrom(this.store.select(selectIsMsGraphSyncEnabled)),
            switchMap(async ([{ showConfirmPopup, threadId}, isMsGraphSyncEnabled]) => {
                try{
                    // call opt in api call here
                    const data: any = await this.messagingService.optInRequest(this.getContactPeerId);
                    let threadExists;
                    if(data.desc == "Success"){
                      threadExists = await this.dbContext.message.threadIdExistsorNot(sessionStorage.getItem('__api_identity__'), data.thread_id);
                      console.log('theadid exists data', threadExists);
                    }
                    if(data.return === 29002){
                        this.modalService.create({
                            nzContent: ConfirmDialogComponent,
                            nzComponentParams: {
                                titleTxt: 'Send Contact Opt-in',
                                subTitleTxt:
                                    data.desc,
                                applyBtnTxt: 'Ok',
                                onOkAction: () => {
                                    if (this.routerURL == '/messaging/chat/new') {
                                        if (this.loadFirstThreadMsg !== null) {
                                            this.router.navigate([`/messaging/chat/${this.loadFirstThreadMsg}`]);
                                        } else {
                                            this.router.navigate([`/messaging`]);
                                        }
                                    }
                                },
                            },
                            nzClosable: false,
                            nzMaskClosable: false,
                            nzBodyStyle: {
                                width: '26rem',
                            },
                            nzWidth: '26rem',
                            nzFooter: null,
                        });
                        // return EMPTY;
                        return contactAlreadyInConversartion();
                    }else if(threadExists){
                        console.log('came to theread exists');
                        this.modalService.create({
                            nzContent: ConfirmDialogComponent,
                            nzComponentParams: {
                                titleTxt: 'Send Contact Opt-in',
                                subTitleTxt:
                                    'Cannot create any more new chats with this contact. Please select an existing conversation.',
                                applyBtnTxt: 'Ok',
                                onOkAction: () => {
                                    this.getOptInParticipants(this.getContactPeerId)
                                },
                                //type: 'Error',
                            },
                            nzBodyStyle: {
                                width: '26rem',
                            },
                            nzWidth: '26rem',
                            nzFooter: null,
                        });
                        return contactCannotCreateNewConveration();
                    }
                    else{
                        if(showConfirmPopup){
                            if(data.messages.length != 0){
                                logger.debug('PeerId::' + data.messages[0].from + '&MsgId::' + data.messages[0].id + '&ThreadId::' + data.thread_id + ' Processing:: customerOptInSuccess');
                                //Pushing optin success msg to hash in prior receiving sip msg back to avoid
                                //showing threadid instead of peerid on UI issue until sip msg back 
                                this.store.dispatch(
                                    addIncomingSessionMessage({
                                        peerId: data.messages[0].from,
                                        messageId: data.messages[0].id,
                                        fromNum: data.messages[0].from.replace('whatsapp:', ''),
                                        content: data.messages[0].body,
                                        dateTime: serverDateToISO(data.messages[0].ts),
                                        isSystem: true,
                                        threadId: data.thread_id,
                                        parties_list: undefined,
                                        messageType: 'text',
                                        messageInfo: {},
                                        stype: 16,
                                        messageChannelType: "whatsapp"
                                    })
                                );
                            }
                            return customerOptInSuccess({
                                thread_id : data.thread_id ?  data.thread_id : null,
                                messages: data.messages ?  data.messages: [],
                                peerId: this.getContactPeerId
                            });
                        }else{
                            // if old and new threadId are different, create new thread
                            if(data.thread_id != threadId && threadId != undefined){
                                sessionStorage.setItem('thread-'+this.getContactPeerId,data.thread_id)
                                sessionStorage.setItem('CurrentThread',data.thread_id);
                                logger.debug("[Contacts] Customer opt-in reEngage Success");
                                return customerOptInReEngageSuccess({
                                    threadId : data.thread_id ?  data.thread_id : null,
                                    messages: data.messages ?  data.messages: [],
                                    peerId: this.getContactPeerId,
                                    oldThreadId: threadId
                                });
                            }else{
                                //await this.messagingService.updateSentRequestCount(threadId);
                                logger.debug("[Message] Update opt-in Request Count");
                                return updateRequestCount({
                                    threadId : data.thread_id ?  data.thread_id : null,
                                    peerId: this.getContactPeerId
                                });
                            }
                            
                        }
                       
                    }
                }catch(err){
                    logger.error('Error on optin request send::', err);
                    return customerOptInError(err);
                }
            })
        ),
    );


    loadPeerMessagesList(peerId) {
        this.peerMessages?.filter((peers) => {
            if (peers.messageChannelType != 'normalMsg') {
                peers.participants.filter((peer) => {
                    if (peer == peerId) {
                        this.messagingThreadList.push(peers);
                    }
                })
            }
        })
    }
      getOptInParticipants(peerId: string) {
        this.loadPeerMessagesList(peerId)
        if (this.messagingThreadList.length > 0) {
          this.messagingThreadList = [];
          this.modalService.create({
            nzContent: OptInWhatsappTemplateComponent,
            nzComponentParams: {
              headerTitle: 'History',
              actionBtnTitle: 'New Chat',
              waPeerId: peerId.replace('whatsapp:', ''),
            },
            nzStyle: {
              margin: '20px auto',
            },
            nzMask: true,
            nzFooter: null,
            nzClosable: false,
            nzKeyboard: false,
            nzMaskClosable: false,
            nzCentered: true,
          })
            .afterClose.pipe(
          );
        }
      }

    customerOptInSuccess$ = createEffect(
        () =>
            this.actions$.pipe(
                ofType(customerOptInSuccess),
                tap(async ({ thread_id, messages }) => {
                    logger.debug('ThreadId::' + thread_id + ' Processing:: Effect Action customerOptInSuccess');
                    const participantsArr = [];
                    if(thread_id){
                        sessionStorage.setItem('CurrentThread',thread_id);
                        messages.forEach((message) =>{
                            participantsArr.push(message.from)
                        });
                        participantsArr.push(sessionStorage.getItem('__api_identity__'));
                        const participants = participantsArr.length ? [...new Set(participantsArr)]: [];
                        const particapantsStr = participants.length ? participants.join('|') : `${sessionStorage.getItem('__api_identity__')}|${this.getContactPeerId}`;
                        await this.dbContext.message.addParticipants(sessionStorage.getItem('__api_identity__'), particapantsStr, thread_id);
                        const latestMessageTime = messages && messages.length ? messages[0].ts : Date.now();
                        await this.messagingService.addEntryInMessageThread({thread_id, messages, latestMessageTime});
                        this.router.navigate(['/messaging', 'chat', thread_id])
                    }
                })
            ),
        { dispatch: false }
    );

    customerOptInReEngageSuccess$ = createEffect(
        () =>
            this.actions$.pipe(
                ofType(customerOptInReEngageSuccess),
                switchMap(async ({ threadId, messages, peerId, oldThreadId}) => {
                    // create new thread
                    const particapantsStr =  `${sessionStorage.getItem('__api_identity__')}|${this.getContactPeerId}`;
                    await this.dbContext.message.addParticipants(sessionStorage.getItem('__api_identity__'), particapantsStr, threadId);
                    await this.messagingService.addEntryInMessageThread({
                        thread_id: threadId, 
                        messages,
                        att_status: "2",
                        lastIncommingMessageAt: new Date(),
                        seq: messages.length ? messages[0].seq : null,
                        t_created: new Date(),
                        t_read: new Date()
                    });
                    // this update sent request count in old thread
                    await this.messagingService.updateSentRequestCount(oldThreadId); 
                    // update reducer with new threadId
                    return updateThreadIdOnReEngage({
                        threadId: threadId,
                        peerId
                    })
                })
            ),
    );

    loginMsGraphSuccess$ = createEffect(() =>
        this.actions$.pipe(
            ofType(loginMsGraphSuccess),
            filter(({ resetContacts }) => resetContacts),
            map(({ resetContacts, contacts }) =>
                importFromMsGraph({ resetContacts, contacts })
            )
        )
    );

    syncMsGraphContacts$ = createEffect(() =>
        this.actions$.pipe(
            ofType(importFromMsGraph),
            withLatestFrom(this.userId$),
            switchMap(async ([{ contacts, resetContacts }, userId]) => {
                try {
                    if (contacts === 'not-loaded') {
                        const msgraphContacts = await this.msgraphService.getContacts();
                        contacts = msgraphContacts.map(mapFromMsGraphContact);
                    }
                    let existentContacts: Contact[] = null;
                    if (resetContacts) {
                        existentContacts = await this.dbContext.contact.getContacts(
                            userId
                        );
                        const removeContacts = existentContacts.filter(
                            (f) => {
                                if (f.type == 'Line' || f.type == 'WeChat') {
                                    return f
                                }
                            }
                        );

                        logger.debug('removeContacts', removeContacts);

                        if (removeContacts.length > 0) {
                            const removeIds = removeContacts.map((m) => m.id);
                            await this.dbContext.contact.removeContacts(
                                removeIds
                            );
                        }

                        // await this.dbContext.contact.removeAll(userId);
                    } else {
                        existentContacts = await this.dbContext.contact.getContacts(
                            userId
                        );
                    }
                    // contacts = contacts.filter((e) => {
                    //     if (e.phones.length > 0) {
                    //         if (e.phones[0]['phone'].match(/[0-9]/) !== null)
                    //             return e;
                    //     }
                    // });
                    const ids = await this.dbContext.contact.addOrUpdateContacts(
                        userId,
                        contacts
                    );
                    if (existentContacts) {
                        // find removed contacts
                        const removeContacts = existentContacts.filter(
                            (f) => {
                                if (f.type == 'Line' || f.type == 'WeChat') {
                                    return !f
                                } else {
                                    return !ids.includes(f.id)
                                }
                            }
                        );

                        logger.debug('removeContacts', removeContacts);

                        if (removeContacts.length > 0) {
                            const removeIds = removeContacts.map((m) => m.id);
                            await this.dbContext.contact.removeContacts(
                                removeIds
                            );
                        }
                    }
                    contacts = ids.map((id, i) => ({
                        ...(contacts[i] as Contact),
                        id,
                    }));
                    sessionStorage.removeItem('calledRefreshSsoToken');
                    return importFromMsGraphSuccess({
                        resetContacts,
                        contacts,
                    });
                } catch (error) {
                    if (sessionStorage.getItem('ssoToken') != null) {
                        const refereshTokenResponse = await this.authDataAccess.refresh_token_on_expiry().toPromise();
                        //logger.debug('refresh token response:', refereshTokenResponse);

                        if (refereshTokenResponse.root.desc == 'Success' && refereshTokenResponse.root.sso_access_token != null) {
                            sessionStorage.setItem('ssoToken', refereshTokenResponse.root.sso_access_token);
                        }

                        if (refereshTokenResponse.root.desc == 'Success' && refereshTokenResponse.root.refresh_token != null) {
                            sessionStorage.setItem('refreshToken', refereshTokenResponse.root.refresh_token);
                        }

                        if (refereshTokenResponse.root.return == 13002) {
                            this.router.navigate([
                                '/auth/login',
                                { info: 'timeoutExpired' },
                            ]);
                        } else if (sessionStorage.getItem('calledRefreshSsoToken') == undefined) {
                            sessionStorage.setItem('calledRefreshSsoToken', 'true');
                            logger.debug('calling importFromMsGraph from catch block');
                            this.store.dispatch(
                                importFromMsGraph({ resetContacts: false, contacts: 'not-loaded' })
                            );
                        }

                    }
                }
            })
        )
    );

    // when user logout from exchange reset his contacts
    exchangeLogoutSuccess$ = createEffect(() =>
        this.actions$.pipe(
            ofType(logoutMsGraph),
            filter(({ resetContacts }) => resetContacts === true),
            withLatestFrom(this.userId$),
            switchMap(async ([_, userId]) => {
                await this.dbContext.profile.resetSyncExchangeInterval(userId);
                await this.dbContext.contact.removeAll(userId);
                return deleteContactsSuccess();
            })
        )
    );

    deleteExchangeContact$ = createEffect(() =>
        this.actions$.pipe(
            ofType(deleteMSGraphContacts),
            withLatestFrom(this.userId$),
            switchMap(async ([_, userId]) => {
                console.log('Deleted MS Graph Contacts')
                await this.dbContext.profile.resetSyncExchangeInterval(userId);
                await this.dbContext.contact.removeAll(userId);
                return deleteContactsSuccess();
            })
        )
    );

    startAddToExistentContact$ = createEffect(
        () =>
            this.actions$.pipe(
                ofType(startAddToExistentContact),
                withLatestFrom(this.store.select(selectContacts)),
                switchMap(([{ mlNumber }, contacts]) =>
                    chooseContact(this.modalService, contacts).pipe(
                        map((contactId) => ({ contactId, mlNumber }))
                    )
                ),
                tap(({ mlNumber, contactId }) => {
                    if (this.appEmbededStatus === 'messaging') {
                        if (contactId) {
                            this.router.navigate([
                                '/messaging',
                                contactId,
                                'edit',
                                mlNumber,
                            ]);
                        }
                    } else {
                        if (contactId) {
                            this.router.navigate([
                                '/contacts',
                                contactId,
                                'edit',
                                mlNumber,
                            ]);
                        }
                    }
                })
            ),
        {
            dispatch: false,
        }
    );

    syncOrScheduleExchangeOnLoginSuccess$ = createEffect(() =>
        this.actions$.pipe(
            ofType(loginMsGraphSuccess),
            switchMap(() => this.store.select(selectUserId).pipe(take(1))),
            switchMap(async (userId) => {
                const settings = await this.dbContext.profile.getSettings(
                    userId
                );

                let exchangeNextSyncTime =
                    settings && settings.exchangeNextSyncTime;

                if (!exchangeNextSyncTime) {
                    logger.debug('exchangeNextSyncTime not found, reinit one');
                    // if there is no exchange settings in repo its either because fo cache cleanup or initial load
                    const exchangeSettings = await this.store
                        .select(selectUserExchangeSettings)
                        .pipe(take(1))
                        .toPromise();
                    const updateSettingsResult = await this.dbContext.profile.updateSettings(
                        userId,
                        {
                            exchange: {
                                syncInterval: exchangeSettings.syncInterval,
                            },
                        }
                    );
                    exchangeNextSyncTime =
                        updateSettingsResult.exchangeNextSyncTime;
                }

                if (exchangeNextSyncTime) {
                    return scheduleImportFromMsGraph({
                        exchangeNextSyncTime,
                    });
                } else {
                    return null;
                }
            }),
            filter((f) => !!f)
        )
    );

    scheduleExchangeOnExchangeUpdateSettings$ = createEffect(() =>
        this.actions$.pipe(
            ofType(updateUserExchangeSyncSettingsSuccess),
            // give chance to update repository
            delay(100),
            map(({ exchangeNextSyncTime }) =>
                scheduleImportFromMsGraph({ exchangeNextSyncTime })
            )
        )
    );

    scheduleImportFromMsGraph$ = createEffect(() =>
        this.actions$.pipe(
            ofType(scheduleImportFromMsGraph),
            switchMap(({ exchangeNextSyncTime }) => {
                if (exchangeNextSyncTime !== 'never') {
                    // if sync interval already passed
                    const now = new Date().getTime();
                    // give some skew
                    const diff = exchangeNextSyncTime - now - 1000;
                    const syncDate = new Date(exchangeNextSyncTime);
                    logger.debug('syncDate', syncDate, now, diff);
                    if (diff > 0) {
                        return timer(diff).pipe(
                            mapTo(
                                importFromMsGraph({
                                    resetContacts: false,
                                    contacts: 'not-loaded',
                                    isBySchedule: true,
                                })
                            )
                        );
                    } else {
                        return of(
                            importFromMsGraph({
                                resetContacts: false,
                                contacts: 'not-loaded',
                                isBySchedule: true,
                            })
                        );
                    }
                } else {
                    return NEVER;
                }
            })
        )
    );

    importFromMsGraphBySchedule = createEffect(() =>
        this.actions$.pipe(
            ofType(importFromMsGraph),
            filter(({ isBySchedule }) => isBySchedule),
            withLatestFrom(this.store.select(selectUserId)),
            switchMap(async ([_, userId]) => {
                const exchangeNextSyncTime = await this.dbContext.profile.recalculateNextSyncExchangeTime(
                    userId
                );
                return scheduleImportFromMsGraph({ exchangeNextSyncTime });
            })
        )
    );

    syncMsGraphContactsSuccessLoadPhotos$ = createEffect(() =>
        this.actions$.pipe(
            ofType(importFromMsGraphSuccess),
            switchMap(({ contacts }) => {
                const graphContacts = contacts.filter((f) => !!f.msGraphId);
                //Blocking calling getContactPhotoMeta call for now for performance check
                 const ids = graphContacts.map((m) => m.msGraphId);
                 const result$ = ids.map(async (id, i) => {
                     const contactId = graphContacts[i].id;
                     return null;
                    //  try {
                    //      const metaImg = await this.msgraphService.getContactPhotoMeta(
                    //          id
                    //      );
                    //      if (metaImg) {
                    //          const img = await this.msgraphService.getContactPhoto(
                    //              id
                    //          );
                    //          this.dbContext.contact.updateContactImage(
                    //              contactId,
                    //              img
                    //          );
                    //          return setContactImage({
                    //              img,
                    //              contactId,
                    //          });
                    //      }
                    //  } catch (err) {
                    //      console.warn(
                    //          'error while getting image from msgraph',
                    //          err
                    //      );
                    //      return null;
                    //  }
                 });
                 const merged$ = merge(...result$, 3).pipe(filter((f) => !!f));
                 return merged$;
            })
        )
    );
}
