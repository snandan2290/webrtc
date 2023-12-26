import { Observable, of } from 'rxjs';
import { catchError, filter, map } from 'rxjs/operators';
import { Session, SessionState } from 'sip.js';
import { cleanupMedia, setupSessionRemoteMedia } from './media-helpers';
import { UserAgentEvent } from './sip-user';

/**
 * Based on user agent events will properly setup html media element streams when necessary
 * 1. Setup stream on media element when outgoing call accepted
 * 2. Setup stream on media when incoming call established
 * 3. Cleanup stream from media element when outgoing call bye
 * 4. Cleanup stream from media element when incoming terminated
 * @param events$ - event of user agent events
 * @param destroy$ - handle events till an event in this stream
 * @param mediaElement - media element to setup stream
 */
export const setupMediaElementStream = () => (
    events$: Observable<UserAgentEvent>
): Observable<'setup' | 'cleaned'> => {
    const mediaElementsHash: { [key: string]: HTMLAudioElement } = {};

    const createAudioElement = (session: Session) => {
        console.log('createAudioElement', session.id);
        const audioElement = mediaElementsHash[session.id];
        if (!audioElement) {
            const audioElement = document.createElement('audio');
            mediaElementsHash[session.id] = audioElement;
            setupSessionRemoteMedia(session, audioElement);
            return audioElement;
        } else {
            console.log('audio element already exists');
            return audioElement;
        }
    };

    const removeAudioElement = (sessionId: string) => {
        console.log('removeAudioElement', sessionId);
        const audioElement = mediaElementsHash[sessionId];
        if (!audioElement) {
            console.warn('Audio element for session is not found !', sessionId);
            return;
        }
        cleanupMedia(audioElement);
        audioElement.remove();
        delete mediaElementsHash[sessionId];
    };

    return events$.pipe(
        map((event) => {
            switch (event.kind) {
                // outgoing
                case 'UserAgentOutgoingActionEvent':
                    switch (event.action.kind) {
                        // Outgoing hangup by local user
                        case 'OutgoingHangUpAction':
                            console.log('***Outgoing hangup by local user');
                            removeAudioElement(event.action.session.id);
                            return 'cleaned' as 'cleaned';
                    }
                    break;
                case 'UserAgentInviterSessionEvent':
                    switch (event.event.kind) {
                        // outgoing call terminated
                        case 'ByeSessionEvent':
                            console.log('***Outgoing call bye from remote');
                            removeAudioElement(event.inviter.id);
                            return 'setup' as 'setup';
                    }
                    break;
                case 'UserAgentOutgoingInviteEvent':
                    switch (event.event.kind) {
                        case 'AcceptOutgoingRequestEvent':
                            switch (event.inviter.state) {
                                case SessionState.Established:
                                    // outgoing call accepted
                                    console.log('***Outgoing call accepted');
                                    createAudioElement(event.inviter);
                                    return 'setup';
                            }
                            break;
                        case 'ProgressOutgoingRequestEvent':
                            switch (event.event.response.message.statusCode) {
                                // case 180:
                                case 183:
                                    // outgoing call accepted
                                    console.log(
                                        `***ProgressOutgoingRequestEvent (${event.event.response.message.statusCode} )`
                                    );
                                    createAudioElement(event.inviter);
                                    return 'setup';
                            }
                            break;
                    }
                    break;
                // incoming
                case 'UserAgentCommonEvent':
                    switch (event.event.kind) {
                        case 'IncomingInviteSessionUserEvent':
                            if (
                                event.event.event.kind ===
                                'UserSessionStateEvent'
                            ) {
                                switch (event.event.event.state) {
                                    case SessionState.Established:
                                        // incoming call established
                                        console.log(
                                            '***Incoming call established'
                                        );
                                        createAudioElement(
                                            event.event.invitation
                                        );
                                        return 'setup';
                                    case SessionState.Terminated:
                                        // incoming call terminated
                                        console.log(
                                            '***Incoming call terminated'
                                        );
                                        removeAudioElement(
                                            event.event.invitation.id
                                        );
                                        return 'cleaned';
                                }
                            }
                            break;
                    }
            }
            return null;
        }),
        catchError((err) => {
            console.warn('Unexpected error in setupMediaElementStream !', err);
            return of(null);
        }),
        filter((f) => !!f)
    );
};
