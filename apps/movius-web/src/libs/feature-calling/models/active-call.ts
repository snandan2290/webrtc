export type ActiveCallDirection = 'incoming' | 'outgoing';

export interface SuspendedActiveCall {
    kind: 'SuspendedActiveCall';
    startedDateTime: string;
    callId: string;
    peerId: string;
    direction: ActiveCallDirection;
    isAccepted?: boolean;
    isEstablishing?: boolean;
    isAnonymous?: boolean;
}

export type OngoingCallStatus = 'active' | 'on-hold';

export interface OngoingActiveCall {
    kind: 'OngoingActiveCall';
    startedDateTime: string;
    callId: string;
    peerId: string;
    direction: ActiveCallDirection;
    acceptedDatTime: string;
    isMuted: boolean;
    isHold: boolean;
    status: OngoingCallStatus;
    isAnonymous?: boolean;
}

export type ActiveCall = SuspendedActiveCall | OngoingActiveCall;
