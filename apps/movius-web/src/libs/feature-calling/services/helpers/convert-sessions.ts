import { equals } from 'lodash/fp';
import { combineLatest, Observable } from 'rxjs';
import { distinctUntilChanged, map, scan } from 'rxjs/operators';
import { Peer } from '../../../shared';
import { PeerCallSession } from '../../models';
import { CallSession, SessionsState } from './get-sessions-state';

export const convertUser = (
    user: Peer,
    session: CallSession | null
): PeerCallSession => {
    if (!session) {
        return {
            kind: 'PeerCallInactiveSession',
            peer: user,
            history: [],
        };
    } else {
        switch (session.kind) {
            case 'OutgoingCallSession':
                return {
                    kind: 'PeerCallActiveSession',
                    peer: user,
                    startTime: new Date().toISOString(),
                    call: {
                        id: session.inviter.id,
                        peer: user,
                        kind: 'OutgoingCallSession',
                        state: session.inviter.state,
                    },
                    history: [],
                };
            case 'IncomingCallSession':
                return {
                    kind: 'PeerCallActiveSession',
                    peer: user,
                    startTime: new Date().toISOString(),
                    call: {
                        id: session.invitation.id,
                        peer: user,
                        kind: 'IncomingCallSession',
                        state: session.invitation.state,
                    },
                    history: [],
                };
            default:
                throw new Error('Unknown session kind');
        }
    }
};

const getPeerId = (peers: Peer[], idOrMultiLine: string) => {
    const peerFromMultiline = peers.find((f) => f.multiLine === idOrMultiLine);
    return peerFromMultiline ? peerFromMultiline.id : idOrMultiLine;
};

const getSessionPeerId = (peers: Peer[], callSession: CallSession) =>
    callSession.kind === 'IncomingCallSession'
        ? getPeerId(
              peers,
              callSession.invitation.request.getHeader('X-CAFE-DN') ||
                  callSession.invitation.request.from.uri.user
          )
        : getPeerId(peers, callSession.inviter.request.to.uri.user);

const getSessionByPeerId = (
    peers: Peer[],
    state: SessionsState,
    userId: string
): CallSession =>
    Object.values(state.sessions).find(
        (s) => getSessionPeerId(peers, s) === userId
    );

export const convertSessions = (
    peerCallSessions: PeerCallSession[],
    peers: Peer[],
    state: SessionsState
) => {
    const sessionsList = Object.values(state.sessions);
    const activeSessions = sessionsList.map((session) => {
        const sessionPeerId = getSessionPeerId(peers, session);

        // Update session only if it changes it status
        const existentSession = peerCallSessions.find(
            (f) => f.peer.id === sessionPeerId
        );
        if (existentSession) {
            const sessionState =
                session.kind === 'IncomingCallSession'
                    ? session.invitation.state
                    : session.inviter.state;
            const existentSessionState =
                existentSession.kind === 'PeerCallActiveSession'
                    ? existentSession.call.state
                    : null;
            if (sessionState === existentSessionState) {
                return existentSession;
            }
        }

        let user = peers.find((p) => p.id === sessionPeerId);

        if (!user) {
            const sipSession =
                session.kind === 'IncomingCallSession'
                    ? session.invitation
                    : session.inviter;
            const request = sipSession.request;
            const nameAddr =
                session.kind === 'IncomingCallSession'
                    ? request.from
                    : request.to;
            const uri = nameAddr.uri.toString();
            const multiline = request.ruri.user || request.headers['X-Cafe-Dn'][0]['raw'];
            user = {
                id: multiline,
                uri: uri,
                multiLineUri: uri,
                name: multiline,
                img: null,
                multiLine: multiline,
                lastTimeOnline: null
            };
        }

        return convertUser(user, session);
    });

    const inactivePeers = peers.filter(
        (peer) => !activeSessions.find((f) => f.peer.id === peer.id)
    );

    const inactiveSessions = inactivePeers.map((user) =>
        convertUser(user, getSessionByPeerId(peers, state, user.id))
    );

    return [...activeSessions, ...inactiveSessions];
};

export const convertSessions$ = (peers$: Observable<Peer[]>) => (
    state$: Observable<SessionsState>
): Observable<PeerCallSession[]> =>
    combineLatest([peers$, state$]).pipe(
        scan(
            (sessions, [peers, sessionState]) =>
                convertSessions(sessions, peers, sessionState),
            [] as PeerCallSession[]
        ),
        distinctUntilChanged(equals)
    );
