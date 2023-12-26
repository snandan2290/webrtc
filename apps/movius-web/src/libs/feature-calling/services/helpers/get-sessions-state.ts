import { UserAgentEvent } from '@scalio/sip';
import { assoc, omit, update } from 'lodash/fp';
import { merge, Observable } from 'rxjs';
import { scan } from 'rxjs/operators';
import { Invitation, Inviter, SessionState } from 'sip.js';

export interface IncomingCallSession {
    kind: 'IncomingCallSession';
    invitation: Invitation;
}

export interface OutgoingCallSession {
    kind: 'OutgoingCallSession';
    inviter: Inviter;
}

export type CallSession = IncomingCallSession | OutgoingCallSession;

export interface SessionsState {
    sessions: { [key: string]: CallSession };
}

const deleteSession = (state: SessionsState, id: string) => {
    return update('sessions', omit([id]), state) as SessionsState;
};

const addSession = (state: SessionsState, session: CallSession) => {
    const id =
        session.kind === 'IncomingCallSession'
            ? session.invitation.id
            : session.inviter.id;
    return update(['sessions'], assoc([id], session), state) as SessionsState;
};

export const sessionsStateHandler = (
    state: SessionsState,
    event: UserAgentEvent
) => {
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
            }
            break;
    }
    return state;
};

export const getSessionsState = (clearSession$: Observable<string>) => (
    event$: Observable<UserAgentEvent>
) =>
    merge(event$, clearSession$).pipe(
        scan(
            (acc, eventOrClear) => {
                if (typeof eventOrClear === 'string') {
                    const sessions = omit([eventOrClear], acc.sessions);
                    return assoc(['sessions'], sessions, acc);
                } else {
                    return sessionsStateHandler(acc, eventOrClear);
                }
            },
            { sessions: {} } as SessionsState
        )
    );
