import { MessageState } from '@movius/domain';
import { messageInfoType } from 'libs/domain/src/lib/models/messageInfo';
import { UserContactGhost } from '../../feature-contacts/models';
import { StateStatusLoadedSeq } from './state-status-loaded-seq';

export type FromType = 'me' | 'peer';
export type MessageType = "text" | "voicemail" | "picture"

export interface PeerChatMessage {
    id: string;
    from: FromType;
    fromNumber: string;
    sentTime: string;
    // readTime: string | null;
    content: string;
    state: MessageState;
    isSystem: boolean;
    messageType: MessageType;
    messageInfo: messageInfoType;
    stype?:number
    threadId?: string;
    wanum?: string;
}

export interface PeerChatSession {
    threadId: string;
    isMuted: boolean;
    peer: UserContactGhost;
    messages: PeerChatMessage[];
    status: StateStatusLoadedSeq;
}

export interface ChatSessionView extends PeerChatSession {
    loadNextPageMessageId: string;
}
