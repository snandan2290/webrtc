import { LoggerFactory } from '@movius/ts-logger';
import { createReducer, on } from '@ngrx/store';
import { MessageState } from 'libs/domain/src/lib/models/message';
import { messageInfoType } from 'libs/domain/src/lib/models/messageInfo';
import {
    any,
    assoc,
    assocPath,
    equals,
    first,
    fromPairs,
    groupBy,
    omit,
    sortBy,
    toPairs,
} from 'lodash/fp';
import { omitDeep, sortParticipantsAsID, StateStatus, checkIfIsWhatsAppThread, getLastInCommingMsgTime, covertToTimeZoneDate, getValidPeerId, getMsgChannelTypeFromParticipants, getPeerIdFromThreadId, getValidOptinSatus, getPeerIdFromThreadIdUpdateParticipant, getValidXCafeParticipants } from '../../shared';
import { LoadedSeq, MessageType, PeerChatMessage, StateStatusLoadedSeq } from '../models';
import { Message as MessageDTO, Thread } from '../services';
import {
    addIncomingSessionMessage,
    addOutgoingSessionMessage,
    checkIncomingSessionSelfMessage,
    loadInitialHistory,
    loadInitialHistoryStoreSuccess,
    loadInitialHistorySuccess,
    loadPeerHistoryStoreSuccess,
    loadPeerHistorySuccess,
    messageRead,
    setTreadMute,
    outgoingSessionMessageAccepted,
    outgoingSessionMessageRejected,
    rehydrateSuccess,
    removePeerMessage,
    removePeerMessages,
    updateVVMReadStatusInStore,
    loadInitialVoiceMailHistorySuccess,
    addPicMsgPlaceholder,
    updatePicMsgAPIError,
    updatePictureRetryThresholdReached,
    updateDownloadAPIErrorStatus,
    updateDownloadAPISuccess,
    setSearchText,
    hideMessageThread,
    updateRequestCount,
    updateThreadIdOnReEngage,
    updateParticipantList,
    updateCacheStore
} from './actions';

import { getThreadPeerId, getThreadPeerIdGroup } from './utils';
const logger = LoggerFactory.getLogger("")

export interface PeerMessages {
    peerId: string;
    threadId: string;
    status: StateStatusLoadedSeq;
    messages: PeerChatMessage[];
    participants_list: string;
    isGroup: boolean;
    createdAt?:Date;
    lastIncommingMessageAt?:string;
    whatsOptInReqStatus?:string;
    isWhatsAppThread?:boolean
    optInRequestCount?:number;
    hideThread?:boolean;
    readTime?:string;
    seq?:number;
    participants?:any;
    messageChannelType?:string;
}

export interface MessagesThread {
    id: string;
    readTime: string;
    isMuted?: boolean;
    parties_list?: string;
}

export interface MessagingState {
    status: StateStatus;
    hash: {
        [key: string]: PeerMessages;
    };
    threads: {
        [key: string]: MessagesThread;
    };
    searchText?: string
}

export class MessageB<T = string | ArrayBuffer> {
    id: string;
    userId: T;
    peerId: T;
    fromNumber: string;
    threadId: string;
    callId: string;
    sentTime: string;
    content: T;
    state: MessageState;
    isSystem: boolean;
    messageType: MessageType;
    messageInfo: any;
}

// const initialState: MessagingState =  loadState()

const initialState: MessagingState = {
    status: { kind: 'StateStatusInitial' },
    hash: {},
    threads: {},
    searchText: ''
};

 function loadState() {
    try {
      const serializedState = localStorage.getItem('cacheRehidrate');
      if (serializedState === null || !serializedState) {
        return {
                status: { kind: 'StateStatusInitial' },
                hash: {},
                threads: {},
                searchText: ''
            };
      }
      return JSON.parse(serializedState);
    } catch (err) {
      return {
                status: { kind: 'StateStatusInitial' },
                hash: {},
                threads: {},
                searchText: ''
            };
    }
  }

function getGroupParticipants() {
    const addParticipants = sessionStorage.getItem('participants');
    if (addParticipants !== null && addParticipants !== 'undefined') {
        const participants = addParticipants.split('|');
        const sortParticipants = participants.sort((a, b) => 0 - (a > b ? -1 : 1));
        let allNumbers = "";

        for (let i = 0; i < sortParticipants.length; i++) {
            if (i === 0) {
                allNumbers = sortParticipants[i];
            } else {
                allNumbers = allNumbers + sortParticipants[i];
            }
        }
        sessionStorage.setItem(allNumbers, JSON.stringify(addParticipants));

        return allNumbers;
    }
};


function getIncomingGroupParticipants() {
    const addParticipants = sessionStorage.getItem('incomingGroupParticipants');
    if (addParticipants !== null && addParticipants !== 'undefined') {
        const participants = JSON.parse(addParticipants).split('|');
        const sortParticipants = participants.sort((a, b) => 0 - (a > b ? -1 : 1));
        let allNumbers = "";

        for (let i = 0; i < sortParticipants.length; i++) {
            if (i === 0) {
                allNumbers = sortParticipants[i];
            } else {
                allNumbers = allNumbers + sortParticipants[i];
            }
        }
        sessionStorage.setItem(allNumbers, JSON.stringify(addParticipants));

        return allNumbers;
    }
};

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

const mapDtoMessage = (peerId: string, userId: string, threadId: string, threadParties: string) => (msg: MessageDTO) => {
    const dateTime = new Date(msg.ts).toISOString();
    let messageInfo: messageInfoType;
    let isPicture = false;
    if (msg.multimedia_id !== "" && msg.multimedia_id !== undefined) {
        const identity = sessionStorage.getItem("__api_identity__");
        if (threadParties === null || threadParties === undefined || threadParties === "null") {
            threadParties = `${peerId}|${identity}`;
        }
        if(threadParties.indexOf("\"") !== -1){
            threadParties = JSON.parse(threadParties);
        }
        const [sent_by, sent_to] = getSentToSentBy(threadParties, msg, peerId);
        isPicture = true
        messageInfo = {
            id: msg.id,
            session_id: msg.multimedia_id, // mms_session for now, can hold multiple session_id of diff msg types
            multimediaStatus: 'not-initiated',
            messageType: 'picture',
            parties_list: threadParties,
            to: sent_to,
            from: sent_by,
            multimediaContentType: msg.multimedia_content_type,
            stype: msg.stype
        }
    }
    return {
        id: msg.id,
        from: msg.from === userId ? 'me' : 'peer',
        fromNumber: msg.from === userId ? 'me' : msg.from,
        sentTime: dateTime,
        content: msg.body,
        peerId: peerId,
        state: {
            kind: 'MessageStateSent',
            dateTime,
            seq:msg.seq
        },
        isSystem: (msg.stype !== undefined || msg.stype === 0),
        messageType: isPicture ? 'picture' : 'text',
        messageInfo: messageInfo,
        stype: msg.stype,
        participants: threadParties
    } as PeerChatMessage;
};

