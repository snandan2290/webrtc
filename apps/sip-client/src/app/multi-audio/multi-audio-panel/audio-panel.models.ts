import { SipUser } from '@scalio/sip';
import { Invitation, Inviter } from 'sip.js';

export interface IncomingCallSession {
    kind: 'IncomingCallSession';
    invitation: Invitation;
}

export interface OutgoingCallSession {
    kind: 'OutgoingCallSession';
    inviter: Inviter;
}

export type CallSession = IncomingCallSession | OutgoingCallSession;

//

export interface AudioPanelUnConnectedState {
    kind: 'AudioPanelUnConnectedState';
    userName: string;
}

export interface AudioPanelConnectedState {
    kind: 'AudioPanelConnectedState';
    user: SipUser;
}

export interface AudioPanelRegisteredState {
    kind: 'AudioPanelRegisteredState';
    user: SipUser;
    sessions: { [key: string]: CallSession };
}

export type AudioPanelState =
    | AudioPanelUnConnectedState
    | AudioPanelRegisteredState
    | AudioPanelConnectedState;

//

export interface Peer {
    uri: string;
    name: string;
}
