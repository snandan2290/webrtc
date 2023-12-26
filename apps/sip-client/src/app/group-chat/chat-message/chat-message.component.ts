import { Component, Input } from '@angular/core';
import { GroupMessageView } from '../chat-messages/views/group-messages.view';

@Component({
    selector: 'movius-web-chat-message',
    templateUrl: './chat-message.component.html',
    styleUrls: ['./chat-message.component.scss'],
})
export class ChatMessageComponent {
    @Input() message: GroupMessageView;

    constructor() {}
}
