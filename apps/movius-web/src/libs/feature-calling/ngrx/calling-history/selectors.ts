import { createFeatureSelector, createSelector } from '@ngrx/store';
import { fromPairs, map, orderBy, pipe, toPairs } from 'lodash/fp';
import { HistorySession } from '../../models';
import { CallingHistoryState, PeerCalls } from './reducer';

export const selectCallingHistory = createFeatureSelector<CallingHistoryState>(
    'callingHistory'
);

export const selectCallingHistoryHash = createSelector(
    selectCallingHistory,
    (state) => state.hash
);

export const selectMissedViewed = createSelector(
    selectCallingHistory,
    (state) => state.missedViewed
);

const sortSession = (session: HistorySession) => new Date(session.startTime);

export const selectCallingHistorySessions = createSelector<
    any,
    { [key: string]: PeerCalls },
    { [key: string]: HistorySession[] }
>(
    selectCallingHistoryHash,
    pipe(
        toPairs,
        map(([k, v]: [string, PeerCalls]) => [
            k,
            orderBy(sortSession, 'desc', v.sessions || []),
        ]),
        fromPairs
    )
);

export const selectIsHistoryLoaded = createSelector<
    any,
    CallingHistoryState,
    boolean
>(selectCallingHistory, (state) => state.status.kind === 'StateStatusLoaded');

export const selectPeersCallsIsLoaded = createSelector(
    selectIsHistoryLoaded,
    (isLoaded) => isLoaded
);