const mergeThread = (
    state: MessagingState,
    peerId: string,
    threadId: string,
    messages: PeerChatMessage[],
    incomingWins: boolean,
    thread?:any,
    participants?: any,
    getPeerId?:any
): PeerMessages => {
    //logger.debug('peerId::::reducers-messaging::mergeThread', peerId);
    //logger.debug('threadId::::reducers-messaging::mergeThread', threadId);
    //logger.debug('participants::::reducers-messaging::mergeThread', participants);
    //logger.debug('getPeerId::::reducers-messaging::mergeThread', getPeerId);
    let stateThread = state.hash[peerId] ? state.hash[peerId] : state.hash[threadId];
    if (!stateThread) {
        // peer thread still not exist just add one
        const lastIncommingMessage = thread && thread.lastIncommingMessageAt ? thread.lastIncommingMessageAt : getLastInCommingMsgTime(messages, peerId);
        let fetch_participants;
        let getThreadParties;
        let getWhatsOptInReqStatus;
        if((thread && thread.parties_list) || (thread && participants)){
            fetch_participants = thread.parties_list ? thread.parties_list : participants;
            fetch_participants = Array.isArray(fetch_participants) ?  fetch_participants : fetch_participants ? fetch_participants?.includes('|')?  fetch_participants?.split('|') : fetch_participants?.split(',') : peerId.split('|')
            getThreadParties = fetch_participants;
            if(fetch_participants.length == 2){
                fetch_participants = fetch_participants.filter((e) => e != sessionStorage.getItem('__api_identity__'))
            }
        }
        if (thread &&  thread.att_status) {
            if (thread.t_left == '') {
                getWhatsOptInReqStatus = thread.att_status;
            } else {
                getWhatsOptInReqStatus = '5';
            }
        } else if (thread && thread.whatsOptInReqStatus != undefined) {
            getWhatsOptInReqStatus = thread.whatsOptInReqStatus;
        } else {
            getWhatsOptInReqStatus = '2';
        }

        //logger.debug('optinstatus without session logic for the thread--' + threadId, getWhatsOptInReqStatus);
        if((sessionStorage.getItem('opt-in-status-for-thread-id-' + threadId) != undefined) && (sessionStorage.getItem('opt-in-status-for-thread-id-' + threadId) != null)){
            getWhatsOptInReqStatus = sessionStorage.getItem('opt-in-status-for-thread-id-' + threadId);
            //logger.debug('optinstatus with session logic--' + threadId, getWhatsOptInReqStatus);
        } else if(getWhatsOptInReqStatus){
            getWhatsOptInReqStatus = getWhatsOptInReqStatus;
        }

        //logger.debug('getWhatsOptInReqStatus data::', getWhatsOptInReqStatus);
        //logger.debug('getPeerIdFromThreadId::::reducers-messaging::mergeThread', getPeerIdFromThreadId(getPeerId, state.hash));

        return {
            peerId: getPeerIdFromThreadId(getPeerId, state.hash),
            threadId,
            status: {
                kind: 'StateStatusInitial' as 'StateStatusInitial',
            },
            messages,
            isWhatsAppThread: getThreadParties ? getThreadParties.some(obj => obj.includes('whatsapp')): (thread && thread.isWhatsAppThread != undefined ? thread.isWhatsAppThread: false ),
            whatsOptInReqStatus: getWhatsOptInReqStatus ? getWhatsOptInReqStatus : sessionStorage.getItem('opt-in-status-for-thread-id-' + threadId),
            optInRequestCount: thread &&  thread.optInRequestCount ? thread.optInRequestCount: (thread && thread.optInRequestCount != undefined ? thread && thread.optInRequestCount : 0 ),
            lastIncommingMessageAt : lastIncommingMessage,
            createdAt: thread && thread.t_created ? new Date(thread.t_created) : (thread && thread.createdAt ? thread.createdAt : null),
            hideThread: thread && thread.hideThread ? thread.hideThread : false,
            readTime: (thread && thread.t_read && !thread.t_read?.endsWith('Z')) ? thread.t_read?.replace(' ', 'T').slice(0, -3) + 'Z' : "",
            seq: thread && thread.seq ? thread.seq : 0,
            participants: fetch_participants,
            isGroup: fetch_participants?.length > 1 ? true : false,
            messageChannelType: getMsgChannelTypeFromParticipants (fetch_participants, thread && thread.messageChannelType)
        } as PeerMessages;
    } else {
        // peer thread exist merge only new messages


        if((sessionStorage.getItem('opt-in-status-for-thread-id-' + threadId) != undefined) && (sessionStorage.getItem('opt-in-status-for-thread-id-' + threadId) != null)){


            const lastIncommingMessage = thread && thread.lastIncommingMessageAt ? thread.lastIncommingMessageAt : getLastInCommingMsgTime(messages, peerId);
            let fetch_participants;
            let getThreadParties;
            let getWhatsOptInReqStatus;
            if((thread && thread.parties_list) || (thread && participants)){
                fetch_participants = thread.parties_list ? thread.parties_list : participants;
                fetch_participants = Array.isArray(fetch_participants) ?  fetch_participants : fetch_participants ? fetch_participants?.includes('|')?  fetch_participants?.split('|') : fetch_participants?.split(',') : peerId.split('|')
                getThreadParties = fetch_participants;
                if(fetch_participants.length == 2){
                    fetch_participants = fetch_participants.filter((e) => e != sessionStorage.getItem('__api_identity__'))
                }
            }
            if (thread &&  thread.att_status) {
                if (thread.t_left == '') {
                    getWhatsOptInReqStatus = thread.att_status;
                } else {
                    getWhatsOptInReqStatus = '5';
                }
            } else if (thread && thread.whatsOptInReqStatus != undefined) {
                getWhatsOptInReqStatus = thread.whatsOptInReqStatus;
            } else {
                getWhatsOptInReqStatus = '2';
            }

            //logger.debug('optinstatus without session logic for the thread--' + threadId, getWhatsOptInReqStatus);
            if((sessionStorage.getItem('opt-in-status-for-thread-id-' + threadId) != undefined) && (sessionStorage.getItem('opt-in-status-for-thread-id-' + threadId) != null)){
                getWhatsOptInReqStatus = sessionStorage.getItem('opt-in-status-for-thread-id-' + threadId);
                //logger.debug('optinstatus with session logic--' + threadId, getWhatsOptInReqStatus);
            } else if(getWhatsOptInReqStatus){
                getWhatsOptInReqStatus = getWhatsOptInReqStatus;
            }

            //logger.debug('getWhatsOptInReqStatus data::', getWhatsOptInReqStatus);

            stateThread = {
                peerId: getPeerIdFromThreadId(getPeerId, state.hash),
                threadId,
                status: {
                    kind: 'StateStatusInitial' as 'StateStatusInitial',
                },
                messages,
                isWhatsAppThread: getThreadParties ? getThreadParties.some(obj => obj.includes('whatsapp')): (thread && thread.isWhatsAppThread != undefined ? thread.isWhatsAppThread: false ),
                whatsOptInReqStatus: getWhatsOptInReqStatus ? getWhatsOptInReqStatus : sessionStorage.getItem('opt-in-status-for-thread-id-' + threadId),
                optInRequestCount: thread &&  thread.optInRequestCount ? thread.optInRequestCount: (thread && thread.optInRequestCount != undefined ? thread && thread.optInRequestCount : 0 ),
                lastIncommingMessageAt : lastIncommingMessage,
                createdAt: thread && thread.t_created ? new Date(thread.t_created) : (thread && thread.createdAt ? thread.createdAt : null),
                hideThread: thread && thread.hideThread ? thread.hideThread : false,
                readTime: (thread && thread.t_read && !thread.t_read?.endsWith('Z')) ? thread.t_read?.replace(' ', 'T').slice(0, -3) + 'Z' : "",
                seq: thread && thread.seq ? thread.seq : 0,
                participants: fetch_participants,
                isGroup: fetch_participants?.length > 1 ? true : false,
                messageChannelType: getMsgChannelTypeFromParticipants (fetch_participants, thread && thread.messageChannelType)
            } as PeerMessages;

        }




        const stateMessages = stateThread.messages;
        messages = messages || [];
        if (!incomingWins) {
            const newMessages = messages.filter(
                (msg) => !stateMessages.some((x) => x.id === msg.id)
            );
            const oldMessages = stateMessages.filter(
                (msg) => !messages.some((x) => x.id === msg.id)
            );
            return newMessages.length > 0
                ? {
                    ...stateThread,
                    threadId,
                    messages: [...oldMessages, ...newMessages],
                }
                : { ...stateThread, threadId };
        } else {
            const missedOldMessages = stateMessages.filter(
                (msg) => !messages.some((x) => x.id === msg.id)
            );
            return {
                ...stateThread,
                threadId,
                messages: [...messages, ...missedOldMessages],
            };
        }
    }
};

