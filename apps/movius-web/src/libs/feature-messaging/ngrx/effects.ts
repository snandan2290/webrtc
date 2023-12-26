import { HttpErrorResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Message } from '@movius/domain';
import { LoggerFactory } from '@movius/ts-logger';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import { SipService, SipUser } from '@scalio/sip';
import { messageInfoType, VoicemailType } from 'libs/domain/src/lib/models/messageInfo';
import { flatten, orderBy } from 'lodash/fp';
import { NzModalService } from 'ng-zorro-antd/modal';
import { combineLatest, Observable, of, fromEvent, merge } from 'rxjs';
import {
    catchError,
    distinctUntilChanged,
    filter,
    map,
    mapTo,
    mergeMap,
    shareReplay,
    switchMap,
    take,
    tap,
    withLatestFrom,
} from 'rxjs/operators';
import { UserContactGhost } from '../../feature-contacts';
import {
    ConfirmDialogComponent,
    DbContext,
    getMsgChannelTypeFromParticipants,
    getValidParticipantsArray,
    getValidXCafeParticipants,
    isHighZoomedScreen,
    loginSuccess,
    SelectContactsDialogComponent,
    selectUserId,
    setTransportStatus,
    SipUserService,
    sortParticipantsAsID
} from '../../shared';
import { Message as MessageDTO, MessagingDataAccessService, MessagingService } from '../services';
import {
    addIncomingSessionMessage,
    addOutgoingSessionMessage,
    checkIncomingSessionSelfMessage,
    forwardMessage,
    loadInitialHistory,
    loadInitialHistoryStoreSuccess,
    loadInitialHistorySuccess,
    loadInitialVoiceMailHistory,
    loadInitialVoiceMailHistorySuccess,
    loadLatestVoiceMail,
    loadPeerHistory,
    loadPeerHistoryError,
    loadPeerHistoryStoreSuccess,
    loadPeerHistorySuccess,
    messageRead,
    outgoingSessionMessageAccepted,
    outgoingSessionMessageRejected,
    readVoicemail,
    rehydrateSuccess,
    removePeerMessage,
    removePeerMessages,
    resendPendingMessages,
    setTreadMute,
    startRemovePeerMessages,
    startSendSessionMessage,
    forwardMultimediaMessage,
    startSendMultimediaMessage,
    hideMessageThread,
    updateRequestCount,
    updateParticipantList,
    loadNextHistory,
    loadPreviousPeerHistory
} from './actions';
import {
    selectMessagesContactGhosts,
    selectPeerThreadStatuses,
    selectPendingMessages,
    selectThreads,
} from './selectors';
import { getThreadPeerId, getThreadPeerIdGroup } from './utils';
import { ParentAppWindow } from '@microsoft/teams-js';

const logger = LoggerFactory.getLogger("")

const getSentToSentBy = (threadParties, msg, peerId) => {
    const identity = sessionStorage.getItem("__api_identity__");
    let sent_by;
    let sent_to;
    if (msg.from === identity) {
        sent_by = identity;
        threadParties = threadParties ? threadParties?.replaceAll("|", ',') : "";
        const parties = threadParties.split(",");
        sent_to = parties.length > 2 ? parties[0] !== identity ? parties[0] : parties[1] : peerId;
    } else {
        sent_by = msg.from;
        sent_to = identity;
    }
    return [sent_by, sent_to];
}

const mapDtoMessage = (peerId: string, threadId: string, threadParties: string) => (msg: MessageDTO): Message => {
    const dt = new Date(msg.ts).toISOString();
    let messageInfo = {};
    let isPicture = false;
    if (msg.multimedia_id !== "" && msg.multimedia_id !== undefined) {
        const identity = sessionStorage.getItem("__api_identity__");
        if (threadParties === null || threadParties === undefined || threadParties === "null") {
            threadParties = `${peerId}|${identity}`;
        }
        if (threadParties.indexOf("\"") !== -1) {
            threadParties = JSON.parse(threadParties);
        }
        const [sent_by, sent_to] = getSentToSentBy(threadParties, msg, peerId);
        isPicture = true;
        messageInfo = {
            id: msg.id,
            session_id: msg.multimedia_id, // mms_session for now, can hold multiple session_id of diff msg types
            multimediaStatus: 'not-initiated',
            messageType: 'picture',
            parties_list: threadParties,
            from: sent_by,
            to: sent_to,
            multimediaContentType: msg.multimedia_content_type,
            stype: msg.stype
        }
    }
    return {
        id: msg.id,
        userId: msg.from,
        callId: null,
        peerId: peerId,
        sentTime: dt,
        content: msg.body,
        threadId,
        isSystem: !!msg.stype,
        state: {
            kind: 'MessageStateSent',
            dateTime: dt,
            seq:msg.seq
        },
        messageType: isPicture ? 'picture' : 'text',
        messageInfo: messageInfo,
        stype: msg.stype
    };
};

const sortMessage = (message: Message) =>
    message.sentTime ? new Date(message.sentTime) : null;

const chooseForwardToUris = (
    modalService: NzModalService,
    contacts: UserContactGhost[],
    mode: number
): Observable<string[]> =>
    modalService
        .create({
            nzContent: SelectContactsDialogComponent,
            nzComponentParams: {
                headerTitle: 'Forward message to',
                okBtnTitle: 'Forward',
                cancelBtnTitle: 'Cancel',
                sourceContacts: contacts,
                mode: mode,
                actionTriggeredFrom: 'forward',
                heightMode: isHighZoomedScreen() ? 'Limited' : 'Normal',
            },
            nzStyle: {
                margin: '20px auto',
            },
            nzMask: true,
            nzFooter: null,
            nzClosable: false,
            nzCentered: true,
        })
        .afterClose.pipe(
            map((m: UserContactGhost[]) =>
                m ? m.map((x) => x.multiLineUri) : []
            )
        );

