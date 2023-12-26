import { Component, Input, OnDestroy, OnInit } from '@angular/core';
import { SipUser } from '@scalio/sip';
import { Observable, Subject } from 'rxjs';
import { tap } from 'rxjs/operators';
import { GroupMessageView, mapMessagesView } from './views/group-messages.view';
import { getMessages } from './views/messages.view';

@Component({
    selector: 'movius-web-chat-messages',
    templateUrl: './chat-messages.component.html',
    styleUrls: ['./chat-messages.component.scss'],
})
export class ChatMessagesComponent implements OnInit, OnDestroy {
    @Input() sipUser: SipUser;
    @Input() userIdentifier: string;

    messages$: Observable<GroupMessageView[]>;

    private readonly destroy$ = new Subject();

    constructor() {}

    ngOnInit() {
        this.messages$ = this.sipUser.userAgentEvents$
            .pipe(
                tap((evt) =>
                    console.log('Before message', this.sipUser.userName, evt)
                ),
                getMessages(this.userIdentifier)
            )
            .pipe(mapMessagesView);
    }

    ngOnDestroy() {
        this.destroy$.next();
    }
}
