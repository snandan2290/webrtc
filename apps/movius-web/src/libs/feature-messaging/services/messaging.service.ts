import { Injectable } from '@angular/core';
import { Store } from '@ngrx/store';
import { HttpClient } from '@angular/common/http';
import { RESEND_CALL_ID, SipService, SipUser } from '@scalio/sip';
import { filter, map, shareReplay, switchMap, withLatestFrom } from 'rxjs/operators';
import { selectContactGhosts, selectContacts, UserContact } from '../../feature-contacts';
import { base64toFile, blobToBase64, convertBinaryToBlob, convertFileToBlob, DbContext, SipUserService, sortParticipantsAsID, selectUserId, getMessageChannelType, addPulsToMultilineNumber, getMsgChannelTypeFromParticipants, getValidParticipantsArray } from '../../shared';

import {
    addIncomingSessionMessage,
    addOutgoingSessionMessage,
    checkIncomingSessionSelfMessage,
    forwardMessage,
    forwardMultimediaMessage,
    loadInitialHistory,
    loadPeerHistory,
    messageRead,
    setTreadMute,
    outgoingSessionMessageAccepted,
    outgoingSessionMessageRejected,
    removePeerMessage,
    startRemovePeerMessages,
    startSendSessionMessage,
    resendPendingMessages,
    loadLatestVoiceMail,
    addPicMsgPlaceholder,
    updatePicMsgAPIError,
    loadInitialVoiceMailHistorySuccess,
    loadPreviousPeerHistory,
    selectPeersMessages,
} from '../ngrx';
import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { Media, RetryQueue, serverDateToISO } from '@movius/domain';
import { delay } from 'lodash';
import { MessagingDataAccessService } from './messaging.data-access.service';
import { MessageType, PeerChatSession } from '../models';
import { LoggerFactory } from '@movius/ts-logger';
import { AuthService } from '../../shared/services/auth.service';
import { GeoHttpService } from '../../shared/services/geo-http.service';
import { AuthDataAccessService } from '../../shared/services/auth.data-access.service';

const logger = LoggerFactory.getLogger("")

/**
 * This is facade service which join sip streams and application state in order
 * to provide components with messaging data to display.
 * Component should reference only this service for all their needs.
 * Ngxs and sip services should not be used inside components.
 */
@Injectable({ providedIn: 'root' })
export class MessagingService {
    [x: string]: any;
    readonly peers$: Observable<UserContact[]>;
    public savedContact: any = [];
    public sipUserValue: SipUser;
    private nameSource = new BehaviorSubject<number>(0);
    name = this.nameSource.asObservable()
    public isGalContact = new Subject<any>();
    public is911Message = new Subject<any>();
    public isLocationEnabled = new Subject<any>();
    public locationInfoSubject = new Subject<any>();
    public locationDetails: any;
    public isTeamsLocationEnabled = new Subject<any>();
    public MessageLazyLoaded = new BehaviorSubject<boolean>(true);

    otpRetryCount = 0;
    generatedNewOtp: string;

