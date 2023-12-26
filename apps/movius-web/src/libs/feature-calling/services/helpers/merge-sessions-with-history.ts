import { orderBy } from 'lodash/fp';
import { combineLatest, Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { HistorySession, PeerCallSession } from '../../models';

const sortSession = (session: PeerCallSession) => {
    switch (session.kind) {
        case 'PeerCallActiveSession':
            const date = new Date(session.startTime);
            return date;
        case 'PeerCallInactiveSession':
            const latest = session.history[0];
            if (latest) {
                return new Date(latest.startTime);
            } else {
                // return min date
                return new Date(-8640000000000000);
            }
    }
};

export const mergeSessionsWithHistory = (
    history$: Observable<{ [key: string]: HistorySession[] }>
) => (sessions$: Observable<PeerCallSession[]>) => {
    const sessionsWithHistory$ = combineLatest([sessions$, history$]).pipe(
        map(([sessions, history]) => {
            return sessions.map(
                (session) =>
                    ({
                        ...session,
                        history: history[session.peer.id] || [],
                    } as PeerCallSession)
            );
        })
    );

    const ordered$ = sessionsWithHistory$.pipe(
        map<PeerCallSession[], PeerCallSession[]>(orderBy(sortSession, 'desc'))
    );

    return ordered$;
};
