import { Clipboard } from '@angular/cdk/clipboard';
import {
    ChangeDetectionStrategy,
    Component,
    Input,
    OnDestroy,
    Output,
    EventEmitter,
    OnChanges,
    SimpleChanges,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Contact } from '@movius/domain';
import { LoggerFactory } from '@movius/ts-logger';
import { Actions, ofType } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import { SipService } from '@scalio/sip';
import { NzNotificationService } from 'ng-zorro-antd/notification';
import {
    BehaviorSubject,
    combineLatest,
    forkJoin,
    Observable,
    Subject,
} from 'rxjs';
import { selectContactGhosts } from '../../../feature-contacts';


import {
    distinctUntilChanged,
    filter,
    map,
    shareReplay,
    skipUntil,
    skipWhile,
    switchMap,
    take,
    takeUntil,
    tap,
    withLatestFrom,
} from 'rxjs/operators';
import {
    CallingStatus,
    ConfirmDialogComponent,
    convertFileToBlob,
    DbContext,
    getCallNowPayload,
    MessagingStatus,
    selectCallingStatus,
    SelectContactsDialogComponent,
    selectMessagingStatus,
} from '../../../shared';
import {
    ChatSessionView,
    LoadedSeq,
    PeerChatMessage,
    PeerChatSession,
} from '../../models';
import {
    addIncomingSessionMessage,
    PeerChatMessageView,
    selectMessagesContactGhosts,
    selectMessagesStatus,
    selectPeerMessagesAndStatuses,
    selectPeerMessageStatus,
    selectWhatsAppOptInStatus,
} from '../../ngrx';
import {
    ChatWorkspaceService,
    MessagingDataAccessService,
} from '../../services';
import { MessagingService } from '../../services/messaging.service';
import { MMSService } from '../../services/mms.service';
import { getContactRealNumber } from '../../../shared';
import { ContactTitlePipe } from './../../pipes/contact-title.pipe';
import {
    getPeerNumberWOSpecialChars,
    isHighZoomedScreen,
    isTimeCrossed,
    allowedSpecialCharacters,
    getFeatureEnabled,
    getMsgChannelTypeForSingleParticipant,
    getMsgChannelTypeFromParticipants,
    getValidSipId,
} from './../../../shared/utils/common-utils';
import { NzModalService } from 'ng-zorro-antd/modal';
import { MobileUiService } from '../../services/mobile-ui.service';

const logger = LoggerFactory.getLogger('');
import { AuthService } from '../../../shared';
import { MessageContactSelectorComponent } from '../message-contact-selector/message-contact-selector.component';

const ITEMS_PER_PAGE = 20;
const LOAD_NEXT_PAGE_TOP_OFFSET = 10;

const getMessageIdNotifyIfVisible = (
    messages: PeerChatMessage[],
    loadedSeq: LoadedSeq
): string => {
    if (!loadedSeq || !messages) {
        return null;
    }

    // request to load next batch only if items count equal to expected page count, if not then this is end of the thread
    const latestMessageIndex =
        loadedSeq && loadedSeq.count === ITEMS_PER_PAGE
            ? messages.findIndex((f) => f.id === loadedSeq.id)
            : -1;
    // when item with this index visible, load next page
    const notifyIndexVisible =
        latestMessageIndex !== -1
            ? latestMessageIndex - LOAD_NEXT_PAGE_TOP_OFFSET
            : -1;

    return notifyIndexVisible === -1 ? null : messages[notifyIndexVisible].id;
};

export interface ChatWorkspaceView extends ChatSessionView {
    callingStatus: CallingStatus;
    messagingStatus: MessagingStatus;
}