    // public skipFaildeMMS: BehaviorSubject<boolean> = new BehaviorSubject(false);
    // readonly state$: Observable<MessagingState>;
    constructor(
        private readonly sipService: SipService,
        private readonly userService: SipUserService,
        private readonly store: Store,
        private readonly dbContext: DbContext,
        private http: HttpClient,
        private messagingDataAccessService: MessagingDataAccessService,
        private readonly authService: AuthService,
        private readonly geoHttpService: GeoHttpService,
        private readonly authDataAccess: AuthDataAccessService
    ) {
        const userAgentEvents$ = userService.registeredSipUser$.pipe(
            filter((f) => !!f),
            switchMap((sipUser) => sipUser.userAgentEvents$)
        );

        const userTwoAgentEvents$ = userService.registeredSecondarySipUser$.pipe(
            filter((f) => !!f),
            switchMap((sipUser) => sipUser.userAgentEvents$)
        );


        const contacts$ = store.select(selectContacts);


        userTwoAgentEvents$
            .pipe(withLatestFrom(contacts$), shareReplay())
            .subscribe(async ([event]) => {
                logger.debug('Secondary Event::', event);
                if(event.kind === 'UserAgentTransportStateChangedEvent' &&
                event.state != 'Connected'){
                    //this.authDataAccess.secServerCntcStsDataEvent('Disconnected');
                    logger.debug('Secondary Server Websocket Disconnected');
                }else if(event.kind === 'UserAgentRegisterEvent' &&
                event.event.kind === 'AcceptOutgoingRequestEvent'){
                    logger.debug('Processing Secondary::' + event.event.kind + ' StatusCode::' + event.event.response.message.statusCode);
                    if(event.event.response.message.statusCode == 200){
                        logger.debug('Secondary Server Registered Successfully after Register Check');
                        this.authDataAccess.secServerCntcStsDataEvent(null);
                    }
                }else if(event.kind === 'UserAgentRegisterEvent' &&
                event.event.kind === 'RejectOutgoingRequestEvent'){
                    logger.debug('Processing Secondary::' + event.event.kind + 'Reason::' + event.event.response.message.reasonPhrase);
                    this.authDataAccess.secServerCntcStsDataEvent('Disconnected');
                    if (event.event.response.message.reasonPhrase == 'OTP Auth Error' && event.event.response.message.statusCode == 500) {
                        if (this.otpRetryCount <= 1) {
                            this.retryOtpAndTryReregistration('Secondary');
                        } else {
                            console.log('Tried OTP validation twice need manuall refresh here...')
                        }
                    }else if (event.event.response.message.reasonPhrase != 'OTP Auth Error' && event.event.response.message.statusCode == 500 || event.event.response.message.statusCode == 503 || event.event.response.message.statusCode == 408) {
                        logger.debug('Calling Secondary Server Registration based on StatusCode::', event.event.response.message.statusCode);
                        this.userService.register_secondary_site();
                    }
                }else if (
                    event.kind === 'UserAgentOutgoingActionEvent' &&
                    event.action.kind === 'UserAgentOutgoingMessageAction'
                ) {
                    logger.debug('CallId:: ' + event.action?.message?.callId + ' Processing::' + event.action.kind);
                    const message = event.action.message;
                    const valid = event.action.valid;
                    // Message not exist in store
                    let sent_by = this.removePlusPrefix(
                        message.to.uri.user
                    );
                    // update sent_by field if message is sent from whatsapp
                    if (message.getHeader('X-CAFE-MSG-CALLED-TYPE') == 'whatsapp') {
                        sent_by = `whatsapp:${sent_by}`
                    }
                    const isSystem =
                        message.getHeader('X-CAFE-SYSTEMGEN') === 'Yes';
                    const parties_list = message.getHeader('X-CAFE-PARTICIPANTS');
                    if(parties_list){
                        sessionStorage.setItem(message.callId, JSON.stringify(sortParticipantsAsID(parties_list.split('|'))));
                    }
                    const participants = sessionStorage.getItem('participants');
                    // if (participants !== "null" && participants !== null && participants !== undefined && participants !== 'undefined' && parties_list !== undefined) {
                    //     const allNumbers = sortParticipantsAsID(participants.split('|'));
                    //     sessionStorage.setItem(message.callId, JSON.stringify(allNumbers));
                    // }
                    const fromNumber = message.getHeader('From').split(" ")[0].split("\"")[1];
                    const multimediaId = message.getHeader('X-CAFE-MULTIMEDIA-ID');
                    let messageType: MessageType = "text";
                    let messageInfo = {}

                    const to_ = this.getToValueForMessageInfo(participants, parties_list, message);
                    //let to_ = message.getHeader('To').replace("<sip:+", "").split("@")[0];
                    const multimediaType = message.getHeader('X-CAFE-MULTIMEDIA-CONTENT-TYPE');
                    if (multimediaId !== undefined) {
                        messageType = "picture";
                        messageInfo = {
                            id: message.callId,
                            session_id: multimediaId, // mms_session for now, can hold multiple session_id of diff msg types
                            multimediaStatus: 'not-initiated',
                            messageType: 'picture',
                            parties_list: parties_list ? parties_list : sent_by,
                            multimediaContentType: multimediaType,
                            to: to_,
                            from: sessionStorage.getItem('__api_identity__'),
                        }
                    }
                    store.dispatch(
                        addOutgoingSessionMessage({
                            peerId: sent_by,
                            callId: message.callId,
                            content: message.body.body,
                            dateTime: new Date().toISOString(),
                            resendCallId: message.getHeader(RESEND_CALL_ID),
                            isSystem,
                            parties_list: parties_list,
                            participants: parties_list ? parties_list.split('|') : [sent_by],
                            messageType,
                            messageInfo,
                            valid
                        })
                    );
                } else if (
                    event.kind === 'UserAgentSendMessageEvent' &&
                    event.event.kind === 'AcceptOutgoingRequestEvent'
                ) {
                    logger.debug('CallId::' + event.event.response.message.callId + '&MsgId::' + event.event.response.message.getHeader('X-Cafe-Message-Id') + ' Processing::' + event.event.kind);
                    const responseMessage = event.event.response.message;
                    const threadIdHeader = event.message.getHeader('X-CAFE-MESSAGE-THREAD');
                    let sent_by = this.removePlusPrefix(
                        responseMessage.to.uri.user
                    );
                    if (event.message.getHeader('X-CAFE-MSG-CALLED-TYPE') == 'whatsapp') {
                        sent_by = `whatsapp:${sent_by}`
                    }
                    const messageId = responseMessage.getHeader(
                        'X-Cafe-Message-Id'
                    );
                    if (event.message.getHeader('X-CAFE-MSG-CALLED-TYPE') == 'whatsapp') {
                        sent_by = `whatsapp:${sent_by}`
                    }
                    let peerId = undefined;
                    const messageDetails = new Promise(async (resolve, reject) => {
                        // let userId: string;
                        // this.store.select(selectUserId).subscribe(value => {
                        //     userId = value;
                        // });
                        // const getMessages = await this.dbContext.message.getMessages(userId);
                        // const resMsg = getMessages.filter((msg) => msg.id === responseMessage.callId)
                        // logger.debug('CallId::' + responseMessage.callId  + 'Processing fetching peerId from indexdb' + 'PeerId::' + resMsg[0]["peerId"]);
                        // resolve({ resMsg })

                        const peerMessages$ = store
                            .select(selectPeersMessages(sipService.getUserUri))
                            .pipe(
                                map((m) => m.filter((f) => f.messages?.length > 0 && f.peerId != '' && f.peerId != undefined)),
                            );
                        peerMessages$.subscribe((peers) => {
                            if (peers.length > 0) {
                                this.peerids = peers;
                                peers.forEach((e) => {
                                    const msg = e.messages.filter((msg) => {
                                        msg.id == responseMessage.callId
                                        if (msg.id == responseMessage.callId) {
                                            logger.debug('Msg with callId exists against peerid::', e.peer.id);
                                            peerId = e.peer.id;
                                            return
                                        }
                                    });
                                })
                            }
                        });
                        resolve({ peerId })
                    })
                    messageDetails.then((res) => {
                        logger.debug("MessagingService : Dispatching action for Accepting outgoing message with PeerId & SentBy::", peerId, sent_by);
                        //const peerId = res["resMsg"].length > 0 ? res["resMsg"][0]["peerId"] : undefined;
                        this.store.dispatch(
                            outgoingSessionMessageAccepted({
                                peerId: peerId ? peerId : sent_by,
                                callId: responseMessage.callId,
                                messageId,
                                dateTime: new Date().toISOString(),
                                resendCallId: event.message.getHeader(
                                    RESEND_CALL_ID
                                ),
                                threadId: threadIdHeader,
                            })
                        );
                    })
                    logger.debug("MessagingService : AcceptOutgoingRequestEvent completed");
                }
                if (event.kind === 'UserAgentSendMessageEvent' && event.event.kind === 'RejectOutgoingRequestEvent') {
                    logger.debug('CallId::' + event.event.response.message.callId + '&ResendCallId::' + event.message.getHeader(RESEND_CALL_ID) + '&MsgId::' + event.event.response.message.getHeader('X-Cafe-Message-Id') + ' Processing::' + event.event.kind);
                    const message = event.message;
                    let sent_by = this.removePlusPrefix(
                        message.to.uri.user
                    );
                    const threadIdHeader = message.getHeader('X-CAFE-MESSAGE-THREAD');
                    const parties_list = message.getHeader('X-CAFE-PARTICIPANTS');
                    if (parties_list !== undefined && parties_list !== null) {
                        sessionStorage.setItem('resend-' + message.callId, parties_list)
                        sent_by = sortParticipantsAsID(parties_list.split('|'));
                    } else {
                        if(message.extraHeaders[4] == 'X-CAFE-MSG-CALLED-TYPE: whatsapp'){
                          sessionStorage.setItem('resend_121-' + message.callId, 'whatsapp:' + sent_by)
                        }
                    }
                                            
                    if(message.extraHeaders[4] == 'X-CAFE-MSG-CALLED-TYPE: whatsapp'){
                        sent_by = 'whatsapp:' + sent_by;
                    }
                    //if(message?.getHeader(RESEND_CALL_ID) && sent_by){
                        store.dispatch(
                            outgoingSessionMessageRejected({
                                peerId: sent_by,
                                callId: message.callId,
                                resendCallId: message.getHeader(RESEND_CALL_ID),
                                error: {
                                    dateTime: new Date().toISOString(),
                                    code: event.event.response.message.statusCode,
                                    message:
                                        event.event.response.message.reasonPhrase,
                                },
                                threadId: threadIdHeader,
                            })
                        );

                    //}
                    if (event.event.response.message.statusCode === 408 || event.event.response.message.statusCode === 503) {
                        console.warn(
                            '$$$ 408 for message, try to reregister'
                        );
                        this.userService.registeredSecondarySipUser$.next(null);
                        this.userService.register_secondary_site();
                    }

                } else if (
                    event.kind === 'UserAgentCommonEvent' &&
                    event.event.kind === 'MessageUserEvent'
                ) {
                    logger.debug('MsgId::' + event.event.message?.request?.getHeader('X-Cafe-Message-Id') + ' Processing::' + event.event.kind);
                    const message = event.event.message;
                    const request = message.request;
                    const messageId = request.getHeader('X-Cafe-Message-Id');
                    sessionStorage.setItem(messageId, 'true');
                    const isCalllogNotification = request.getHeader('X-CAFE-NOTIFICATION') === 'Calllog';
                    if (isCalllogNotification) {
                        logger.debug('Refresh call log message ignore');
                        event.event.message.accept();
                        return;
                    }
                    // check if incomming message from whatsapp and if yes, update peer id accordingly
                    const isWhatsAppThread = request.getHeader('X-Cafe-Msg-Caller-Type');
                    let sent_by = this.removePlusPrefix(
                        request.from.uri.user
                    );
                    // Incoming message
                    // Message not exist in store
                    sent_by = isWhatsAppThread ? `${isWhatsAppThread}:${sent_by}` : sent_by;
                    const messageTime = serverDateToISO(
                        request.getHeader('X-CAFE-MESSAGE-TIMESTAMP')
                    );
                    const systemCafeHeader = request.getHeader('X-CAFE-SYSTEM-MESSAGE-TYPE');

                    let messageReadTime: any;
                    if(systemCafeHeader){
                        messageReadTime = serverDateToISO(
                            request.getHeader('X-CAFE-MESSAGE-READ-TIMESTAMP'));
                    }

                    const isSystem =
                        request.getHeader('X-CAFE-SYSTEMGEN') === 'Yes';
                    const threadId = request.getHeader('X-CAFE-MESSAGE-THREAD');
                    const sent_to = userService?.user?.multiLine;
                    let parties_list = request.getHeader('X-Cafe-Participants');
                    let fromNumber = request.getHeader('From').split(" ")[0].split("\"")[1];
                    if(parties_list?.includes('|') && parties_list?.includes('whatsapp:')  && parties_list?.split('|').length == 2){
                        let loggedinuser = parties_list?.split('|').filter((id) => id == sessionStorage.getItem("__api_identity__"))
                        if(loggedinuser.length == 1){
                          sent_by = parties_list?.split('|').filter((id) => id.includes('whatsapp'))[0]
                          fromNumber = sent_by.replace('whatsapp:', '')
                          parties_list = undefined
                        }
                    }

                    const multimediaId = request.getHeader('X-CAFE-MULTIMEDIA-ID');
                    const multimediaType = request.getHeader('X-CAFE-MULTIMEDIA-CONTENT-TYPE');
                    let messageChannelType = '';
                    if(parties_list){
                        messageChannelType = getMsgChannelTypeFromParticipants(getValidParticipantsArray(parties_list))
                    } else {
                        let clrtype = request.getHeader('X-CAFE-MSG-CALLED-TYPE') ? request.getHeader('X-CAFE-MSG-CALLED-TYPE') : request.getHeader('X-Cafe-Msg-Caller-Type');
                        messageChannelType = getMessageChannelType(clrtype, fromNumber, threadId)   // get msgType for whatsapp, Line & WeChat
                    }
                    // if (systemCafeHeader === "16") {
                    //     this.updateSentRequestCount(threadId);
                    // }
                    //if (systemCafeHeader === "33") {
                    //    sessionStorage.setItem("__enable_whatsapp_message__", "false");
                    //}
                    let messageInfo = {}
                    if  (systemCafeHeader === "30" && event.event.body.includes("and shared chat history")) {
                        this.loadPeerHistory(threadId);
                    }
                    if (systemCafeHeader === "26") {
                        event.event.body = "Looks like this contact hasn't enabled WhatsApp."
                    }

                    if (multimediaId !== undefined) {
                        sessionStorage.setItem("inboundPic", multimediaId);
                        fromNumber = sent_by ? sent_by : fromNumber
                        messageInfo = {
                            id: messageId,
                            session_id: multimediaId, // mms_session for now, can hold multiple session_id of diff msg types
                            multimediaStatus: 'not-initiated',
                            messageType: 'picture',
                            parties_list: parties_list ? parties_list : sent_by,
                            multimediaContentType: multimediaType,
                            from: fromNumber,
                            to: sessionStorage.getItem('__api_identity__'),
                        }
                    }

                    sessionStorage.setItem('incomingGroupParticipants', JSON.stringify(parties_list));

                    const groupParticipants = sessionStorage.getItem('incomingGroupParticipants');
                    let allNumbers = "";
                    if (groupParticipants !== 'undefined' && groupParticipants != null) {
                        sessionStorage.setItem('participants', JSON.parse(groupParticipants));

                        const participants = JSON.parse(groupParticipants).split('|');
                        const sortParticipants = participants.sort((a, b) => 0 - (a > b ? -1 : 1));
                        let getPartiesList = "";

                        for (let i = 0; i < sortParticipants.length; i++) {
                            if (i === 0) {
                                getPartiesList = sortParticipants[i];
                                allNumbers = sortParticipants[i];
                            } else {
                                getPartiesList = getPartiesList + ',' + sortParticipants[i];
                                allNumbers = allNumbers + sortParticipants[i];
                            }
                        }

                        this.dbContext.message.addParticipants(allNumbers, JSON.parse(groupParticipants), threadId);
                        sessionStorage.setItem(allNumbers, JSON.parse(groupParticipants));
                        sessionStorage.setItem(threadId, JSON.stringify(getPartiesList));
                    } else {
                        sessionStorage.setItem('participants', null);
                    }

                    //
                    // const msgIdExists = await this.dbContext.message.checkMsgIdExistsorNot(messageId);
                    // if(msgIdExists){
                    //     console.log('MessagingService: Blocking following msg since allready exists msg in db with same id:', messageId)
                    //     message.accept();
                    // } 
                    if (sent_by === sent_to) {
                        let peerId = request.getHeader('X-CAFE-RECIPIENT');
                        let messageInfo = {};
                        if (multimediaId !== undefined) {
                            messageInfo = {
                                id: messageId,
                                session_id: multimediaId, // mms_session for now, can hold multiple session_id of diff msg types
                                multimediaStatus: 'not-initiated',
                                messageType: 'picture',
                                parties_list: parties_list ? parties_list : peerId,
                                from: sessionStorage.getItem('__api_identity__'),
                                to: peerId,
                                multimediaContentType: multimediaType,
                            }
                        }
                        // const recipientHeader = request.getHeader('X-CAFE-RECIPIENT')
                        // Self message, just notify sipjs, it is accepted
                        // Once accepted server should not push tis message anymore
                        // TODO : Check not in cache !
                        // skip messages from itself
                        console.warn('from secondary received self-message, accept it', event);
                        if (!event.event.body) {
                            console.warn(
                                'received self-message, with empty content, looks like server push ACCEPT message from my another device!',
                                event
                            );

                            if (systemCafeHeader === "4") {
                                const vvmMsg = new Promise(async (resolve, reject) => {
                                    const vvm = await this.messagingDataAccessService.getVVMMsgById(messageId);
                                    resolve({ vvm })
                                });
                                let peerid;
                                let parties_list;
                                vvmMsg.then(async res => {
                                    peerid = res['vvm'][0].peerId
                                    parties_list = res['vvm'][0].messageInfo.parties_list
                                    await this.messagingDataAccessService.updateVoicMailMessageReadStatus(messageId);
                                    await this.messagingDataAccessService.updateVoicemailReadStatusInStore(
                                        {
                                            peerId: peerid,
                                            id: messageId,
                                            partiesList: parties_list
                                        }
                                    );
                                });
                            }

                            if (systemCafeHeader == "3") {

                                this.loadLatestVoiceMail();
                            }
                            if (systemCafeHeader === '1') {
                                this.store.dispatch(
                                    messageRead({
                                        peerId,
                                        messageId,
                                        dateTime: messageReadTime,
                                        threadId,
                                        isSystem
                                    })
                                );
                            }
                            return;
                        }
                        peerId = allNumbers !== "" ? allNumbers : peerId;

                        const msgbody =  event.event.body;
                        if(peerId){
                            setTimeout(() => {
                                store.dispatch(
                                    checkIncomingSessionSelfMessage({
                                        peerId,
                                        messageId,
                                        fromNum: fromNumber,
                                        content: msgbody,
                                        dateTime: messageTime,
                                        isSystem,
                                        threadId,
                                        parties_list,
                                        messageType: multimediaId ? 'picture' : 'text',
                                        messageInfo: messageInfo,
                                        stype: systemCafeHeader ? Number(systemCafeHeader) : null,
                                        messageChannelType
                                    })
                                );
                              }, 5000)
                        }

                        message.accept();
                        this.addsyncmessages(systemCafeHeader, event.event.body, threadId);
                    } else {
                        sent_by = allNumbers !== "" ? allNumbers : sent_by;
                        store.dispatch(
                            addIncomingSessionMessage({
                                peerId: sent_by,
                                messageId,
                                fromNum: fromNumber,
                                content: event.event.body,
                                dateTime: messageTime,
                                isSystem,
                                threadId,
                                parties_list,
                                messageType: multimediaId ? 'picture' : 'text',
                                messageInfo: messageInfo,
                                stype: systemCafeHeader ? Number(systemCafeHeader) : null,
                                messageChannelType
                            })
                        );
                        message.accept();
                        this.addsyncmessages(systemCafeHeader, event.event.body, threadId);
                    }
                }
            });



        userAgentEvents$
            .pipe(withLatestFrom(contacts$), shareReplay())
            .subscribe(async ([event]) => {
                logger.debug('Primary Event::', event);
                if(event?.kind === 'UserAgentTransportStateChangedEvent' &&
                event?.state != 'Connected'){
                    //this.authDataAccess.serverCntcStsDataEvent('Disconnected');
                    logger.debug('Primary Server Websocket Disconnected');
                }else if(event.kind === 'UserAgentRegisterEvent' &&
                event.event.kind === 'AcceptOutgoingRequestEvent'){
                    logger.debug('Processing Primary::' + event.event.kind + ' StatusCode::' + event.event.response.message.statusCode);
                    if(event.event.response.message.statusCode == 200){
                        logger.debug('Primary Server Registered Successfully after Register Check');
                        this.authDataAccess.serverCntcStsDataEvent(null);
                    }
                }else if(event.kind === 'UserAgentRegisterEvent' &&
                event.event.kind === 'RejectOutgoingRequestEvent'){
                    logger.debug('Processing Primary::' + event.event.kind + 'Reason::' + event.event.response.message.reasonPhrase);
                    this.authDataAccess.serverCntcStsDataEvent('Disconnected');
                    if (event.event.response.message.reasonPhrase == 'OTP Auth Error' && event.event.response.message.statusCode == 500) {
                        //if with same otp trying for registration more than 2 times should stop and inform 
                        //client to reload application manually
                        if(this.otpRetryCount <= 1){ 
                            this.retryOtpAndTryReregistration('Primary');
                        }else {
                            console.log('Tried OTP validation twice need manuall refresh here...')
                         }
                    }else if (event.event.response.message.reasonPhrase != 'OTP Auth Error' && event.event.response.message.statusCode == 500 || event.event.response.message.statusCode == 503 || event.event.response.message.statusCode == 408) {
                        logger.debug('Calling Primary Server Registration based on StatusCode::', event.event.response.message.statusCode);
                        this.userService.reRegister();
                    }
                }else if (
                    event.kind === 'UserAgentOutgoingActionEvent' &&
                    event.action.kind === 'UserAgentOutgoingMessageAction'
                ) {
                    logger.debug('CallId:: ' + event.action?.message?.callId + ' Processing::' + event.action.kind);
                    const message = event.action.message;
                    const valid = event.action.valid;
                    // Message not exist in store
                    let sent_by = this.removePlusPrefix(
                        message.to.uri.user
                    );
                    // update sent_by field if message is sent from whatsapp
                    if (message.getHeader('X-CAFE-MSG-CALLED-TYPE') == 'whatsapp') {
                        sent_by = `whatsapp:${sent_by}`
                    }
                    const isSystem =
                        message.getHeader('X-CAFE-SYSTEMGEN') === 'Yes';
                    const parties_list = message.getHeader('X-CAFE-PARTICIPANTS');
                    if(parties_list){
                        sessionStorage.setItem(message.callId, JSON.stringify(sortParticipantsAsID(parties_list.split('|'))));
                    }
                    const participants = sessionStorage.getItem('participants');
                    // if (participants !== "null" && participants !== null && participants !== 'undefined') {
                    //     const allNumbers = sortParticipantsAsID(participants.split('|'));
                    //     sessionStorage.setItem(message.callId, JSON.stringify(allNumbers));
                    // }
                    const fromNumber = message.getHeader('From').split(" ")[0].split("\"")[1];
                    const multimediaId = message.getHeader('X-CAFE-MULTIMEDIA-ID');
                    const multimediaType = message.getHeader('X-CAFE-MULTIMEDIA-CONTENT-TYPE');
                    const toNumber = message.getHeader('To')

                    const to_ = this.getToValueForMessageInfo(participants, parties_list, message);
                    //let to_ = message.getHeader('To').replace("<sip:+", "").split("@")[0];
                    let messageType: MessageType = "text";
                    let messageInfo = {}
                    if (multimediaId !== undefined) {
                        messageType = "picture";
                        messageInfo = {
                            id: message.callId,
                            session_id: multimediaId, // mms_session for now, can hold multiple session_id of diff msg types
                            multimediaStatus: 'not-initiated',
                            messageType: 'picture',
                            parties_list: parties_list ? parties_list : sent_by,
                            from: sessionStorage.getItem('__api_identity__'),
                            to: to_,
                            multimediaContentType: multimediaType,
                        }
                    }
                    store.dispatch(
                        addOutgoingSessionMessage({
                            peerId: sent_by,
                            callId: message.callId,
                            content: message.body.body,
                            dateTime: new Date().toISOString(),
                            resendCallId: message.getHeader(RESEND_CALL_ID),
                            isSystem,
                            parties_list: parties_list,
                            participants: parties_list ? parties_list.split('|') : [sent_by],
                            messageType,
                            messageInfo,
                            valid
                        })
                    );
                } else if (
                    event.kind === 'UserAgentSendMessageEvent' &&
                    event.event.kind === 'AcceptOutgoingRequestEvent'
                ) {
                    logger.debug('CallId::' + event.event.response.message.callId + '&MsgId::' + event.event.response.message.getHeader('X-Cafe-Message-Id') + ' Processing::' + event.event.kind);
                    const responseMessage = event.event.response.message;
                    const threadIdHeader = event.message.getHeader('X-CAFE-MESSAGE-THREAD');
                    let sent_by = this.removePlusPrefix(
                        responseMessage.to.uri.user
                    );
                    // update sent_by field if message is sent from whatsapp
                    if (event.message.getHeader('X-CAFE-MSG-CALLED-TYPE') == 'whatsapp') {
                        sent_by = `whatsapp:${sent_by}`
                    }
                    const messageId = responseMessage.getHeader(
                        'X-Cafe-Message-Id'
                    );
                    let peerId = undefined;
                    const messageDetails = new Promise(async (resolve, reject) => {
                        // let userId: string;
                        // this.store.select(selectUserId).subscribe(value => {
                        //     userId = value;
                        // });
                        // const getMessages = await this.dbContext.message.getMessages(userId);
                        // const resMsg = getMessages.filter((msg) => msg.id === responseMessage.callId)
                        // //logger.debug("MessagingService : Searched for accepting outgoing message");
                        // logger.debug('CallId::' + responseMessage.callId  + 'Processing fetching peerId from indexdb' + 'PeerId::' + resMsg[0]["peerId"]);
                        // resolve({ resMsg })

                        const peerMessages$ = store
                            .select(selectPeersMessages(sipService.getUserUri))
                            .pipe(
                                map((m) => m.filter((f) => f.messages?.length > 0 && f.peerId != '' && f.peerId != undefined)),
                            );
                        peerMessages$.subscribe((peers) => {
                            if (peers.length > 0) {
                                this.peerids = peers;
                                peers.forEach((e) => {
                                    const msg = e.messages.filter((msg) => {
                                        msg.id == responseMessage.callId
                                        if(msg.id == responseMessage.callId){
                                            logger.debug('Msg with callId exists against peerid::', e.peer.id);
                                            peerId = e.peer.id;
                                            return
                                        }
                                    });
                                })
                            }
                        });
                        resolve({ peerId })
                    })
                    messageDetails.then((res) => {
                        logger.debug("MessagingService : Dispatching action for Accepting outgoing message with PeerId & SentBy::", peerId, sent_by);                        
                        //const peerId = res["resMsg"].length > 0 ? res["resMsg"][0]["peerId"] : undefined;
                        this.store.dispatch(
                            outgoingSessionMessageAccepted({
                                peerId: peerId ? peerId : sent_by,
                                callId: responseMessage.callId,
                                messageId,
                                dateTime: new Date().toISOString(),
                                resendCallId: event.message.getHeader(
                                    RESEND_CALL_ID
                                ),
                                threadId: threadIdHeader,
                            })
                        );
                    })
                }
                if (
                    event.kind === 'UserAgentSendMessageEvent' &&
                    event.event.kind === 'RejectOutgoingRequestEvent'
                ) {
                    logger.debug('CallId::' + event.event.response.message.callId + '&ResendCallId::' + event.message.getHeader(RESEND_CALL_ID) + '&MsgId::' + event.event.response.message.getHeader('X-Cafe-Message-Id') + ' Processing::' + event.event.kind);
                    const message = event.message;
                    const threadIdHeader = message.getHeader('X-CAFE-MESSAGE-THREAD');
                    let sent_by = this.removePlusPrefix(
                        message.to.uri.user
                    );

                    const parties_list = message.getHeader('X-CAFE-PARTICIPANTS');
                    if (parties_list !== undefined && parties_list !== null) {
                        sessionStorage.setItem('resend-' + message.callId, parties_list)
                        sent_by = sortParticipantsAsID(parties_list.split('|'));
                    } else {
                        if(message.extraHeaders[4] == 'X-CAFE-MSG-CALLED-TYPE: whatsapp'){
                          sessionStorage.setItem('resend_121-' + message.callId, 'whatsapp:' + sent_by)
                        }
                    }
                                            
                    if(message.extraHeaders[4] == 'X-CAFE-MSG-CALLED-TYPE: whatsapp'){
                        sent_by = 'whatsapp:' + sent_by;
                    }
                    //if (message?.getHeader(RESEND_CALL_ID) && sent_by) {
                        store.dispatch(
                            outgoingSessionMessageRejected({
                                peerId: sent_by,
                                callId: message.callId,
                                resendCallId: message.getHeader(RESEND_CALL_ID),
                                error: {
                                    dateTime: new Date().toISOString(),
                                    code: event.event.response.message.statusCode,
                                    message:
                                        event.event.response.message.reasonPhrase,
                                },
                                threadId: threadIdHeader,
                            })
                        );
                    //}
                    if (
                        event.event.response.message.statusCode ===
                        408 || event.event.response.message.statusCode === 503
                    ) {
                        console.warn(
                            '$$$ 408 for message, try to reregister'
                        );
                        this.userService.registeredSipUser$.next(null);
                        this.userService.reRegister();
                    }
                } else if (
                    event.kind === 'UserAgentCommonEvent' &&
                    event.event.kind === 'MessageUserEvent'
                ) {
                    logger.debug('MsgId::' + event.event.message?.request?.getHeader('X-Cafe-Message-Id') + ' Processing::' + event.event.kind);
                    const message = event.event.message;
                    const request = message.request;
                    const messageId = request.getHeader('X-Cafe-Message-Id');
                    sessionStorage.setItem(messageId, 'true');
                    const isCalllogNotification = request.getHeader('X-CAFE-NOTIFICATION') === 'Calllog';
                    if (isCalllogNotification) {
                        logger.debug('Refresh call log message ignore');
                        event.event.message.accept();
                        return;
                    }
                    // Incoming message
                    // Message not exist in store
                    if(sessionStorage.getItem('processing-'+messageId) != null){
                        logger.debug('Message is getting processed, discard the sync message');
                        event.event.message.accept();
                        return;
                    }
                    sessionStorage.setItem('processing-'+messageId,"yes")
                    const isWhatsAppThread = request.getHeader('X-Cafe-Msg-Caller-Type');
                    let sent_by = this.removePlusPrefix(
                        request.from.uri.user
                    );
                    sent_by = isWhatsAppThread ? `${isWhatsAppThread}:${sent_by}` : sent_by;

                    const messageTime = serverDateToISO(
                        request.getHeader('X-CAFE-MESSAGE-TIMESTAMP')
                    );
                    const systemCafeHeader = request.getHeader('X-CAFE-SYSTEM-MESSAGE-TYPE');

                    let messageReadTime: any;
                    if(systemCafeHeader){
                        messageReadTime = serverDateToISO(
                            request.getHeader('X-CAFE-MESSAGE-READ-TIMESTAMP'));
                    }

                    const isSystem =
                        request.getHeader('X-CAFE-SYSTEMGEN') === 'Yes';
                    const threadId = request.getHeader('X-CAFE-MESSAGE-THREAD');
                    
                    const sent_to = userService?.user?.multiLine;
                    let parties_list = request.getHeader('X-Cafe-Participants');
                    let fromNumber = request.getHeader('From').split(" ")[0].split("\"")[1];
                    if(parties_list?.includes('|') && parties_list?.includes('whatsapp:')  && parties_list?.split('|').length == 2){
                        let loggedinuser = parties_list?.split('|').filter((id) => id == sessionStorage.getItem("__api_identity__"))
                        if(loggedinuser.length == 1){
                          sent_by = parties_list?.split('|').filter((id) => id.includes('whatsapp'))[0]
                          fromNumber = sent_by.replace('whatsapp:', '')
                          parties_list = undefined
                        }
                    }

                    sessionStorage.setItem('incomingGroupParticipants', JSON.stringify(parties_list));
                    //console.log('test from is', request.getHeader('From'));
                    //console.log('test from number is', fromNumber);
                    //const messageChannelType = getMessageChannelType(request.getHeader('X-Cafe-Msg-Caller-Type'), '101' + fromNumber, threadId)   // get msgType for whatsapp, Line & WeChat
                    let messageChannelType = '';
                    if(parties_list){
                        messageChannelType = getMsgChannelTypeFromParticipants(getValidParticipantsArray(parties_list))
                    } else {
                        let clrtype = request.getHeader('X-CAFE-MSG-CALLED-TYPE') ? request.getHeader('X-CAFE-MSG-CALLED-TYPE') : request.getHeader('X-Cafe-Msg-Caller-Type');
                        messageChannelType = getMessageChannelType(clrtype, fromNumber, threadId)   // get msgType for whatsapp, Line & WeChat
                    }
                    const groupParticipants = sessionStorage.getItem('incomingGroupParticipants');
                    const multimediaId = request.getHeader('X-CAFE-MULTIMEDIA-ID');
                    const multimediaType = request.getHeader('X-CAFE-MULTIMEDIA-CONTENT-TYPE');
                    let to_ = request.getHeader('To').replace("<sip:+", "").split("@")[0];
                    // if (systemCafeHeader === "16") {
                    //     this.updateSentRequestCount(threadId);
                    // }
                    //if (systemCafeHeader === "33") {
                    //    sessionStorage.setItem("__enable_whatsapp_message__", "false");
                    //}
                    let messageInfo = {};
                    if (systemCafeHeader === "26") {
                        event.event.body = "Looks like this contact hasn't enabled WhatsApp."
                    }
                    if (multimediaId !== undefined) {
                        sessionStorage.setItem("inboundPic", multimediaId);
                        fromNumber = sent_by ? sent_by : fromNumber
                        messageInfo = {
                            id: messageId,
                            session_id: multimediaId, // mms_session for now, can hold multiple session_id of diff msg types
                            multimediaStatus: 'not-initiated',
                            messageType: 'picture',
                            parties_list: parties_list ? parties_list : sent_by,
                            from: fromNumber,
                            to: sessionStorage.getItem('__api_identity__'),
                            multimediaContentType: multimediaType,
                        }
                    }
                    let allNumbers = "";
                    if (groupParticipants !== 'undefined' && groupParticipants != null) {
                        sessionStorage.setItem('participants', JSON.parse(groupParticipants));

                        const participants = JSON.parse(groupParticipants).split('|');
                        const sortParticipants = participants.sort((a, b) => 0 - (a > b ? -1 : 1));
                        let getPartiesList = "";

                        for (let i = 0; i < sortParticipants.length; i++) {
                            if (i === 0) {
                                getPartiesList = sortParticipants[i];
                                allNumbers = sortParticipants[i];
                            } else {
                                getPartiesList = getPartiesList + ',' + sortParticipants[i];
                                allNumbers = allNumbers + sortParticipants[i];
                            }
                        }

                        this.dbContext.message.addParticipants(allNumbers, JSON.parse(groupParticipants), threadId);
                        sessionStorage.setItem(allNumbers, JSON.parse(groupParticipants));
                        sessionStorage.setItem(threadId, JSON.stringify(getPartiesList));
                    } else {
                        sessionStorage.setItem('participants', null);
                    }

                    //

                    // const msgIdExists = await this.dbContext.message.checkMsgIdExistsorNot(messageId);
                    // if(msgIdExists){
                    //     console.log('MessagingService: Blocking following msg since allready exists msg in db with same id:', messageId)
                    //     message.accept();
                    // }
                    if (sent_by === sent_to) {
                        let peerId = request.getHeader('X-CAFE-RECIPIENT');
                        let messageInfo = {};
                        if (multimediaId !== undefined) {
                            messageInfo = {
                                id: messageId,
                                session_id: multimediaId, // mms_session for now, can hold multiple session_id of diff msg types
                                multimediaStatus: 'not-initiated',
                                messageType: 'picture',
                                parties_list: parties_list ? parties_list : peerId,
                                from: sessionStorage.getItem('__api_identity__'),
                                to: peerId,
                                multimediaContentType: multimediaType,
                            }
                        }
                        // Self message, just notify sipjs, it is accepted
                        // Once accepted server should not push tis message anymore
                        // TODO : Check not in cache !
                        // skip messages from itself
                        console.warn('from primary received self-message, accept it::', event);

                        if (!event.event.body) {
                            console.warn(
                                'received self-message, with empty content, looks like server push ACCEPT message from my another device!',
                                event
                            );


                            if (systemCafeHeader === "4") {
                                const vvmMsg = new Promise(async (resolve, reject) => {
                                    const vvm = await this.messagingDataAccessService.getVVMMsgById(messageId);
                                    resolve({ vvm })
                                });
                                let peerid;
                                let partieslist;
                                vvmMsg.then(async res => {
                                    peerid = res['vvm'][0].peerId
                                    partieslist = res['vvm'][0].messageInfo.parties_list
                                    await this.messagingDataAccessService.updateVoicMailMessageReadStatus(messageId);
                                    await this.messagingDataAccessService.updateVoicemailReadStatusInStore(
                                        {
                                            peerId: peerid,
                                            id: messageId,
                                            parties_list: partieslist
                                        }
                                    );
                                    // const updateVVM = new Promise(async (resolve, reject) => {
                                    //     let userId: string;
                                    //     this.store.select(selectUserId).subscribe(value => {
                                    //         userId = value;
                                    //     });
                                    //     const getMessgaes = await this.dbContext.message.getVoiceMails(userId)
                                    //     resolve({ getMessgaes })
                                    // })
                                    // updateVVM.then(value => {
                                    //     const res = JSON.parse(JSON.stringify(value))
                                    //     this.store.dispatch(loadInitialVoiceMailHistorySuccess({ vvms: res.getMessgaes }))
                                    // })
                                });
                            }


                            if (systemCafeHeader == "3") {

                                this.loadLatestVoiceMail();
                            }
                            if (systemCafeHeader === '1') {
                                this.store.dispatch(
                                    messageRead({
                                        peerId,
                                        messageId,
                                        dateTime: messageReadTime,
                                        threadId,
                                        isSystem
                                    })
                                );
                            }
                            return;
                        }
                        peerId = allNumbers !== "" ? allNumbers : peerId;

                        const msgbody =  event.event.body;
                        if(peerId){
                            setTimeout(() => {
                                store.dispatch(
                                    checkIncomingSessionSelfMessage({
                                        peerId,
                                        messageId,
                                        fromNum: fromNumber,
                                        content: msgbody,
                                        dateTime: messageTime,
                                        isSystem,
                                        threadId,
                                        parties_list,
                                        messageType: multimediaId ? 'picture' : 'text',
                                        messageInfo: messageInfo,
                                        stype: systemCafeHeader ? Number(systemCafeHeader) : null,
                                        messageChannelType
                                    })
                                );
                              }, 5000)
                        }

                        if(sessionStorage.getItem('processing-'+messageId) != null){
                            sessionStorage.removeItem('processing-'+messageId);
                        }                
                        message.accept();
                        this.addsyncmessages(systemCafeHeader, event.event.body, threadId);
                    } else {
                        sent_by = allNumbers !== "" ? allNumbers : sent_by
                        store.dispatch(
                            addIncomingSessionMessage({
                                peerId: sent_by,
                                messageId,
                                fromNum: fromNumber,
                                content: event.event.body,
                                dateTime: messageTime,
                                isSystem,
                                threadId,
                                parties_list,
                                messageType: multimediaId ? 'picture' : 'text',
                                messageInfo: messageInfo,
                                stype: systemCafeHeader ? Number(systemCafeHeader) : null,
                                messageChannelType
                            })
                        );
                        if(sessionStorage.getItem('processing-'+messageId) != null){
                            sessionStorage.removeItem('processing-'+messageId);
                        }
                        message.accept();
                        this.addsyncmessages(systemCafeHeader, event.event.body, threadId);
                    }
                }
            });

        this.peers$ = store.select(selectContactGhosts(sipService.getUserUri));
        this.getContacts();
        this.locationInfoSubject.subscribe((data) => {
            this.locationDetails = data;
        });
    }

