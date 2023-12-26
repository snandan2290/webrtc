import {
    ChangeDetectorRef,
    EventEmitter,
    Injectable,
    ViewContainerRef,
} from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { SipService } from '@scalio/sip';
import { NzModalRef, NzModalService } from 'ng-zorro-antd/modal';
import { combineLatest, Observable, Subject } from 'rxjs';
import { filter, map, takeUntil } from 'rxjs/operators';
import { CustomNzModalService } from '../../shared';
import { PopoverCallStackComponent } from '../components';
import { PeerCallingState } from '../models';
import { selectPeersCallingStates } from '../ngrx';
import { CallingService } from './calling.service';

/**
 * Handle user calls show popup for active calls
 */
@Injectable({ providedIn: 'root' })
export class PopoverCallingService {
    private modal: NzModalRef<PopoverCallStackComponent, any>;
    private readonly destroy$ = new Subject();
    private readonly activeSessions$: Observable<PeerCallingState[]>;
    private readonly routerCallId$: Observable<string>;
    private viewContainerRef: ViewContainerRef;
    private viewContainerRefCdr: ChangeDetectorRef;

    constructor(
        private readonly callingService: CallingService,
        private readonly modalService: NzModalService,
        private customModalService:CustomNzModalService,
        router: Router,
        store: Store,
        sipService: SipService
    ) {
        this.activeSessions$ = store
            .select(selectPeersCallingStates(sipService.getUserUri))
            .pipe(
                map((sessions) =>
                    sessions.filter((f) => (f.active || []).length > 0)
                )
            ) as Observable<PeerCallingState[]>;

        this.routerCallId$ = router.events.pipe(
            filter((evt) => evt instanceof NavigationEnd),
            map((evt: NavigationEnd) => evt.url),
            map((url) => {
                //WARN: CB:25Jan2021: url can potentially contain unsupported values e.g. commas or hashes.
                //WARN: CB:25Jan2021: currently solved due to ui-control-disabled restrictions.
                const res = /calling\/call\/(\w+)/.exec(url);
                return res && res[1];
            })
        );
    }

    init(
        viewContainerRef: ViewContainerRef,
        viewContainerRefCdr: ChangeDetectorRef
    ) {
        this.viewContainerRef = viewContainerRef;
        this.viewContainerRefCdr = viewContainerRefCdr;
        combineLatest([this.activeSessions$, this.routerCallId$])
            .pipe(takeUntil(this.destroy$))
            .subscribe(
                ([sessions, routerCallId]) => {
                    
                    const filteredSessions = sessions.filter((s) =>
                        routerCallId === 'new'
                            ? s.active[0].direction === 'incoming'
                            : s.active[0].kind === 'OngoingActiveCall' ||
                              (s.peer.multiLine !== routerCallId || this.customModalService.noOfCallsReceived <= 2)
                    );
                    
                    const withoutCurrentRouterCallIdSessions = filteredSessions.filter(
                        (s) => s.peer.multiLine !== routerCallId
                    );

                    if (withoutCurrentRouterCallIdSessions.length > 0) {
                        this.showPopover(filteredSessions);
                    } else {
                        this.hidePopover();
                    }
                },
                () => {},
                () => {
                    this.hidePopover();
                }
            );
    }

    dispose() {
        this.hidePopover();
        this.destroy$.next();
    }

    private showPopover(sessions: PeerCallingState[]) {
        if (!this.modal || !this.modal.componentInstance) {
            if (!this.viewContainerRef) {
                throw new Error('View container ref is not setup');
            }
            const accept$ = new EventEmitter();
            const cancel$ = new EventEmitter();
            const mute$ = new EventEmitter();
            const hold$ = new EventEmitter();
            const swap$ = new EventEmitter();
            this.modal = this.modalService.create({
                nzMaskClosable: false,
                //BUG CB:01Nov2020: Workaround: Disable modal mask -> sidefeect -> Hotfix - Ng-zorro backdrop shadow is displayed above modals.
                nzMaskStyle: { display: 'none' },
                nzMask: false,
                nzStyle: {
                    margin: '0 auto 0 auto',
                },
                nzWidth: '22.5rem',
                nzContent: PopoverCallStackComponent,
                nzClosable: false,
                nzViewContainerRef: this.viewContainerRef,
                nzFooter: null,
                nzComponentParams: {
                    sessions,
                    accept: accept$,
                    cancel: cancel$,
                    mute: mute$,
                    hold: hold$,
                    swap: swap$,
                },
                nzWrapClassName: 'draggableNzModal',
            });
            // TODO : Modal is not displayed without it
            setTimeout(() => {
                this.modal.componentInstance.cdr.detectChanges();
                // this.viewContainerRefCdr.detectChanges();
            }, 0);
            const afterClose$ = this.modal.afterClose;
            accept$.pipe(takeUntil(afterClose$)).subscribe((session) => {
                this.callingService.accept(session);
            });
            cancel$.pipe(takeUntil(afterClose$)).subscribe((session) => {
                this.callingService.hangUp(session);
            });
            swap$.pipe(takeUntil(afterClose$)).subscribe((session) => {
                this.callingService.swap(session);
            });
            mute$
                .pipe(takeUntil(afterClose$))
                .subscribe(({ callId, isMute }) => {
                    this.callingService.setMute(callId, isMute);
                });
            hold$
                .pipe(takeUntil(afterClose$))
                .subscribe(({ callId, isHold }) => {
                    this.callingService.setHold(callId, isHold);
                });
        } else {
            this.modal.componentInstance.sessions = sessions;
            this.modal.componentInstance.cdr.detectChanges();
        }
    }

    private hidePopover() {
        if (this.modal) {
            this.modal.close();
            this.modal = null;
        }
    }
}