@Injectable()
export class MessagingEffects {
    allLoadedMessages = [];
    onlineStatus$: Observable<boolean>;
    ntwkStatus: boolean = true;
    constructor(
        private readonly actions$: Actions,
        private readonly dataAccess: MessagingDataAccessService,
        private readonly store: Store,
        private readonly dbContext: DbContext,
        private readonly modalService: NzModalService,
        private readonly sipService: SipService,
        private readonly sipUserService: SipUserService,
        private readonly messageService: MessagingService

    ) { }

    private readonly userId$ = this.store.select(selectUserId);
    private readonly peerThreadStatuses$ = this.store.select(
        selectPeerThreadStatuses
    );
    private readonly pendingMessages$ = this.store.select(
        selectPendingMessages
    );
    public sipUserData: SipUser;

    messageIncomingNotification$ = createEffect(
        () =>
            this.actions$.pipe(
                ofType(addIncomingSessionMessage),
                tap(async (action) => {
                    const peerId = action.fromNum === 'unknown' ? 'Anonymous' : '+' + action.fromNum
                    const notification = new Notification('Incoming message', {
                        body: `Incoming Message From ${peerId}`,
                        icon: 'assets/images/notification-badge.png',
                    });
                    notification.onclick = function openSite(event) {
                        window.focus()
                    }
                })
            ),
        { dispatch: false }
    );

    registerResendPendingMessages$ = createEffect(() => {
        const isTransportConnectedAndRegistered$ = this.actions$.pipe(
            ofType(setTransportStatus),
            map(({ status }) => status === 'registered'),
            distinctUntilChanged(),
            filter((f) => f)
        );

        const rehydrateSuccess$ = this.actions$.pipe(
            ofType(rehydrateSuccess),
            mapTo(true),
            take(1),
            shareReplay(1)
        );

        return combineLatest([
            isTransportConnectedAndRegistered$,
            rehydrateSuccess$,
        ]).pipe(mapTo(resendPendingMessages()));
    });

    loginSuccess$ = createEffect(() =>
        this.actions$.pipe(
            ofType(loginSuccess),
            switchMap(() => [
                loadInitialHistory(),
                loadInitialVoiceMailHistory()
            ])
        )
    );

//     loadsuccesss$ = createEffect(() =>
//     this.actions$.pipe(
//         ofType(loadInitialHistoryStoreSuccess),
//         map(()=>
//             loadNextHistory()
//         )
//     )
// );

    rehydrateHistory$ = createEffect(() =>
        this.actions$.pipe(
            ofType(loginSuccess),
            withLatestFrom(this.userId$),
            switchMap(async ([_, userId]) => {
                const isMessageInfoUpgraded = localStorage.getItem("__DB_change_1__");
                if (isMessageInfoUpgraded === 'message_info') {
                    const $migration = this.dbContext.message.migratePrePicToPic(sessionStorage.getItem("__api_identity__"));
                    await Promise.all([$migration]);
                    console.log("migration done");
                    localStorage.removeItem("__DB_change_1__")
                }
                return Promise.all([
                    this.dbContext.message.getMessagesWithFilter(userId),
                    this.dbContext.message.getThreads(userId),
                    this.dbContext.message.getAllRetryQueue(),
                    this.dbContext.message.getAllParticipants()
                ])
            }),
            map(([messages, threads, retryMsgs, participants_data]) => {
                return rehydrateSuccess({
                    threads,
                    messages,
                    retryMsgs,
                    dateTime: new Date().toISOString(),
                    participants_data
                });
            })
        )
    );

    rehydrateSuccessB4CallScrn$ = createEffect(() =>
        this.actions$.pipe(
            ofType(loadInitialHistoryStoreSuccess),
            withLatestFrom(this.userId$),
            switchMap(([_, userId]) =>
                Promise.all([
                    this.dbContext.message.getMessagesWithFilter(userId),
                    this.dbContext.message.getThreads(userId),
                    this.dbContext.message.getAllRetryQueue(),
                    this.dbContext.message.getAllParticipants()
                ])
            ),
            map(([messages, threads, retryMsgs, participants_data]) => {
                return rehydrateSuccess({
                    threads,
                    messages,
                    retryMsgs,
                    dateTime: new Date().toISOString(),
                    participants_data,
                });
            })
        )
    );

    loadInitialHistory$ = createEffect(() =>
        this.actions$.pipe(
            ofType(loadInitialHistory),
            withLatestFrom(this.userId$),
            switchMap(([_, userId]) =>
                this.dataAccess.loadHistory().pipe(
                    map((result) =>
                        loadInitialHistorySuccess({
                            userId,
                            result,
                            dateTime: new Date().toISOString(),
                        })
                    )
                )
            )
        )
    );

