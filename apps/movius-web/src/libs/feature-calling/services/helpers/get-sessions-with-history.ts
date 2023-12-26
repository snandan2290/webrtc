import { combineLatest, Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { HistorySession, PeerCallSession } from '../../models';

export const getSessionsWithHistory = (
    sessions$: Observable<PeerCallSession[]>,
    history$: Observable<{ [peerId: string]: HistorySession[] }>
): Observable<any[]> =>
    combineLatest([sessions$, history$]).pipe(
        map(([sessions, history]) =>
            sessions.map(
                (session) =>
                    ({
                        ...session,
                        history: history[session.peer.id] || [],
                    } as PeerCallSession)
            )
        )
    );
