import { UserContact } from '../../feature-contacts/models';
import { PeerChatMessage } from './peer-chat-session';

export interface PeerMessagingState {
    peer: UserContact;
    isMuted: boolean;
    newCount: number;
    messages: PeerChatMessage[];
    threadId: string;
    peerId: string;
    participants: any;
    isGroup:boolean;
    isWhatsAppThread:boolean;
    whatsOptInReqStatus: string;
    messageChannelType: string;
}