    loadNextThreads$ = createEffect(() =>
    this.actions$.pipe(
        ofType(loadNextHistory),
        withLatestFrom(
            this.store.select(selectThreads),
            this.userId$),
        switchMap(([_,threads ,userId]) =>

            this.dataAccess.loadHistory(sessionStorage.getItem("lastThreadTime")).pipe(
                map((result) =>{
                    this.dataAccess.ThreadLazyLoaded.next(true)
                    return loadInitialHistorySuccess({
                        userId,
                        result,
                        dateTime: new Date().toISOString(),
                    })
                }
                )
            )
        )
    )
);


loadPeerHistoryPrevious$ = createEffect(() =>
this.actions$.pipe(
    ofType(loadPreviousPeerHistory),
    withLatestFrom(this.userId$, this.peerThreadStatuses$),
    switchMap(([{ peerId, seq,ts }, userId, peerThreads]) => {
        const threadStatus = peerThreads[peerId];
        if (threadStatus && threadStatus.threadId) {
            const threadId = threadStatus.threadId;
            const threadStatusSeq = {seq:seq,ts:ts}
                // loadNextPage && threadStatus.status.latestLoadedSeq;
            if (!threadId.includes("mlnumber:")) {
                return this.dataAccess
                    .loadPeerHistory(threadId, threadStatusSeq)
                    .pipe(
                        map((result) =>{
                            this.messageService.MessageLazyLoaded.next(false)
                            return loadPeerHistorySuccess({
                                result,
                                peerId,
                                userId,
                                threadId,
                                dateTime: new Date().toISOString(),
                                isInitial: false,
                            })
                        }
                        ),
                        catchError((error: HttpErrorResponse) =>{
                            this.messageService.MessageLazyLoaded.next(false)
                            return of(loadPeerHistoryError({ error }))
                        }
                        )
                    );
            } else if (threadId.includes("mlnumber:")) {
                this.messageService.MessageLazyLoaded.next(false)
                return of(
                    loadPeerHistorySuccess({
                        result: {
                            thread: null,
                            messages: [],
                            return: 0,
                            desc: null,
                        },
                        peerId,
                        userId,
                        threadId: threadId,
                        dateTime: new Date().toISOString(),
                        isInitial: false,
                    })
                );
            }
        } else {
            this.messageService.MessageLazyLoaded.next(false)
            // this is new message without thread
            return of(
                loadPeerHistorySuccess({
                    result: {
                        thread: null,
                        messages: [],
                        return: 0,
                        desc: null,
                    },
                    peerId,
                    userId,
                    threadId: null,
                    dateTime: new Date().toISOString(),
                    isInitial: false,
                })
            );
        }
    })
)
);


    loadPeerHistoryNextPage$ = createEffect(() =>
        this.actions$.pipe(
            ofType(loadPeerHistory),
            withLatestFrom(this.userId$, this.peerThreadStatuses$),
            switchMap(([{ peerId, loadNextPage }, userId, peerThreads]) => {
                const threadStatus = peerThreads[peerId];
             /*   const threadId = threadTest;
                if (threadTest) {
                    return this.dataAccess
                        .loadPeerHistory(threadTest,)
                        .pipe(
                            map((result) =>
                                loadPeerHistorySuccess({
                                    result,
                                    peerId,
                                    userId,
                                    threadId,
                                    dateTime: new Date().toISOString(),
                                    isInitial: !loadNextPage,
                                })
                            ),
                            catchError((error: HttpErrorResponse) =>
                                of(loadPeerHistoryError({ error }))
                            )
                        );
                } else*/ if (threadStatus && threadStatus.threadId) {
                    const threadId = threadStatus.threadId;
                    const threadStatusSeq =
                        loadNextPage && threadStatus.status.latestLoadedSeq;
                    // if (threadId.includes("mlnumber:") && threadStatus.isVoiceMail === true) {
                    //     const updateVVM = new Promise(async (resolve, reject) => {
                    //         const getMessgaes = await this.dbContext.message.getVoiceMails(userId)
                    //         resolve({ getMessgaes })
                    //     })
                    //     let res: any;
                    //     updateVVM.then(async value => {
                    //         res = await JSON.parse(JSON.stringify(value))
                    //         return of(
                    //             loadPeerHistorySuccess({
                    //                 result: {
                    //                     thread: null,
                    //                     messages: res,
                    //                     return: 0,
                    //                     desc: null
                    //                 },
                    //                 peerId,
                    //                 userId,
                    //                 threadId: threadId,
                    //                 dateTime: new Date().toISOString(),
                    //                 isInitial: !loadNextPage,
                    //             })
                    //         );
                    //     });
                    // } else
                    if (!threadId.includes("mlnumber:")) {
                        return this.dataAccess
                            .loadPeerHistory(threadId, threadStatusSeq)
                            .pipe(
                                map((result) =>
                                    loadPeerHistorySuccess({
                                        result,
                                        peerId,
                                        userId,
                                        threadId,
                                        dateTime: new Date().toISOString(),
                                        isInitial: !loadNextPage,
                                    })
                                ),
                                catchError((error: HttpErrorResponse) =>
                                    of(loadPeerHistoryError({ error }))
                                )
                            );
                    } else if (threadId.includes("mlnumber:")) {
                        return of(
                            loadPeerHistorySuccess({
                                result: {
                                    thread: null,
                                    messages: [],
                                    return: 0,
                                    desc: null,
                                },
                                peerId,
                                userId,
                                threadId: threadId,
                                dateTime: new Date().toISOString(),
                                isInitial: !loadNextPage,
                            })
                        );
                    }
                } else {
                    // this is new message without thread
                    return of(
                        loadPeerHistorySuccess({
                            result: {
                                thread: null,
                                messages: [],
                                return: 0,
                                desc: null,
                            },
                            peerId,
                            userId,
                            threadId: null,
                            dateTime: new Date().toISOString(),
                            isInitial: !loadNextPage,
                        })
                    );
                }
            })
        )
    );