    async get_updated_token(){
        const refereshTokenResponse = await this.authDataAccess.refresh_token_on_expiry().toPromise();
          if (refereshTokenResponse.root.desc == 'Success' && refereshTokenResponse.root.sso_access_token != null) {
            sessionStorage.setItem('ssoToken', refereshTokenResponse.root.sso_access_token);
          }
          if (refereshTokenResponse.root.desc == 'Success' && refereshTokenResponse.root.refresh_token != null) {
            sessionStorage.setItem('refreshToken', refereshTokenResponse.root.refresh_token);
          }
    }

    async updateSentRequestCount(threadId) {
        await this.dbContext.message.updateMessageReadSentRequestCount(
            sessionStorage.getItem('__api_identity__'),
            threadId,
        );
    }
    async addEntryInMessageThread(threadData) {
        logger.debug('ThreadId::' + threadData.thread_id + ' Processing:: addEntryInMessageThread');
        await this.dbContext.message.addOrUpdateMessageThread(
            {
                id: threadData.thread_id,
                createdAt: threadData.lastIncommingMessageAt ? threadData.lastIncommingMessageAt : null,
                readTime: threadData.lastIncommingMessageAt ? threadData.lastIncommingMessageAt : null,
                isWhatsAppThread: true,
                att_status: threadData.att_status ? threadData.att_status : "2",
                messages: threadData.messages ? threadData.messages : [],
                lastIncommingMessageAt: threadData.lastIncommingMessageAt ? threadData.lastIncommingMessageAt : new Date(),
                messageChannelType: 'whatsapp'
            },
            sessionStorage.getItem('__api_identity__'),
        );
    }

