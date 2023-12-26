import { SessionState, User } from '../../shared';

export interface IncomingCall {
    id: string;
    kind: 'IncomingCallSession';
    peer: User;
    state: SessionState;
}

export interface OutgoingCall {
    id: string;
    kind: 'OutgoingCallSession';
    peer: User;
    state: SessionState;
}

export type Call = IncomingCall | OutgoingCall;