    mergeInitialLoadedHistoryIntoDbContext$ = createEffect(() =>
        this.actions$.pipe(
            ofType(loadInitialHistorySuccess),
            withLatestFrom(this.userId$),
            switchMap(async ([payload, userId]) => {
                const loadedMessages = flatten(
                    payload.result.map((thread) => {
                        let peerId = getThreadPeerId(userId, thread.parties);
                        if (thread.parties_list.split(",").length > 2) {
                            peerId = getThreadPeerIdGroup(userId, thread.parties_list.split(","));
                        }
                        return thread.messages.map(
                            mapDtoMessage(peerId, thread.id, thread.parties_list)
                        )
                    })
                );
                const msgInfos = []
                loadedMessages.forEach((element) => {
                    if (element.messageInfo.session_id) {
                        msgInfos.push(element.messageInfo);
                    }
                })
                await this.dbContext.message.addOrUpdateAllMessageInfo(msgInfos);
                await this.dbContext.message.addOrIgnoreMessagesRange(
                    userId,
                    loadedMessages
                );

                // TODO : Update threads read time !!!
                return loadInitialHistoryStoreSuccess(payload);
            })
        )
    );

    mergePeerHistoryIntoDbContext$ = createEffect(() =>
        this.actions$.pipe(
            ofType(loadPeerHistorySuccess),
            withLatestFrom(this.userId$),
            filter(([payload]) => !payload.result['error']),
            switchMap(async ([payload, userId]) => {
                const { result, threadId, peerId } = payload;
                //Immediate get_all_messages api call getting the response data here and here need to
                //concat the same peerId related thread msgs


                const loadedMessages = flatten(
                    result.messages.map(mapDtoMessage(peerId, threadId, sessionStorage.getItem(threadId)))
                );
                let optInCount = 0;
                //let att_status = 2;
                loadedMessages.forEach((lm) => {
                    if (lm.stype == 16) {
                        optInCount += 1;
                    }
                    /*if (lm.stype == 30 || lm.stype == 31) {
                        att_status = 3;
                    }*/
                });

                const threadData: any = {
                    id: threadId,
                    optInRequestCount: optInCount,
                    parties_list: getValidXCafeParticipants(sessionStorage.getItem(threadId))
                    //att_status: att_status
                }

                await this.dbContext.message.addOrUpdateMessageThread(threadData, sessionStorage.getItem('__api_identity__'));

                /*loadedMessages.forEach((elem) => {
                    this.allLoadedMessages.push(elem);
                })*/

                //console.log('only loaded messages', loadedMessages);
                /*if (peerId.includes('whatsapp')) {
                    //console.log('check result messages here', result.messages);
                    result.messages.forEach((elem) => {
                        this.allLoadedMessages = Object.assign([], this.allLoadedMessages);
                        if (this.allLoadedMessages.length == 0) {
                            this.allLoadedMessages.push(elem);
                        } else if (this.allLoadedMessages.length && this.allLoadedMessages[0].from == peerId) {
                            this.allLoadedMessages.push(elem);
                        } else if (this.allLoadedMessages.length && this.allLoadedMessages[0].from != peerId) {
                            this.allLoadedMessages = [];
                            this.allLoadedMessages.push(elem);
                        }
                    })
                    //console.log('all loaded messages data', this.allLoadedMessages);
                }*/

                const msgInfos = []
                loadedMessages.forEach((element) => {
                    if (element.messageInfo.session_id) {
                        msgInfos.push(element.messageInfo);
                    }
                })
                await this.dbContext.message.addOrUpdateAllMessageInfo(msgInfos);
                await this.dbContext.message.addOrIgnoreMessagesRange(
                    userId,
                    loadedMessages
                );
                const sortedMessages = orderBy(
                    sortMessage,
                    'desc',
                    loadedMessages
                );
                if (sortedMessages[0]) {
                    this.sipUserService.setLatestUserMessageDateTime(
                        sortedMessages[0].sentTime
                    );
                }
                //console.log('payload data before update', payload);
                //payload.result.messages = this.allLoadedMessages;

                /*if (peerId.includes('whatsapp')) {
                    payload = {
                        isInitial: payload.isInitial,
                        result: {
                            thread: payload.result.thread,
                            desc: payload.result.desc,
                            return: payload.result.return,
                            messages: this.allLoadedMessages
                        },
                        userId: payload.userId,
                        peerId: payload.peerId,
                        threadId: payload.threadId,
                        dateTime: payload.dateTime,
                        type: "[Messaging] Load Peer History Success"
                    }
                }*/

                return loadPeerHistoryStoreSuccess(payload);
            })
        )
    );

    mergeNewSessionMessageIntoDbContext$ = createEffect(
        () =>
            this.actions$.pipe(
                ofType(addOutgoingSessionMessage),
                withLatestFrom(this.userId$, this.peerThreadStatuses$),
                tap(
                    async ([
                        { peerId, callId, content, dateTime, resendCallId, parties_list, messageType, messageInfo, valid },
                        userId,
                        peerThreads,
                    ]) => {
                        logger.debug('CallId::' + callId + '&ResendCallId::' + resendCallId + '&PeerId::' + peerId + ' Processing:: Effect action addOutgoingSessionMessage');
                        const participants = sessionStorage.getItem('participants');
                        if ((participants !== null && participants !== "null" && participants !== undefined)
                            && (parties_list !== undefined)) {
                            peerId = sortParticipantsAsID(participants.split('|'))
                        }
                        const domainMessage: Message = {
                            id: resendCallId || callId,
                            userId,
                            peerId: peerId,
                            callId: resendCallId || callId,
                            threadId: peerThreads[peerId]?.threadId,
                            sentTime: dateTime,
                            content: content,
                            isSystem: false,
                            state: {
                                kind: valid == false ? 'MessageStateInvalid' : 'MessageStateSending',
                            },
                            messageType,
                            messageInfo
                        };
                        //sessionStorage.removeItem('num_is_not_valid');
                        await this.dbContext.message.addOrIgnoreMessage(
                            userId,
                            domainMessage,
                            parties_list !== undefined ? true : false,
                        );
                        if (messageType !== "text") {
                            await this.dbContext.message.addOrUpdateAllMessageInfo([messageInfo]);
                        }

                    }
                )
            ),
        { dispatch: false }
    );