const rehydrateSuccessHandler = (
    state: MessagingState,
    { messages, threads, retryMsgs, participants_data }: ReturnType<typeof rehydrateSuccess>
) => {
    const listOfMessage = new Array();
    const listOfWatsappMessage = new Array();

    for (let i = 0; i < retryMsgs.length; i++) {
        const sent_to = retryMsgs[i].data.sent_to
        let peerId = sent_to.indexOf("|") === -1 ? sent_to : sortParticipantsAsID(sent_to.split("|"));
        const message = new MessageB();
        message.id = retryMsgs[i].id;
        message.userId = retryMsgs[i].data.sent_by;
        message.peerId = peerId;
        message.sentTime = new Date().toISOString();
        message.content = "Multimedia Message";
        message.isSystem = false;
        message.state = {
            kind: 'PictureMessageAPIError'
        };
        message.messageType = "picture";
        message.messageInfo = {
            session_id: retryMsgs[i].id,
            multimediaStatus: 'downloaded',
        };
        listOfMessage.push(message);
    }

    for (let i = 0; i < messages.length; i++) {
        const message = new MessageB();
        message.id = messages[i].id;
        message.userId = messages[i].userId;
        message.peerId = messages[i].peerId;
        message.threadId = messages[i].threadId;
        message.callId = messages[i].callId;
        message.sentTime = messages[i].sentTime;
        message.content = messages[i].content;
        message.state = messages[i].state;
        message.isSystem = messages[i].isSystem;
        message.messageType = messages[i].messageType;
        message.messageInfo = messages[i].messageInfo ? messages[i].messageInfo : {};
        //if(message.peerId.includes("whatsapp")) continue; // remove this line when whatsapp is supported in MLDT
        //listOfMessage.push(message);
        if (message?.peerId?.includes('whatsapp:') || message?.userId?.includes('whatsapp')
        || message.peerId === message.threadId) {
            listOfWatsappMessage.push(message);
        } else {
            listOfMessage.push(message);
        }
    }

    for (let i = 0; i < listOfMessage.length; i++) {
        const groupParticipants = JSON.parse(sessionStorage.getItem(listOfMessage[i].threadId));

        if (groupParticipants != null && groupParticipants !== "") {
            const participants = groupParticipants.split(',');
            const sortParticipants = participants.sort((a, b) => 0 - (a > b ? -1 : 1));
            let tempGroupId = "";

            for (let j = 0; j < sortParticipants.length; j++) {
                if (j === 0) {
                    tempGroupId = sortParticipants[j];
                } else {
                    tempGroupId = tempGroupId + sortParticipants[j];
                }
            }
            listOfMessage[i].peerId = tempGroupId;
        }
    }
    //console.log('list of messages', listOfMessage);
    //console.log('list of wa messages', listOfWatsappMessage);
    const groupedMessages = toPairs(groupBy('peerId', listOfMessage));
    const wagroupedMessages = toPairs(groupBy('threadId', listOfWatsappMessage));
    //console.log('final grouped messages', groupedMessages);
    //console.log('final wa grouped messages', wagroupedMessages);
    let combiOfWAandNormal = [...groupedMessages, ...wagroupedMessages]
    //console.log('combination of both', combiOfWAandNormal);
    const apiUserIdentity = sessionStorage.getItem('__api_identity__');
    let msgs = combiOfWAandNormal.map(([peerId, msgs]) => {
        const chatMsgs = msgs.map(
            (msg) =>
            ({
                ...msg,
                from: msg.userId === apiUserIdentity ? 'me' : 'peer',
                fromNumber: msg.userId === apiUserIdentity ? 'me' : msg.userId,
            } as PeerChatMessage)
        );
        const threadId = msgs[0].threadId;

        let participants = '';
        if(participants_data){
            participants_data.forEach((participant) => {
                    if(participant.threadId == threadId){
                    participants = participant.participants;
                }
            })
        }
        //console.log('rehydrateSuccessHandler-- reducers--->', msgs[0].id, participants);
        //logger.debug('rehydrateSuccessHandler-- reducers--->', msgs[0].id, participants);

        const thread = threads.length ? threads.find(obj => obj.id == threadId) : null;
        if(thread){
            if(!(peerId.includes('whatsapp') && participants == '' )) {
                let getPeerId;
                if (peerId != threadId) {
                    getPeerId = getValidPeerId(peerId);
                } else {
                    getPeerId = getValidPeerId(participants);
                }
                return mergeThread(state, peerId, msgs[0].threadId, chatMsgs, true, thread, participants, getPeerId);
            }
        }
    });

    // add only threads which still not exists or readTime is less than incoming
    const mergeThreads = fromPairs(
        threads.map((m) => [m.id, m])
    );

    const updThreads = {
        ...state.threads,
        ...mergeThreads,
    };
    msgs = msgs.filter(obj => obj !== undefined);
    const history = fromPairs(msgs.map((msg) => [msg?.peerId?.includes('whatsapp:') ? msg?.threadId: msg?.peerId , msg]));
    const updHash = { ...state.hash, ...history };

    const result: MessagingState = {
        status: {
            kind: 'StateStatusLoaded',
            dateTime: new Date().toISOString(),
        },
        hash: updHash,
        threads: updThreads,
    };
    //console.log("rehidrated",result)
    localStorage.setItem("cacheRehidrate",JSON.stringify(result))
    return result;
};

