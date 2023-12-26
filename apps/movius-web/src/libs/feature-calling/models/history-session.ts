export interface HistorySessionCalling {
    id: string;
    peerId: string;
    kind: 'HistorySessionCalling';
    startTime: string;
    direction: 'incoming' | 'outgoing';
    isAnonymous?: boolean;
}

export interface HistorySessionOngoing {
    id: string;
    peerId: string;
    kind: 'HistorySessionOngoing';
    startTime: string;
    acceptTime: string;
    direction: 'incoming' | 'outgoing';
    isAnonymous?: boolean;
}

export interface HistorySessionCompleted {
    id: string;
    kind: 'HistorySessionCompleted';
    peerId: string;
    startTime: string;
    endTime: string;
    type: 'accepted' | 'rejected';
    direction: 'incoming' | 'outgoing';
    isAnonymous?: boolean;
}

export type HistorySession =
    | HistorySessionCalling
    | HistorySessionOngoing
    | HistorySessionCompleted;
