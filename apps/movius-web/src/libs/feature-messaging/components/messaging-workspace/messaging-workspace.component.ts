import {
    ChangeDetectionStrategy,
    ChangeDetectorRef,
    Component,
    OnChanges,
    SimpleChanges,
    OnDestroy,
    OnInit,
    Input,
    EventEmitter,
    Output,
    HostListener,
} from '@angular/core';
import { ActivatedRoute, NavigationEnd, Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { SipService } from '@scalio/sip';
import { uniqBy, sortBy, equals } from 'lodash/fp';
import { BehaviorSubject, combineLatest, Observable, of, Subject } from 'rxjs';
import {
    distinctUntilChanged,
    filter,
    map,
    skipUntil,
    startWith,
    take,
    tap,
    debounceTime,
    switchMap,
    distinct,
} from 'rxjs/operators';
import { UserContact, selectContactGhosts } from '../../../feature-contacts';
import {
    AuthService,
    DateTimeService,
    DbContext,
    filterState,
    GeneralFailureType,
    MessagingStatus,
    selectMessagingStatus,
    selectTransportStatus,
    cleanPhoneNumber,
    mapFromMsGraphPerson,
    getFeatureEnabled,
    reloadUserCheck,
    selectFeatures,
} from '../../../shared';
import {User} from '../../../shared/models/user'
import { setSearchText } from './../../ngrx/actions';
import { PeerMessagingState } from '../../models';
import { loadNextHistory, selectPeersMessages, selectPeersMessagesIsLoaded } from '../../ngrx';
import { MessagingService } from '../../services/messaging.service';
import { LoggerFactory } from '@movius/ts-logger';
import { MessagingDataAccessService } from '../../services';
import { MMSService } from '../../services/mms.service';
import { PeerCallingState } from '../../../feature-calling/models';
import { MSGraphService } from '@movius/msgraph';
import { Contact, NewContact } from '@movius/domain';
import { startCreateUserContact } from '../../ngrx';
import {PhoneNumberService} from '../../../shared/services/phone-number.service';
import {SipUserService} from '../../../shared/services/sip-user.service'
import { selectPeersCallingStates } from '../../../feature-calling/ngrx';
import { MobileUiService } from '../../services/mobile-ui.service';
import { AuthDataAccessService } from '../../../shared/services/auth.data-access.service';
const logger = LoggerFactory.getLogger('');

const sortContact = (contact: Contact) => {
    const fullName = [contact.firstName !== null ? contact.firstName?.trim() : contact.firstName,
    contact.lastName !== null ? contact.lastName?.trim() : contact.lastName].join(' ');
    return fullName.toLowerCase().trim() || 'zzzzzzzzzzzzzzzzzzz';
};

//TODO: CB30Jul2021: TECH-DEBT: Refactor to use shared search funtion filterNameOrPhone in shared/filter-utils
const filterContactsSingleWord = (contacts: Contact[], search: string) => {
    if (search) {
        const search1 = search.toLowerCase();
        const search2 = search1.replace(/^\+/, '');
        return contacts.filter(
            (f) =>
                f.firstName?.trim().toLowerCase().startsWith(search1) ||
                f.lastName?.trim().toLowerCase().startsWith(search1) ||
                (f.firstName?.trim() + ' ' + f.lastName?.trim())
                    ?.trim()
                    ?.toLowerCase()
                    ?.includes(search1) ||
                f.phones.some((m) => {
                    const phone = cleanPhoneNumber(m?.phone);
                    const filtSearch = cleanPhoneNumber(search2);
                    return phone?.includes(filtSearch);
                })
        );
    } else {
        return contacts;
    }
};

const filterContacts = (contacts: Contact[], search: string) => {
    if (!search) {
        return contacts;
    } else {
        const terms = (search || '').split(' ').filter((f) => !!f);
        if (terms.length > 1) {
            // return filterContactsDoubleWord(contacts, terms[0], terms[1]);
            return filterContactsSingleWord(contacts, search);
        } else {
            return filterContactsSingleWord(contacts, search);
        }
    }
};

const aggrigateDuplicate = (filteredContacts:any[])=>{
    return filteredContacts.filter((object,index,self)=>{
        return self.findIndex((obj)=> obj.firstName == object.firstName && obj.lastName == object.lastName) === index
    });
}

const calcScreenHeight = () => {
    return 'innerHeight' in window
        ? window.innerHeight
        : document.documentElement.offsetHeight;
};

const calcSectionHeight = (elementsCount: number) => {
    return elementsCount * 64;
};

const calcMultiSectionHeight = (
    screen: number,
    totalLength: number,
    sectionCount: number
) => {
    const elemsHeight = calcSectionHeight(totalLength);
    return elemsHeight > screen ? screen / sectionCount : elemsHeight;
};

const calcViewportHeight = (
    privLength: number,
    galLength: number,
    freqLength: number
) => {
    const screenHeight = calcScreenHeight();
    if (privLength > 0 && galLength > 0 && freqLength > 0) {
        return calcMultiSectionHeight(
            screenHeight,
            privLength + galLength + freqLength,
            3
        );
    } else if (privLength > 0 && galLength > 0 && freqLength === 0) {
        return calcMultiSectionHeight(screenHeight, privLength + galLength, 2);
    } else if (privLength > 0 && galLength === 0 && freqLength > 0) {
        return calcMultiSectionHeight(screenHeight, privLength + freqLength, 2);
    } else if (privLength > 0 && galLength === 0 && freqLength === 0) {
        return calcMultiSectionHeight(screenHeight, privLength, 1);
    } else if (privLength === 0 && galLength > 0 && freqLength > 0) {
        return calcMultiSectionHeight(screenHeight, galLength + freqLength, 2);
    } else if (privLength === 0 && galLength > 0 && freqLength === 0) {
        return calcMultiSectionHeight(screenHeight, galLength, 1);
    } else if (privLength === 0 && galLength === 0 && freqLength > 0) {
        return calcMultiSectionHeight(screenHeight, freqLength, 1);
    } else {
        return calcMultiSectionHeight(screenHeight, screenHeight, 1);
    }
};

export interface MessagingWorkspaceView {
    contacts?: any[];
    galContacts?: any[];
    sessions: PeerMessagingState[];
    status: MessagingStatus;
    isSearchBarActivated: boolean;
    showEmptyListPlaceholder: boolean;
    generalFailure?: string;
    generalFailureType?: GeneralFailureType;
    viewPortHeights: {
        contactsLength: number;
        galContactsLength: number;
        conversationsLength: number;
    };
}

@Component({
    selector: 'movius-web-messaging-workspace',
    templateUrl: './messaging-workspace.component.html',
    styleUrls: ['./messaging-workspace.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MessagingWorkspaceComponent implements OnChanges, OnDestroy {
    private readonly destroy$ = new Subject();
    private readonly search$ = new BehaviorSubject<string>(null);
    readonly searchBarActivated$ = new BehaviorSubject(false);
    readonly view$: Observable<MessagingWorkspaceView>;
    readonly peers$: Observable<UserContact[]>;
    threadIdvalue: any;
    chatHeight = false;

    savedContact: any = [];
    peerids = [];
    getConnectionErrorValue: any;
    appEmbededStatus: string;
    contentIdValue: any;
    matchedMsgCount: number = 0;
    matchedMsgElements: any = [];
    mmelemtnstest: any = [];
    newName: number;
    msgHavingInbtwText: any = [];
    searchText: string = '';
    cachedGalContacts = {};
    isWhatsAppEnabledByOrg =
        sessionStorage.getItem('__enable_whatsapp_message__') === 'true';
    isMobileDevice: Boolean = false;
    classesForList: any = {};
    classesForMsgHistory: any = {};
    stylesForList: any = {};
    stylesForMsgHistory: any = {};
    isHideChatList: boolean = false;
    isHideChatHistory: boolean = false;
    galContactsCalledAfterRefreshingToken: boolean = false;
    stateData: any;

    backClickCount:number = 0;

    conversations: any = [];

    composeMessageType: any;
    popOverContent: string = "Location permission is required for texting 911. Please enable and reload the application.";
    isLocationEnabled: string;
    teamsLocationEnabled: boolean;
    is911Message:string;
    showHeader: boolean = false;
    isCollapsed = false;
    feature: any;
    MuteinboundCallAndMsgSound: boolean = false;
    loadedThread:boolean=true;


    constructor(
        public router: Router,
        public activatedRoute: ActivatedRoute,
        private readonly store: Store,
        private readonly dateTimeService: DateTimeService,
        sipService: SipService,
        private readonly dbContext: DbContext,
        private readonly messagingService: MessagingService,
        private authService: AuthService,
        private readonly authDataAccess: AuthDataAccessService,
        private messagingDataAccessService: MessagingDataAccessService,
        private mmsService: MMSService,
        private readonly msGraphService: MSGraphService,
        private mobileUiService: MobileUiService,
        private cd: ChangeDetectorRef,
        private readonly sipUserService: SipUserService,
        private phoneNumberService: PhoneNumberService,

    ) {
        this.mobileUiService.startSaveHistory();
        this.isMobileDevice = ((sessionStorage.getItem('Contex_res')?.toLowerCase() === "ios") || (sessionStorage.getItem('Contex_res')?.toLowerCase() === "android"))
            ? true : false;
        this.mobileUiService.hideChatListSubject.subscribe((val) => {
            this.isHideChatList = val;
            this.cd.markForCheck();
        });
        this.mobileUiService.hideChatHistorySubject.subscribe((val) => {
            this.isHideChatHistory = val;
            this.cd.markForCheck();
        });

        if (sessionStorage.getItem('callAndMsgMuteStatus') !== null) {
            this.MuteinboundCallAndMsgSound =
                sessionStorage.getItem('callAndMsgMuteStatus') === 'true'
                    ? true
                    : false;
        } else {
            sessionStorage.setItem('callAndMsgMuteStatus', 'false');
        }
        this.authService.onComposeMessageTypeSelected.subscribe(type => {
            this.composeMessageType = type;
          })

          this.messagingService.isLocationEnabled.subscribe((res:any) => {
            this.isLocationEnabled = res;
        });

        this.messagingService.isTeamsLocationEnabled.subscribe((res: any) => {
            this.teamsLocationEnabled = res;
        });

        this.messagingService.is911Message.subscribe((res: any) => {
            this.is911Message = res;
        });

        this.messagingDataAccessService.ThreadLazyLoaded.subscribe((res)=>{
            this.loadedThread = res
        })
        // if (!this.isMobileDevice) {
        //     this.showHideListAndChatHistoryTwo();
        // }
        if (this.isMobileDevice) {
            this.showHideChatHistory();
        } else {
            //console.log('else showhidechatlist');

            this.showHideChatList();
        }
        this.showHideListAndChatHistory();
        logger.debug('Messaging workspace Called');
        this.appEmbededStatus = getFeatureEnabled();
        const peerMessages$ = store
            .select(selectPeersMessages(sipService.getUserUri))
            .pipe(
                map((m) => m.filter((f) => f.messages?.length > 0 && f.peerId != '' && f.peerId != undefined)),
                map((m) => uniqBy((x) => x.threadId, m))
            );
        peerMessages$.subscribe((peers) => {
            logger.debug('General:: Total No of Msg Threads::', peers.length);
            if (peers.length > 0) {
                this.peerids = peers;
            }
        });

        const status$ = store.select(selectMessagingStatus);

        const isLoaded$ = store
            .select(selectPeersMessagesIsLoaded)
            .pipe(startWith(false));

        const messageLoaded$ = store
        .select(selectPeersMessagesIsLoaded)

        messageLoaded$.subscribe((res)=>{
            if(res){
                this.authDataAccess.loaderSpinnerEvent(false);
                setTimeout(() => {
                    this.authDataAccess.appLoaded.next(true);
                }, 200);

            }
        })

        const isChatRouter$ = router.events.pipe(
            filter((f) => f instanceof NavigationEnd),
            map((m: NavigationEnd) => {
                return m.url.indexOf('/chat/') !== -1;
            }),
            startWith(router.url.indexOf('/chat/') !== -1)
        );

        const showEmptyListPlaceholder$ = combineLatest([
            peerMessages$,
            isLoaded$,
            isChatRouter$,
        ]).pipe(
            map(
                ([sessions, isLoaded, isChatRouter]) =>
                    !isChatRouter && isLoaded && sessions.length === 0
            ),
            distinctUntilChanged()
        );
        const galSearch$ = new BehaviorSubject([]);
        this.search$
            .pipe(debounceTime(400), distinctUntilChanged())
            .subscribe((term) => {
                let regExp = /^\D+$/g; // allow non digit searh only
                let canSearch = regExp.test(term);
                if (canSearch && term && term.length > 1) {
                    const cachedTerm = term;
                    if (!this.cachedGalContacts[cachedTerm]) {
                        this.getGalContacts(cachedTerm)
                            .then((val) => {
                                this.cachedGalContacts[cachedTerm] = val;
                                galSearch$.next(val);
                            })
                            .catch(() => galSearch$.next([]));
                    } else {
                        galSearch$.next(this.cachedGalContacts[cachedTerm]);
                    }
                } else {
                    galSearch$.next([]);
                }
            });

            store.select(selectFeatures).subscribe((features)=>{
                this.feature =
                {
                    "isE911Available":
                    features.e911Status === 'enabled_accepted' ||
                    features.e911Status === 'enabled_declined',
                }

            })

        this.view$ = (combineLatest as any)([
            peerMessages$,
            this.search$,
            galSearch$,
            status$,
            showEmptyListPlaceholder$,
            this.searchBarActivated$,
            store.select(selectTransportStatus),
        ]).pipe(
            distinctUntilChanged(equals),
            map(
                ([
                    state,
                    search,
                    galContacts,
                    status,
                    showEmptyListPlaceholder,
                    isSearchBarActivated,
                    transportStatus,
                ]) => {
                    this.stateData = state;
                    let filterMldtGroup = [];
                    let filterWaGroup = [];
                    let savedWAUsers = [];
                    let filterSearchData = [];
                    // filter data in participants array from state based on search
                    /*state?.forEach((res: any) => {
                        res?.participants?.forEach((re: any) => {
                            if (re?.includes(search)) {
                                filterSearchData.push(res);
                            }
                        });
                    });*/
                    // separate MLDT group and WA group from filtered data
                    filterMldtGroup = filterSearchData.filter((res: any) => { return res.messageChannelType == 'normalMsg' && res.isGroup === true });
                    filterWaGroup = filterSearchData.filter((res: any) => { return res.messageChannelType != 'normalMsg' && res.isGroup === true });

                    if (search?.length > 1) {
                        if (filterSearchData?.length >= 1) {
                            let whatsAppUser = [];
                            let normalUser = [];
                            filterSearchData.forEach((res: any) => {
                                // search for 1:1 WA thread
                                if (res.messageChannelType != 'normalMsg' && res.isGroup === false) {
                                    // whatsAppUser = filterState(state, 'whatsapp:' + search, this.savedContact, true).map(obj => obj.peer.multiLine.includes('whatsapp') ? this.getObject(obj) : obj)
                                    whatsAppUser = filterSearchData.filter((res: any) => { return res.messageChannelType != 'normalMsg' && res.isGroup === false });
                                }
                                // search for 1:1 MLDT thread
                                else if (res.messageChannelType == 'normalMsg' && res.isGroup === false) {
                                    normalUser = filterState(state, search, this.savedContact, true).map(obj => obj.peer?.multiLine.includes('whatsapp') ? this.getObject(obj) : obj)
                                }
                            });
                            // get filtered data for all search
                            let finalSearchResult = [...whatsAppUser, ...normalUser, ...filterMldtGroup, ...filterWaGroup];
                            // remove duplicate enties from search result
                            this.conversations = [...new Map(finalSearchResult.map((m) => [m.threadId, m])).values()];

                        }
                        // search for saved contact
                        else if (filterSearchData?.length === 0) {
                            // get filtered data for saved contact
                            let searchSavedContact = filterState(state, search, this.savedContact, true).map(obj => obj.peer.multiLine.includes('whatsapp') ? this.getObject(obj) : obj)

                            // find the if the contact is saved
                            searchSavedContact?.forEach((res: any) => {
                                if (res?.messageChannelType != 'normalMsg' && res?.isGroup === false && res?.peer?.contact?.firstName && res?.peer?.contact?.lastName) {
                                    // get detail for WA user
                                    let waUser = [];
                                    waUser.push({
                                        firstName: res?.peer?.contact?.firstName,
                                        isMuted: res?.isMuted,
                                        lastName: res?.peer?.contact?.lastName,
                                        messages: [],
                                        newCount: 0,
                                        peer: res?.peer,
                                        phones: [],
                                        threadId: res?.threadId
                                    });
                                    // remove duplicate entries if any
                                    //savedWAUsers = [...new Map(waUser?.map((m) => [m?.threadId, m])).values()];
                                }
                            });
                            // find messages in conversation
                            let messageConversation = [];
                            searchSavedContact?.forEach((res: any) => {
                                // check messages for 1:1 WA thread
                                if (res?.messageChannelType != 'normalMsg' && res?.isGroup === false) {
                                    res?.messages?.forEach((resData: any) => {
                                        if (resData?.content?.toLowerCase().trim().includes(search.toLowerCase())) {
                                            messageConversation.push(res);
                                        }
                                    });
                                }
                                // check messages for 1:1 MLDT thread
                                else if (res?.messageChannelType == 'normalMsg' && res?.isGroup === false) {
                                    res?.messages?.forEach((data: any) => {
                                        if (data?.content?.toLowerCase().trim().includes(search.toLowerCase())) {
                                            messageConversation.push(res);
                                        }
                                    });
                                }
                                // check messages for WA group thread
                                else if (res?.messageChannelType != 'normalMsg' && res?.isGroup === true) {
                                    res?.messages?.forEach((reData: any) => {
                                        if (reData?.content?.toLowerCase().trim().includes(search.toLowerCase())) {
                                            messageConversation.push(res);
                                        }
                                    });
                                }
                                // check messages for 1MLDT group thread
                                else if (res?.messageChannelType == 'normalMsg' && res?.isGroup === true) {
                                    res?.messages?.forEach((record: any) => {
                                        if (record?.content?.toLowerCase().trim().includes(search.toLowerCase())) {
                                            messageConversation.push(res);
                                        }
                                    });
                                }
                            });
                            // Remove duplicate entries while searching for saved contact
                            this.conversations = [...new Map(messageConversation?.map((m) => [m.threadId, m])).values()];
                        }
                    }
                    // get all data if there is no value in search
                    else {
                        this.conversations = filterState(state, search, this.savedContact, true).map(obj => obj.peer?.multiLine.includes('whatsapp') ? this.getObject(obj) : obj)
                    }


                    if(this.conversations.length == 1){
                        // commenting the code below as it doesn't work if the contact has WA Conversation as well as MLDT Conversation with the same number
                        //this.callFirstConv();
                    }
                    const contactsArr = search && search.length > 1 ? this.savedContact.map(con => ({
                        isMuted: false,
                        messages: [],
                        newCount: 0,
                        peer: con,
                        firstName: con.firstName,
                        phones: con.contact.phones,
                        lastName: con.lastName,
                    })) : [];
                    const contactForFilterContacts = contactsArr.length ? filterContacts(
                        contactsArr,
                        search
                        ) : [];

                    let filteredPrivateContacts = [...contactForFilterContacts, ...savedWAUsers]
                    filteredPrivateContacts = aggrigateDuplicate(filteredPrivateContacts)

                    const nonEmptyContacts = galContacts.length ? galContacts.filter(contact => contact.phones && contact.phones[0] && contact.phones[0].phone ): [];
                    const galContactArray:any = search && search.length > 1 && nonEmptyContacts.length ?  nonEmptyContacts.map(con => ({
                       ...con,
                       newCount: 0,
                       peer: {
                        multiLine: cleanPhoneNumber(con.phones[0].phone),
                        firstName: con.firstName,
                        lastName: con.lastName,
                        name: `${con.firstName} ${con.lastName}`
                       },
                    })): [];
                    const filteredGalContacts = galContactArray.length ? filterContacts(
                        galContactArray,
                        search
                    ) : [];
                    const isEmptySearch =
                    isSearchBarActivated &&
                    filteredPrivateContacts.length === 0 &&
                    this.conversations.length === 0 &&
                    filteredGalContacts.length === 0;
                    const res = {
                        contacts: filteredPrivateContacts.filter((c) => c.peer?.contact?.type == 'personal' || c.peer?.contact?.type == 'organization'),
                        galContacts: filteredGalContacts,
                        isEmptySearch: isEmptySearch,
                        sessions: this.conversations,
                        status,
                        showEmptyListPlaceholder,
                        isSearchBarActivated,
                        generalFailure: this.getTransportStatus(
                            transportStatus
                        ),
                        generalFailureType: (transportStatus == 'disconnected'
                            ? 'NoConnection'
                            : 'Common') as GeneralFailureType,
                        viewPortHeights: (() => {
                            const contactLength =
                                filteredPrivateContacts.length;
                            const galLength = galContacts.length;
                            const conversationsLength = this.conversations.length;
                            const maxHeight = calcViewportHeight(
                                contactLength,
                                conversationsLength,
                                galLength
                            );
                            const contactHeight = calcSectionHeight(
                                contactLength
                            );
                            const galHeight = calcSectionHeight(galLength);
                            const conversationHeight = calcSectionHeight(
                                conversationsLength
                            );
                            return {
                                contactsLength:
                                    contactHeight >= maxHeight
                                        ? maxHeight
                                        : contactHeight,
                                galContactsLength:
                                    galHeight >= maxHeight
                                        ? maxHeight
                                        : galHeight,
                                conversationsLength:
                                    conversationHeight >= maxHeight
                                        ? maxHeight
                                        : conversationHeight,
                            };
                        })(),
                    };
                    return res;
                }
            )
        );

        if (!activatedRoute.snapshot.firstChild) {
            this.view$.pipe(skipUntil(isLoaded$.pipe(filter((f) => !!f))), take(1))
                .subscribe((view) => {
                    //logger.debug('MessagingWorkspace::view.sessions.length', view.sessions.length);
                    if (view.sessions.length && !this.isMobileDevice) {
                        this.onClickMessagingWorkspace(view.sessions[0]);
                        this.authDataAccess.appLoaded.next(true);
                    }
                });
        }

        combineLatest([this.authDataAccess.cacheReload,this.authDataAccess.appLoaded]).pipe(
            map(([cacheReload,appLoaded])=> cacheReload && appLoaded)
        ).subscribe((result)=>{
            if(result){
                this.store.dispatch(reloadUserCheck())
            }
        })

        this.peers$ = store.select(selectContactGhosts(sipService.getUserUri));
        this.peers$.subscribe((peers) => {
            this.savedContact = peers;
            if (this.savedContact.length === 2) {
                this.savedContact.push();
            }
        });
        this.messagingDataAccessService.addSearchData.subscribe((data) => {
            this.updateSearch(data);
        });

        const ongoingSessions$ = store
            .select(selectPeersCallingStates(sipService.getUserUri))
            .pipe(
                map((sessions) =>
                    sessions.filter(
                        (f) =>
                            (f.active || []).length > 0 &&
                            (f.active[0].kind === 'OngoingActiveCall' ||
                                f.active[0].kind === 'SuspendedActiveCall')
                    )
                ),
                tap(console.log)
            ) as Observable<PeerCallingState[]>;

        ongoingSessions$.subscribe((ongoingSessions) => {
            logger.debug('ongoing sessions count', ongoingSessions.length);
            if (ongoingSessions.length != 0) {
                sessionStorage.setItem('call_is_active', 'true');
            } else {
                sessionStorage.setItem('call_is_active', 'false');
            }
        });
    }


    @HostListener('window:popstate', ['$event'])
    onPopState(event) {
        if (this.isMobileDevice) {
            this.backClickCount++;
            if (this.backClickCount == 1) {
                this.router.navigate([`/messaging`], {
                    queryParams: { isFromBackBtn: 't' },
                });
            }
        }
    }
    ngOnInit() {
        this.isCollapsed = true;
    }

    changeMuteStatus(status: boolean) {
        this.MuteinboundCallAndMsgSound = status;
        sessionStorage.setItem('callAndMsgMuteStatus', status.toString());
    }

    get userInfo(): User {
        sessionStorage.setItem('loggedInuserCntCode',this.phoneNumberService.getUserCountryCode(this.sipUserService.user));
        sessionStorage.setItem('loggedInuserCntName',this.phoneNumberService.getUserCountryName(this.sipUserService.user));
        return this.sipUserService.user;
    }

    ngOnChanges(changes: SimpleChanges): void {
        this.mobileUiService.hideChatListSubject.subscribe((val) => {
            this.isHideChatList = val;
        });
        this.mobileUiService.hideChatHistorySubject.subscribe((val) => {
            this.isHideChatHistory = val;
        });
        this.activatedRoute.queryParamMap.subscribe((qparam) => {
            //console.log('Qparams data::', qparam);
        });
    }

    backBtnClicked(isClicked: boolean): void {
        alert(isClicked);
        // this.isBackBtnClicked.emit(isClicked);
    }

    showHideChatList() {
        this.isHideChatHistory = true;
}

    // method for highlighting un saved contact in message search
    highlightUnsavedContact(message: any) {
        if (message.isGroup === true) {
            return false;
        } else {
            let findUnsavedContacts = this.savedContact?.find((res: any) => {
                return res?.id === message?.peer?.id
            });
            if (findUnsavedContacts) {
                return false;
            } else {
                if (message.peer?.id) {
                    return true;
                } else {
                    return false;
                }
            }
        }
    }

    callFirstConv() {
        if(this.conversations.length){
            if (!this.isMobileDevice) {
                this.onClickMessagingWorkspace(this.conversations[0]);
            }
            // if (this.conversations[0].peerId.includes('whatsapp:')){
            //     //console.log('this is first whatsapp thread');
            //     this.router.navigate(['messaging', 'chat', this.conversations[0]?.threadId])
            // } else {
            //     this.router.navigate(['messaging', 'chat', this.conversations[0]?.peerId])
            // }
        }
    }

    // getObject(obj){
    //     if(this.savedContact.length){
    //         if(obj.peer.multiLine.includes('whatsapp')){
    //             obj.isWhatsAppContact = true
    //         }
    //         const contactObj = this.savedContact.find(contact => contact.multiLine === obj.peer.multiLine.replace('whatsapp:', ''))
    //         const contact = contactObj ? { ...contactObj.contact, isWhatsAppContact : true}: null;
    //         obj.peer.contact = contact;

    //     }
    //     return {...obj}

    // }

    // onClickMessagingWorkspace(session:any, message?: any, isGalContact?:boolean){
    //     if (session.peer['id']?.includes('whatsapp:')){
    //         if(!session.threadId){
    //             this.router.navigate(['messaging', 'chat', session.messages[0]?.threadId])
    //         }
    //         else {     // Condition for whataApp Thread only
    //             this.router.navigate(['messaging', 'chat', session.threadId ])
    //         }
    //     } else {
    //         if(session.peer['id']){
    //             this.router.navigate(['messaging', 'chat', session.peer['id'] ])
    //         }else{
    //             this.router.navigate(
    //                 ['messaging/chat/new'],
    //                 { queryParams: { id: session.peer['multiLine'] } }
    //               );
    //             setTimeout(() => {
    //                 this.messagingService.isGalContact.next(true);
    //             }, 100);
    //         }
    //     }
    // }

    showHideChatHistory() {
        if (!this.isHideChatHistory) {
            this.classesForMsgHistory = {
                messages__splitter: this.isHideChatHistory,
                'messages__splitter--second': this.isHideChatHistory,
                messages__details: this.isHideChatHistory,
                messages__splitter_full: this.isHideChatHistory,
            };
            this.stylesForMsgHistory = {
                display: 'block',
                height: '100%',
            };
        } else {
            this.classesForMsgHistory = {
                messages__splitter: this.isHideChatHistory,
                'messages__splitter--second': this.isHideChatHistory,
                messages__details: this.isHideChatHistory,
                messages__splitter_full: this.isHideChatHistory,
            };
            this.stylesForMsgHistory = {
                display: 'none',
            };
        }
    }

    showHideListAndChatHistory() {
        this.classesForList = {
            messages__splitter: this.isMobileDevice,
            'messages__splitter--first': this.isMobileDevice,
            messages__general: this.isMobileDevice,
        };
        this.stylesForList = {
            display: this.isMobileDevice ? 'none' : 'block',
            height: '100%'
        };
        this.classesForMsgHistory = {
            messages__splitter: this.isMobileDevice,
            'messages__splitter--second': this.isMobileDevice,
            messages__details: this.isMobileDevice,
            messages__splitter_full: this.isMobileDevice,
        };
        this.stylesForMsgHistory = {
            display: !this.isMobileDevice ? 'none' : 'block',
        };
    }

    showHideListAndChatHistoryTwo() {
        this.classesForList = {
            messages__splitter: this.isMobileDevice,
            'messages__splitter--first': this.isMobileDevice,
            messages__general: this.isMobileDevice,
        };
        this.stylesForList = {
            display: this.isHideChatList ? 'block' : 'none',
            height: '100%'
        };
        this.classesForMsgHistory = {
            messages__splitter: this.isMobileDevice,
            'messages__splitter--second': this.isMobileDevice,
            messages__details: this.isMobileDevice,
            messages__splitter_full: this.isMobileDevice,
        };
        this.stylesForMsgHistory = {
            display: this.isHideChatHistory ? 'block' : 'none',
        };
    }
    getObject(obj) {
        if (this.savedContact.length) {
            if (obj.peer?.multiLine.startsWith('whatsapp')) {
                obj.isWhatsAppContact = true;
            }
            const contactObj = this.savedContact.find(
                (contact) =>
                    contact.multiLine ===
                    obj.peer?.multiLine.replace('whatsapp:', '')
            );
            const contact = contactObj
                ? { ...contactObj.contact, isWhatsAppContact: true }
                : null;
            obj.peer.contact = contact;
        }
        return { ...obj };
    }

    activeRouteUrl(session?:any,isGalContact?: boolean){
        let url: string = null;
        if(isGalContact){
            return false;
        }
        try {
            if (session && session.peer['id']?.includes('whatsapp:')) {
                if (!session.threadId) {
                    url = '/messaging/chat/' + session.messages[0]?.threadId;
                } else {
                    url = '/messaging/chat/' + session.threadId;
                }
            } else {
                if (session && session.peer['id']) {
                    url = '/messaging/chat/' + session.peer['id'];
                } else {
                    let conversationMessages;
                    this.stateData?.forEach((res: any) => {
                        if (res?.participants === undefined) {
                            if (
                                res?.peerId?.includes(
                                    session?.peer['multiLine']
                                ) &&
                                res?.isGroup === false &&
                                res?.messageChannelType == 'normalMsg'
                            ) {
                                conversationMessages = res;
                            }
                        } else {
                            res?.participants.forEach((re: any) => {
                                if (
                                    re?.includes(session?.peer['multiLine']) &&
                                    res?.isGroup === false &&
                                    res?.messageChannelType == 'normalMsg'
                                ) {
                                    conversationMessages = res;
                                }
                            });
                        }
                    });
                    if (conversationMessages) {
                        url = '/messaging/chat/' + session?.peer['multiLine'];
                    }
                }
            }
        } catch (e) {
            return url;
        }
        return url;
    }

    onClickMessagingWorkspace(session?: any, isGalContact?: boolean) {
        this.backClickCount = 0;
        // this.isMobileDevice = true;
        this.chatHeight = (this.isMobileDevice) ? true : false;
        this.mobileUiService.hideChatList(false);
        this.mobileUiService.hideChatHistory(true);
        this.mobileUiService.hideChatListSubject.subscribe((val) => {
            this.isHideChatList = val;
        });
        this.mobileUiService.hideChatHistorySubject.subscribe((val) => {
            this.isHideChatHistory = val;
        });
        // this.showHideChatList();
        // this.showHideChatHistory();
        this.showHideListAndChatHistoryTwo();
        // this.showHideListAndChatHistory();

        if (session && session.peer['id']?.includes('whatsapp:')){
            if(!session.threadId){
                this.router.navigate(['messaging', 'chat', session.messages[0]?.threadId])
            }
            else {     // Condition for whataApp Thread only
                this.router.navigate(['messaging', 'chat', session.threadId ])
            }
        } else {
            if(session && session.peer['id']){
                this.router.navigate(['messaging', 'chat', session.peer['id'] ])
            }else{
                let conversationMessages;
                this.stateData?.forEach((res: any) => {
                    if (res?.participants === undefined) {
                        if (res?.peerId?.includes(session?.peer['multiLine']) && res?.isGroup === false && res?.messageChannelType == 'normalMsg') {
                            conversationMessages = res;
                        }
                    } else {
                        res?.participants.forEach((re: any) => {
                            if (re?.includes(session?.peer['multiLine']) && res?.isGroup === false && res?.messageChannelType == 'normalMsg') {
                                conversationMessages = res;
                            }
                        });
                    }
                });
                if (conversationMessages) {
                    this.router.navigate(['messaging', 'chat', session?.peer['multiLine']])
                } else {
                    this.router.navigate(
                        ['messaging/chat/new'],
                        { queryParams: { id: session?.peer['multiLine'],
                                        name: session?.peer['name'],
                                        firstName: session?.peer['firstName'],
                                        lastName: session?.peer['lastName']} }
                    );
                    setTimeout(() => {
                        this.messagingService.isGalContact.next(true);
                    }, 100);
                }
            }
        }
        if (session && isGalContact) {
            const contact: NewContact = session;
            // dispatch action to add contact
            const savedContact = this.savedContact.length
                ? this.savedContact.find(
                      (obj) =>
                          contact.phones &&
                          contact.phones[0] &&
                          obj.multiLine ==
                              cleanPhoneNumber(contact.phones[0].phone)
                  )
                : null;
            if (!savedContact) {
                sessionStorage.setItem('addGalCnctViaMsging', 'true');
                const contactCreatedFrom = 'addingGalCnctViaMsging'
                this.store.dispatch(startCreateUserContact({ contact, contactCreatedFrom }));
            }
        }

        this.mmsService.updatePreviewImageCancelStatus(false);
    }

    getTransportStatus(transportStatus: string) {
        let status = '';
        return status;
    }

    public messageComposeRedirect(type) {
        // this.isMobileDevice = true;
        this.authService.ComposeRedirectEvent(true);
        this.authService.selectedMessageType(type);

        this.onClickMessagingWorkspace(null, false);
    }

    public getConnectionError(event: any) {
        this.fromBackBtnClick();
        this.getConnectionErrorValue = event;
    }

    private getGalContacts = (term: string) => {
        if (term && term.length >= 2) {
            return this.msGraphService.getPeople(term).then((res) => {
                const sorted = sortBy(
                    sortContact,
                    res.map(mapFromMsGraphPerson)
                );
                const sortedAndLocalFiltered = filterContacts(sorted, term);
                return sortedAndLocalFiltered;
                }, async (err) => {
                    //if (this.galContactsCalledAfterRefreshingToken === true) {
                    //  return Promise.resolve([]);
                    //}
                    if (JSON.parse(err.body).code === "InvalidAuthenticationToken") {
                      // TO DO:
                      // 1) when user enters three char and execution comes to this portion..
                      //    then the refresh token has to be done, before getting the galcontacts again..
                      //    currently the contacts cannot be fetched in this same time even when calling getGalContacts in a recursive way..
                      // 2) should check the recursive call is not going in loop.
                      this.messagingService.get_updated_token();
                      //this.galContactsCalledAfterRefreshingToken = true;
                      // this.getGalContacts(term)
                    }
                    return Promise.resolve([]);
            });

        } else {
            return Promise.resolve([]);
        }
    };

    removeNullRecord(state: PeerMessagingState[]): PeerMessagingState[] {
        let orginal = [];
        const stateFilter = state.map((a) => a.peer.id);
        const findDup = stateFilter.filter((x, y, z) => z.indexOf(x) !== y);
        for (let i = 0; i < state.length; i++) {
            if (state[i].peer.id !== 'null') {
                if (findDup.indexOf(state[i].peer.id) === -1) {
                    orginal.push(state[i]);
                } else if (findDup.indexOf(state[i].peer.id) !== -1) {
                    if (state[i].peer.name !== null) {
                        orginal.push(state[i]);
                    }
                }
            }
        }
        return orginal;
    }

    ngOnDestroy() {
        this.destroy$.next();
        this.store.dispatch(
            setSearchText({
                searchText: '',
            })
        );
        this.messagingService.changeName(0);
    }

    trackByFun(_, session: PeerMessagingState) {
        return session.peer?.multiLine;
    }

    updateSearch(searchTerm: string) {
        let regExp = /[a-zA-Z]/g;
        let strChk = regExp.test(searchTerm);
        this.store.dispatch(
            setSearchText({
                searchText: searchTerm,
            })
        );
        this.searchText = searchTerm;
        if (strChk == true) {
            this.search$.next(searchTerm);
        } else {
            this.search$.next(cleanPhoneNumber(searchTerm));
        }
    }

    formatHistoryTime(time: string) {
        if (!time) {
            return time;
        }
        return this.dateTimeService.formatHistoryTime(time);
    }

    onSearchBarActivated(f: boolean) {
        this.searchBarActivated$.next(f);
    }

    fromBackBtnClick() {
        this.activatedRoute.queryParamMap.subscribe((params: any) => {
            if (params.params.isFromBackBtn === 't') {
                this.isHideChatList = true;
                this.isHideChatHistory = false;
                this.showHideListAndChatHistoryTwo();
            }
        });
    }

    nextThreads(){
        this.messagingDataAccessService.ThreadLazyLoaded.next(false)
        this.store.dispatch(loadNextHistory())
    }

    isHidden() {
        let classList:string
        if(this.isMobileDevice && this.isHideChatHistory){
            classList = "messages__splitter messages__splitter--first messages__general display-none";
        }else{
            classList = "messages__splitter messages__splitter--first messages__general display-flex";
        }
        if(this.appEmbededStatus == "messaging"){
            classList = classList + " message_height_teams"
        }else{
            classList = classList + " message_height"
        }
        return classList
    }

    getMessageWidth() {
        if (this.isMobileDevice && !this.isHideChatHistory) {
            return 'messages_mobile';
        } else if (this.isMobileDevice && this.isHideChatHistory) {
            return 'messages_mobile_history';
        } else {
            return 'messages';
        }
    }

    getChatButtonStyle() {
        return this.isMobileDevice ? 'messages__chatPlace_mob' : 'messages__chatPlace'
    }

    getMessageStyle() {
        return this.isMobileDevice ? 'message_style_block' : 'message_style_flex';
    }

    isTeamsSSO(): boolean {
        if (sessionStorage.getItem('isLogingViaTeams') === 'true') {
            return true;
        } else {
            return false;
        }
    }

        isMessaging(){
        return this.appEmbededStatus == "messaging" ? " message_height_teams" : "message_height"
    }

    GetTheme(){
        let theme = localStorage.getItem("Theme")
        return theme ? "Dark" : null
    }
}
