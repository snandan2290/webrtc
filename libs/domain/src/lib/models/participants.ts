export interface ParticipantThread {
    id: string;
    threadId: string;
    participants: any;
    isServer: boolean;
    isLocal: boolean;
    isGroup: boolean;
}