const loadInitialHistoryStoreSuccessHandler = (
    state: MessagingState,
    {
        userId,
        result,
        dateTime,
    }:
        | ReturnType<typeof loadInitialHistorySuccess>
        | ReturnType<typeof loadInitialHistoryStoreSuccess>
): MessagingState => {
    const messages = result.map((thread) => {
        // merge only new messages !
        let peerId = getThreadPeerId(userId, thread.parties);
        if (thread.parties_list.split(',').length > 2) {
            peerId = getThreadPeerIdGroup(userId, thread.parties_list.split(','));
        } else {
            sessionStorage.setItem('peerId-' + peerId, peerId);
        }
        const msgs = thread.messages.map(mapDtoMessage(peerId, userId, thread.id, thread.parties_list));
        sessionStorage.setItem('loadInitialHistoryStoreSuccessHandler', 'true');
        return mergeThread(state, peerId, thread.id, msgs, false, thread, thread.parties_list, peerId);
    });



    /*let peerIdcheck = [];
    let peerIdMatchedObjId = [];
    let myKeyValuePairs = [];
    let tesarray = [];
    let whatsAppThreads: any = []
    myKeyValuePairs = messages.map(function (obj) {
        if (peerIdcheck.indexOf(obj.peerId) > -1) {
            console.log('exists in array');
            //if object key with peerid allready exists then
            if(myKeyValuePairs.length){
                myKeyValuePairs.forEach((myKV) => {
                    //console.log('mskv data', myKV);
                    if(myKV.key.includes('whatsapp') && myKV.key == obj.peerId){
                        peerIdMatchedObjId.push(obj.peerId + ' threadid:' + obj.threadId);
                        //peerIdMatchedObjId.push(obj.threadId);
                        //console.log('myKVvalue data', myKV.value.messages);
                        //console.log('obj value msg data', obj.messages);
                        myKV.value.messages = myKV.value.messages.concat(obj.messages);
                    }
                })
            }
            whatsAppThreads.push(obj.threadId)
        } else {
            // console.log('peerid not exists so inserting');
            peerIdcheck.push(obj.peerId)
            if(obj.peerId.includes('whatsapp')){
                peerIdMatchedObjId.push(obj.peerId + ' threadid:' + obj.threadId);
                //peerIdMatchedObjId.push(obj.threadId);
            }
            let abc = {
                key: obj.peerId,
                value: obj
            }
            myKeyValuePairs.push(abc);
        }
        tesarray = myKeyValuePairs
    })

    console.log('Value after concat is', tesarray);

    let filterWhatsAppThreads= tesarray.filter((data)=>{return data.key.includes('whatsapp')})
    filterWhatsAppThreads.forEach((res)=>{
        whatsAppThreads.push(res.value.threadId)
    });*/

    // console.log('Value after concat is', tesarray);
    //sessionStorage.setItem('threadIdData', JSON.stringify(peerIdMatchedObjId));
    //const history = fromPairs(tesarray.map((msgs) => [msgs.key.includes('whatsapp:') ? msgs.value.threadId : msgs.key , msgs.value]));

    const history = fromPairs(messages.map((msgs) => [msgs.peerId, msgs]));

    // add only threads which still not exists or readTime is less than incoming
    const mergeThreads = fromPairs(
        result.map((m) => [
                m.id,
                {
                    id: m.id,
                    readTime: m.t_read,
                    isMuted: state.threads[m.id]?.isMuted || false,
                },
            ])
    );

    const threads = {
        ...state.threads,
        ...mergeThreads,
    };

    // return new state only if some new messages were added !
    // if (!equals(history, state.hash)) {
    //     return {
    //         status: {
    //             kind: 'StateStatusLoaded',
    //             dateTime,
    //         },
    //         hash: { ...state.hash, ...history },
    //         threads,
    //     };
    // } else {
        return {
            ...state,
            status: {
                kind: 'StateStatusLoaded',
                dateTime,
            },
            threads,
        };
    // }
};
const loadPeerHistorySuccessHandler = (
    state: MessagingState,
    {
        result,
        dateTime,
        userId,
        peerId,
        threadId,
        isInitial,
    }:
        | ReturnType<typeof loadPeerHistorySuccess>
        | ReturnType<typeof loadPeerHistoryStoreSuccess>
) => {
    const loadedMessages = result.messages.map(mapDtoMessage(peerId, userId, threadId, sessionStorage.getItem(peerId)));
    const pervMessages = state.hash[peerId] ? state.hash[peerId].messages : [];
    const newMessages = loadedMessages.filter(
        (msg) => !pervMessages.some((x) => x.id === msg.id)
    );
    // if order of the returned messages is fixed, can omit sorting
    const latestLoadedMessage = first(sortBy('seq', result.messages));
    const latestLoadedSeq: LoadedSeq = latestLoadedMessage
        ? {
            seq: latestLoadedMessage.seq,
            ts: latestLoadedMessage.ts,
            id: latestLoadedMessage.id,
            count: result.messages.length,
            isInitial,
        }
        : null;
    // update state only if new messages were loaded
    if (newMessages.length > 0) {
        const messages = [...pervMessages, ...newMessages];
        const isWhatsAppThread = checkIfIsWhatsAppThread(messages);
        // const isWhatsOptInReqAccepted = checkIfIsWhatsOptInReqAccepted(result.messages);
        const lastIncommingMessageTime = getLastInCommingMsgTime(messages, peerId);
        // console.log('isWhatsOptInReqAccepted', isWhatsOptInReqAccepted)
        return assoc(
            ['hash', peerId],
            {
                ...state.hash[peerId],
                peerId,
                threadId,
                messages,
                status: {
                    kind: 'StateStatusLoaded',
                    dateTime,
                    latestLoadedSeq,
                },
                lastIncommingMessageAt: lastIncommingMessageTime,
            } as PeerMessages,
            state
        );
    } else {
        return assoc(
            ['hash', peerId, 'status'],
            {
                kind: 'StateStatusLoaded',
                dateTime,
                latestLoadedSeq,
            },
            state
        );
    }
};
const addOutgoingSessionMessageHandler = (
    state: MessagingState,
    {
        content,
        callId,
        resendCallId,
        peerId,
        dateTime,
        isSystem,
        parties_list,
        participants,
        messageType,
        messageInfo,
        valid
    }: ReturnType<typeof addOutgoingSessionMessage>
) => {
    logger.debug('CallId::' + callId + '&ResendCallId::' + resendCallId + '&PeerId::' +  peerId + ' Processing:: Reducer action addOutgoingSessionMessageHandler');
    if (!!resendCallId) {
        // message already in hash
        return state;
    }
    // sessionStorage.getItem('participants') !== "null" && sessionStorage.getItem('participants') !== undefined &&
    if (parties_list !== undefined && parties_list !== "null") {
        peerId = sortParticipantsAsID(parties_list.split("|"));
    } else {
        sessionStorage.setItem('peerId-' + peerId, peerId);
    }
    //logger.debug('peerId::::reducers-messaging::addOutgoingSessionMessageHandler', peerId);
    const peer = state.hash[peerId.includes('whatsapp') ? sessionStorage.getItem('CurrentThread') : peerId];
    const message: PeerChatMessage = {
        id: callId,
        from: 'me',
        fromNumber: 'me',
        sentTime: dateTime,
        content,
        isSystem,
        state: {
            kind: valid == false ? 'MessageStateInvalid' : 'MessageStateSending',
        },
        messageType,
        messageInfo
    };
    if (!peer) {
        //console.log("addOutgoingSessionMessageHandler : Inside if block")
        //console.warn('new thread! unknown threadId');
        const threadId = `mlnumber:${peerId}`;
        logger.debug('MsgId::' + message.id + '&PeerId::' + peerId + '&ThreadId::' + threadId + ' Processing:: New OutgoingSession Msg Thread');
        const updState = assoc(
            ['threads', threadId],
            {
                id: threadId,
                readTime: new Date().toISOString(),
            } as MessagesThread,
            state
        );
        return assoc(
            ['hash', peerId.includes('whatsapp') ? threadId : peerId],
            {
                peerId,
                status: { kind: 'StateStatusInitial' },
                messages: [message],
                threadId,
                participants: participants ? participants : peerId,
                isWhatsAppThread: participants.some(obj => obj.includes('whatsapp:')) ? true  : false,
                isGroup: participants.length > 1 ? true : false,
                messageChannelType: participants.some(obj => obj.includes('whatsapp:')) ? 'whatsapp'  : 'normalMsg'
            } as PeerMessages,
            updState
        );
    } else {
        //console.log("addOutgoingSessionMessageHandler : Inside else block")
        //logger.debug('peerId::::reducers-messaging::addOutgoingSessionMessageHandler', peerId);
        // message already exists
        if ((peer.messages || []).some((msg) => msg.id === callId)) {
            logger.debug('CallId::' + callId + 'Processing:: OutgoingSession Msg allready exists in hash With callId');
            return state;
        }
        if (messageInfo !== {} && (peer.messages || []).some((msg) => msg.id === messageInfo.session_id)) {
            const prevMsgs = [...peer.messages];
            const msgs = prevMsgs.filter((msg) => msg.id !== messageInfo.session_id)
            msgs.push(message);
            return assoc(['hash', peerId.includes('whatsapp') ? sessionStorage.getItem('CurrentThread') : peerId, 'messages'], msgs, state);
        }
        const messages = [...peer.messages, message];
        return assoc(['hash', peerId.includes('whatsapp') ? sessionStorage.getItem('CurrentThread') : peerId, 'messages'], messages, state);
    }
};

