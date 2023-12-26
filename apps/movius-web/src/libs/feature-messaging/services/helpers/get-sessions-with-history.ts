import { last, orderBy } from 'lodash/fp';
import { combineLatest, Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { PeerChatMessage, PeerChatSession } from '../../models';

const sortSession = (session: PeerChatSession) => {
    const latestMessage = last(session.messages);
    if (latestMessage) {
        return new Date(latestMessage.sentTime);
    } else {
        // return min date
        return new Date(-8640000000000000);
    }
};

export const getSessionsWithHistory = (
    sessions$: Observable<PeerChatSession[]>,
    history$: Observable<{ [peerId: string]: PeerChatMessage[] }>
): Observable<PeerChatSession[]> =>
    combineLatest([sessions$, history$]).pipe(
        map(([sessions, history]) => {
            const notOrdered = sessions.map((session) => ({
                ...session,
                messages: [
                    ...(history[session.peer.id] || []),
                    ...session.messages,
                ],
            }));
            const ordered = orderBy(sortSession, 'desc', notOrdered);
            return ordered;
        })
    );
