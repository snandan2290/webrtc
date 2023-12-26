import { PeerChatMessage } from './peer-chat-session';

export interface ChatItemMessage extends PeerChatMessage {
    notifyWhenVisible: boolean;
}