const addIncomingSessionMessageHandler = (from: 'me' | 'peer') => (
    state: MessagingState,
    {
        messageId,
        fromNum,
        content,
        peerId,
        dateTime,
        isSystem,
        threadId,
        type,
        messageType,
        messageInfo,
        stype,
        parties_list,
        messageChannelType
    }:
        | ReturnType<typeof addIncomingSessionMessage>
        | ReturnType<typeof checkIncomingSessionSelfMessage>
) => {
    logger.debug('PeerId::' + peerId + '&ThreadId::' + threadId + '&MsgId::' + messageId + ' Processing:: Reducer action addIncomingSessionMessageHandler');
    let participants_list = peerId
    let participants = parties_list;
    let isGroup = false;
    if (sessionStorage.getItem('incomingGroupParticipants') !== 'undefined' && sessionStorage.getItem('incomingGroupParticipants') !== null) {
        if (sessionStorage.getItem('incomingGroupParticipants') !== "null") {
            peerId = getIncomingGroupParticipants();
            participants_list = sessionStorage.getItem('incomingGroupParticipants')
            isGroup = true
            sessionStorage.removeItem('incomingGroupParticipants');
        }
    } else {
        sessionStorage.setItem('peerId-' + peerId, peerId);
    }
    const peer = (peerId?.includes('whatsapp') || stype == 34) ? state.hash[threadId] : state.hash[peerId];
    let message: PeerChatMessage;
    if (messageType == "voicemail") {
        message = {
            id: messageId,
            from,
            fromNumber: peerId,
            sentTime: new Date().toISOString(),
            content: 'Voicemail',
            isSystem: false,
            state: {
                kind: 'MessageStateSent',
                dateTime: new Date().toISOString()
            },
            messageType: "voicemail",
            messageInfo

        }
    } else {
        message = {
            id: messageId,
            from,
            fromNumber: fromNum,
            sentTime: dateTime,
            content,
            isSystem,
            state: {
                kind: 'MessageStateSent',
                dateTime,
            },
            messageType,
            messageInfo,
            stype,
            threadId: threadId,
        };
    }


    Object.values(state.hash).filter((e) => {
            if(e.threadId == threadId){
            e.messages?.filter((a) => {
                //console.log('hash message id', a.id);
                //console.log('new incoming message id', messageId);
                    if(a.id === messageId){
                    console.log('incoming reducer exists same msgid');
                    return assoc(
                        ['threads', threadId],
                        {
                            id: threadId,
                        } as MessagesThread,
                        state
                    );
                }
            })
        }
    })

    if (!peer) {
        logger.debug('PeerId::' + peerId + '&threadId::' + ' Processing:: Creating New Msg Thread With PeerId or ThreadId');
        if (!threadId) {
            console.warn('threadId is null!');
        }
        assoc(
            ['threads', threadId],
            {
                id: threadId,
                readTime: new Date().toISOString(),
            } as MessagesThread,
            state
        );
        const isWhatsAppThread = peerId.includes('whatsapp')
        let addParticipantsArray:any = [];
        if (participants == undefined) {
            addParticipantsArray.push(participants_list)
        }
        //logger.debug('!peerId::::reducers-messaging::addIncomingSessionMessageHandler', peerId);
        return assoc(
            ['hash', peerId.includes('whatsapp') ? threadId : peerId],
            {
                peerId,
                status: { kind: 'StateStatusLoaded' },
                messages: [message],
                participants_list,
                isGroup,
                threadId,
                isWhatsAppThread: isWhatsAppThread,
                optInRequestCount: isWhatsAppThread ? 1 : 0,
                hideThread: false,
                whatsOptInReqStatus: isWhatsAppThread ? stype == 30 || stype == 31 ? "3" : getValidOptinSatus(isWhatsAppThread, messageChannelType): null,
                lastIncommingMessageAt: covertToTimeZoneDate(dateTime),
                participants:participants ? participants?.split('|') : addParticipantsArray,
                messageChannelType
            } as PeerMessages,
            state
        );
    } else {
        //logger.debug('peerId::::reducers-messaging::addIncomingSessionMessageHandler', peerId);
        const messageIndex = (peer.messages || []).findIndex(
            (msg) => msg.id === messageId
        );

        if (messageIndex !== -1) {
            if (type === '[Messaging] Check Incoming Session Self Message') {
                logger.debug('PeerId::' + peerId + '&ThreadId::' + threadId + ' Processing:: Self Msg With PeerId or ThreadId');
                if (typeof (peer.threadId) === "undefined") {
                    peer.threadId = 'mlnumber:' + peerId;
                }
                const messageThreadId = peer.threadId;
                if (messageThreadId.startsWith('mlnumber')) {
                    logger.debug('message from new thread update thread id !');
                    state = assoc(
                        ['hash', peerId.includes('whatsapp') ? threadId : peerId, 'threadId'],
                        threadId,
                        state
                    );
                    // remove all thread entry
                    const thread = state.threads[messageThreadId];
                    let threads = omit(messageThreadId, state.threads);
                    // add new thread entry
                    threads = assoc(
                        threadId,
                        { ...thread, id: threadId },
                        threads
                    );
                    state = assoc(['threads'], threads, state);
                }
            }

            // message already exists, update time
            return assoc(
                ['hash', peerId.includes('whatsapp') ? threadId : peerId, 'messages', messageIndex, 'sentTime'],
                dateTime,
                state
            );
        } else {
            //logger.debug('peerIdAnotherElseBlock::::reducers-messaging::addIncomingSessionMessageHandler', peerId);
            logger.debug('PeerId::' + peerId + '&ThreadId::' + threadId + ' Processing:: Inserting New Msg of PeerId or ThreadId');
            const messages = [...peer.messages, message];
            // on accepting or rejecting opt-in request, 25 = accept, 21- reject

            if(message.stype == 25 || message.stype == 21 || message.stype == 33 || message.stype == 34
                    || message.stype == 30 || message.stype == 31 || message.stype == 29 || message.stype == 37 || message.stype == 35){
                let whatsOptInReqStatus = null;

                switch(stype){
                    case 25:
                        {
                            whatsOptInReqStatus = 3;
                            break;
                        }
                    case 21:{
                        whatsOptInReqStatus = 4;
                        break;
                    }
                    case 33: {
                        whatsOptInReqStatus = 5;
                        break;
                    }
                    case 34: {
                        whatsOptInReqStatus = 3;
                        break;
                    }
                    case 30: {
                        whatsOptInReqStatus = 3;
                        break;
                    }
                    case 31: {
                        whatsOptInReqStatus = 3;
                        break;
                    }
                    case 29: {
                        whatsOptInReqStatus = 3;
                        break;
                    }
                    case 37: {
                        whatsOptInReqStatus = 5;
                        break;
                    }
                    case 35: {
                        whatsOptInReqStatus = 3;
                        break;
                    }
                }
                let id;
                if(message.stype == 34 || message.stype == 35){
                    //participants = state.hash[threadId].participants.filter((id) => id != peerId).join('|');
                  if(state.hash[threadId].participants.length == 3){
                        participants = state.hash[threadId].participants.filter((id) => id.includes('whatsapp')
                        )
                    }
                    //id = state.hash[threadId];
                    //peerId = state.hash[threadId].participants.join('|');
                }

                if(message.stype == 33){
                    participants = state.hash[threadId].participants.filter((id) => id != sessionStorage.getItem("__api_identity__"))
                }

                const updatedHash = {
                    ...state.hash[threadId],
                    peerId : getPeerIdFromThreadId(peerId, state.hash),
                    messages: messages,
                    isGroup,
                    lastIncommingMessageAt: dateTime,
                    isWhatsAppThread: true,
                    whatsOptInReqStatus: whatsOptInReqStatus,
                    participants: participants ? participants.length > 1 && participants.includes('|') ?  participants.split('|') : participants : [peerId],
                    threadId,
                    messageChannelType
                };
                //console.log('updateHash-- reducers--->', messages[0].id, participants)
                //logger.debug('updateHash-- reducers--->', messages[0].id, participants);
                return assoc(
                    ['hash', (peerId.includes('whatsapp') || stype == 34) ? threadId : peerId],
                    updatedHash as PeerMessages,
                    state
                );
            }
            //logger.debug('updateHashNew-- reducers--->', messages[0].id, participants);
            return assoc(
                ['hash', peerId.includes('whatsapp') ? threadId : peerId],
                {...state.hash[peerId.includes('whatsapp') ? threadId : peerId], messages, lastIncommingMessageAt:  participants?.includes('whatsapp:'+fromNum)  ? dateTime : state.hash[threadId]?.lastIncommingMessageAt, participants: participants ? participants?.split('|') : [peerId]} as PeerMessages,
                state
            );
        }
    }

};

