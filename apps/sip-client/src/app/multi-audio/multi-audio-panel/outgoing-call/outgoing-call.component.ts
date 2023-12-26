import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
    selector: 'movius-web-outgoing-call',
    templateUrl: './outgoing-call.component.html',
    styleUrls: ['./outgoing-call.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OutgoingCallComponent {
    @Input() peerName: string;

    @Output() hangUp = new EventEmitter();

    constructor() {}
}