    mergeOutgoingAcceptedMessageIntoDbContext$ = createEffect(
        () =>
            this.actions$.pipe(
                ofType(outgoingSessionMessageAccepted),
                withLatestFrom(this.userId$),
                tap(
                    async ([
                        { messageId, dateTime, callId, resendCallId },
                        userId,
                    ]) => {
                        logger.debug('CallId::' + callId + '&ResendCallId::' + resendCallId + '&MsgId::' + messageId + ' Processing:: Effect action outgoingSessionMessageAccepted');
                        this.dbContext.message.acceptMessage(
                            userId,
                            resendCallId || callId,
                            messageId,
                            dateTime
                        );
                    }
                )
            ),
        { dispatch: false }
    );

    mergeOutgoingRejectedMessageIntoDbContext$ = createEffect(
        () =>
            this.actions$.pipe(
                ofType(outgoingSessionMessageRejected),
                withLatestFrom(this.userId$),
                tap(async ([{ callId, error, resendCallId }, userId]) => {
                    logger.debug('CallId::' + callId + '&ResendCallId::' + resendCallId + 'Processing Effect action outgoingSessionMessageRejected');
                    this.dbContext.message.rejectMessage(
                        userId,
                        resendCallId || callId,
                        error
                    );
                })
            ),
        { dispatch: false }
    );

    mergeIncomingMessageIntoDbContext$ = createEffect(
        () =>
            this.actions$.pipe(
                ofType(
                    addIncomingSessionMessage
                    // checkIncomingSessionSelfMessage
                ),
                withLatestFrom(this.userId$),
                tap(
                    async ([
                        {
                            messageId,
                            dateTime,
                            content,
                            peerId,
                            isSystem,
                            threadId,
                            parties_list,
                            fromNum,
                            messageType,
                            messageInfo,
                            stype,
                            messageChannelType
                        },
                        userId,
                    ]) => {
                        logger.debug('MsgId::' + messageId + '&PeerId::' + peerId + ' Processing:: Effect action addIncomingSessionMessage')
                        // If still not accepted
                        const message: Message = {
                            id: messageId,
                            userId: fromNum,
                            peerId,
                            callId: null,
                            threadId, //peerThreads[peerId]?.threadId,
                            sentTime: dateTime,
                            content: content,
                            isSystem,
                            state: {
                                kind: 'MessageStateSent',
                                dateTime: dateTime,
                            },
                            messageType,
                            messageInfo,
                            stype,
                            messageChannelType
                        };
                        if (Object.keys(messageInfo).length) {
                            await this.dbContext.message.addOrUpdateAllMessageInfo([messageInfo]);
                        }
                        await this.dbContext.message.addOrIgnoreMessage(
                            userId,
                            message,
                            parties_list !== undefined && parties_list.split("|").length > 2
                                ? true : false
                        );
                        //update participants
                        /*this.dbContext.message.updateParticipants(
                            threadId,
                            parties_list.length > 1 ? parties_list.split('|') : [parties_list],
                            threadId,
                            'Add Participants');*/
                        // on accepting or rejecting opt-in request, 25= accept, 21- reject
                        if (stype) {
                            let whatsOptInReqStatus = null;
                            switch (stype) {
                                case 25: whatsOptInReqStatus = 3; break;
                                case 29: whatsOptInReqStatus = 3; break;
                                case 30: whatsOptInReqStatus = 3; break;
                                case 31: whatsOptInReqStatus = 3; break;
                                case 21: whatsOptInReqStatus = 4; break;
                                case 33: whatsOptInReqStatus = 5; break;
                                case 34: whatsOptInReqStatus = 3; break;
                                default: whatsOptInReqStatus = 2; break;
                            }


                            let updparticips;
                            if(stype == 34){
                                const participants = await this.dbContext.message.getParticipants(threadId);
                                let updatedParticpants = participants.split('|').filter((x) => x != fromNum).join('|');
                                if(updatedParticpants.split('|').length == 2){
                                    updparticips = updatedParticpants.split('|').join('|')
                                }
                                this.dbContext.message.updateParticipants(threadId, updatedParticpants, threadId, 'Add Participants');
                            }

                            if(stype == 33){
                                const participants = await this.dbContext.message.getParticipants(threadId);
                                let updatedParticpants = participants.split('|').filter((x) => x != sessionStorage.getItem('__api_identity__')).join('|');
                                if(updatedParticpants.split('|').length == 2){
                                    updparticips = updatedParticpants.split('|').join('|')
                                }
                                this.dbContext.message.updateParticipants(threadId, updatedParticpants, threadId, 'Add Participants');
                            }

                            const threadData: any = {
                                id: threadId,
                                lastIncommingMessageAt: dateTime,
                                isWhatsAppThread: (parties_list?.includes('whatsapp') || message.peerId.includes('whatsapp')) ? true : false,
                                whatsOptInReqStatus: whatsOptInReqStatus,
                                parties_list: parties_list ? parties_list : updparticips,
                                messageChannelType
                            }
                            if (whatsOptInReqStatus == 5) {
                                threadData.optInRequestCount = 0
                            }

                            await this.dbContext.message.addOrUpdateMessageThread(threadData,
                                sessionStorage.getItem('__api_identity__'),
                            )
                        } else {
                            const threadData: any = {
                                id: threadId,
                                lastIncommingMessageAt: dateTime,
                                //isWhatsAppThread: false,
                                //whatsOptInReqStatus: '1',
                                parties_list: parties_list ? parties_list : peerId,
                                messageChannelType: messageChannelType
                            }


                            await this.dbContext.message.addOrUpdateMessageThread(threadData,
                                sessionStorage.getItem('__api_identity__'),
                            )
                            // update last incomming message readtime
                            if (parties_list?.split("|").some(obj => obj.includes('whatsapp'))) {
                                await this.dbContext.message.updateLastIncommingMessageTime(
                                    sessionStorage.getItem('__api_identity__'),
                                    threadId,
                                    dateTime
                                )
                            }
                        }
                    }
                )
            ),
        { dispatch: false }
    );

