import { Peer } from '../../shared';
import { Call } from './call';
import { HistorySession } from './history-session';

export interface PeerCallInactiveSession {
    kind: 'PeerCallInactiveSession';
    peer: Peer;
    history: HistorySession[];
}

export interface PeerCallActiveSession {
    kind: 'PeerCallActiveSession';
    peer: Peer;
    call: Call;
    startTime: string;
    history: HistorySession[];
}

export type PeerCallSession = PeerCallInactiveSession | PeerCallActiveSession;