@Component({
    selector: 'movius-web-chat-workspace',
    templateUrl: './chat-workspace.component.html',
    styleUrls: ['./chat-workspace.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    providers: [ChatWorkspaceService, ContactTitlePipe, MessageContactSelectorComponent],
})
export class ChatWorkspaceComponent implements OnDestroy, OnChanges {
    private readonly destroy$ = new Subject();

    @Input() view$: Observable<ChatWorkspaceView>;
    @Output() msgFormError = new EventEmitter();
    msg: any;
    isGroupChat: boolean;
    e911UserStatus: any;
    callingStatus_tmp: CallingStatus;
    callingStatus_tmp_previous: CallingStatus = 'allowed';
    getDisplayImagesSelectedValue: any;
    imageBlobData: any;
    picMsgeventCancelled: boolean;
    loadedPictures: any[] = [];
    loadedPictures$ = new BehaviorSubject([]);
    appEmbededStatus: string;
    selfDestinationError: string;
    getConnectionErrorValue: any;
    savedContact = [];
    cntId: any;
    peerMessagesData: any;
    isValnum: boolean = true;
    startMessaging:any;
    systemMessages = [
        'The contact hasn’t responded to the opt-in request for more than 24 hours. You can try sending the request again.',
        'The contact hasn’t responded for more than 24 hours. Please use the template button in the bottom-left to select a message to send.',
        "Looks like this contact hasn't enabled WhatsApp.",
        'To Re-Engage the conversation, please send guest a request',
    ];
    otherThreads = JSON.parse(sessionStorage.getItem('threadIdData'));
    filteredCommonThreads: any = [];
    isMobileDevice: Boolean = false;
    chatHeight = !this.isMobileDevice;
    urlId;
    classesForList: any = {};
    classesForMsgHistory: any = {};
    stylesForList: any = {};
    stylesForMsgHistory: any = {};
    isHideChatList: boolean = false;
    isHideChatHistory: boolean = false;
    @Output()
    isBackBtnClicked = new EventEmitter<boolean>();
    loadFirstThreadMsg: string;
    locationDetails: any;
    // @Output()
    constructor(
        private router: Router,
        private readonly messagingService: MessagingService,
        public activatedRoute: ActivatedRoute,
        public store: Store,
        private readonly chatWorkspaceService: ChatWorkspaceService,
        public sipService: SipService,
        public actions: Actions,
        private clipboard: Clipboard,
        private readonly notificationService: NzNotificationService,
        private readonly dbContext: DbContext,
        private mmsService: MMSService,
        private contactTitlePipe: ContactTitlePipe,
        private readonly modalService: NzModalService,
        private messagingDataAccessService: MessagingDataAccessService,
        private mobileUiService: MobileUiService,
        private readonly authService: AuthService,
        private messageContactSelector: MessageContactSelectorComponent
    ) {
        // this.mobileUiService.hideChatListSubject.subscribe((val: any) => {
        //     console.log(val);
        //     if (val) {
        //         this.showHideListAndChatHistoryTwo();
        //     }
        // });

        this.isMobileDevice = ((sessionStorage.getItem('Contex_res')?.toLowerCase() === "ios") || (sessionStorage.getItem('Contex_res')?.toLowerCase() === "android"))
            ? true : false;
        this.chatHeight = !this.isMobileDevice;
        this.urlId = this.activatedRoute.params['_value']['id'];
        this.displayChatItemDetails();
    }

    ngOnChanges(changes: SimpleChanges): void {
        console.log(changes);
    }

    backToList() {
        logger.debug(this.loadFirstThreadMsg);
        this.router.navigate([`/messaging/chat/${this.loadFirstThreadMsg}`], {
            queryParams: { isFromBackBtn: 't' },
        });
        // this.mobileUiService.hideChatHistory(false);
        // this.mobileUiService.hideChatList(true);
    }

    backBtnClicked(isClicked: boolean): void {
        console.log('isClicked', isClicked);
        this.isBackBtnClicked.emit(isClicked);
        if (isClicked) {
            this.displayChatItemDetails();
            this.mobileUiService.hideChatList(true);
            this.mobileUiService.hideChatHistory(false);
            // this.showHideListAndChatHistoryTwo();
            // window.location.reload();
        }
    }

    showHideListAndChatHistoryTwo() {
        this.mobileUiService.hideChatListSubject.subscribe((val) => {
            this.isHideChatList = val;
        });
        this.mobileUiService.hideChatHistorySubject.subscribe((val) => {
            this.isHideChatHistory = val;
        });
        // console.log(
        //     'this.isHideChatList',
        //     this.isHideChatList,
        //     'this.isHideChatHistory',
        //     this.isHideChatHistory
        // );
        this.classesForList = {
            messages__splitter: this.isMobileDevice,
            'messages__splitter--first': this.isMobileDevice,
            messages__general: this.isMobileDevice,
        };
        this.stylesForList = {
            display: this.isHideChatList ? 'block' : 'none',
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
        // console.log(
        //     'this.classesForList',
        //     this.classesForList,
        //     'this.stylesForList',
        //     this.stylesForList,
        //     'this.classesForMsgHistory',
        //     this.classesForMsgHistory,
        //     'this.stylesForMsgHistory',
        //     this.stylesForMsgHistory
        // );
    }

    displayChatItemDetails() {
        this.showHideListAndChatHistoryTwo();
        const id$ = this.activatedRoute.params.pipe(
            map(({ id }) => id),
            tap((id) => {
                this.getDisplayImagesSelectedValue = false;
            }),
            distinctUntilChanged()
        );
        const callingStatus$ = this.store.select(selectCallingStatus);
        const messagingStatus$ = this.store.select(selectMessagingStatus);
        this.store
            .select(selectContactGhosts(this.sipService.getUserUri))
            .subscribe((peers) => {
                this.savedContact = peers;
            });
        this.view$ = combineLatest([
            id$,
            this.store.select(selectPeerMessagesAndStatuses),
            id$.pipe(
                switchMap((id) =>
                    this.store.select(
                        selectMessagesContactGhosts(
                            this.sipService.getUserUri,
                            id
                        )
                    )
                )
            ),
            callingStatus$,
            messagingStatus$,
            id$.pipe(
                switchMap((id: string) =>
                    this.store.select(selectWhatsAppOptInStatus(id))
                )
            ),
        ]).pipe(
            map(
                ([
                    id,
                    peerMessages,
                    contacts,
                    callingStatus,
                    messagingStatus,
                    whatsAppStatus,
                ]) => {
                    let messagesCopy: any = [];
                    let getId = id;
                    let routerId = id;
                    this.urlId = id;
                    this.loadFirstThreadMsg = routerId;
                    const peerMessagedObj = Object.values(peerMessages);

                    if (peerMessagedObj.length > 0) {
                        peerMessagedObj.filter((e) => {
                            if (e.threadId == id) {
                                routerId = e.threadId
                                if (e.participants?.length == 1) {
                                    getId = e.participants[0] ?  e.participants[0] : e.peerId
                                } else {
                                    getId = e.peerId
                                }
                            }
                        });
                    }


                    this.peerMessagesData = peerMessages;
                    localStorage.setItem('selectedGroup', '');
                    // console.log('aaaaaaaaaaaaaa', aaa, aaa.length == 0 )

                    //console.log('getId : ', getId)
                    //console.log('peerMessages : ', peerMessages)
                    const peerMessage = peerMessages[routerId] || {
                        status: {
                            kind: 'StateStatusLoaded',
                            latestLoadedSeq: null,
                            dateTime: new Date().toISOString(),
                        },
                        messages: [],
                        threadId: null,
                        peerId: null,
                        isMuted: false,
                        isGroup: false,
                    };

                    peerMessage.status = {kind: 'StateStatusLoaded',
                            latestLoadedSeq: null,
                            dateTime: new Date().toISOString()
                        }

                    if(!peerMessage.isGroup){
                        sessionStorage.setItem('participants',null)
                    }
                    messagesCopy = JSON.parse(JSON.stringify(peerMessage));
                    const peer = contacts.find((f) => f.multiLine === getId);
                    const contactObj = this.savedContact.length
                        ? this.savedContact.find(
                              (contact) =>
                                  contact?.multiLine ==
                                  peer?.multiLine.replace('whatsapp:', '')
                          )
                        : null;
                    this.cntId = contactObj?.contact?.id;
                    if(peer?.multiLine.includes('whatsapp')){
                        if(contactObj){
                            peer.contact = { ...contactObj.contact, isWhatsAppContact: whatsAppStatus.messageChannelType == 'whatsapp' ? true : false};
                        }
                    }

                    //     peer.contact.isWhatsAppContact = false;
                    // }

                    if (
                        peer &&
                        peer.multiLine ==
                            sessionStorage.getItem('__api_identity__')
                    ) {
                        this.selfDestinationError =
                            'You cannot send message to your number.';
                        this.msgFormError.emit(this.selfDestinationError);
                        this.isValnum = false;
                    } else if (
                        peer?.contact != undefined &&
                        this.checkValidNumornot(
                            peer.contact?.phones[0]?.orgPhone
                        ) == 'specialCharacterValidation'
                    ) {
                        this.selfDestinationError =
                            "'" +
                            peer.contact?.phones[0]?.orgPhone +
                            "' " +
                            'is invalid. Please enter the phone number with a valid country code (e.g. For U.S: 1xxxxxxxxxx).';
                        this.msgFormError.emit(this.selfDestinationError);
                        this.isValnum = false;
                    } else if (
                        peer?.contact != undefined &&
                        this.checkValidNumornot(
                            peer.contact?.phones[0]?.orgPhone
                        ) == 'conference-destination'
                    ) {
                        this.selfDestinationError =
                            'You cannot send message to a conference number.';
                        this.msgFormError.emit(this.selfDestinationError);
                        this.isValnum = false;
                    } else {
                        this.selfDestinationError = '';
                    }

                    this.callingStatus_tmp = callingStatus;

                    if((peer?.multiLine.includes('whatsapp') || whatsAppStatus.messageChannelType == 'whatsapp') && whatsAppStatus.whatsOptInReqStatus && ["2", "3", "5"].indexOf(whatsAppStatus.whatsOptInReqStatus.toString()) >= 0){
                        //let threadsholdTimeCrossed = isTimeCrossed(whatsAppStatus.lastIncommingMessageAt)
                        //logger.debug('ChatWorkspaceComponent threadsholdTimeCrossed = ' + threadsholdTimeCrossed)
                        //let messages_only = JSON.stringify(JSON.parse(JSON.stringify(messagesCopy))['messages'])
                        //logger.debug('ChatWorkspaceComponent Get only inbound sms ' + JSON.parse(JSON.stringify(messages_only)))
                        let timearray = []
                        var inbound_date, first_msg = null;
                        var i,wa_number;
                        var index = whatsAppStatus?.participants?.findIndex(value => /^whatsapp/.test(value))
                        if (index >= 0){
                          wa_number= whatsAppStatus?.participants[index].replace('whatsapp:','');
                        }
                        for (i=0; i<messagesCopy?.messages?.length; i++) {
                          if(messagesCopy.messages[i].fromNumber != 'me' && (messagesCopy.messages[i].fromNumber == wa_number ||
                            messagesCopy.messages[i].fromNumber == 'whatsapp:'+wa_number) && !(messagesCopy.messages[i].isSystem)){
                            if (inbound_date == null){
                                inbound_date=messagesCopy.messages[i].sentTime
                                break;
                            } else if(inbound_date < new Date(messagesCopy.messages[i].sentTime)){
                                inbound_date=messagesCopy.messages[i].sentTime
                                break;
                            }
                           } else if(messagesCopy.messages[i].content == 'The contact has opted in. You can start messaging now.' && messagesCopy.messages[i].isSystem) {
                            inbound_date = messagesCopy.messages[i].sentTime
                            break;
                           } else if(messagesCopy.messages[i].content.includes('added you to the conversation. Last message:') && messagesCopy.messages[i].isSystem && inbound_date == null){
                            inbound_date = messagesCopy.messages[i].sentTime
                            break;
                           }
                         }
                         if(inbound_date === undefined || inbound_date === null) logger.debug('could not satisfy any condition for last incoming message for whatsapp number')
                         let threadsholdTimeCrossed = isTimeCrossed(inbound_date)
                         //console.log('Message crossed ' + threadsholdTimeCrossed + ' , Last message ' + inbound_date)
                         whatsAppStatus.lastIncommingMessageAt=inbound_date
                         // send data to select-contact-dialog component
                        sessionStorage.setItem('lastIncommingMessageAt',whatsAppStatus.lastIncommingMessageAt);
                        let whatsAppEnabled = sessionStorage.getItem('__enable_whatsapp_message__') === "true";
                        let message = this.systemMessages[0];
                        let isSystem = true;
                        let add_msg = true;
                        if (messagesCopy?.messages?.length){
                            //console.log("Current message = " + messagesCopy.messages[0])
                        }
                        //console.log("Thread id = " + id);
                        //console.log("WA status = " + whatsAppStatus.whatsOptInReqStatus);
                        if(whatsAppStatus.whatsOptInReqStatus?.toString() == "3") {
                           if(messagesCopy?.messages[0]?.content.startsWith('You left the conversation.')){
                             message = this.systemMessages[3];
                             add_msg = false
                           } else {
                             message = this.systemMessages[1];
                           }
                        } else if(whatsAppStatus.whatsOptInReqStatus == "5"){
                            if(messagesCopy?.messages?.length && messagesCopy.messages[0].content.startsWith('You left the conversation.')){
                                threadsholdTimeCrossed = true;
                                message = this.systemMessages[3];
                                add_msg = false
                            } else if(messagesCopy?.messages?.length == 0){
                                message = this.systemMessages[4]; // Logic for thread which user has left and no messages are retunred from server
                            } else {
                                add_msg = false
                            }
                        } else if(whatsAppStatus.whatsOptInReqStatus == "2"){
                            if(whatsAppStatus.whatsAppDisabled){
                                threadsholdTimeCrossed = true;
                                message = this.systemMessages[2];
                            }else{
                                if(!whatsAppStatus.lastIncommingMessageAt){
                                    threadsholdTimeCrossed = isTimeCrossed(whatsAppStatus.createdAt)
                                }
                            }
                        }

                        //console.log("Add message = " + message + ", add msg = " + add_msg)
                        if(whatsAppStatus.messageChannelType == 'whatsapp'){
                            let shaouldAdd = this.addSystemMessage(messagesCopy.messages, message, whatsAppStatus, threadsholdTimeCrossed);
                            //Added check for threads which has no messages in the respone
                            if((messagesCopy?.messages?.length == 0 && whatsAppStatus.whatsOptInReqStatus == "5") ||
                                 (messagesCopy?.messages?.length == 0 && whatsAppStatus.whatsOptInReqStatus?.toString() == "3")){
                                shaouldAdd = true;
                            }
                            if(shaouldAdd && whatsAppEnabled && add_msg){
                                messagesCopy.messages.unshift({
                                    content: message,
                                    from: 'peer',
                                    fromNumber: null,
                                    id: null,
                                    isSystem: isSystem,
                                    messageInfo: undefined,
                                    messageType: 'text',
                                    sentTime: new Date().toISOString(),
                                    state: {
                                        kind: 'MessageStateSent',
                                        dateTime: new Date().toISOString(),
                                    },
                                });
                            }
                        }
                    }

                    if(whatsAppStatus.messageChannelType != 'whatsapp'){
                        this.authService.selectedMessageType('message')
                    }
                    return {
                        loadNextPageMessageId: getMessageIdNotifyIfVisible(
                            messagesCopy.messages,
                            messagesCopy.status?.latestLoadedSeq
                        ),
                        threadId: messagesCopy.threadId,
                        isMuted: messagesCopy.isMuted,
                        status: messagesCopy.status,
                        peer,
                        messages: (messagesCopy && messagesCopy.messages) || [],
                        callingStatus,
                        messagingStatus,
                        isWhatsAppThread: whatsAppStatus.messageChannelType == 'whatsapp',
                        isWhatsOptInReqAccepted:
                            whatsAppStatus.whatsOptInReqStatus?.toString() == '3',
                        showWhatsAppTemplateList: this.showTemplate(
                            whatsAppStatus
                        ),
                        optInRequestCount: whatsAppStatus.optInRequestCount,
                        lastIncommingMessageAt:
                            whatsAppStatus.lastIncommingMessageAt,
                        whatsOptInReqStatus: whatsAppStatus.whatsOptInReqStatus,
                        participants: messagesCopy.participants,
                        isValnum: this.isValnum,
                        isGroup: messagesCopy.isGroup,
                        messageChannelType: getMsgChannelTypeFromParticipants(messagesCopy.participants, whatsAppStatus.messageChannelType)
                    };
                }
            )
        );

        // scroll to bottom on receiving incoming message
        this.actions
            .pipe(
                takeUntil(this.destroy$),
                ofType(addIncomingSessionMessage),
                withLatestFrom(id$),
                filter(([msg, id]) => msg.messageChannelType == 'normalMsg' ? msg.peerId == id : msg.threadId == id)
            )
            .subscribe(() => {
                logger.debug(
                    'new incoming message received for the peer, scroll to bottom'
                );
                setTimeout(() => {
                    this.chatWorkspaceService.onScrollToBottom();
                }, 150);
            });

        const threadChanged$ = this.view$.pipe(
            distinctUntilChanged(
                (a, b) =>
                    a.threadId === b.threadId && a.status?.kind === b.status?.kind
            )
        );
        threadChanged$.pipe(takeUntil(this.destroy$)).subscribe((session) => {
            sessionStorage.setItem('CurrentThread', session.threadId);
            this.chatWorkspaceService.onScrollToBottom();
        });

        const loaded$ = this.store
            .select(selectMessagesStatus)
            .pipe(filter((f) => f.kind === 'StateStatusLoaded'));

        // wait till all peers loaded
        combineLatest([id$, loaded$])
            .pipe(
                takeUntil(this.destroy$),
                skipWhile(([_, f]) => !f),
                switchMap(([id]) =>
                    this.store
                        .select(selectPeerMessageStatus(id))
                        .pipe(map((status) => ({ id, status })))
                )
            )
            .subscribe(({ id, status }) => {
                if (
                    status &&
                    (status.kind === 'StateStatusInitial' ||
                        status.kind === 'StateStatusError')
                ) {
                    //messagingService.loadPeerHistory(id);

                    if (!id.includes('whatsapp')) {
                        this.messagingService.loadPeerHistory(id);
                    } /*else {
                        this.otherThreads = JSON.parse(sessionStorage.getItem('threadIdData'))
                        console.log('other threads data', this.otherThreads?.toString());
                        if(this.otherThreads){
                            this.otherThreads.forEach((ot) => {
                                if (ot.includes(id)) {
                                    this.filteredCommonThreads.push(
                                        ot.split('threadid:')[1]
                                    );
                                }
                            });
                            console.log(
                                'filtered common threads data',
                                this.filteredCommonThreads
                            );
                            forkJoin(
                                this.filteredCommonThreads.map(
                                    (threadTest: any) =>
                                        this.messagingService.loadPeerHistory(
                                            id,
                                            false,
                                            threadTest
                                        )
                                )
                            );
                            this.filteredCommonThreads = [];
                        }
                    }*/
                }
            });

        this.getDisplayImagesSelectedValue = false;
        this.appEmbededStatus = getFeatureEnabled();
    }

    checkValidNumornot(phnnum) {
        let allowedCharcs: string[] = [
            '-',
            '+',
            '(',
            ')',
            '0',
            '1',
            '2',
            '3',
            '4',
            '5',
            '6',
            '7',
            '8',
            '9',
            ',',
            ' ',
        ];
        if ([',', ';', '#'].some((char) => phnnum.includes(char))) {
            return 'conference-destination';
        } else if (allowedSpecialCharacters(phnnum, allowedCharcs)) {
            return 'specialCharacterValidation';
        }
    }

    addSystemMessage(messages, newMessage, whatsAppStatus, thresholdTimeCrossed){

        function checkMessageExists(messages, newMessage){
            if( messages?.length && !messages[0].content.startsWith(newMessage)){
                return true
            }else{
                return false
            }
        }

        //whatsapp opt in req accepted
        if (whatsAppStatus.optInRequestCount >= 3) {
            if (
                thresholdTimeCrossed &&
                whatsAppStatus.whatsOptInReqStatus?.toString() == '3'
            ) {
                return checkMessageExists(messages, newMessage);
            }
            return false;
        }
        if (
            whatsAppStatus.whatsOptInReqStatus?.toString() == '3' ||
            whatsAppStatus.whatsOptInReqStatus == '5'
        ) {
            if (thresholdTimeCrossed) {
                return checkMessageExists(messages, newMessage);
            }
        } else {
            //whatsapp opt in pending
            if(messages?.length == 0){
                if(thresholdTimeCrossed){
                    return true
                }
            } else {
                if (!whatsAppStatus.whatsAppDisabled && thresholdTimeCrossed) {
                    return checkMessageExists(messages, newMessage);
                }
            }
        }
        return false;
    }

    showTemplate(whatsAppStatus: any) {
        // if(whatsAppStatus.whatsOptInReqStatus ===  "2"){
        //     return isTimeCrossed(whatsAppStatus.lastIncommingMessageAt)
        // }
        if (whatsAppStatus.whatsOptInReqStatus?.toString() === '3') {
            return isTimeCrossed(whatsAppStatus.lastIncommingMessageAt);
        }
        return false;
    }

    async getParticipants(multiLine: string) {
        const dbParticipants = await this.dbContext.message.getParticipants(
            multiLine
        );
        if (dbParticipants !== '' && dbParticipants.split('|').length > 2) {
            this.isGroupChat = true;
            sessionStorage.setItem('participants', dbParticipants);
            sessionStorage.setItem('dbParticipants', dbParticipants);
            sessionStorage.setItem(multiLine, JSON.stringify(dbParticipants));
        } else {
            this.isGroupChat = false;
        }
    }

    // getObject(obj){
    //     const contact = this.savedContact.find(contact => contact.multiLine === obj.peer.multiLine.replace('whatsapp:', ''))
    //     obj.peer.contact = contact;
    //     return {...obj, whatsApp : true}
    // }

    ngOnDestroy() {
        this.destroy$.next();
    }

    onSendMessage(session: PeerChatSession, message: string) {
        let peerId = session['participants']?.join('');
        const peerUri = 'sip:' + peerId + '@undefined';
        if (peerUri.includes('whatsapp')) {
            this.messagingService.sendMessage(peerUri, message, session);
            sessionStorage.setItem('CurrentThread', session.threadId);
        } else {
            /*if(session.peer.multiLine === '911' && sessionStorage.getItem("_USER_E911_STATUS_") == 'enabled_accepted' && this.messagingService.locationDetails == undefined) {
                this.messageContactSelector.getUserLocation();

                this.messagingService.locationInfoSubject.subscribe((res) => {
                    this.messagingService.sendMessage(
                        session.peer.multiLineUri,
                        message,
                        session
                    );
                });
            }
            else */
                this.messagingService.sendMessage(
                    session.peer.multiLineUri,
                    message,
                    session
                );
            //}

        }
        setTimeout(() => {
            this.chatWorkspaceService.onScrollToBottom();
        }, 200);
    }

    onSendMedia(session: PeerChatSession, media: File) {
        this.picMsgeventCancelled = true;
        this.messagingService.sendMultimediaMessage(session, media);
        this.getDisplayImagesSelectedValue = false;
        setTimeout(() => {
            this.chatWorkspaceService.onScrollToBottom();
        }, 300);
    }

    onMessageDisplayed(session: ChatSessionView, message: PeerChatMessageView) {
        // TODO : Rename to message read
        if (!message.isRead) {
            this.messagingService.messageRead(
                session.peer?.multiLine,
                message.id,
                message.sentTime,
                session.threadId,
                false // We will not read the System message in chat workspace hence sending "FALSE" always.
                // message.isVoiceMail
            );
        }
        if (message.id && message.id === session.loadNextPageMessageId) {
            this.messagingService.loadPeerHistory(session.peer.multiLine, true);
        }
    }

    onRemoveMessages(peerId: string) {
        this.messagingService.removePeerMessages(peerId);
    }

    onRemoveMessage(peerId: string, msg: PeerChatMessage) {
        this.messagingService.removePeerMessage(peerId, msg.id);
    }

    onCall(peerId: string) {
        const called_number = peerId.includes('whatsapp:') ? peerId.replace('whatsapp:','') : peerId;
        this.router.navigate(['calling', 'call', getPeerNumberWOSpecialChars(called_number)], {
            state: { data: getCallNowPayload() },
        });
    }

    async onCopyMessage(msg: PeerChatMessage) {
        let selection = window.getSelection();
        if (msg.messageType === 'text') {
            logger.debug('selection type::', selection.type);
            if(selection.type != "Range") {
                this.clipboard.copy(msg.content);
                // this.notificationService.blank('Message', 'Copied to clipboard', {
                //     nzPlacement: 'bottomLeft',
                // });
            }
        } else if (msg.messageType === 'picture') {
            let mms_id = msg.messageInfo.session_id;
            const mmsMedia = await this.messagingService.getMediaById(mms_id);
            const mmsBlobData: Blob = mmsMedia.data;
            const mmsContentType = mmsBlobData.type;
            const mmsFilename = mmsMedia.fileName;
            const mmsFile = new File([mmsBlobData], mmsFilename, {
                type: mmsContentType,
                lastModified: Date.now(),
            });
            const base64: any = await convertFileToBlob(mmsFile);
            const fileObj = {
                type: mmsContentType,
                blob: mmsBlobData,
                base64: base64,
            };
            window['copyImageToClipboard'](fileObj);
            this.notificationService.blank(
                'Image',
                'Copied image to clipboard',
                {
                    nzPlacement: 'bottomLeft',
                }
            );
        }
    }

    onForwardMessage(msg: PeerChatMessage) {
        this.messagingService.forwardMessage(
            msg.id,
            msg.content,
            msg.messageType
        );
    }

    onMuteThread(threadId: string, isMute: boolean) {
        this.messagingService.setThreadMute(threadId, isMute);
    }

    getContactCallTitleValue(peer) {
        return this.contactTitlePipe.transform(peer, this.savedContact);
    }

    add_participants_enable() {
        return sessionStorage.getItem('__whatsapp_group_messaage__');
    }

    get disbaledCallButton() {
        this.e911UserStatus = sessionStorage.getItem('_USER_E911_STATUS_');
        // logger.debug("chat-workspace:: e911UserStatus::" + this.e911UserStatus);
        // logger.debug("chat-workspace:: callingStatus_tmp::" + this.callingStatus_tmp);
        if (this.e911UserStatus === 'disabled') {
            return this.callingStatus_tmp !== 'allowed';
        }
        if (
            this.e911UserStatus === 'enabled_accepted' &&
            this.callingStatus_tmp === 'allowed'
        ) {
            return false;
        } else {
            return true;
        }
    }

    public getDisplayImagesSelectedStatus(status: boolean) {
        this.getDisplayImagesSelectedValue = status;
    }

    public imagePreviewCancelStatus() {
        this.mmsService.previewImageCancelStatus.subscribe((status) => {
            this.getDisplayImagesSelectedValue = status;
            this.picMsgeventCancelled = this.getDisplayImagesSelectedValue;
            this.chatWorkspaceService.onScrollToBottom();
        });
    }

    public fetchBlobURL({ blobUrl, file }) {
        this.getDisplayImagesSelectedValue = true;
        this.imageBlobData = {
            blobUrl,
            file,
        };
    }

    onNewImageLoaded(event) {
        const pictureMsg = this.loadedPictures.find(
            (e) => e.msgId == event.msgId
        );
        if (!pictureMsg) {
            this.loadedPictures.push(event);
            this.loadedPictures$.next(this.loadedPictures);
        }
    }

    getContactRealNumber = getContactRealNumber;

    public getConnectionError(event: any) {
        this.getConnectionErrorValue = event;
        this.callingStatus_tmp_previous = this.callingStatus_tmp;
        if (event == true) {
            this.callingStatus_tmp = 'network-error';
        } else if (event == false) {
            this.callingStatus_tmp = this.callingStatus_tmp_previous;
        }
    }

    addMoreParticipants(participants: any) {
        const mode = 11;
        this.modalService.create({
            nzContent: SelectContactsDialogComponent,
            nzComponentParams: {
                headerTitle: 'Add User',
                okBtnTitle: 'Add',
                mode: mode,
                actionTriggeredFrom: 'addMoreParticipants',
                heightMode: isHighZoomedScreen() ? 'Limited' : 'Normal',
            },
            nzStyle: {
                margin: '20px auto',
            },
            nzMask: true,
            nzFooter: null,
            nzClosable: false,
            nzMaskClosable: false,
            nzCentered: true,
        })
        .afterClose.pipe(

            );
            // get participants array in select-contacts-dialog component
            this.messagingDataAccessService.getPeerMessages.next(participants);
    }

    // leaveConversation() {
    //     this.modalService.create({
    //         nzContent: ConfirmDialogComponent,
    //         nzComponentParams: {
    //             titleTxt: 'Leave Conversation',
    //             subTitleTxt:
    //                 'Are you sure you want to leave this conversation.',
    //             cancelBtnTxt: 'No',
    //             applyBtnTxt: 'Yes',
    //             onOkAction: () => {
    //                 // leave group with whatsapp user
    //                 const data = {
    //                     thread: this.urlId,
    //                     receiver: this.getWAUser,   // Add line, wechat & whatsapp user in the group
    //                     format: 'json',
    //                     ver: '1',
    //                 };
    //                 this.messagingDataAccessService
    //                     .leaveWhatsAppGroup(data)
    //                     .subscribe();
    //             },
    //         },
    //         nzBodyStyle: {
    //             width: '26rem',
    //         },
    //         nzWidth: '26rem',
    //         nzFooter: null,
    //         nzKeyboard: false,
    //     });
    // }

    isLineOrWeChatThread(multiLine:any) {
        const messageChannelType = getMsgChannelTypeForSingleParticipant(multiLine)
        if (messageChannelType == 'Line' || messageChannelType == 'WeChat') {
            return true;
        } else {
            return false;
        }
    }

}