    mergeIncomingSelfMessageIntoDbContext$ = createEffect(
        () =>
            this.actions$.pipe(
                ofType(checkIncomingSessionSelfMessage),
                withLatestFrom(this.userId$, this.peerThreadStatuses$),
                tap(
                    async ([
                        { messageId, dateTime, content, peerId, isSystem, parties_list, messageType, messageInfo },
                        userId,
                        peerThreads,
                    ]) => {
                        // If still not accepted
                        const message: Message = {
                            id: messageId,
                            userId,
                            peerId: peerId,
                            callId: null,
                            threadId: peerThreads[peerId]?.threadId,
                            sentTime: dateTime,
                            content: content,
                            isSystem,
                            state: {
                                kind: 'MessageStateSent',
                                dateTime: dateTime,
                            },
                            messageType,
                            messageInfo
                        };
                        if (messageType !== "text")
                            await this.dbContext.message.addOrUpdateAllMessageInfo([messageInfo]);
                        await this.dbContext.message.addOrIgnoreMessage(
                            userId,
                            message,
                            parties_list !== undefined && parties_list.split("|").length > 2
                                ? true : false
                        );
                    }
                )
            ),
        { dispatch: false }
    );

    setLatestIncomingMessageDataTime$ = createEffect(
        () =>
            this.actions$.pipe(
                ofType(addIncomingSessionMessage),
                tap((action) => {
                    this.sipUserService.setLatestUserMessageDateTime(
                        action.dateTime
                    );
                })
            ),
        { dispatch: false }
    );

    messageDisplayedUpdateInDb$ = createEffect(
        () =>
            this.actions$.pipe(
                ofType(messageRead),
                withLatestFrom(this.userId$),
                tap(([{ threadId, dateTime, isVoiceMail }, userId]) => {
                    this.dbContext.message.updateMessageReadTime(
                        userId,
                        threadId,
                        new Date().toISOString(),
                    );
                })
            ),
        { dispatch: false }
    );

    messageDisplayedNotifyServer$ = createEffect(
        () =>
            this.actions$.pipe(
                ofType(messageRead),
                tap(async ({ peerId, messageId, isSystem, isVoiceMail }) => {
                    await this.dataAccess
                        .setMessageRead(peerId, messageId, isSystem, isVoiceMail)
                        .toPromise();
                })
            ),
        { dispatch: false }
    );

    messageHideThreadInDb$ = createEffect(
        () =>
            this.actions$.pipe(
                ofType(hideMessageThread),
                withLatestFrom(this.userId$),
                tap(([{ threadId, hideThread }, userId]) => {
                    this.dbContext.message.hideMessageThread(
                        userId,
                        threadId,
                        hideThread
                    );
                })
            ),
        { dispatch: false }
    );


    startRemovePeerMessages$ = createEffect(() => {
        return this.actions$.pipe(
            ofType(startRemovePeerMessages),
            switchMap(({ peerId }) => {
                const ref = this.modalService.create({
                    nzContent: ConfirmDialogComponent,
                    nzComponentParams: {
                        titleTxt: 'Delete All  Messages',
                        subTitleTxt:
                            'Do you want to delete all the messages on this thread ?',
                        cancelBtnTxt: 'Cancel',
                        applyBtnTxt: 'Delete',
                        onOkAction: () => ({
                            confirmed: true,
                        }),
                        onCancelAction: () => ({
                            confirmed: false,
                        }),
                    },
                    nzBodyStyle: {
                        width: '26rem',
                    },
                    nzWidth: '26rem',
                    nzFooter: null,
                });
                return ref.afterClose.pipe(
                    filter(({ confirmed }) => !!confirmed),
                    map(() =>
                        removePeerMessages({
                            peerId,
                        })
                    )
                );
            })
        );
    });

    removePeerMessages$ = createEffect(
        () => {
            return this.actions$.pipe(
                ofType(removePeerMessages),
                withLatestFrom(this.userId$),
                tap(async ([{ peerId }, userId]) => {
                    await this.dbContext.message.removePeerMessages(
                        userId,
                        peerId
                    );
                })
            );
        },
        { dispatch: false }
    );

    removePeerMessage$ = createEffect(
        () =>
            this.actions$.pipe(
                ofType(removePeerMessage),
                withLatestFrom(this.userId$),
                tap(async ([{ peerId }, userId]) => {
                    await this.dbContext.message.removePeerMessage(
                        userId,
                        peerId
                    );
                })
            ),
        { dispatch: false }
    );

