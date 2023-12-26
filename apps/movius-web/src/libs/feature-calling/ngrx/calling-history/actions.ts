import { CallSession } from '@movius/domain';
import { createAction, props } from '@ngrx/store';
import { HistorySession } from '../../models';

export const rehydrateHistorySuccess = createAction(
    '[CallingHistory] Rehydrate History Success',
    props<{ sessions: CallSession[]; dateTime: string }>()
);

export const loadInitialHistory = createAction(
    '[CallingHistory] Load Initial History'
);

export const loadHistoryStartTS = createAction(
    '[CallingHistory] Load History',
    props<{ start_ts: number }>()
);

export const loadInitialHistorySuccess = createAction(
    '[CallingHistory] Load Initial History Success',
    props<{ result: HistorySession[]; dateTime: string }>()
);

export const loadHistoryStartTSSuccess = createAction(
    '[CallingHistory] Load History Success',
    props<{ result: HistorySession[]; dateTime: string }>()
);

export const clearCallingHistory = createAction(
    '[CallingHistory] Clear Calling History',
    props<{ peerId: string }>()
);

export const addCallingHistorySessions = createAction(
    '[CallingHistory] Add Calling History Sessions',
    props<{ sessions: HistorySession[] }>()
);

export const deleteHistoryItem = createAction(
    '[CallingHistory] Delete History Item',
    props<{ peerId: string; itemId: string }>()
);

export const rehydrateMissedViewedSuccess = createAction(
    '[CallingHistory] Rehydrate Missed Viewed Success',
    props<{ sessionIds: string[] }>()
);

export const missedViewedShown = createAction(
    '[CallingHistory] Missed Viewed Shown',
    props<{ sessionIds: string[] }>()
);