    sendMessage(toUri: string, msg: string, session?: any) {
        const sendToWhatsApp = toUri.includes('whatsapp');
        const sendToLineorWechat = toUri.includes('whatsapp:101') || toUri.includes('whatsapp:100');
        const participants = session?.participants ? session?.participants : null;
        if (sendToWhatsApp) {
            toUri = toUri.replace('whatsapp:', '');
        }
        this.store.dispatch(
            startSendSessionMessage({
                peerUri: addPulsToMultilineNumber(toUri),
                content: msg,
                dateTime: new Date().toISOString(),
            })
        );
        const targetUri = this.updateTargetUriWithPlusPrefix(toUri);
        if (this.userService.getActiveSipUser !== undefined && this.userService.getActiveSipUser !== null) {
            this.sipUserValue = this.userService.getActiveSipUser;
        }
        this.sipService.sendMessage(this.sipUserValue, targetUri, msg, participants, sendToWhatsApp, sendToLineorWechat, this.locationDetails);
    }

    async getMultimediaData(from, to, mms_id) {
        return new Promise((resolve, reject) => {
            this.messagingDataAccessService.getMultiMediaData(from, to, mms_id).subscribe(data => {
                const mmsDataResponse = data.root.data;
                const multimediaId = from + '-' + Date.now()
                const blobUrl = convertBinaryToBlob(mmsDataResponse, data.root.content_type)
                const media: Media = {
                    id: multimediaId,
                    data: blobUrl,
                    update_r_download_time: Date.now.toString(),
                    fileName: data.root.filename
                }
                this.dbContext.message.addOrUpdateMedia(from, media);
                resolve(media)
            })
        })

    }

