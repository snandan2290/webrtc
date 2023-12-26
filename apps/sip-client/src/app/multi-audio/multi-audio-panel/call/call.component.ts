import {
    ChangeDetectionStrategy,
    Component,
    EventEmitter,
    Input,
    OnInit,
    Output,
} from '@angular/core';
import { SessionState } from 'sip.js';

export interface User {
    uri: string;
    name: string;
}

export interface IncomingCall {
    id: string;
    kind: 'IncomingCallSession';
    peer: User;
    state: SessionState;
}

export interface OutgoingCall {
    id: string;
    kind: 'OutgoingCallSession';
    peer: User;
    state: SessionState;
}

export type Call = IncomingCall | OutgoingCall;

@Component({
    selector: 'movius-web-call',
    templateUrl: './call.component.html',
    styleUrls: ['./call.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CallComponent implements OnInit {
    @Input() call: Call;

    @Output() accept = new EventEmitter();
    @Output() hangUp = new EventEmitter();
    @Output() hold = new EventEmitter<boolean>();
    @Output() mute = new EventEmitter<boolean>();

    constructor() {}

    ngOnInit() {}

}
