import { Media, Message, MessageError, MessageState, MessageThread, NewContact, Contact } from '@movius/domain';
import { createAction, props } from '@ngrx/store';
import { messageInfoType } from 'libs/domain/src/lib/models/messageInfo';
import { MessageType } from '../models';
import { GetAllMessagesDTO, Thread } from '../services';
export interface ImageFile {
    img: string;
    file: File;
}


export const rehydrateSuccess = createAction(
    '[Messaging] Rehydrate Success',
    props<{ messages: Message[]; threads: MessageThread[]; retryMsgs:any[]; dateTime: string; participants_data?:any[] }>()
);

export const loadInitialHistory = createAction(
    '[Messaging] Load Initial History'
);

export const loadNextHistory = createAction(
    '[Messaging] Load Next History'
);

export interface LoadInitialHistorySuccessPayload {
    result: Thread[];
    dateTime: string;
    userId: string;
}

export const loadInitialHistorySuccess = createAction(
    '[Messaging] Load Initial History Success',
    props<LoadInitialHistorySuccessPayload>()
);

export const loadInitialHistoryStoreSuccess = createAction(
    '[Messaging] Load Initial History Store Success',
    props<LoadInitialHistorySuccessPayload>()
);

export const loadPeerHistory = createAction(
    '[Messaging] Load Peer History',
    props<{ peerId: string; loadNextPage: boolean; threadTest?: string }>()
);

export const loadPreviousPeerHistory = createAction(
    '[Messaging] Load prevoius Peer History',
    props<{ peerId: string; seq:number,ts:string }>()
);


export interface LoadPeerHistorySuccessPayload {
    isInitial: boolean;
    result: GetAllMessagesDTO;
    userId: string;
    peerId: string;
    threadId: string;
    dateTime: string;
}

export const loadPeerHistorySuccess = createAction(
    '[Messaging] Load Peer History Success',
    props<LoadPeerHistorySuccessPayload>()
);

export const loadPeerHistoryError = createAction(
    '[Messaging] Load Peer History Error',
    props<{ error: any }>()
);

export const loadPeerHistoryStoreSuccess = createAction(
    '[Messaging] Load Peer History Store Success',
    props<LoadPeerHistorySuccessPayload>()
);

export const addMultilineSession = createAction(
    '[Messaging] Add Multiline Session',
    props<{
        multiline: string;
        message: string;
    }>()
);

export const startSendSessionMessage = createAction(
    '[Messaging] Start Send Session Message',
    props<{
        peerUri: string;
        content: string;
        dateTime: string;
    }>()
);

export const addPicMsgPlaceholder = createAction(
    '[Messaging] Adding placeholder for pictureMessaging',
    props<{
        peerId: string;
        mms_id: string;
        dateTime: string;
        to: string;
        parties_list: string;
        messageInfo: any;
    }>()
);

export const updatePicMsgAPIError = createAction(
    '[Messaging] Update Picture Message API failed status',
    props<{
        peerId: string;
        mms_id:string;
    }>()
);

export const updatePictureRetryThresholdReached = createAction(
    '[Messaging] Update Picture Message Retry Threshold Reached',
    props<{
        peerId:string;
        mms_id:string;
    }>()
);

export const updateDownloadAPIErrorStatus = createAction(
    '[Messaging] Update Download Picture Message Failure',
    props<{
        peerId:string;
        msg_id:string;
        error:{
            desc: string,
            error_code: number
        };
    }>()
);

export const updateDownloadAPISuccess = createAction(
    '[Messaging] Update multimedia status to downloaded',
    props<{
        peerId: string;
        msg_id: string;
    }>()
);

export const startSendMultimediaMessage = createAction(
    '[Messaging] Start Send Multimedia Message',
    props<{
        messageId:string;
        mediaInfo:Media;
        messageInfo:messageInfoType;
        messageType:MessageType;
        peerUri:string;
        dateTime: string
    }>()
);


export const addOutgoingSessionMessage = createAction(
    '[Messaging] Add Outgoing Session Message',
    props<{
        peerId: string;
        callId: string;
        resendCallId?: string;
        content: string;
        dateTime: string;
        isSystem: boolean;
        parties_list: string;
        participants: any;
        messageType: MessageType,
        messageInfo : any,
        valid?: boolean
    }>()
);

export const addIncomingSessionMessage = createAction(
    '[Messaging] Add Incoming Session Message',
    props<{
        peerId: string;
        messageId: string;
        fromNum: string;
        content: string;
        dateTime: string;
        isSystem: boolean;
        threadId: string;
        parties_list: string;
        messageType: MessageType;
        messageInfo: any;
        stype?:number;
        messageChannelType?:string;
    }>()
);

export const checkIncomingSessionSelfMessage = createAction(
    '[Messaging] Check Incoming Session Self Message',
    props<{
        peerId: string;
        fromNum: string;
        messageId: string;
        content: string;
        dateTime: string;
        isSystem: boolean;
        threadId: string;
        parties_list: string;
        messageType:MessageType;
        messageInfo: any;
        stype?:number;
        messageChannelType?:string;
    }>()
);