    async forwardMultimediaMessage(params) {
        let mediaInfo = params.mediaInfo;
        if (!mediaInfo) {
            const messageInfo = await this.dbContext.message.getMessageInfo(params.messageId)
            // const multimediadata = await this.getMultimediaData(messageInfo.from, messageInfo.to, messageInfo.session_id).subscribe;

            const mmsdata = await this.getMultimediaData(messageInfo.from, messageInfo.to, messageInfo.session_id);
            mediaInfo = mmsdata;
        }
        const blob: Blob = mediaInfo.data;
        const base46 = await blobToBase64(blob);
        const file = base64toFile(base46, mediaInfo.fileName.split('.')[0]);
        const multiLineUri = params.peerUri;
        let peerId = multiLineUri.replace("sip:", "")
        peerId = peerId.split("@")[0];

        const session: PeerChatSession = {
            threadId: "",
            isMuted: false,
            peer: {
                id: peerId,
                uri: "",
                multiLineUri,
                name: "",
                img: "",
                multiLine: "",
                firstName: "",
                lastName: "",
                multiLineType: ""
            },
            messages: [],
            status: {
                kind: 'StateStatusInitial'
            },
        }

        this.sendMultimediaMessage(session, file, true)

    }

    addsyncmessages(systemCafeHeader, body, threadId){
        if  (systemCafeHeader === "30" && body.includes("and shared chat history")) {
            this.loadPeerHistory(threadId);
        }
    }

