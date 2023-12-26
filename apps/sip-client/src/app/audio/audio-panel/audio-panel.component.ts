import {
    Component,
    EventEmitter,
    Injectable,
    Input,
    OnDestroy,
    Output,
} from '@angular/core';
import { SipService, SipUser } from '@scalio/sip';
import {
    BehaviorSubject,
    combineLatest,
    merge,
    Observable,
    Subject,
} from 'rxjs';
import {
    distinctUntilChanged,
    filter,
    map,
    mapTo,
    scan,
    switchMap,
} from 'rxjs/operators';
import { Invitation, Session, SessionState } from 'sip.js';
import { createActionsView, defaultActionsView } from './views/actions.view';
import { AudioPanelView } from './views/audio-panel.view';
import { ParticipantView } from './views/participant.view';

@Injectable()
export class ParticipantsProvider {
    readonly participants = new BehaviorSubject<SipUser[]>([]);
    constructor() {}
}

@Component({
    selector: 'movius-web-audio-panel',
    templateUrl: './audio-panel.component.html',
    styleUrls: ['./audio-panel.component.scss'],
})
export class AudioPanelComponent implements OnDestroy {
    @Input() userId: string;
    @Input() userName: string;

    @Output() userConnected = new EventEmitter<SipUser>();
    @Output() userDisconnected = new EventEmitter<string>();

    private readonly destroy$ = new Subject();
    private readonly _user$ = new BehaviorSubject<SipUser>(null);
    readonly audioPanelView$: Observable<AudioPanelView>;

    get sipUser$() {
        return this._user$.asObservable();
    }

    private get sipUser() {
        return this._user$.value;
    }

    constructor(
        private readonly sipService: SipService,
        participantsProvider: ParticipantsProvider
    ) {
        const participants$ = participantsProvider.participants.pipe(
            map((ps) =>
                ps.map(
                    (p) =>
                        <ParticipantView>{
                            uri: p.uri,
                            name: p.userName,
                            status: 'online',
                        }
                )
            )
        );

        const _user$ = this._user$.pipe(distinctUntilChanged());
        const nullUser$ = _user$.pipe(
            filter((user) => !user),
            mapTo(<AudioPanelView>{
                user: {
                    uri: null,
                    name: this.userName,
                    actions: defaultActionsView,
                },
                participants: [],
            })
        );
        const notNullUser$ = _user$.pipe(filter((user) => !!user));

        const actionsView$ = notNullUser$.pipe(
            switchMap((user) =>
                createActionsView(this.userId, user.userAgentEvents$)
            )
        );

        const invitation$ = notNullUser$.pipe(
            switchMap((user) => user.userAgentEvents$),
            scan((acc, event) => {
                switch (event.kind) {
                    case 'UserAgentCommonEvent':
                        switch (event.event.kind) {
                            case 'InviteUserEvent':
                                return event.event.invitation;
                            case 'IncomingInviteSessionUserEvent':
                                switch (event.event.event.kind) {
                                    case 'UserSessionDelegateEvent':
                                        switch (event.event.event.event.kind) {
                                            case 'ByeSessionEvent':
                                                event.event.event.event.bye.accept();
                                                return acc;
                                        }
                                }
                                break;
                            case 'IncomingInviteSessionUserEvent':
                                switch (event.event.event.kind) {
                                    case 'UserSessionStateEvent':
                                        switch (event.event.event.state) {
                                            case SessionState.Terminated:
                                                return null;
                                        }
                                }
                                break;
                        }
                }
                return acc;
            }, null as Invitation)
        );

        const session$ = notNullUser$.pipe(
            switchMap((user) => user.userAgentEvents$),
            scan((acc, event) => {
                switch (event.kind) {
                    case 'UserAgentInviterSessionEvent':
                        return event.inviter;
                    case 'UserAgentOutgoingActionEvent':
                        switch (event.action.kind) {
                            case 'OutgoingHangUpAction':
                                return null;
                        }
                }
                return acc;
            }, null as Session)
        );

        const panelView$ = combineLatest([
            notNullUser$,
            actionsView$,
            invitation$,
            session$,
        ]).pipe(
            map(
                ([user, actions, invitation, session]) =>
                    <AudioPanelView>{
                        user: {
                            uri: user.uri,
                            name: user.userName,
                            actions,
                        },
                        session,
                        invitation,
                        participants: [],
                    }
            )
        );

        const chatViewNoParticipants$ = merge(panelView$, nullUser$);

        this.audioPanelView$ = combineLatest([
            chatViewNoParticipants$,
            participants$,
        ]).pipe(
            map(([view, participants]) => ({
                ...view,
                participants: participants.filter(
                    (f) => f.uri !== view.user.uri
                ),
            }))
        );
    }

    ngOnDestroy() {
        this.destroy$.next();
        this._user$.next(null);
    }

    async onConnect() {
        const user = this.sipService.createUser(this.userId, this.userName);
        this._user$.next(user);
        await this.sipService.startUser(user);
        this.userConnected.emit(user);
    }

    onRegister() {
        this.sipService.registerUser(this.sipUser);
    }

    onUnregister() {
        this.sipService.unregisterUser(this.sipUser);
    }

    onCall(target: string) {
        this.sipService.inviteUser(this.sipUser, target);
    }

    onAccept(invitation: Invitation) {
        this.sipService.acceptInvitation(invitation);
    }

    onReject(invitation: Invitation) {
        this.sipService.rejectInvitation(invitation);
    }

    onHangUp(session: Session) {
        this.sipService.hangUpSession(this.sipUser, session);
    }

    onMute(session: Session, isMute: boolean) {
        this.sipService.setSessionMute(this.sipUser, session, isMute);
    }

    onHold(session: Session, isHold: boolean) {
        this.sipService.setSessionHold(this.sipUser, session, isHold);
    }

    async onDisconnect() {
        const userUri = this.sipUser.uri;
        await this.sipService.stopUser(this.sipUser);
        this._user$.next(null);
        this.userDisconnected.emit(userUri);
    }
}