const outgoingSessionMessageAcceptedHandler = (
    state: MessagingState,
    {
        messageId,
        callId,
        resendCallId,
        peerId,
        dateTime,
        threadId,
    }: ReturnType<typeof outgoingSessionMessageAccepted>
) => {
    // if (sessionStorage.getItem('participants') !== "null") {
    //     if (sessionStorage.getItem('isMessageForwarded') !== 'true') {
    //         peerId = getGroupParticipants();
    //     }
    // } else {
    //     sessionStorage.setItem('peerId-' + peerId, peerId);
    // }
    logger.debug('CallId::' + callId + '&ResendCallId::' + resendCallId + '&MsgId::' + messageId + '&PeerId::' + peerId + ' Processing:: Reducer action outgoingSessionMessageAcceptedHandler');
    //logger.debug('peerId::::reducers-messaging::outgoingSessionMessageAcceptedHandler', peerId);
    //logger.debug('callId::::reducers-messaging::outgoingSessionMessageAcceptedHandler', callId);
    if(JSON.parse(sessionStorage.getItem(callId))){
        peerId = JSON.parse(sessionStorage.getItem(callId)).replaceAll("'", '');
        logger.debug('PeerId::' + peerId + '&CallId::' + callId + 'Resetting Peer Id from CallId');
    }
    //logger.debug('resendCallId::::reducers-messaging::outgoingSessionMessageAcceptedHandler', resendCallId);
    //logger.debug('messageId::::reducers-messaging::outgoingSessionMessageAcceptedHandler', messageId);
    if (resendCallId && sessionStorage.getItem('resend-' + resendCallId) !== "null" && sessionStorage.getItem('resend-' + resendCallId) !== null && sessionStorage.getItem('resend-' + resendCallId) !== 'undefined') {
        peerId = sortParticipantsAsID(sessionStorage.getItem('resend-' + resendCallId).split('|'));
        sessionStorage.removeItem('resend-' + resendCallId);
    } else if (resendCallId && sessionStorage.getItem('resend_121-' + resendCallId) !== "null" && sessionStorage.getItem('resend_121-' + resendCallId) !== null) {
        peerId = sessionStorage.getItem('resend_121-' + resendCallId);
        sessionStorage.removeItem('resend_121-' + resendCallId);
    }
    const getHashId = peerId?.includes('whatsapp:') ? threadId : peerId;
    const peerMessages = state.hash[getHashId];
    const messages = peerMessages?.messages;
    const index = messages?.findIndex((f) => f.id === (resendCallId ? resendCallId : callId));
    logger.debug('CallId::' + callId + '&ResendCallId::' + resendCallId + ' Processing:: index value for callId(says Msg with CallId Exists or Not):: ' + index);
    logger.debug('Note:: index having value means msg with callid is exists');
        const indexM = messages?.findIndex((f) => f.id === (messageId));
        //logger.debug(`MessagingReducer : Messages for the id ${JSON.stringify(state.hash[getHashId].messages)}}`);
        //logger.debug(`MessagingReducer : Messages for the length ${JSON.stringify(state.hash[getHashId].messages?.length)}}`);
        if (indexM !== -1) {
            logger.debug('MsgId::' + messageId + 'Processing:: indexM value for MsgId(says Msg with MsgId Exists or Not):: ' + indexM);
            logger.debug('Note:: indexM value not equal to -1 means msg with same messageId is allready exists, so below will omit that msg');
            //logger.debug(`MessagingReducer : Message id ${messageId} and getHashId = ${getHashId}`);
            //logger.debug(`MessagingReducer : indexM value ${indexM}}`);
            //console.log('cmt_to_selfmsg_first data value::', sessionStorage.getItem('cmt_to_selfmsg_first'));
            //if(sessionStorage.getItem('cmt_to_selfmsg_first') != undefined && sessionStorage.getItem('cmt_to_selfmsg_first') != 'true'){
                state = omitDeep(
                    [
                        'hash',
                        getHashId,
                        'messages',
                        state.hash[getHashId]?.messages?.findIndex((f) => f.id === messageId),
                    ],
                    state
                );

                if(index == undefined){
                    logger.debug(`MessagingReducer :outgoingSessionMessageAcceptedHandler::afterSyncMsgFlow`);
                    return state
                }
            //}
            //sessionStorage.removeItem('cmt_to_selfmsg_first');
        }
        if(index != undefined){
            const message = messages[index];
        //logger.debug(`MessagingReducer : State before update message ${JSON.stringify(state.hash[getHashId].messages)}}`);
        //logger.debug(`MessagingReducer : State before update message length ${JSON.stringify(state.hash[getHashId].messages?.length)}}`);
        const updMessage: PeerChatMessage = {
            ...message,
            id: messageId,
            state: {
                kind: 'MessageStateSent',
                dateTime,
            },
        };
        const updState = assoc(
            ['hash', getHashId, 'messages', index],
            updMessage,
            state
        );
        //logger.debug(`MessagingReducer : State after update message ${JSON.stringify(updState.hash[getHashId].messages)}}`);
        //logger.debug(`MessagingReducer : State after update message length ${JSON.stringify(updState.hash[getHashId].messages?.length)}}`);
        //logger.debug("MessagingReducer : accepting outgoing message");
        sessionStorage.setItem('isMessageForwarded', 'false');
        return updState;
    }
};

