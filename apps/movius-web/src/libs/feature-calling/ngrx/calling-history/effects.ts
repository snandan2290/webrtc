import { Injectable } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import { map, switchMap, tap, withLatestFrom } from 'rxjs/operators';
import { DbContext, getFeatureEnabled, loginSuccess, selectUserId } from '../../../shared';
import { HistorySession, HistorySessionCompleted } from '../../models';
import { CallingDataAccessService } from '../../services';
import {
    addCallingHistorySessions,
    clearCallingHistory,
    deleteHistoryItem,
    loadHistoryStartTS,
    loadHistoryStartTSSuccess,
    loadInitialHistory,
    loadInitialHistorySuccess,
    missedViewedShown,
    rehydrateHistorySuccess,
    rehydrateMissedViewedSuccess,
} from './actions';
import { selectCallingHistorySessions } from './selectors';

@Injectable()
export class CallingHistoryEffects {
    appEmbededStatus:string;
    constructor(
        private readonly actions$: Actions,
        private readonly dataAccess: CallingDataAccessService,
        private readonly dbContext: DbContext,
        private readonly store: Store
    ) {
        this.appEmbededStatus = getFeatureEnabled();
    }

    userId$ = this.store.select(selectUserId);

    private mergeSessions = async (
        incomingSessions: HistorySession[],
        existentSessions: { [key: string]: HistorySession[] },
        userId: string
    ) => {
        const completedSessions = incomingSessions.filter(
            (f) => f.kind === 'HistorySessionCompleted'
        ) as HistorySessionCompleted[];
        const newSessions = completedSessions.filter(
            (f) => !existentSessions[f.peerId]
        );
        const updatedSessions = completedSessions.filter(
            (f) => !!existentSessions[f.peerId]
        );
        await this.dbContext.call.addCallsRange(userId, newSessions);
        await this.dbContext.call.updateCallsRange(userId, updatedSessions);
    };

    addCallingHistorySessionsToRepository$ = createEffect(
        () =>
            this.actions$.pipe(
                ofType(addCallingHistorySessions),
                withLatestFrom(
                    this.store.select(selectCallingHistorySessions),
                    this.userId$
                ),
                tap(([{ sessions }, existentSessions, userId]) =>
                    this.mergeSessions(sessions, existentSessions, userId)
                )
            ),
        { dispatch: false }
    );

    loadInitialHistory$ = createEffect(() =>
        this.actions$.pipe(
            ofType(loginSuccess),
            map(() => loadInitialHistory())
        )
    );

    rehydrateHistory$ = createEffect(() =>
        this.actions$.pipe(
            ofType(loginSuccess),
            withLatestFrom(this.userId$),
            switchMap(([_, userId]) => this.dbContext.call.getCalls(userId)),
            map((sessions) => {
                return rehydrateHistorySuccess({
                    sessions,
                    dateTime: new Date().toISOString(),
                });
            })
        )
    );

    rehydrateViewedHistory$ = createEffect(() =>
        this.actions$.pipe(
            ofType(loginSuccess),
            withLatestFrom(this.userId$),
            switchMap(([_, userId]) =>
                this.dbContext.callViewed.getCallsViewed(userId)
            ),
            map((sessionIds) => {
                return rehydrateMissedViewedSuccess({
                    sessionIds,
                });
            })
        )
    );

    loadInitialHistorySuccess$ = createEffect(() =>
        this.actions$.pipe(
            ofType(loadInitialHistory),
            switchMap(() => {
                if(this.appEmbededStatus !== "messaging"){
                    return this.dataAccess.loadInitialHistory()
                }else{
                    return []
                }
            }),
            map((result) =>
                loadInitialHistorySuccess({
                    result,
                    dateTime: new Date().toISOString(),
                })
            )
        )
    );

    loadHistoryStartTSSuccess$ = createEffect(() =>
        this.actions$.pipe(
            ofType(loadHistoryStartTS),
            switchMap(() => {
                if(this.appEmbededStatus !== "messaging"){
                    return this.dataAccess.loadHistoryStartTS()
                }else{
                    return []
                }
            }),
            map((result) =>
                loadHistoryStartTSSuccess({
                    result,
                    dateTime: new Date().toISOString(),
                })
            )
        )
    );

    mergeLoadedHistoryIntoDbContext$ = createEffect(
        () =>
            this.actions$.pipe(
                ofType(loadInitialHistorySuccess),
                withLatestFrom(
                    this.store.select(selectCallingHistorySessions),
                    this.userId$
                ),
                tap(([{ result }, sessions, userId]) =>
                    this.mergeSessions(result, sessions, userId)
                )
            ),
        { dispatch: false }
    );

    mergeLoadedHistoryStartTSIntoDbContext$ = createEffect(
        () =>
            this.actions$.pipe(
                ofType(loadHistoryStartTSSuccess),
                withLatestFrom(
                    this.store.select(selectCallingHistorySessions),
                    this.userId$
                ),
                tap(([{ result }, sessions, userId]) =>
                    this.mergeSessions(result, sessions, userId)
                )
            ),
        { dispatch: false }
    );

    clearCallingHistory$ = createEffect(
        () =>
            this.actions$.pipe(
                ofType(clearCallingHistory),
                withLatestFrom(this.userId$),
                tap(async ([{ peerId }, userId]) => {
                    await this.dbContext.call.removePeerCalls(userId, peerId);
                })
            ),
        { dispatch: false }
    );

    deleteHistoryItem$ = createEffect(
        () =>
            this.actions$.pipe(
                ofType(deleteHistoryItem),
                withLatestFrom(this.userId$),
                tap(async ([{ itemId }, userId]) => {
                    await this.dbContext.call.removePeerCall(userId, itemId);
                })
            ),
        { dispatch: false }
    );

    missedViewedShown$ = createEffect(
        () =>
            this.actions$.pipe(
                ofType(missedViewedShown),
                withLatestFrom(this.userId$),
                tap(async ([{ sessionIds }, userId]) => {
                    await this.dbContext.callViewed.putAsViewed(
                        userId,
                        sessionIds
                    );
                })
            ),
        { dispatch: false }
    );
}
