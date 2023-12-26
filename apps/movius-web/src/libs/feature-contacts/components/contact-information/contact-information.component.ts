import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Contact } from '@movius/domain';
import { Store } from '@ngrx/store';
import { combineLatest, Observable, of } from 'rxjs';
import { distinctUntilChanged, map, switchMap } from 'rxjs/operators';
import {
    CallingStatus,
    cleanPhoneNumber,
    getContactFriendlyAddress,
    getContactFriendlyName,
    getCallNowPayload,
    MessagingStatus,
    selectCallingStatus,
    selectMessagingStatus,
    toView,
    DbContext,
    SipUserService,
    PhoneNumberService,
    getPeerNumberWOSpecialChars,
    isEmergencyNumber,
    isHighZoomedScreen,
    addPulsToMultilineNumber,
} from '../../../shared';
import {
    createUserContact,
    deleteContact,
    selectContactAsIs,
    updateUserContact,
    sendCustomerOptInRequest
} from '../../ngrx';
import { selectHash, selectPeersMessages } from './../../../feature-messaging/ngrx/selectors';
import * as lpn from 'google-libphonenumber';
import { Country } from '../../../shared/components/country-selector/model/country.model';
import { CountryCode } from '../../../shared/components/country-selector/model/country-code';
import { selectContacts } from './../../ngrx/selectors';
import { NzModalService } from 'ng-zorro-antd/modal';
import { OptInWhatsappTemplateComponent } from '../../../feature-messaging/components/optIn-whatsapp-template/optIn-whatsapp-template.component';
import { SipService } from '@scalio/sip';
import { uniqBy } from 'lodash/fp';
export interface ContactInformationView {
    contact: Contact;
    info: { [key: string]: string };
    callingStatus: CallingStatus;
    messagingStatus: MessagingStatus;
}