const outgoingSessionMessageRejectedHandler = (
    state: MessagingState,
    {
        error,
        callId,
        peerId,
        resendCallId,
        threadId,
    }: ReturnType<typeof outgoingSessionMessageRejected>
) => {
    logger.debug('CallId::', callId + '&ResendCallId::' + resendCallId + '&PeerID::' + peerId + '&ThreadId::' + threadId + ' Processing:: Reducer action outgoingSessionMessageRejectedHandler');
    const getHashId = peerId.includes('whatsapp:') ? threadId : peerId
    const messages = state.hash[getHashId]?.messages;
    const index = messages?.findIndex((f) => f.id === (resendCallId || callId));
    const updMessage: PeerChatMessage = {
        ...messages[index],
        state: {
            kind: 'MessageStateError',
            error,
        },
        wanum: peerId
    };
    return assoc(['hash', getHashId, 'messages', index], updMessage, state);
};

const messageDisplayedHandler = (
    state: MessagingState,
    { dateTime, threadId }: ReturnType<typeof messageRead>
) => {
    const threadReadTime = state.threads[threadId]?.readTime;
    if (!threadReadTime || new Date(dateTime)) {
        return assocPath(['threads', threadId, 'readTime'], dateTime, state);
    } else {
        return state;
    }
};

const removePeerMessageHandler = (
    state: MessagingState,
    { peerId, messageId }: ReturnType<typeof removePeerMessage>
) =>
    omitDeep(
        [
            'hash',
            peerId,
            'messages',
            state.hash[peerId].messages?.findIndex((f) => f.id === messageId),
        ],
        state
    );

const setTreadMuteHandler = (
    state: MessagingState,
    { threadId, isMuted }: ReturnType<typeof setTreadMute>
) => assocPath(['threads', threadId, 'isMuted'], isMuted, state);

const hideMessageThreadHandler = (
    state: MessagingState,
    { peerId, hideThread }: ReturnType<typeof hideMessageThread>
) => assocPath(['hash', peerId, 'hideThread'], hideThread, state);

//voicemails
const updateVVMReadStatusInStoreHandler = (
    state: MessagingState, { peerId, messageId }: ReturnType<typeof updateVVMReadStatusInStore>
) => {
    return assocPath(['hash', peerId, 'messages', state.hash[peerId].messages?.findIndex((f) => f.id === messageId), 'messageInfo', 'isVoiceMailRead'], true, state);
}

const updatePicMsgAPIErrorHandler = (
    state: MessagingState, { peerId, mms_id }: ReturnType<typeof updatePicMsgAPIError>
) => {
    peerId = getValidPeerId(peerId);
    return assoc(
        ['hash', peerId, 'messages', state.hash[peerId]?.messages?.findIndex((f) => f.id === mms_id), 'state'],
        { kind: 'PictureMessageAPIError' },
        state
    );
}

const updateDownloadAPIErrorStatusHandler = (
    state: MessagingState, { peerId, msg_id, error }: ReturnType<typeof updateDownloadAPIErrorStatus>
) => {
    peerId = getValidPeerId(peerId);
    let errorStat = 'failure';
    // this needs to be addressed incase image is purged
    // if(error && error.error_code === NaN){
    //     errorStat = 'deleted-in-server';
    // }
    return assoc(
        ['hash', peerId, 'messages', state.hash[peerId]?.messages?.findIndex((f) => f.id === msg_id), 'messageInfo', 'multimediaStatus'],
        errorStat,
        state
    )
}
const updateDownloadAPISuccessHandler = (
    state: MessagingState, { peerId, msg_id }: ReturnType<typeof updateDownloadAPISuccess>
) => {
    peerId = getValidPeerId(peerId);
    return assoc(
        ['hash', peerId, 'messages', state.hash[peerId]?.messages?.findIndex((f) => f.id === msg_id), 'messageInfo', 'multimediaStatus'],
        'downloaded',
        state
    )
}

const updatePictureRetryThresholdReachedHandler = (
    state: MessagingState, { peerId, mms_id }: ReturnType<typeof updatePictureRetryThresholdReached>
) => {
    peerId = getValidPeerId(peerId);
    return assoc(
        ['hash', peerId, 'messages', state.hash[peerId]?.messages?.findIndex((f) => f.id === mms_id), 'state'],
        { kind: 'PicMsgRetryThresholdReached' },
        state
    );
}

const addPicMsgPlaceholderHanler = (
    state: MessagingState, {
        peerId, mms_id, dateTime, to, parties_list, messageInfo
    }: ReturnType<typeof addPicMsgPlaceholder>
) => {
    const messageType = "picture";
    peerId = getValidPeerId(peerId);
    const getHashId = peerId.includes('whatsapp:') ? messageInfo.isWhatsAppThreadId : peerId
    const peer = state.hash[getHashId];
    const message: PeerChatMessage = {
        id: mms_id,
        from: 'me',
        fromNumber: 'me',
        sentTime: dateTime,
        content: "Multimedia Message",
        isSystem: false,
        state: {
            kind: 'PictureMessageAPISending',
        },
        messageType,
        messageInfo: messageInfo
    };
    if (!peer) {
        console.warn('new thread! unknown threadId');
        const threadId = `mlnumber:${peerId}`;
        const updState = assoc(
            ['threads', threadId],
            {
                id: threadId,
                readTime: new Date().toISOString(),
            } as MessagesThread,
            state
        );

        let paticips: any
        if(parties_list){
            paticips = getValidXCafeParticipants(parties_list).split('|');
        }
        return assoc(
            ['hash', peerId.includes('whatsapp') ? threadId : peerId],
            {
                peerId,
                status: { kind: 'StateStatusInitial' },
                messages: [message],
                threadId,
                participants: paticips ? paticips : [peerId],
                isWhatsAppThread: paticips?.some(obj => obj.includes('whatsapp:')) ? true  : false,
                isGroup: paticips?.length > 1 ? true : false,
                messageChannelType: paticips?.some(obj => obj.includes('whatsapp:')) ? 'whatsapp'  : 'normalMsg'
            } as PeerMessages,
            updState
        );
    } else {
        // message already exists
        if ((peer.messages || []).some((msg) => msg.id === mms_id)) {
            return state;
        }
        const messages = [...peer.messages, message];
        return assoc(['hash', getHashId, 'messages'], messages, state);
    }
}


