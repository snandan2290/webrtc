import { ChangeDetectionStrategy, Component, HostListener } from '@angular/core';
import { ActivatedRoute, NavigationEnd, Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { SipService } from '@scalio/sip';
import { set } from 'lodash/fp';
import { BehaviorSubject, combineLatest, Observable } from 'rxjs';
import {
    distinctUntilChanged,
    filter,
    map,
    shareReplay,
    skipUntil,
    startWith,
    take,
    withLatestFrom
} from 'rxjs/operators';
import { UserContactGhost } from '../../../feature-contacts/models';
import {
    CallingStatus,
    DateTimeService,
    filterState,
    GeneralFailureType,
    selectCallingStatus,
    selectFeatures,
    selectTransportStatus,
    cleanPhoneNumber
} from '../../../shared';
import {
    HistorySession,
    HistorySessionCompleted,
    PeerCallingState,
} from '../../models';
import {
    HistorySessionView,
    PeerCallingStateView,
    selectIsHistoryLoaded,
    selectPeersCallingStates,
} from '../../ngrx';
import { UserContact, selectContactGhosts } from '../../../feature-contacts';
import {LoggerFactory} from '@movius/ts-logger';
const logger = LoggerFactory.getLogger("")

export interface PeerCallingStateExt
    extends PeerCallingState<HistorySession, UserContactGhost> {
    unViewed: boolean;
    callTitle: string;
    callType: string;
}

export interface View {
    isSearchBarActivated: boolean;
    sessions: PeerCallingStateExt[];
    status: CallingStatus;
    showEmptyListPlaceholder: boolean;
    generalFailure?: string;
    generalFailureType?: GeneralFailureType;
}

export interface HistorySessionCompletedViewGrouped
    extends HistorySessionCompleted {
    groupCount?: number;
}

const groupHistory = (history: HistorySessionView[]) =>
    history
        .reduce((acc, val) => {
            const perv = acc[0];
            if (perv && val.kind === perv.kind && val.type === perv.type) {
                return set(
                    [0],
                    { ...perv, groupCount: perv.groupCount + 1 },
                    acc
                );
            } else {
                return [{ ...val, groupCount: 1 }, ...acc];
            }
        }, [] as HistorySessionCompletedViewGrouped[])
        .reverse();

const getCallTitle = (session: PeerCallingStateView) => {
    if (!session.isAnonymous) {
        const peer = session.peer;
        return peer ? peer.name || peer?.multiLine : '';
    } else {
        return 'Anonymous';
    }
};

const getCallType = (session: PeerCallingStateView) => {
    if (!session.isAnonymous) {
        return session.peer.multiLineType;
    } else {
        return 'unknown';
    }
};

@Component({
    selector: 'movius-web-calling-workspace',
    templateUrl: './calling-workspace.component.html',
    styleUrls: ['./calling-workspace.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CallingWorkspaceComponent  {
    readonly search$ = new BehaviorSubject<string>(null);
    readonly searchBarActivated$ = new BehaviorSubject(false);
    readonly view$: Observable<View>;

    e911UserStatus: any;
    readonly peers$: Observable<UserContact[]>;
    threadIdvalue: any;
    public savedContact: any = [];
    public properyFlag: boolean;
    getConnectionErrorValue: any;

    constructor(
        public router: Router,
        activatedRoute: ActivatedRoute,
        store: Store,
        private readonly dateTimeService: DateTimeService,
        sipService: SipService
    ) {
        //logger.debug("Calling workspace Called")
        const callingStates$ = store
            .select(selectPeersCallingStates(sipService.getUserUri))
            .pipe(map((f) => f.filter((f) => f.history.length > 0)));
        const contactCallingStates$ = combineLatest([
            callingStates$,
            this.search$,
        ]).pipe(
            map(([state, search]) =>
                filterState(state, search, this.savedContact).map((m) => ({
                    ...m,
                    unViewed: m.history.some(
                        (f) => f.kind === 'HistorySessionCompleted' && !f.viewed
                    ),
                    isAnonymous: m.isAnonymous,
                    callTitle: getCallTitle(m),
                    callType: getCallType(m),
                }))
            )
        );

        const callingStatus$ = store.select(selectCallingStatus);

        const isCallingRouter$ = router.events.pipe(
            filter((f) => f instanceof NavigationEnd),
            map((m: NavigationEnd) => {
                return m.url.indexOf('/call/') !== -1;
            }),
            startWith(router.url.indexOf('/call/') !== -1)
        );

        const isLoaded$ = store
            .select(selectIsHistoryLoaded)
            .pipe(startWith(false));

        const showEmptyListPlaceholder$ = combineLatest([
            callingStates$,
            isLoaded$,
            isCallingRouter$,
        ]).pipe(
            map(
                ([sessions, isLoaded, isCallingRouter]) =>
                    !isCallingRouter && isLoaded && sessions.length === 0
            ),
            distinctUntilChanged()
        );

        this.view$ = combineLatest([
            contactCallingStates$,
            callingStatus$,
            showEmptyListPlaceholder$,
            this.searchBarActivated$,
            store.select(selectTransportStatus),
            store.select(selectFeatures),
        ]).pipe(
            map(
                ([
                    sessions,
                    status,
                    showEmptyListPlaceholder,
                    isSearchBarActivated,
                    transportStatus,
                    features,
                ]) => ({
                    sessions: sessions.map((session) => ({
                        ...session,
                        history: session.history, //groupHistory(session.history),
                    })),
                    status,
                    showEmptyListPlaceholder,
                    isSearchBarActivated,
                    generalFailure:
                        this.getTransportStatus(transportStatus),
                    generalFailureType: (transportStatus == 'disconnected'
                        ? 'NoConnection'
                        : 'Common') as GeneralFailureType,
                })
            ),
            shareReplay()
        );

        if (!activatedRoute.snapshot.firstChild) {
            // open first contact automatically
            contactCallingStates$
                .pipe(
                    skipUntil(isLoaded$.pipe(filter((f) => !!f))),
                    take(1),
                    withLatestFrom(this.router.events.pipe(startWith(null)))
                )
                .subscribe(([sessions, latestRouterEvent]) => {
                    if (latestRouterEvent === null && sessions.length) {
                        router.navigate(
                            ['/calling', 'call', sessions[0].peer?.multiLine],
                            {
                                relativeTo: activatedRoute,
                            }
                        );
                    }
                });
        }
        this.peers$ = store.select(selectContactGhosts(sipService.getUserUri));
        this.peers$.subscribe(peers => {
            this.savedContact = peers;
            if (this.savedContact.length === 2) {
                this.savedContact.push();
            }
        });
    }

    @HostListener('window:popstate', ['$event'])     // On browser "Back" it will redirect you to login page. 
    onPopState(event) {
        location.href = window.document.baseURI + 'auth/login';
    }

    updateSearch(searchTerm: string) {
        let regExp = /[a-zA-Z]/g;
        let strChk = regExp.test(searchTerm)
        if(strChk == true){
            this.search$.next(searchTerm);
        } else {
            this.search$.next(cleanPhoneNumber(searchTerm));
        }
    }

    trackBySession(_: number, session: PeerCallingStateExt) {
        return session.peer.id;
    }

    formatHistoryTime(time: string) {
        if (!time) {
            return time;
        }
        return this.dateTimeService.formatHistoryTime(time);
    }

    onNewCall() {
        this.router.navigate(['/calling/call/new']);
    }

    onSearchBarActivated(f: boolean) {
        this.searchBarActivated$.next(f);
    }

    displayErrorPopup = (callingStatus: CallingStatus) => {
        this.e911UserStatus = sessionStorage.getItem("_USER_E911_STATUS_");
        // console.log("calling-workspace:: displayErrorPopup::: e911UserStatus::" + this.e911UserStatus);
        // console.log("calling-workspace:: displayErrorPopup::: callingStatus::" + callingStatus);
        if (this.e911UserStatus === "enabled_accepted") {
            return callingStatus !== 'allowed'
        } else {
            return (callingStatus === 'another-active-call' ||
                callingStatus === 'e911-declined');
        }

    };

    getTransportStatus(transportStatus: string) {
        let status = ''
        return status;
    }

    ngOnInit() { }

    public getConnectionError(event :any){
        this.getConnectionErrorValue = event;
    }


}
