export interface CallSessionBase<T = string | ArrayBuffer> {
    id: string;
    peerId: T;
    startTime: string;
    endTime: string;
    type: 'accepted' | 'rejected';
    direction: 'incoming' | 'outgoing';
    isAnonymous?: boolean;
}

export type CallSessionEncrypted = CallSessionBase<ArrayBuffer>;

export type CallSession = CallSessionBase<string>;