const loadInitialVoiceMailHistorySuccessHandler = (
    state: MessagingState,
    { vvms }: ReturnType<typeof loadInitialVoiceMailHistorySuccess>
) => {
    let messages = vvms
    const listOfMessage = new Array();
    const threads = []
    for (let i = 0; i < messages.length; i++) {
        const message = new MessageB();
        message.id = messages[i].id;
        message.userId = messages[i].userId;
        message.peerId = messages[i].peerId;
        message.threadId = messages[i].threadId;
        message.callId = messages[i].callId;
        message.sentTime = messages[i].sentTime;
        message.content = messages[i].content;
        message.state = messages[i].state;
        message.isSystem = messages[i].isSystem;
        message.messageType = "voicemail";
        message.messageInfo = messages[i].messageInfo;
        listOfMessage.push(message);
        threads.push(message.threadId)
    }
    const groupedMessages = toPairs(groupBy('peerId', listOfMessage));
    const msgs = groupedMessages.map(([peerId, msgs], index) => {
        const chatMsgs = msgs.map(
            (msg) =>
            ({
                ...msg,
                from: 'peer',
                fromNumber: msg.userId,
            } as PeerChatMessage)
        );

        return mergeThread(state, peerId, msgs[0].threadId, chatMsgs, true);

    });

    // add only threads which still not exists or readTime is less than incoming

    const mergeThreads = fromPairs(
        threads
            .filter(
                (f) =>
                    !state.threads[f.id] ||
                    new Date(state.threads[f.id].readTime) <
                    new Date(f.readTime)
            )
            .map((m) => [m.id, m])
    );

    const updThreads = {
        ...state.threads,
        ...mergeThreads,
    };


    const history = fromPairs(msgs.map((msg) => [msg.peerId?.includes('whatsapp:') ? msg.threadId: msg.peerId, msg]));
    const updHash = { ...state.hash, ...history };
    const result: MessagingState = {
        status: {
            kind: 'StateStatusLoaded',
            dateTime: new Date().toISOString(),
        },
        hash: updHash,
        threads: updThreads
    };
    return result;

}

const updateRequestCountHandler = (
    state: MessagingState,
    {peerId }: ReturnType<any>
) =>{
    const oldRequestCountValue = state.hash[peerId]?.optInRequestCount ? state.hash[peerId].optInRequestCount: 1;
    return assoc(

        ['hash', peerId, 'optInRequestCount'],
        oldRequestCountValue+1,
        state
    );
}

const updateThreadIdOnReEngageHandler = (
    state: MessagingState,
    { peerId, threadId }: ReturnType<typeof updateThreadIdOnReEngage>
) =>{
    console.log('update for :', peerId, threadId )
    const oldSentRequestCount = state.hash[peerId]?.optInRequestCount;
    const oldPeerState = {
        ...state.hash[peerId],
        optInRequestCount : oldSentRequestCount+1,
        whatsOptInReqStatus : "2",
        threadId: threadId
    }

    return assoc(
        ['hash', peerId],
        oldPeerState,
        state
    );
}

const updateParticipantListHandler = (
    state: MessagingState,
    {
        peerId,
        modifyUser,
        threadId,
        actionType
    }:
        | ReturnType<typeof updateParticipantList>
) => {
    logger.debug('modifyUser--->threadId,::::reducers-messaging::updateParticipantListHandler', modifyUser, threadId);
    const newPeerState = {
        ...state.hash[threadId],
        peerId : getPeerIdFromThreadIdUpdateParticipant(modifyUser),
        participants : modifyUser,
        isGroup: modifyUser.length > 1 ? true : false
    }
    return assoc(
        ['hash', threadId],
        newPeerState,
        state
    );
}

const updateCachelocal = (state:MessagingState)=>{
    console.log("load state to cache callecd.",state)
    localStorage.setItem("cacheRehidrate",JSON.stringify(state))
    return state
}


const setSearchTextHandler = (
    state: MessagingState,
    { searchText }: ReturnType<typeof setSearchText>
) => assoc(['searchText'], searchText, state);


const _messagingReducer = createReducer<MessagingState>(
    initialState,
    on(rehydrateSuccess, rehydrateSuccessHandler),
    on(loadInitialHistory, (state) =>
        assoc(['status'], { kind: 'StateStatusLoading' }, state)
    ),
    on(loadInitialHistoryStoreSuccess, loadInitialHistoryStoreSuccessHandler),
    on(loadPeerHistoryStoreSuccess, loadPeerHistorySuccessHandler),
    on(addOutgoingSessionMessage, addOutgoingSessionMessageHandler),
    on(addPicMsgPlaceholder, addPicMsgPlaceholderHanler),
    on(updatePicMsgAPIError, updatePicMsgAPIErrorHandler),
    on(updateDownloadAPIErrorStatus, updateDownloadAPIErrorStatusHandler),
    on(updateDownloadAPISuccess,updateDownloadAPISuccessHandler),
    on(updatePictureRetryThresholdReached, updatePictureRetryThresholdReachedHandler),
    on(outgoingSessionMessageAccepted, outgoingSessionMessageAcceptedHandler),
    on(outgoingSessionMessageRejected, outgoingSessionMessageRejectedHandler),
    on(addIncomingSessionMessage, addIncomingSessionMessageHandler('peer')),
    on(checkIncomingSessionSelfMessage, addIncomingSessionMessageHandler('me')),
    on(messageRead, messageDisplayedHandler),
    on(removePeerMessages, (state, { peerId }) =>
        omitDeep(['hash', peerId], state)
    ),
    on(removePeerMessage, removePeerMessageHandler),
    on(setTreadMute, setTreadMuteHandler),
    on(updateVVMReadStatusInStore, updateVVMReadStatusInStoreHandler),
    on(loadInitialVoiceMailHistorySuccess, loadInitialVoiceMailHistorySuccessHandler),
    on(setSearchText, setSearchTextHandler),
    on(hideMessageThread, hideMessageThreadHandler),
    on(updateRequestCount, updateRequestCountHandler),
    on(updateThreadIdOnReEngage, updateThreadIdOnReEngageHandler),
    on(updateParticipantList, updateParticipantListHandler),
    on(updateCacheStore,updateCachelocal)
);

export const messagingReducer = (state, action) => {
    return _messagingReducer(state, action);
};
