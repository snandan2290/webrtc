import { Observable } from 'rxjs';
import { filter, map, scan, tap } from 'rxjs/operators';
import { NameAddrHeader, URI } from 'sip.js';
import { UserAgentEvent } from './sip-user';

const getPeerUri = (userUri: string) => ({
    from,
    to,
}: {
    from: NameAddrHeader;
    to: NameAddrHeader;
}) => (from.uri.toString() === userUri ? to.uri : from.uri);

const filterPeerActivity = (userUri: string) => (
    event: UserAgentEvent
): URI | null => {
    const _getPeerUri = getPeerUri(userUri);
    switch (event.kind) {
        case 'UserAgentOutgoingInviteEvent':
            switch (event.event.kind) {
                case 'AcceptOutgoingRequestEvent':
                case 'ProgressOutgoingRequestEvent':
                    return _getPeerUri(event.event.response.message);
            }
            break;
        case 'UserAgentCommonEvent':
            switch (event.event.kind) {
                case 'MessageUserEvent':
                    return _getPeerUri(event.event.message.request);
                case 'IncomingInviteSessionUserEvent':
                    return _getPeerUri(event.event.invitation.request);
            }
            break;
        case 'UserAgentSendMessageEvent': {
            switch (event.event.kind) {
                case 'AcceptOutgoingRequestEvent':
                    return _getPeerUri(event.event.response.message);
            }
        }
    }
};

export const peerActivitiesFilter = (userUri: string) => (
    events$: Observable<UserAgentEvent>
) =>
    events$.pipe(
        tap((x) => console.log('peerActivitiesFilter:event', x)),
        map(filterPeerActivity(userUri)),
        map((uri) => uri && uri.toString()),
        tap((x) => console.log('peerActivitiesFilter:filtered', x)),
        filter((f) => !!f)
    );

/**
 * Get latest peer activities time for which was received some ACK response
 */
export const getPeerActivities = (userUri: string) => (
    events$: Observable<UserAgentEvent>
) =>
    events$.pipe(
        peerActivitiesFilter(userUri),
        scan(
            (acc, uri) => ({ ...acc, [uri]: new Date().toISOString() }),
            {} as { [key: string]: string }
        )
    );
