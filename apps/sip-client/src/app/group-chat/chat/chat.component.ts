import { Component, Input, OnDestroy } from '@angular/core';
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
    startWith,
    switchMap,
} from 'rxjs/operators';
import { createActionsView, defaultActionsView } from './views/actions.view';
import { ChatView } from './views/chat.view';
import { ParticipantView } from './views/participant.view';

export interface PeerView {
    id: string;
    uri: string;
    name: string;
    status: 'online' | 'offline';
}

export interface User {
    id: string;
    name: string;
    password?: string;
    identifier?: string;
}

@Component({
    selector: 'movius-web-chat',
    templateUrl: './chat.component.html',
    styleUrls: ['./chat.component.scss'],
})
export class ChatComponent implements OnDestroy {
    @Input() user: User;

    readonly peers$: Observable<PeerView[]>;
    private readonly destroy$ = new Subject();
    private readonly _user$ = new BehaviorSubject<SipUser>(null);
    private readonly _peers$ = new BehaviorSubject<
        { id: string; identifier?: string; name: string }[]
    >([]);
    readonly chatView$: Observable<ChatView>;

    @Input() set peers(
        val: { id: string; identifier?: string; name: string }[]
    ) {
        this._peers$.next(val);
    }
    get peers() {
        return this._peers$.getValue();
    }

    get sipUser$() {
        return this._user$.asObservable();
    }

    private get sipUser() {
        return this._user$.value;
    }

    constructor(private readonly sipService: SipService) {
        const _user$ = this._user$.pipe(distinctUntilChanged());
        const nullUser$ = _user$.pipe(
            filter((user) => !user),
            mapTo(<ChatView>{
                user: {
                    uri: null,
                    name: this.user ? this.user.name : 'unknown',
                    actions: defaultActionsView,
                },
                participants: [],
            })
        );
        const notNullUser$ = _user$.pipe(filter((user) => !!user));

        const actionsView$ = notNullUser$.pipe(
            switchMap((user) => createActionsView(user.userAgentEvents$))
        );

        const chatView$ = combineLatest([notNullUser$, actionsView$]).pipe(
            map(
                ([user, actions]) =>
                    <ChatView>{
                        user: {
                            uri: user.uri,
                            name: user.userName,
                            actions,
                        },
                        participants: [],
                    }
            )
        );

        const chatViewNoParticipants$ = merge(chatView$, nullUser$);

        this.peers$ = this._peers$.pipe(
            map((peers) =>
                peers.map((peer) => {
                    const uri = this.sipService.getUserUri(peer.id);
                    const identifierUri = this.sipService
                        .getUserUri(peer.identifier || peer.id)
                        .replace(':8089', '');
                    return {
                        id: peer.id,
                        name: peer.name,
                        uri,
                        status: 'online',
                        identifierUri,
                    };
                })
            )
        );

        this.chatView$ = combineLatest([
            chatViewNoParticipants$,
            this.peers$.pipe(startWith([])),
        ]).pipe(
            map(([view, peers]) => ({
                ...view,
                participants: peers.filter((f) => f.uri !== view.user.uri),
            }))
        );
    }

    ngOnDestroy() {
        this.destroy$.next();
        this._user$.next(null);
    }

    async onConnect() {
        const extraHeaders = this.user.identifier
            ? [
                  `X-CAFE-IDENTITY: ${this.user.identifier}`,
                  `X-CAFE-IDENTITY-INFO: identity='${this.user.identifier}',last_message=''`,
                  'X-MCP-SECURECALL: yes',
              ]
            : undefined;

        const user = this.sipService.createUser(
            this.user.id,
            this.user.name,
            this.user.password,
            false,
            extraHeaders
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

    async onDisconnect() {
        await this.sipService.stopUser(this.sipUser);
        this._user$.next(null);
    }

    onSendMessage(participants: ParticipantView[], msg: string) {
        this.sipService.sendMultiTargetMessage(
            this.sipUser,
            participants.map((p) => p.identifierUri || p.uri),
            msg
        );
    }
}
