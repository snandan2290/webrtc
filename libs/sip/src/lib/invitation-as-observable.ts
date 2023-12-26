import { merge, Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Invitation, InvitationAcceptOptions, SessionState } from 'sip.js';
import {
    createSessionObservableDelegate,
    SessionEvent,
} from './create-session-observable-delegate';
import { sessionStateAsObservable } from './session-state-as-observable';

export interface UserSessionDelegateEvent {
    kind: 'UserSessionDelegateEvent';
    event: SessionEvent;
}

export interface UserSessionStateEvent {
    kind: 'UserSessionStateEvent';
    state: SessionState;
}

export type UserSessionEvent = UserSessionDelegateEvent | UserSessionStateEvent;

export const invitationAsObservable = (
    invitation: Invitation
): Observable<UserSessionEvent> => {
    const { delegate, stream } = createSessionObservableDelegate();
    invitation.delegate = delegate;

    const stateStream = sessionStateAsObservable(invitation);

    return merge(
        stream.pipe(
            map((event) => ({
                kind: 'UserSessionDelegateEvent' as 'UserSessionDelegateEvent',
                event,
            }))
        ),
        stateStream.pipe(
            map((state) => ({
                kind: 'UserSessionStateEvent' as 'UserSessionStateEvent',
                state,
            }))
        )
    );
};

export const acceptInvitationAsObservable = (
    invitation: Invitation
): Observable<UserSessionEvent> => {
    const result = invitationAsObservable(invitation);

    const constrainsDefault: MediaStreamConstraints = {
        audio: false,
        video: false,
    };

    const options: InvitationAcceptOptions = {
        sessionDescriptionHandlerOptions: {
            constraints: constrainsDefault,
        },
    };

    invitation.accept(options);

    return result;
};