    sendMultimediaMessage(session: any, file: File, isForwarding?: boolean) {
        let owner = sessionStorage.getItem('__api_identity__');
        isForwarding = isForwarding || false;
        convertFileToBlob(file).then(async resp => {
            const blobUrl = convertBinaryToBlob(resp, file.type, true)
            sessionStorage.setItem("outboundPic", multimediaId);
            await this.dbContext.message.addOrUpdateMedia(owner, {
                id: multimediaId,
                data: blobUrl,
                update_r_download_time: (new Date()).toString(),
                fileName: file.name,
            });
            logger.debug("media added to Media objectStore");
        })

        const multimediaId = owner + '-' + Date.now();
        let getWhatsAppUser;
        //multimedia support is only for whatsapp
        if(session.messageChannelType == 'whatsapp'){
            session.participants.filter((data) => {
                        if (data.includes('whatsapp:')) {
                            getWhatsAppUser = data.replace('whatsapp:','');
                        }
            })
        }
        const peerUri = session.messageChannelType == 'whatsapp' ? "sip:"+getWhatsAppUser+"@undefined" : session.peer.multiLineUri
        //const peerUri = session.isWhatsAppThread ? "sip:919590743794@undefined" : session.peer.multiLineUri

        const session_id = multimediaId;
        let peer
        if (isForwarding) {
            peer = session.peer.id
        } else {
            peer = (sessionStorage.getItem("participants") === "null") ? session.peer.id : sessionStorage.getItem("participants");
        }
        const info = {
            sentBy: owner,
            sentTo: peer,
            mmsId: multimediaId,
            isWhatsAppThreadId: session.messageChannelType == 'whatsapp' ? session.threadId : undefined
        };
        const msgInfo = { ...info, multimediaStatus: 'downloaded' };
        delete msgInfo.mmsId;
        msgInfo["session_id"] = info.mmsId;
        const targetUri = this.updateTargetUriWithPlusPrefix(peerUri).replace('whatsapp:','');
        const isWhatsApp = peerUri.includes('whatsapp') ? true : session.messageChannelType == 'whatsapp'  ? true : false
        this.store.dispatch(
            addPicMsgPlaceholder({
                peerId: session.peer.id,
                mms_id: multimediaId,
                dateTime: new Date().toISOString(),
                to: targetUri,
                parties_list: sessionStorage.getItem(session.peer.id),
                messageInfo: msgInfo
            })
        )

        this.messagingDataAccessService.uploadMMS(file, info).subscribe(async response => {
            console.log("messagingDataAccessService.uploadMMS:::", response)
            if (response.root && response.root.return == 0) {
                if (this.userService.getActiveSipUser !== undefined && this.userService.getActiveSipUser !== null) {
                    this.sipUserValue = this.userService.getActiveSipUser;
                }
                const mmsDttails = {
                    mms_type: file.type,
                    mms_id: multimediaId
                }
                const isGroup = info["sentTo"].split("|").length > 2 ? true : false
                const group_parties = isGroup ? info["sentTo"] : undefined;
                this.sipService.sendMMSMessage(this.sipUserValue, targetUri, "Multimedia Message", isForwarding, mmsDttails, session?.participants, isGroup, isWhatsApp);
            }
            else {
                let errorCodeArr = [21002,
                    22018,
                    24001
                ];
                //if (-1 === errorCodeArr.indexOf(response.error.apiReturnCode)) {
                    let peerId = peer.indexOf("|") === -1 ? peer : sortParticipantsAsID(peer.split("|"));
                    this.store.dispatch(
                        updatePicMsgAPIError({
                            peerId: peerId.includes('whatsapp') ? session.threadId : peerId,
                            mms_id: multimediaId
                        })
                    )
                    logger.debug("General:: The upload_mms failed for mms::", multimediaId, " as retryqueue added!")
                    const mmsDetails = {
                        sent_by: owner,
                        sent_to: peer,
                        whatsapp: session.messageChannelType == 'whatsapp',
                        threadid: session.threadId ? session.threadId : undefined,
                        targetUri: targetUri,
                        participats: session.participants
                    }
                    const retruQueue: RetryQueue = {
                        id: multimediaId,
                        type: "upload_mms",
                        data: mmsDetails,
                        failedCount: 0,
                        participants: peer.includes("|") ? peer : "null",
                        targetUri: this.updateTargetUriWithPlusPrefix(peerUri),
                        isforward: isForwarding
                    }
                    const queue = await this.dbContext.message.insertToRetryQueue(retruQueue);
                    logger.debug("General:: Retryqueue Data::", queue)
                //}
            }
        })

    }

