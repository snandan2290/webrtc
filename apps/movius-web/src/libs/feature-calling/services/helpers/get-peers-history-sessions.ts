import { groupBy } from 'lodash/fp';
import { Observable } from 'rxjs';
import { map, scan } from 'rxjs/operators';
import { SessionState } from '../../../shared';
import {
    HistorySession,
    PeerCallActiveSession,
    PeerCallSession,
} from '../../models';

const mapHistorySession = (
    session: HistorySession | null,
    peerSession: PeerCallActiveSession
): HistorySession => {
    if (!session) {
        return {
            id: peerSession.call.id,
            direction:
                peerSession.call.kind === 'IncomingCallSession'
                    ? 'incoming'
                    : 'outgoing',
            peerId: peerSession.peer.id,
            kind: 'HistorySessionCalling',
            startTime: new Date().toISOString(),
        };
    } else {
        switch (peerSession.call.state) {
            case SessionState.Established:
                return {
                    id: session.id,
                    direction: session.direction,
                    peerId: peerSession.peer.id,
                    kind: 'HistorySessionOngoing',
                    startTime: session.startTime,
                    acceptTime: new Date().toISOString(),
                };
            default:
                return session;
        }
    }
};

const mapHistorySessions = (
    sessions: HistorySession[],
    peerSessions: PeerCallSession[]
): HistorySession[] => {
    const newOrUpdatedSessions = peerSessions
        .filter((f) => f.kind === 'PeerCallActiveSession')
        .map((peerSession: PeerCallActiveSession) => {
            const session = sessions.find((s) => s.id === peerSession.call.id);
            return mapHistorySession(session, peerSession);
        });

    const finishedSessions = sessions
        .filter((f) => !newOrUpdatedSessions.some((n) => f.id === n.id))
        .map((session: HistorySession) => {
            if (session.kind !== 'HistorySessionCompleted') {
                return {
                    id: session.id,
                    direction: session.direction,
                    peerId: session.peerId,
                    kind: 'HistorySessionCompleted',
                    startTime: session.startTime,
                    endTime: new Date().toISOString(),
                    type:
                        session.kind === 'HistorySessionOngoing'
                            ? 'accepted'
                            : 'rejected',
                } as HistorySession;
            } else {
                return session;
            }
        });

    const resultSessions = [...newOrUpdatedSessions, ...finishedSessions];

    return resultSessions;
};

// Given peer call sessions convert them to the sessions history
export const getHistorySessions = (
    sessions$: Observable<PeerCallSession[]>
): Observable<HistorySession[]> => sessions$.pipe(scan(mapHistorySessions, []));

const splitHistorySessionsByPeers = (
    historySessions$: Observable<HistorySession[]>
): Observable<{ [peerId: string]: HistorySession[] }> =>
    historySessions$.pipe(map((history) => groupBy('peerId', history)));

export const getPeersHistorySessions = (
    sessions$: Observable<PeerCallSession[]>
): Observable<{ [peerId: string]: HistorySession[] }> =>
    sessions$.pipe(getHistorySessions, splitHistorySessionsByPeers);
