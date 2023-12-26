export interface ParticipantThread {
    id: string;
    threadId: string;
    participants: string;
    isServer: boolean;
    isLocal: boolean;
    isGroup:boolean;
}