@Component({
    selector: 'movius-web-contact-information',
    templateUrl: './contact-information.component.html',
    styleUrls: ['./contact-information.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ContactInformationComponent implements OnInit {
    readonly view$: Observable<ContactInformationView>;
    allCountries: Array<Country> = [];
    phoneUtil: any = lpn.PhoneNumberUtil.getInstance();
    uiContactSelectorInput: string;
    uiContactSelectorCountryCode: string;
    e911UserStatus: any;
    callingStatus_tmp: CallingStatus;
    callingStatus: CallingStatus;
    getConnectionErrorValue: any;
    savedContacts = [];
    hashedRecords: any  = [];
    peerMessages: any;
    messagingThreadList: any = [];

    constructor(
        activatedRouter: ActivatedRoute,
        private readonly store: Store,
        private readonly router: Router,
        private readonly userService: SipUserService,
        private countryCodeData: CountryCode,
        private phoneNumberService: PhoneNumberService,
        private readonly dbContext: DbContext,
        private readonly modalService: NzModalService,
        readonly sipService: SipService,
    ) {
        const peerMessages$ = store
            .select(selectPeersMessages(sipService.getUserUri))
            .pipe(
                map((m) => m.filter((f) => f.messages.length > 0))
            );
        peerMessages$.subscribe(peers => {
            if (peers.length > 0) {
                this.peerMessages = peers;
            }
        });
        this.store.select(selectHash).subscribe((res=>{
            this.hashedRecords  = res;
        }))
        const contact$ = activatedRouter.params.pipe(
            switchMap((val) => {
                // const currentNavigation = this.router.getCurrentNavigation();
                // router.getCurrentNavigation(); is not working on next tick ?
                const contact = window.history?.state?.contact;
                return contact
                    ? of(contact)
                    : store.select(selectContactAsIs(+val?.id));
            })
        );

        const callingStatus$ = store.select(selectCallingStatus);
        const messagingStatus$ = store.select(selectMessagingStatus);

        this.view$ = combineLatest([
            callingStatus$,
            messagingStatus$,
            contact$,
        ]).pipe(
            map(([callingStatus, messagingStatus, userContact]) => {
                const info = toView(userContact);
                this.callingStatus_tmp = callingStatus;
                return {
                    info,
                    contact: userContact,
                    messagingStatus,
                    callingStatus,
                    whatsAppMessageEnabled:sessionStorage.getItem('__enable_whatsapp_message__') ==="true"
                };
            })
        );
        store.select(selectContacts).subscribe(resp =>{
            this.savedContacts = resp;
        })
    }

    ngOnInit(): void {
        this.getCountries();
        const userInfo = this.userService.user;
        this.uiContactSelectorInput = this.phoneNumberService.getUserCountryCode(userInfo);
        this.uiContactSelectorCountryCode = this.phoneNumberService.getUserCountryName(userInfo);
        sessionStorage.setItem('operator', null);
    }

    onDelete(id: number, peerId:string) {
        this.store.dispatch(deleteContact({ id, peerId }));
    }

    async onWhatsAppMessage(id: number, peerId:string) {
        this.getOptInParticipants(peerId);
    }

    loadPeerMessagesList(peerId) {
        this.peerMessages?.filter((peers) => {
            if (peers.messageChannelType != 'normalMsg') {
                peers.participants.filter((peer) => {
                    if (peer == `whatsapp:${cleanPhoneNumber(peerId)}`) {
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
                    waPeerId: peerId,
                    showActionBtns: true,
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
        } else {
            const peerIdVal = `whatsapp:${cleanPhoneNumber(peerId)}`;
            this.store.dispatch(sendCustomerOptInRequest({ peerId: peerIdVal }));
        }
    }

    onCall(contact: Contact, phone: string) {
        let internationalNumber = '';
        if (isEmergencyNumber(phone)) {
            internationalNumber = phone;
        } else {
            phone = getPeerNumberWOSpecialChars(phone);
            if (!phone.startsWith('+')) {
                sessionStorage.setItem('operator', 'call');
                //internationalNumber = this.getInternationalNumber('8054336693');
                internationalNumber = this.getInternationalNumber(phone);
            } else {
                internationalNumber = phone;
            }
        }
        if (contact.type === 'organization' && contact.msGraphId) {
            if (getPeerNumberWOSpecialChars(internationalNumber) !== getPeerNumberWOSpecialChars(contact.phones[0].phone))
                sessionStorage.setItem("exDirContIntNum", internationalNumber);
                const buinessPhone =  contact.phones && contact.phones[0] ? cleanPhoneNumber(contact.phones[0].phone) :null;
                const contactAlreadySaved = this.savedContacts.find(obj => obj.phones && obj.phones[0] && obj.phones[0].phone == buinessPhone);
                if(!contactAlreadySaved){
                    this.store.dispatch(
                        createUserContact({ contact, isImplicit: false })
                    );
                }
                setTimeout(() => {
                    this.router.navigate(
                        ['calling', 'call', cleanPhoneNumber(internationalNumber)],
                        {
                            state: { data: getCallNowPayload() },
                        }
                    );
                }, 500);
        } else {
            this.router.navigate(['calling', 'call', cleanPhoneNumber(internationalNumber)], {
                state: { data: getCallNowPayload() },
            });
        }
    }

    onMessage(contact: Contact, phone: string, whatsAppThread:boolean = false) {
        let peerId = `${cleanPhoneNumber(phone)}`
        const peerIdVal = `${cleanPhoneNumber(phone)}`;
            for(let i in this.hashedRecords){
                if(this.hashedRecords[i].peerId === peerIdVal){
                    peerId = this.hashedRecords[i].peerId;
                }
              }
        sessionStorage.setItem('participants', null);
        let internationalNumber = '';
        if (isEmergencyNumber(phone)) {
            internationalNumber = phone;
        } else {
            phone = getPeerNumberWOSpecialChars(phone);
            if (!phone.startsWith('+')) {
                sessionStorage.setItem('operator', 'msg');
                //internationalNumber = this.getInternationalNumber('8054336693');
                internationalNumber = this.getInternationalNumber(phone);
            } else {
                internationalNumber = phone;
            }
        }
        if (contact.type === 'organization' && contact.msGraphId) {
            if (contact.phones && contact.phones[0] && getPeerNumberWOSpecialChars(internationalNumber) !== getPeerNumberWOSpecialChars(contact.phones[0].phone))
                sessionStorage.setItem("exDirContIntNum", internationalNumber);
            // assumming business phone is at 0 index
            const buinessPhone =  contact.phones && contact.phones[0] ? cleanPhoneNumber(contact.phones[0].phone) :null;
            const contactAlreadySaved = this.savedContacts.find(obj => obj.phones && obj.phones[0] && obj.phones[0].phone == buinessPhone);
            if(!contactAlreadySaved){
                this.store.dispatch(
                    createUserContact({ contact, isImplicit: false })
                );
            }
            setTimeout(() => {
                this.router.navigate([
                    '/messaging',
                    'chat',
                    peerId,
                ]);
            }, 500);
        } else {
            if(whatsAppThread){
                internationalNumber = `whatsapp:${internationalNumber}`
            }
            this.router.navigate([
                '/messaging',
                'chat',
                peerId,
            ]);
        }
    }

    async onEdit(contact: Contact) {
        if (contact.type === 'personal') {
            this.router.navigate(['contacts', contact.id, 'edit']);
        } else {
            sessionStorage.setItem("addContactfromExchange", "true");
            this.router.navigate(['/contacts', 'add'], {
                state: { originContact: contact },
            });
        }
    }

    checkValidNumornot(phnnum){
        let isnum = /^[\d\(\)\-\+\s]+$/.test(phnnum);
        if(isnum){
            return false;
        } else {
            return true;
        }
    }

    disableIfNotValidNum(phn){
        
        let isnumt = /^[\d\(\)\-\+\s]+$/.test(phn);
        if(isnumt){
            return 'cntInfo__dropMenuItem';
        } else {
            return 'cntInfo__dropMenuItem-disabled';
        }
        
    }

    public getCountries() {
        this.allCountries = [];

        this.countryCodeData.allCountries.forEach((c) => {
            const country: Country = {
                name: c[0].toString(),
                iso2: c[1].toString(),
                dialCode: c[2].toString(),
                priority: +c[3] || 0,
                areaCodes: (c[4] as string[]) || undefined,
                htmlId: `iti-0__item-${c[1].toString()}`,
                flagClass: `iti__${c[1].toString().toLocaleLowerCase()}`,
                placeHolder: '',
            };

            this.allCountries.push(country);
        });
    }

    public getCountryIsoCode(
        countryCode: number,
        number: lpn.PhoneNumber
    ): string | undefined {
        // Will use this to match area code from the first numbers
        const rawNumber = number['values_']['2'].toString();
        // List of all countries with countryCode (can be more than one. e.x. US, CA, DO, PR all have +1 countryCode)
        const countries = this.allCountries.filter(
            (c) => c.dialCode === countryCode.toString()
        );
        // Main country is the country, which has no areaCodes specified in country-code.ts file.
        const mainCountry = countries.find((c) => c.areaCodes === undefined);
        // Secondary countries are all countries, which have areaCodes specified in country-code.ts file.
        const secondaryCountries = countries.filter(
            (c) => c.areaCodes !== undefined
        );
        let matchedCountry = mainCountry ? mainCountry.iso2 : undefined;

        /*
            Iterate over each secondary country and check if nationalNumber starts with any of areaCodes available.
            If no matches found, fallback to the main country.
        */
        secondaryCountries.forEach((country) => {
            country.areaCodes.forEach((areaCode) => {
                if (rawNumber.startsWith(areaCode)) {
                    matchedCountry = country.iso2;
                }
            });
        });

        return matchedCountry;
    }

    public getInternationalNumber(phone: string): string {
        try {
            let number = this.phoneUtil.parse('+' + phone, "");
            const countryName = this.getCountryIsoCode(number.getCountryCode(), number);
            //let code = this.phoneUtil.parse('+' + phone, countryName);
            let internationalNumber = this.phoneUtil.format(number, lpn.PhoneNumberFormat.INTERNATIONAL);
            console.log('International Number : ', internationalNumber);
            console.log('isValidNumber', this.phoneUtil.isValidNumber(number));
            console.log('isPossibleNumber', this.phoneUtil.isPossibleNumber(number));

            if (!this.phoneUtil.isPossibleNumber(number)) {
                let validNumber = this.phoneUtil.parse(this.uiContactSelectorInput + phone, this.uiContactSelectorCountryCode);
                internationalNumber = this.phoneUtil.format(validNumber, lpn.PhoneNumberFormat.INTERNATIONAL);
                this.updateContact(phone, internationalNumber);
            } else {
                if (!this.phoneUtil.isValidNumber(number)) {
                    let validNumber = this.phoneUtil.parse(this.uiContactSelectorInput + phone, this.uiContactSelectorCountryCode);
                    internationalNumber = this.phoneUtil.format(validNumber, lpn.PhoneNumberFormat.INTERNATIONAL);
                    this.updateContact(phone, internationalNumber);
                }
            }

            if (internationalNumber != null) {
                return internationalNumber;
            }
        } catch (ex) {
            let validNumber = this.phoneUtil.parse(this.uiContactSelectorInput + phone, this.uiContactSelectorCountryCode);
            let internationalNumber = this.phoneUtil.format(validNumber, lpn.PhoneNumberFormat.INTERNATIONAL);
            console.log('International Number2 : ', internationalNumber);
            this.updateContact(phone, internationalNumber);
            return internationalNumber;
        }

        return phone;
    }

    async updateContact(phone: any, internationalNumber: any) {
        const contact = await this.dbContext.contact.updateContactForNumberFormat(phone, getPeerNumberWOSpecialChars(internationalNumber));
        if (contact !== null) {
            const id = contact.id;
            this.store.dispatch(
                updateUserContact({ contact: { ...contact, id } })
            );
        }
    }

    getContactFriendlyName = getContactFriendlyName;

    getContactFriendlyAddress = getContactFriendlyAddress;

    addPulsToMultilineNumber = addPulsToMultilineNumber;

    get disbaledCallButton() {
        this.e911UserStatus = sessionStorage.getItem("_USER_E911_STATUS_");
        // console.log("ContactInformationView::: e911UserStatus:::" + this.e911UserStatus);
        // console.log("ContactInformationView::: callingStatus_tmp:::" + this.callingStatus_tmp);
        if (this.e911UserStatus === 'disabled') {
            return this.callingStatus !== 'allowed';
        }
        if (this.e911UserStatus === "enabled_accepted" &&
            this.callingStatus === 'allowed') {
            return false;
        } else {
            return true;
        }
    }

    public getConnectionError(event: any) {
        this.getConnectionErrorValue = event;
        if (event == true) {
            this.callingStatus_tmp = 'network-error'
        } else {
            this.callingStatus_tmp = null;
            return this.callingStatus;
        }
    }

    async onWeChatOrLine(contact, messageChannelType) {
        if (messageChannelType == 'Line') {
            this.onLineMessage(contact)
        } else if (messageChannelType == 'WeChat'){
            this.onWeChatMessage(contact)
        }
    }

    onLineMessage(contact: any) {
        this.modalService.create({
            nzContent: OptInWhatsappTemplateComponent,
            nzComponentParams: {
                headerTitle: 'History',
                actionBtnTitle: 'New Chat',
                waPeerId: contact.phones[0].phone,
                showActionBtns: false,
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

    onWeChatMessage(contact: any) {
        this.modalService.create({
            nzContent: OptInWhatsappTemplateComponent,
            nzComponentParams: {
                headerTitle: 'History',
                actionBtnTitle: 'New Chat',
                waPeerId: contact.phones[0].phone,
                showActionBtns: false,
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