    resendPendingMessages$ = createEffect(
        () =>
            this.actions$.pipe(
                ofType(resendPendingMessages),
                withLatestFrom(this.pendingMessages$),
                tap(async ([_, messages]) => {
                    logger.debug("Failed message to be retries::", messages);
                    const sipUser = this.sipUserService.getActiveSipUser;
                    // const rejectedMessages = messages.filter(x => x.state.kind == 'MessageStateError');

                    //This block will filter the pending msgs with the same content less than 2 mins time interval
                    //because we may receive sync sip msg back after online before retrying, so will remove the received obj from the retryqueue
                    const objWithIdIndex = messages[0] == undefined ? -1 : messages.findIndex((obj) => obj.id === sessionStorage.getItem('sameCntMsgInPendingMessage-' + obj.id));
                    //const objWithIdIndex = messages.findIndex((obj) => obj.id === sessionStorage.getItem('sameCntMsgInPendingMessage-' + obj.id));
                    //logger.debug('objWithIdIndex value:', objWithIdIndex);
                    if (objWithIdIndex > -1) {
                        console.log('inside splice block');
                        console.log('Removing from session');
                        sessionStorage.removeItem('sameCntMsgInPendingMessage-' + messages[objWithIdIndex].id);
                        console.log('Removing from pending messages array');
                        messages.splice(objWithIdIndex, 1);
                    }
                    //logger.debug("Failed Messages after removing selfMessage Id object::", messages);


                    //const rejectedMessages = messages.filter(x => ['MessageStateError'].includes(x?.state.kind));
                    const rejectedMessages = [];
                    const $all = rejectedMessages.map(async (m) => {
                        let peerId = null
                        let isWhatsApp = false;
                        if (m.peerId) {
                            peerId = JSON.stringify(sessionStorage.getItem('resend-' + m.id))
                            logger.debug("Retrying WA message", 'resend-' + m.id, ' is ', sessionStorage.getItem('resend-' + m.id))
                            if ("null" === peerId) {
                                logger.debug("Retrying WA message", m.id, ' is ', sessionStorage.getItem(m.id))
                                peerId = JSON.stringify(sessionStorage.getItem(m.id))
                            }
                            if ("null" !== peerId && peerId.includes("whatsapp:")) {
                                isWhatsApp = true;
                                peerId = peerId.substring(peerId.indexOf('whatsapp:'), peerId.length).replace(/\D+/g, "");
                            }else {
                                peerId = m.peerId
                            }
                        } else {
                            peerId = m.peerId
                        }

                        //for handling wa one to one usecase
                        if(peerId.length == 36){
                            peerId = m.wanum?.replace('whatsapp:', '');
                            isWhatsApp = true;
                        }

                        logger.debug("Retrying WA message for peerId = " + peerId)

                        //checking online status before retrying pending msg
                        this.onlineStatus$ = merge(
                            of(navigator.onLine),
                            fromEvent(window, 'online').pipe(mapTo(true)),
                            fromEvent(window, 'offline').pipe(mapTo(false))
                        );
                        this.onlineStatus$.subscribe(data => {
                            this.ntwkStatus = data;
                        })
                        logger.debug('Network Status During Resend Pending msgs::', this.ntwkStatus);
                        if (sipUser != undefined && this.ntwkStatus == true) {
                            if (m.messageType === "text" && peerId) {
                                logger.debug('Processed msg from Resend Pending Messages Logic Having Content:', m.content);
                                this.sipService.reSendMessage(
                                    sipUser,
                                    this.sipService.getUserUri(peerId),
                                    m.content,
                                    m.id,
                                    isWhatsApp
                                )
                            } else if (m.messageType === "picture" && peerId) {
                                this.sipService.reSendMessage(
                                    sipUser,
                                    this.sipService.getUserUri(peerId),
                                    m.content,
                                    m.id,
                                    isWhatsApp,
                                    {
                                        mms_id: m.messageInfo.session_id,
                                        mms_type: m.messageInfo.multimediaContentType
                                    }

                                )
                            }
                        }
                    });
                    await Promise.all($all);
                })
            ),
        { dispatch: false }
    );

    forwardMessage$ = createEffect(() =>
        this.actions$.pipe(
            ofType(forwardMessage),
            withLatestFrom(
                this.store.select(
                    selectMessagesContactGhosts((x) =>
                        this.sipService.getUserUri(x)
                    )
                )
            ),
            switchMap(([{ content }, ghosts]) =>
                chooseForwardToUris(
                    this.modalService,
                    ghosts.filter((f) => !!f.contact),
                    1
                ).pipe(map((uris) => ({ content, uris })))
            ),
            mergeMap(({ content, uris }) =>
                uris.map((id) => {
                    return startSendSessionMessage({
                        peerUri: id,
                        content,
                        dateTime: new Date().toISOString(),
                    });
                })
            ),
            tap((action) => {
                if (this.sipUserService.getActiveSipUser !== undefined && this.sipUserService.getActiveSipUser !== null) {
                    this.sipUserData = this.sipUserService.getActiveSipUser;
                }
                this.sipService.sendMessage(
                    this.sipUserData,
                    action.peerUri,
                    action.content
                );
            })
        )
    );
    forwardMultimediaMessage$ = createEffect(() =>
        this.actions$.pipe(
            ofType(forwardMultimediaMessage),
            withLatestFrom(
                this.store.select(
                    selectMessagesContactGhosts((x) =>
                        this.sipService.getUserUri(x)
                    )
                )
            ),
            switchMap(([{ messageId, mediaInfo, messageInfo, messageType }, ghosts]) => {
                const content = "Image"
                return chooseForwardToUris(
                    this.modalService,
                    ghosts.filter((f) => !!f.contact),
                    1
                ).pipe(map((uris) => ({ content, uris, messageId, mediaInfo, messageInfo, messageType })))
            }),
            mergeMap(({ content, uris, messageId, mediaInfo, messageInfo, messageType }) =>
                uris.map((id) => {
                    return startSendMultimediaMessage({
                        messageId, mediaInfo, messageInfo, messageType, peerUri: id,
                        dateTime: new Date().toISOString(),
                    });
                })
            ),
            tap((action) => {
                if (this.sipUserService.getActiveSipUser !== undefined && this.sipUserService.getActiveSipUser !== null) {
                    this.sipUserData = this.sipUserService.getActiveSipUser;
                }
                this.messageService.forwardMultimediaMessage(action)
            })
        )
    );