    retryMultimediaMessage(mmsDetails, targetUri, forward, isGroup, group_parties, waDetails) {
        if (this.userService.getActiveSipUser !== undefined && this.userService.getActiveSipUser !== null) {
            this.sipUserValue = this.userService.getActiveSipUser;
        }
        this.sipService.sendMMSMessage(this.sipUserValue, targetUri, "Multimedia Message", forward, mmsDetails, waDetails);
    }

    startUnknownMultilineSession(multiline: string, msg: string, session: any) {
        const multilineUri = this.sipService.getUserUri(multiline);
        this.sendMessage(multilineUri, msg, session);
    }

    startUnknownMultilineMediaSession(multiline: string, file: File) {
        const multilineUri = this.sipService.getUserUri(multiline);
        // this.sendMessage(multilineUri, msg);
    }

    loadInitialHistory() {
        this.store.dispatch(loadInitialHistory());
    }

    loadPeerHistory(peerId: string, loadNextPage = false, threadTest?: string) {
        this.store.dispatch(
            loadPeerHistory({
                peerId,
                loadNextPage,
                threadTest
            })
        );
    }

    loadPreviousPeerHistory(peerId: string,seq:number,ts:string) {
        this.store.dispatch(
            loadPreviousPeerHistory({
                peerId,
                seq,
                ts
            })
        );
    }

