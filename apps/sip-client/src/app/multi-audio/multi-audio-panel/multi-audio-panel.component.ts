import {
    AfterViewInit,
    Component,
    ElementRef,
    Input,
    OnDestroy,
    ViewChild,
} from '@angular/core';
import {
    setupMediaElementStream,
    SipService,
    SipUser,
    UserAgentEvent,
} from '@scalio/sip';
import {
    BehaviorSubject,
    combineLatest,
    EMPTY,
    NEVER,
    Observable,
    of,
    Subject,
} from 'rxjs';
import {
    distinctUntilChanged,
    map,
    scan,
    shareReplay,
    startWith,
    switchMap,
    takeUntil,
    tap,
} from 'rxjs/operators';
import { IncomingRequestMessage } from 'sip.js/lib/core';
import { AudioPanelState, CallSession } from './audio-panel.models';
import { stateHandler } from './audio-panel.state-handler';
import { Call } from './call/call.component';

const convertSession = (session: CallSession) => {
    return session.kind === 'IncomingCallSession'
        ? session.invitation
        : session.inviter;
};

const getSessionRequest = (session: CallSession) => {
    return session.kind === 'IncomingCallSession'
        ? session.invitation.request
        : session.inviter.request;
};

export interface PeerView {
    id: string;
    uri: string;
    name: string;
    status: 'online' | 'offline' | 'calling';
}

export interface User {
    id: string;
    name: string;
    password?: string;
}

@Component({
    selector: 'movius-web-multi-audio-panel',
    templateUrl: './multi-audio-panel.component.html',
    styleUrls: ['./multi-audio-panel.component.scss'],
})
export class MultiAudioPanelComponent implements OnDestroy, AfterViewInit {
    @Input() user: User;
    @Input() set peers(val: { id: string; name: string }[]) {
        this._peers$.next(val);
    }
    get peers() {
        return this._peers$.getValue();
    }

    @ViewChild('panelRemoteAudio') panelRemoteAudio: ElementRef<
        HTMLAudioElement
    >;

    private readonly destroy$ = new Subject();
    private readonly _user$ = new BehaviorSubject<SipUser>(null);
    private readonly _peers$ = new BehaviorSubject<
        { id: string; name: string }[]
    >([]);
    readonly state$: Observable<AudioPanelState>;
    readonly peers$: Observable<PeerView[]>;
    readonly calls$: Observable<Call[]>;

    get sipUser$() {
        return this._user$.asObservable();
    }

    private get sipUser() {
        return this._user$.value;
    }

    constructor(private readonly sipService: SipService) {
        const _user$ = this._user$.pipe(distinctUntilChanged());

        this.state$ = _user$.pipe(
            switchMap((user) =>
                user
                    ? user.userAgentEvents$.pipe(
                          map((event) => ({ user, event }))
                      )
                    : of<{ user: SipUser; event: UserAgentEvent }>({
                          user: null,
                          event: null,
                      })
            ),
            tap((event) => {
                console.log('Before event handled', this.user.name, event);
            }),
            scan(stateHandler, {
                kind: 'AudioPanelUnConnectedState',
            } as AudioPanelState),
            tap((state) => console.log('After event handled', state)),
            shareReplay()
        );

        this.calls$ = this.state$.pipe(
            map((state) => {
                if (state.kind === 'AudioPanelRegisteredState') {
                    return Object.values(state.sessions).map((callSession) => {
                        const session = convertSession(callSession);
                        const request = getSessionRequest(callSession);
                        const peerUri =
                            request instanceof IncomingRequestMessage
                                ? request.from.uri
                                : request.to.uri;
                        return {
                            id: session.id,
                            kind: callSession.kind,
                            state: session.state,
                            peer: { uri: peerUri.toRaw(), name: peerUri.user },
                        };
                    });
                } else {
                    return [];
                }
            })
        );

        this.peers$ = combineLatest([
            this._peers$,
            this.calls$.pipe(startWith([])),
        ]).pipe(
            map(([peers, calls]) =>
                peers.map((peer) => {
                    const uri = this.sipService.getUserUri(peer.id);
                    return {
                        id: peer.id,
                        name: peer.name,
                        uri,
                        status: calls.some((call) => call.peer.uri === uri)
                            ? 'calling'
                            : 'online',
                    };
                })
            )
        );
    }

    ngAfterViewInit() {
        this._user$
            .pipe(
                switchMap((user) => (user ? user.userAgentEvents$ : EMPTY)),
                setupMediaElementStream(this.panelRemoteAudio.nativeElement),
                takeUntil(this.destroy$)
            )
            .subscribe(() => {});
    }

    ngOnDestroy() {
        this.destroy$.next();
        this._user$.next(null);
    }

    async onConnect() {
        const user = this.sipService.createUser(
            this.user.id,
            this.user.name,
            this.user.password,
            false
        );
        this._user$.next(user);
        await this.sipService.startUser(user);
    }

    onRegister() {
        this.sipService.registerUser(this.sipUser);
    }

    onUnregister() {
        this.sipService.unregisterUser(this.sipUser);
    }

    onCall(targetId: string) {
        this.sipService.inviteUser(
            this.sipUser,
            this.sipService.getUserUri(targetId)
        );
    }

    async onDisconnect() {
        await this.sipService.stopUser(this.sipUser);
        this._user$.next(null);
    }

    trackByCall(_, call: Call) {
        return call.id;
    }

    onAccept(session: CallSession) {
        if (session.kind === 'IncomingCallSession') {
            this.sipService.acceptInvitation(session.invitation);
        } else {
            console.warn('Wrong session type, must be Incoming');
        }
    }

    onHangUp(session: CallSession) {
        this.sipService.hangUpSession(this.sipUser, convertSession(session));
    }

    onMute(session: CallSession, isMute: boolean) {
        this.sipService.setSessionMute(
            this.sipUser,
            convertSession(session),
            isMute
        );
    }

    onHold(session: CallSession, isHold: boolean) {
        this.sipService.setSessionHold(
            this.sipUser,
            convertSession(session),
            isHold
        );
    }
}
