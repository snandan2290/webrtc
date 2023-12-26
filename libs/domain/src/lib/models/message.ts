import { MessageType } from "apps/movius-web/src/libs/feature-messaging/models";

export interface MessageError {
    dateTime: string;
    code: number;
    message: string;
}

export interface MessageStateError {
    kind: 'MessageStateError';
    error: MessageError;
}

export interface PictureMessageAPISending {
    kind: 'PictureMessageAPISending';
}

export interface PictureMessageAPIError {
    kind: 'PictureMessageAPIError';
}

export interface PicMsgRetryThresholdReached {
    kind: 'PicMsgRetryThresholdReached';
}

export interface MessageStateSending {
    kind: 'MessageStateSending';
}

export interface MessageStateSent {
    kind: 'MessageStateSent';
    dateTime: string;
    seq?:number
}

export interface MessageStateInvalid {
    kind: 'MessageStateInvalid';
}

export type MessageState =
    | MessageStateError
    | MessageStateSending
    | MessageStateSent
    | MessageStateInvalid
    | PictureMessageAPISending
    | PictureMessageAPIError
    | PicMsgRetryThresholdReached;

export interface MessageBase<T = string | ArrayBuffer> {
    id: string;
    userId: T;
    peerId: T;
    threadId: string;
    callId: string;
    sentTime: string;
    content: T;
    state: MessageState;
    isSystem: boolean;
    messageType?: MessageType;
    messageInfo: any;
    stype?: any;
    messageChannelType?:string;
}
export interface MessageBaseDB<T = string | ArrayBuffer> {
    id: string;
    userId: T;
    peerId: T;
    threadId: string;
    parties_list: string;
    callId: string;
    sentTime: string;
    content: T;
    state: MessageState;
    messageType: MessageType;
    stype?: any;

}

export type Message = MessageBase<string>;

export type MessageEncrypted = MessageBase<ArrayBuffer>;