    messageRead(
        peerId: string,
        messageId: string,
        messageTime: string,
        threadId: string,
        isSystem: boolean,
        // isVoiceMail:boolean
    ) {
        this.store.dispatch(
            messageRead({
                peerId,
                messageId,
                dateTime: messageTime,
                threadId,
                isSystem,
                // isVoiceMail
            })
        );
    }

    removePeerMessages(peerId: string) {
        this.store.dispatch(
            startRemovePeerMessages({
                peerId,
            })
        );
    }

    removePeerMessage(peerId: string, messageId: string) {
        this.store.dispatch(
            removePeerMessage({
                peerId,
                messageId,
            })
        );
    }

    async forwardMessage(messageId: string, content: string, messageType: MessageType) {
        if (messageType == "picture") {
            const messageInfo = await this.dbContext.message.getMessageInfo(messageId);
            const session_id = messageInfo.session_id;
            const mediaInfo = await this.dbContext.message.getMediaById(session_id);
            this.store.dispatch(
                forwardMultimediaMessage({
                    messageId,
                    messageType,
                    messageInfo,
                    mediaInfo
                })
            );
        } else {
            this.store.dispatch(
                forwardMessage({
                    messageId,
                    content,
                })
            );
        }

    }

    setThreadMute(threadId: string, isMuted: boolean) {
        this.store.dispatch(
            setTreadMute({
                threadId,
                isMuted,
            })
        );
    }

    private removePlusPrefix(phoneNumber: string) {
        return phoneNumber.replace(/(\+)(\d+)/, '$2');
    }

    private updateTargetUriWithPlusPrefix(targetUri: string) {
        return targetUri.replace(/\:(\d+)\@/, ':+$1@');
    }

    getContacts(): void {
        this.peers$.subscribe(peers => {
            this.savedContact = peers;
            if (this.savedContact.length === 2) {
                this.savedContact.push();
            }
        });
    }

    loadLatestVoiceMail() {
        this.store.dispatch(loadLatestVoiceMail())
    }

    getAllContactName(fromNum: string): string {
        const peer = this.savedContact.filter((e) => e.multiLine === fromNum);
        if (peer.length > 0) {
            return peer[0].name === null ? fromNum
                : peer[0].firstName !== null && peer[0].lastName !== null ? peer[0].name
                    : peer[0].firstName !== null ? peer[0].firstName : peer[0].lastName;
        } else {
            let val = this.savedContact.filter((element) => {
                return element.contact.phones.filter(function (item) {
                    return item.phone === fromNum
                }).length != 0
            }).length != 0
            if (val === true) {
                for (let k = 0; k < this.savedContact.length; k++) {
                    if (this.savedContact[k].contact.phones.filter((a) => a.phone === fromNum).length > 0) {
                        return this.savedContact[k].name === null ? fromNum
                            : this.savedContact[k].firstName !== null && this.savedContact[k].lastName !== null ? this.savedContact[k].name
                                : this.savedContact[k].firstName !== null ? this.savedContact[k].firstName : this.savedContact[k].lastName;
                    }
                }
            }
        }
        return addPulsToMultilineNumber(fromNum);
    }

    getContactRealNumber(fromNum: string) {
        const peer = this.savedContact.filter((e) => e.multiLine === fromNum);
        if (peer.length > 0) {
            if (peer[0].contact.phones.length > 1){
                let groupNumber = peer[0].contact.phones.filter((e)=> e.orgPhone == fromNum)
                return groupNumber ? groupNumber[0].orgPhone : peer[0].contact.phones[0].orgPhone
            }else{
                return peer[0].contact.phones[0].orgPhone;
            }
        }

    }

    getAllRetryQueue() {
        return this.dbContext.message.getAllRetryQueue();
    }

    getMediaById(id: string) {
        return this.dbContext.message.getMediaById(id);
    }

    deleteRetryQueueById(id: string) {
        return this.dbContext.message.deleteRetryQueue(id);
    }

    downloadMMS(sent_by: string, sent_to: string, multimediaId: string) {
        return this.messagingDataAccessService.getMultiMediaData(sent_by, sent_to, multimediaId);
    }

    uploadMMS(mmsFile: File, info: any) {
        return this.messagingDataAccessService.uploadMMS(mmsFile, info)
    }

    updateRetryQueueEntry(queueEntry: RetryQueue) {
        return this.dbContext.message.updateRetryQueueEntry(queueEntry);
    }

    changeName(name: number) {
        this.nameSource.next(name);
    }

    async optInRequest(receiverNumber: string) {
        const url = `/mml/accounts/${this.authService.apiName}/${this.authService.apiIdentity}/create_whatsapp_thread?ver=1&api_token=${this.authService.apiToken}&receiver=${receiverNumber}`;
        return this.geoHttpService.callADKRtnResp(url, "get", null, null).toPromise()
    }


    getToValueForMessageInfo(participants, parties_list, message){
        let to_ = '';
        if((participants != null || participants != undefined) && participants.includes('|')){
                to_ = (participants.split('|')[0] != sessionStorage.getItem('__api_identity__')) ? participants.split('|')[0] : participants.split('|')[1] 
        } else if((parties_list != null || parties_list != undefined) && parties_list.includes('|')){
                to_ = (parties_list.split('|')[0] != sessionStorage.getItem('__api_identity__')) ? parties_list.split('|')[0] : parties_list.split('|')[1]
        } else {
            to_ = message.getHeader('To').replace("<sip:+", "").split("@")[0];
        }
        return to_
    }

    setLocation(data) {
        this.locationInfoSubject.next(data);
    }

    private async getOtp() {
        let otpdata = await this.authDataAccess
            .getOtp(sessionStorage.getItem('device_data_name') + '@')
            .toPromise();
        return otpdata;
    }

    private async retryOtpAndTryReregistration(user_event_data) {
        let sipuserdata;
        if (user_event_data == 'Primary') {
            sipuserdata = JSON.parse(sessionStorage.getItem('sipuserdata'));
        } else {
            sipuserdata = JSON.parse(sessionStorage.getItem('secondarysipuserdata'));
        }
        logger.debug(user_event_data + ' Register Event Otp Expired :: Generate new otp and call register again');
        try {
            let otpdata = await this.getOtp()
            sipuserdata.config.otp = otpdata.root.otp
            if (this.generatedNewOtp == otpdata.root.otp) {
                console.log('previous and current generated otps are same');
                user_event_data == 'Primary' ? sessionStorage.setItem('sipuserdata', JSON.stringify(sipuserdata)) : sessionStorage.setItem('secondarysipuserdata', JSON.stringify(sipuserdata))
                this.userService.register(sipuserdata);
                this.otpRetryCount++;
            }
            if (this.generatedNewOtp != otpdata.root.otp) {
                console.log('Otp are different making count to zero');
                this.generatedNewOtp = otpdata.root.otp
                user_event_data == 'Primary' ? sessionStorage.setItem('sipuserdata', JSON.stringify(sipuserdata)) : sessionStorage.setItem('secondarysipuserdata', JSON.stringify(sipuserdata))
                this.userService.register(sipuserdata);
                this.otpRetryCount = 0;
            }
        } catch (err) {
            logger.debug('Error on Generating otp::', err);
        }
    }

}