export const outgoingSessionMessageAccepted = createAction(
    '[Messaging] Outgoing Session Message Accepted',
    props<{
        peerId: string;
        callId: string;
        resendCallId?: string;
        messageId: string;
        dateTime: string;
        threadId: string;
    }>()
);

export const outgoingSessionMessageRejected = createAction(
    '[Messaging] Outgoing Session Message Rejected',
    props<{
        peerId: string;
        callId: string;
        resendCallId?: string;
        error: MessageError;
        threadId: string;
    }>()
);

export const resendPendingMessages = createAction(
    '[Messaging] Resend Pending Messages'
);

export const messageRead = createAction(
    '[Messaging] Message Read',
    props<{
        peerId: string;
        messageId: string;
        dateTime: string;
        threadId: string;
        isSystem: boolean; // A new attribute to identify System Messages.
        isVoiceMail?:boolean
    }>()
);

export const startRemovePeerMessages = createAction(
    '[Messaging] Start Remove Peer Messages',
    props<{
        peerId: string;
    }>()
);

export const removePeerMessages = createAction(
    '[Messaging] Remove Peer Messages',
    props<{
        peerId: string;
    }>()
);

export const removePeerMessage = createAction(
    '[Messaging] Remove Peer Message',
    props<{
        peerId: string;
        messageId: string;
    }>()
);

export const forwardMessage = createAction(
    '[Messaging] Forward Message',
    props<{
        messageId: string;
        content: string;
    }>()
);

export const forwardMultimediaMessage = createAction(
    '[Messaging] Forward Multimedia Message',
    props<{
        messageId: string;
        messageType: MessageType;
        messageInfo:messageInfoType,
        mediaInfo:Media
    }>()
);

export const setTreadMute = createAction(
    '[Messaging] Set Thread Mute',
    props<{
        threadId: string;
        isMuted: boolean;
    }>()
);

//voicemails
export interface loadInitialVoiceMailHistorySuccessPayload {
    vvms: Message[];
}

export const updateVVMReadStatusInStore = createAction(
    '[Messaging] Update VVM Read Status',
    props<{
        peerId: string;
        messageId: string;
    }>()
)
export interface VVMObjects {
    id: string;
    userId: string;
    peerId: string;
    threadId: string;
    callId: string;
    sentTime: string;
    content: string;
    state: MessageState;
    isSystem: boolean;
    isVoiceMail: boolean;
    isVoiceMailRead: boolean;
    duration: string;
    From: string
    SessionID: string
}
export interface loadInitialVoiceMailHistorySuccessPayload {
    vvms: Message[];
}

export const loadInitialVoiceMailHistory = createAction(
    '[Messaging] Load Initial Voice Mails History'
);

export const loadInitialVoiceMailHistorySuccess = createAction(
    '[Messaging] Load Initial Voice Mails History Success',
    props<loadInitialVoiceMailHistorySuccessPayload>()
)


export const loadLatestVoiceMail = createAction(
    '[Messaging] Load Latest Voice Mail'
);

export const loadLatestMessagesWithVVM = createAction(
    '[Messaging] Load Latest Voice Mail with VVM'
);



// export const loadVVMToStore = createAction(
//     '[Messaging] Load VVM To Store'
// )

export const readVoicemail = createAction(
    '[Messaging] Read VVM',
    props<{
        id: string;
        userId: string;
        peerId: string;
        threadId: string;
        callId: string;
        sentTime: string;
        content: string;
        state: MessageState;
        isSystem: boolean;
        isVoiceMail: boolean;
        isVoiceMailRead: boolean;
        duration: string;
        From: string
        SessionID: string
    }>()
);

export const setSearchText = createAction(
    '[Messaging] Set Search Text',
    props<{
        searchText: string;
    }>()
);

export const startCreateUserContact = createAction(
    '[Contacts] Start Create User Contact',
    props<{ contact: NewContact; imageFile?: ImageFile; contactCreatedFrom?: string; }>()
);

export const hideMessageThread = createAction(
    '[Messaging] Hide Message Thread',
    props<{
        peerId:string;
        threadId: string;
        hideThread: boolean; // A new attribute to identify System Messages.
    }>()
);

export const updateRequestCount = createAction(
    '[Message] Update opt-in Request Count',
    props<{ threadId: string, peerId:string }>()
);
export const updateThreadIdOnReEngage = createAction(
    '[Message] Update threadId on Re-Engage Opt-in Request Success',
    props<{ threadId: string,  peerId:string }>()
);

export const updateParticipantList = createAction(
    '[Messaging] Update Participant List',
    props<{ peerId?:string, modifyUser:string[], threadId?:string, actionType:string }>()
);

export const updateCacheStore = createAction(
    '[Messaging] Update Cache Store'
);
