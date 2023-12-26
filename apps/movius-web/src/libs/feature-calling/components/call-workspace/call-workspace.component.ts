import { ChangeDetectionStrategy, Component, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { SipService } from '@scalio/sip';
import { equals } from 'lodash/fp';
import { combineLatest, Observable, Subject } from 'rxjs';
import {
    distinctUntilChanged,
    filter,
    map,
    shareReplay,
    switchMap,
    takeUntil,
    tap,
} from 'rxjs/operators';
import {
    startAddToExistentContact,
    UserContactGhost,
} from '../../../feature-contacts';
import {
    CallingStatus,
    CustomNzModalService,
    MessagingStatus,
    selectCallingStatus,
    selectMessagingStatus,
    SipUserService,
} from '../../../shared';
import { ActiveCall, OngoingActiveCall, PeerCallingState } from '../../models';
import {
    HistorySessionView,
    missedViewedShown,
    PeerCallingStateView,
    selectPeersCallingStates,
} from '../../ngrx';
import { CallingService } from '../../services/calling.service';

export interface CallWorkspaceView
    extends PeerCallingState<HistorySessionView, UserContactGhost> {
    callingStatus: CallingStatus;
    messagingStatus: MessagingStatus;
    isAnonymous: boolean;
    ongoingSessionsCount: number;
}

@Component({
    selector: 'movius-web-call-workspace',
    templateUrl: './call-workspace.component.html',
    styleUrls: ['./call-workspace.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CallWorkspaceComponent implements OnDestroy {
    destroy$ = new Subject();
    session$: Observable<CallWorkspaceView>;

    constructor(
        private readonly callingService: CallingService,
        private customModalService:CustomNzModalService,
        activatedRoute: ActivatedRoute,
        private readonly store: Store,
        sipService: SipService,
        private readonly router: Router,
        private readonly userService: SipUserService
    ) {
        const id$ = activatedRoute.params.pipe(map(({ id }) => id));
        const session$ = combineLatest([
            id$.pipe(
                switchMap((id) =>
                    store.select(
                        selectPeersCallingStates(sipService.getUserUri, id)
                    )
                )
            ),
            id$,
        ]).pipe(
            map(([state, id]) => {
                return state.find((f) => f.peer?.multiLine === id);
            }),
            distinctUntilChanged(),
            shareReplay()
        );

        //

        const ongoingSessions$ = store
            .select(selectPeersCallingStates(sipService.getUserUri))
            .pipe(
                map((sessions) =>
                    sessions.filter(
                        (f) =>
                            (f.active || []).length > 0 &&
                            (f.active[0].kind === 'OngoingActiveCall' ||
                                f.active[0].kind === 'SuspendedActiveCall')
                    )
                ),
                tap(console.log)
            ) as Observable<PeerCallingState[]>;

        //

        const callingStatus$ = store.select(selectCallingStatus);
        const messagingStatus$ = store.select(selectMessagingStatus);

        this.session$ = combineLatest([
            session$,
            callingStatus$,
            messagingStatus$,
            ongoingSessions$,
        ]).pipe(
            map(
                ([
                    session,
                    callingStatus,
                    messagingStatus,
                    ongoingSessions,
                ]) => ({
                    ...session,
                    callingStatus,
                    messagingStatus:
                        session.peer?.multiLine === '911'
                            ? 'messages-not-allowed'
                            : messagingStatus,
                    isAnonymous: session.isAnonymous,
                    ongoingSessionsCount: ongoingSessions.length,
                })
            )
        );

        session$
            .pipe(
                filter((f) => !!f),
                takeUntil(this.destroy$),
                map((m) =>
                    m.history.map((x) => ({
                        id: x.id,
                        isMissed:
                            x.kind === 'HistorySessionCompleted' &&
                            !x.viewed &&
                            x.type === 'rejected',
                    }))
                ),
                distinctUntilChanged((a, b) => equals(a, b))
            )
            .subscribe((sessions) => {
                const sessionIds = sessions
                    .filter((f) => f.isMissed)
                    .map((m) => m.id);
                if (sessionIds.length) {
                    store.dispatch(
                        missedViewedShown({
                            sessionIds,
                        })
                    );
                }
            });
    }

    ngOnInit() {
        //this.reRegister();
    }
 
    async reRegister() {
        const res = await this.userService.reRegister();
    }

    ngOnDestroy() {
        this.destroy$.next();
        
    }

    canDeactivate() { 
        // checking valid number or not
        if (this.userService.userNumberStatus) {
            this.userService.userNumberStatus = false;
          return false;
        } else {
            this.userService.userNumberStatus = false;
            return true;
        }
    }

    onStartCall(session: PeerCallingState) {
        this.callingService.call(session.peer.multiLineUri);
    }

    onClearHistory(peerId: string) {
        this.callingService.clearHistory(peerId);
        this.router.navigate(['/calling']);
    }

    onAccept(session: ActiveCall) {
        console.log('onAccept');
        this.callingService.accept(session.callId);
    }

    onCancel(session: ActiveCall) {
        this.changeUserNumberStatus();
        this.callingService.hangUp(session.callId);
    }

    onMute(session: ActiveCall, isMute: boolean) {
        this.callingService.setMute(session.callId, isMute);
    }

    onHold(session: ActiveCall, isHold: boolean) {
        this.callingService.setHold(session.callId, isHold);
    }

    onSwap(session: ActiveCall) {
        this.callingService.swap(session.callId);
    }

    onDeleteHistoryItem(peerId: string, itemId: string) {
        this.callingService.deleteHistoryItem(peerId, itemId);
    }

    onAddToExistentContact(mlNumber: string) {
        this.store.dispatch(startAddToExistentContact({ mlNumber }));
    }

    onKeyClicked(session: ActiveCall, signal: string) {
        this.callingService.sendDTFM(session.callId, signal);
    }

    getActiveCall(session: PeerCallingState, ongoingSessionsCount: number) {
        // if(ongoingSessionsCount < 2 && (session.active[0] as OngoingActiveCall)){
        //     this.changeUserNumberStatus();
        // }
        console.log('!!!', ongoingSessionsCount);
        this.customModalService.noOfCallsReceived = ongoingSessionsCount;
        return (
            ongoingSessionsCount < 2 && (session.active[0] as OngoingActiveCall)
        );
    }
    private changeUserNumberStatus(){
        if(this.userService.userNumberStatus === true){
            this.userService.userNumberStatus = false;
        }
    }
}
