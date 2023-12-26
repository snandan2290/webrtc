import { Injectable } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import { filter, map, mergeMap, tap, withLatestFrom } from 'rxjs/operators';
import { selectUser } from '../../../shared';
import { CallingService } from '../../services';
import {
    callHangUp,
    callHangUpComplete,
    selectActiveCalls,
} from '../active-calls';
import { addCallingHistorySessions } from '../calling-history/actions';
import { callStarted } from './actions';

@Injectable()
export class ActiveCallsEffects {
    constructor(
        private readonly actions$: Actions,
        private readonly store: Store,
        private readonly callingService: CallingService
    ) {}

    callStartedNotification$ = createEffect(
        () =>
            this.actions$.pipe(
                ofType(callStarted),
                filter((f) => f.direction === 'incoming'),
                tap(async (action) => {
                    const notification = new Notification('Incoming call', {
                        body: `Incoming Call From ${
                            action.isAnonymous
                                ? 'Anonymous'
                                : '+' + action.peerId
                        }`,
                    });
                    notification.onclick = function openSite(event){
                        window.focus()
                    }
                })
            ),
        { dispatch: false }
    );

    // after call hangup ad it to history
    callHangUpAddToHistory$ = createEffect(() =>
        this.actions$.pipe(
            ofType(callHangUp),
            withLatestFrom(
                this.store.select(selectActiveCalls),
                this.store.select(selectUser)
            ),
            map(([{ callId }, calls, user]) => ({ call: calls[callId], user })),
            // TODO : Hangup emitted 2 times for unknown reason
            filter(({ call }) => !!call),
            mergeMap(({ call, user }) => {
                // Don't add user's number to call history since this is voice mail call
                if (user.multiLine !== call.peerId) {
                    return [
                        callHangUpComplete({ callId: call.callId }),
                        addCallingHistorySessions({
                            sessions: [
                                {
                                    id: call.callId,
                                    kind: 'HistorySessionCompleted',
                                    peerId: call.peerId,
                                    startTime: call.startedDateTime,
                                    endTime: new Date().toISOString(),
                                    type:
                                        call.direction === 'outgoing'
                                            ? 'accepted'
                                            : call.kind ===
                                              'SuspendedActiveCall'
                                            ? 'rejected'
                                            : 'accepted',
                                    direction: call.direction,
                                    isAnonymous: call.isAnonymous,
                                },
                            ],
                        }),
                    ];
                } else {
                    return [callHangUpComplete({ callId: call.callId })];
                }
            })
        )
    );

    // after call hangup unhold another if exists
    callHangUpActivateAnother$ = createEffect(
        () =>
            this.actions$.pipe(
                ofType(callHangUpComplete),
                withLatestFrom(this.store.select(selectActiveCalls)),
                map(([_, calls]) => Object.values(calls)[0]),
                filter((call) => !!call),
                tap((call) => {
                    this.callingService.setHold(call.callId, false);
                })
            ),
        { dispatch: false }
    );
}
