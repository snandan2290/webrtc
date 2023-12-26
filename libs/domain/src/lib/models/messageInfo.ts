import { MessageType } from "apps/movius-web/src/libs/feature-messaging/models";

export interface messageInfoType {
    id: string,
    session_id: string, // mms_session for now, can hold multiple session_id of diff msg types
    multimediaStatus: 'downloaded' | 'not-initiated' | 'failure' | 'deleted-in-server',
    messageType: MessageType,
    duration?: string,
    parties_list: string,
    from?: string,
    to?: string,
    multimediaContentType:string,
    stype?:any
}

export interface VoicemailType {
    id: string,
    session_id: string, // mms_session for now, can hold multiple session_id of diff msg types
    multimediaStatus: 'downloaded' | 'not-initiated' | 'failure',
    messageType: MessageType,
    duration: string,
    parties_list: string,
    isVoiceMailRead : boolean,
    multimediaContentType: string,
}

export interface PictureType {
    id: string,
    session_id: string, // mms_session for now, can hold multiple session_id of diff msg types
    multimediaStatus: 'downloaded' | 'not-initiated' | 'failure' | 'deleted-in-server',
    messageType: MessageType,
    duration: string,
    parties_list: string,
    isVoiceMailRead : boolean,
    multimediaContentType : string,
}

export interface TextType {
}