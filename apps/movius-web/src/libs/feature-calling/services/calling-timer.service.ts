import { Injectable } from '@angular/core';
import { Actions, ofType } from '@ngrx/effects';
import { merge, Observable, Subscription, timer } from 'rxjs';
import {
    filter,
    map,
    scan,
    shareReplay,
    tap,
    withLatestFrom,
} from 'rxjs/operators';
import { callAccepted, callFails, callHangUp, callStarted } from '../ngrx';
import { update, omit, assoc, mapValues, isEmpty } from 'lodash/fp';

@Injectable({ providedIn: 'root' })
export class CallingTimerService {
    timers$: Observable<{ [key: string]: number }>;

    constructor(actions: Actions) {
        const callAccepted$ = actions.pipe(ofType(callAccepted));

        const callHangup$ = actions.pipe(ofType(callHangUp, callFails));

        const callStarts$ = callAccepted$.pipe(
            map((f) => ({ callId: f.callId, time: new Date().getTime() })),
            shareReplay(1)
        );
        const callsEnds$ = callHangup$.pipe(
            map((f) => ({ callId: f.callId, time: null }))
        );

        const calls$ = merge(callStarts$, callsEnds$).pipe(
            scan(
                (acc, v) =>
                    !!v.time
                        ? assoc(v.callId, v.time, acc)
                        : omit(v.callId, acc),
                {} as { [key: string]: number }
            )
        );

        const timer$ = timer(0, 1000);

        this.timers$ = timer$.pipe(
            withLatestFrom(calls$),
            map(([_, calls]) => calls),
            filter((calls) => !isEmpty(calls)),
            map((calls) => {
                const t = new Date().getTime();
                return mapValues((time) => (t - time) / 1000, calls);
            }),
            shareReplay(1)
        );
    }
}
