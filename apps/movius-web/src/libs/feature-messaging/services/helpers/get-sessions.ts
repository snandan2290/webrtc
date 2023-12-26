import { last, orderBy } from 'lodash/fp';
import { combineLatest, Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Peer } from '../../../shared';
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

export const getSessions = (peers$: Observable<Peer[]>) => (
    history$: Observable<{ [peerId: string]: PeerChatMessage[] }>
): Observable<PeerChatSession[]> =>
    combineLatest([peers$, history$]).pipe(
        map(([peers, history]) => {
            const sessions = peers.map(
                (peer) =>
                    ({
                        id: peer.id,
                        kind: 'PeerChatSession',
                        peer,
                        messages: history && history[peer.id] || [],
                    } as PeerChatSession)
            );
            const ordered = orderBy(sortSession, 'desc', sessions);
            return ordered;
        })
    );