    threadMute$ = createEffect(
        () =>
            this.actions$.pipe(
                ofType(setTreadMute),
                withLatestFrom(this.userId$),
                tap(([{ threadId, isMuted }, userId]) => {
                    this.dbContext.message.updateThreadMute(
                        userId,
                        threadId,
                        isMuted
                    );
                })
            ),
        { dispatch: false }
    );

    loadLatestVoiceMail$ = createEffect(() =>
        this.actions$.pipe(
            ofType(loadLatestVoiceMail),
            switchMap(() => this.dataAccess.loadVoiceMails().pipe(
                map((result) => {
                    let latestVVM = result.vvms[result.vvms.length - 1];
                    let vvmReadStatus;
                    if (latestVVM.Status == "U") {
                        vvmReadStatus = false;
                    } else {
                        vvmReadStatus = true;
                    }
                    // after API change on timestamp from epoch to timeStamp Format, revisit
                    let formattedDate = new Date(latestVVM.time_stamp * 1000).toISOString()

                    const messageInfo: VoicemailType = {
                        id: latestVVM.SessionID,
                        session_id: "",
                        multimediaStatus: "not-initiated",
                        messageType: "voicemail",
                        duration: latestVVM.Duration,
                        parties_list: `${latestVVM.From}|${latestVVM.To}`,
                        isVoiceMailRead: vvmReadStatus,
                        multimediaContentType: "",
                    }
                    this.dbContext.message.addOrUpdateAllMessageInfo([messageInfo])
                    return addIncomingSessionMessage({
                        peerId: latestVVM.From,
                        messageId: latestVVM.SessionID,
                        fromNum: latestVVM.From,
                        content: 'Voicemail',
                        dateTime: formattedDate,
                        isSystem: false,
                        threadId: `mlnumber:${latestVVM.From}`,
                        parties_list: latestVVM.From,
                        messageType: "voicemail",
                        messageInfo

                    })
                })
            ))
        ))

    loadInitialVoiceMailHistory$ = createEffect(() =>
        this.actions$.pipe(
            ofType(loadInitialVoiceMailHistory),
            withLatestFrom(this.userId$),
            switchMap(([_, userId]) => this.dataAccess.loadVoiceMails().pipe(

                map((result) => {
                    let vvms = result.vvms;
                    let domainMessages = []
                    let domainMessageInfos = []
                    for (let i = 0; i < vvms.length; i++) {
                        vvms[i].id = vvms[i].SessionID;
                        let vvmReadStatus;
                        if (vvms[i].Status == "U") {
                            vvmReadStatus = false;
                        } else {
                            vvmReadStatus = true;
                        }
                        let formattedDate = new Date(vvms[i].time_stamp * 1000).toISOString()
                        const domainMessage: Message = {
                            id: vvms[i].SessionID,
                            userId: vvms[i].From,
                            peerId: vvms[i].From,
                            threadId: `mlnumber:${vvms[i].From}`,
                            callId: null,
                            sentTime: formattedDate,
                            content: 'Voicemail',
                            isSystem: false,
                            state: {
                                kind: "MessageStateSent",
                                dateTime: formattedDate,
                            },
                            messageType: "voicemail",
                            messageInfo: {}
                        }
                        const domainMessageInfo: VoicemailType = {
                            id: vvms[i].SessionID,
                            session_id: "", // this will be empty for VM, but available for pic/gif,etc.,
                            multimediaStatus: "not-initiated",
                            messageType: "voicemail",
                            duration: vvms[i].Duration,
                            parties_list: `${vvms[i].From}|${vvms[i].To}`,
                            isVoiceMailRead: vvmReadStatus,
                            multimediaContentType: "",
                        }
                        domainMessages.push(domainMessage)
                        domainMessageInfos.push(domainMessageInfo)
                        // this.dbContext.message.addOrIgnoreMessage(domainMessage.userId, domainMessage, false);
                    }
                    const updateVVM = new Promise(async (resolve, reject) => {
                        const putmessages = await this.dbContext.message.addOrIgnoreMessagesRange(userId, domainMessages, 'voicemail');
                        const putMessageInfo = await this.dbContext.message.addOrUpdateAllMessageInfo(domainMessageInfos)
                        const getMessgaes = await this.dbContext.message.getVoiceMails(userId)
                        resolve({ putmessages, getMessgaes })
                    })
                    updateVVM.then(value => {
                        const res = JSON.parse(JSON.stringify(value))
                        this.store.dispatch(loadInitialVoiceMailHistorySuccess({ vvms: res.getMessgaes }))
                    })
                })
            ))
        ),
        { dispatch: false }
    );

    readVoicemail$ = createEffect(
        () =>
            this.actions$.pipe(
                ofType(readVoicemail),
                withLatestFrom(this.userId$),
                tap(async ([msg, userId]) => {
                    await this.dbContext.message.updateVVMReadStatus(msg);
                })
            ),
        { dispatch: false }
    );


    updateRequestCount$ = createEffect(
        () =>
            this.actions$.pipe(
                ofType(updateRequestCount),
                tap(async ({ threadId, peerId }) => {
                    if (threadId) {
                        await this.messageService.updateSentRequestCount(threadId);
                    }

                })
            ),
        { dispatch: false }
    );

    updateParticipantList$ = createEffect(
        () =>
            this.actions$.pipe(
                ofType(updateParticipantList),
                tap(async ({ peerId, modifyUser, threadId, actionType }) => {
                    if (peerId) {
                        await this.dbContext.message.updateParticipants(peerId, modifyUser, threadId, actionType);
                    }
                })
            ),
        { dispatch: false }
    );

}
