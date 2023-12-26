import { SipUser, UserAgentEvent } from '@scalio/sip';
import { assoc, omit, update } from 'lodash/fp';
import { SessionState } from 'sip.js';
import {
    AudioPanelConnectedState,
    AudioPanelRegisteredState,
    AudioPanelState,
    AudioPanelUnConnectedState,
    CallSession,
} from './audio-panel.models';

const isRegisteredState = (
    state: AudioPanelState
): state is AudioPanelRegisteredState =>
    state.kind === 'AudioPanelRegisteredState';
const handleNotRegisteredState = (state: AudioPanelState) => {
    console.warn('Not registered state', state);
    return state;
};

const deleteSession = (state: AudioPanelState, id: string) => {
    if (isRegisteredState(state)) {
        return update('sessions', omit([id]), state) as AudioPanelState;
    } else {
        return handleNotRegisteredState(state);
    }
};

const addSession = (state: AudioPanelState, session: CallSession) => {
    if (isRegisteredState(state)) {
        const id =
            session.kind === 'IncomingCallSession'
                ? session.invitation.id
                : session.inviter.id;
        return update(
            ['sessions'],
            assoc([id], session),
            state
        ) as AudioPanelState;
    } else {
        return handleNotRegisteredState(state);
    }
};

export const stateHandler = (
    state: AudioPanelState,
    { user, event }: { user: SipUser; event: UserAgentEvent }
) => {
    if (!user) {
        return {
            kind: 'AudioPanelUnConnectedState',
        } as AudioPanelUnConnectedState;
    } else {
        switch (event.kind) {
            case 'UserAgentOutgoingInviteEvent':
                {
                    switch (event.event.kind) {
                        // outgoing rejected (not established) by remote
                        case 'RejectOutgoingRequestEvent':
                            return deleteSession(state, event.inviter.id);
                    }
                }
                break;

            case 'UserAgentOutgoingActionEvent':
                switch (event.action.kind) {
                    // outgoing call hangup
                    case 'OutgoingHangUpAction':
                        return deleteSession(state, event.action.session.id);
                }
                break;
            case 'UserAgentInviterSessionEvent':
                switch (event.event.kind) {
                    case 'SessionDescriptionHandlerEvent':
                        // outgoing call started
                        return addSession(state, {
                            kind: 'OutgoingCallSession',
                            inviter: event.inviter,
                        });
                    case 'ByeSessionEvent':
                        // outgoing received bye from (established) remote
                        return deleteSession(state, event.inviter.id);
                }
                break;
            case 'UserAgentCommonEvent':
                switch (event.event.kind) {
                    case 'IncomingInviteSessionUserEvent':
                        // incoming reject
                        switch (event.event.invitation.state) {
                            case SessionState.Terminated:
                                return deleteSession(
                                    state,
                                    event.event.invitation.id
                                );
                        }
                        break;
                    case 'InviteUserEvent':
                        switch (event.event.invitation.state) {
                            case SessionState.Initial:
                                // incoming received
                                return addSession(state, {
                                    kind: 'IncomingCallSession',
                                    invitation: event.event.invitation,
                                });
                        }
                        return state;
                    case 'ConnectUserEvent':
                        return {
                            kind: 'AudioPanelConnectedState',
                            user: user,
                        } as AudioPanelConnectedState;
                    case 'DisconnectUserEvent':
                        return {
                            kind: 'AudioPanelUnConnectedState',
                        } as AudioPanelUnConnectedState;
                }
                break;
            case 'UserAgentRegisterEvent':
                switch (event.event.kind) {
                    case 'RejectOutgoingRequestEvent':
                    case 'AcceptOutgoingRequestEvent':
                        return {
                            kind: 'AudioPanelRegisteredState',
                            user: user,
                            sessions: {},
                        } as AudioPanelRegisteredState;
                }
                break;
            case 'UserAgentUnregisterEvent':
                switch (event.event.kind) {
                    case 'RejectOutgoingRequestEvent':
                    case 'AcceptOutgoingRequestEvent':
                        return {
                            kind: 'AudioPanelConnectedState',
                            user: user,
                        } as AudioPanelConnectedState;
                }
        }
    }
    return state;
};
