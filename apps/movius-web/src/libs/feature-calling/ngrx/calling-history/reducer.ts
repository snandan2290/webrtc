import { createReducer, on } from '@ngrx/store';
import { mapValues } from 'lodash';
import { assoc, fromPairs, groupBy } from 'lodash/fp';
import { omitDeep, StateStatus } from '../../../shared';
import { HistorySession } from '../../models';
import {
    addCallingHistorySessions,
    clearCallingHistory,
    deleteHistoryItem,
    loadHistoryStartTSSuccess,
    loadInitialHistorySuccess,

    missedViewedShown,
    rehydrateHistorySuccess,
    rehydrateMissedViewedSuccess,
} from './actions';

export interface PeerCalls {
    peerId: string;
    status: StateStatus;
    sessions: HistorySession[];
    isAnonymous: boolean;
}

export interface CallingHistoryState {
    status: StateStatus;
    hash: {
        [peerId: string]: PeerCalls;
    };
    missedViewed: {
        [sessionId: string]: boolean;
    };
}

//addCallingHistorySessionsHandler

const mapSession = (peerCalls: PeerCalls, session: HistorySession) => {
    if (peerCalls) {
        return {
            ...peerCalls,
            sessions: [session, ...peerCalls.sessions],
        };
    } else {
        return {
            peerId: session.peerId,
            status: {},
            sessions: [session],
        } as PeerCalls;
    }
};

const reduceSession = (
    state: {
        [key: string]: PeerCalls;
    },
    session: HistorySession
) => ({
    ...state,
    [session.peerId]: mapSession(state[session.peerId], session),
});

const addCallingHistorySessionsHandler = (
    state: CallingHistoryState,
    { sessions }: ReturnType<typeof addCallingHistorySessions>
) => {
    const hash = sessions.reduce(reduceSession, state.hash);
    return assoc('hash', hash, state);
};

// loadInitialHistorySuccess
const loadInitialHistorySuccessHandler = (
    state: CallingHistoryState,
    { result, dateTime }: ReturnType<typeof loadInitialHistorySuccess | typeof loadHistoryStartTSSuccess>
) => {
    const groupedHistory = groupBy('peerId', result);
    const calls = mapValues(
        groupedHistory,
        (sessions, peerId) =>
        ({
            peerId: peerId,
            status: {
                kind: 'StateStatusLoaded' as 'StateStatusLoaded',
                dateTime,
            },
            sessions,
        } as PeerCalls)
    );
    // loaded wins
    const hash = { ...state.hash, ...calls };

    return {
        ...state,
        status: {
            kind: 'StateStatusLoaded' as 'StateStatusLoaded',
            dateTime: dateTime,
        },
        hash,
    };
};

const rehydrateSuccessHandler = (
    state: CallingHistoryState,
    { sessions, dateTime }: ReturnType<typeof rehydrateHistorySuccess>
) => {
    const groupedSessions = groupBy('peerId', sessions);
    const calls = mapValues(
        groupedSessions,
        (sess, peerId) =>
        ({
            peerId: peerId,
            status: {
                kind: 'StateStatusLoaded',
                dateTime,
            },
            sessions: sess,
        } as PeerCalls)
    );
    const hash = { ...state.hash, ...calls };

    return assoc('hash', hash, state);
};

const missedViewedShownHandler = (
    state: CallingHistoryState,
    { sessionIds }: ReturnType<typeof missedViewedShown>
) => {
    const newViewed = fromPairs(sessionIds.map((f) => [f, true]));
    return {
        ...state,
        missedViewed: {
            ...state.missedViewed,
            ...newViewed,
        },
    };
};

const rehydrateMissedViewedSuccessHandler = (
    state: CallingHistoryState,
    { sessionIds }: ReturnType<typeof rehydrateMissedViewedSuccess>
) => {
    const newViewed = fromPairs(sessionIds.map((f) => [f, true]));
    return {
        ...state,
        missedViewed: {
            ...state.missedViewed,
            ...newViewed,
        },
    };
};

//
const initialState: CallingHistoryState = {
    status: {
        kind: 'StateStatusInitial',
    },
    hash: {},
    missedViewed: {},
};

const _callingHistoryReducer = createReducer(
    initialState,
    on(rehydrateHistorySuccess, rehydrateSuccessHandler),
    on(loadInitialHistorySuccess, loadInitialHistorySuccessHandler),
    on(loadHistoryStartTSSuccess, loadInitialHistorySuccessHandler),
    on(clearCallingHistory, (state, { peerId }) =>
        omitDeep(['hash', peerId], state)
    ),
    on(addCallingHistorySessions, addCallingHistorySessionsHandler),
    on(deleteHistoryItem, (state, { peerId, itemId }) =>
        omitDeep(
            [
                'hash',
                peerId,
                'sessions',
                state.hash[peerId].sessions.findIndex((f) => f.id === itemId),
            ],
            state
        )
    ),
    on(rehydrateMissedViewedSuccess, rehydrateMissedViewedSuccessHandler),
    on(missedViewedShown, missedViewedShownHandler)
);

export const callingHistoryReducer = (state, action) => {
    return _callingHistoryReducer(state, action);
};
