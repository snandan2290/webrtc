import {
    ChangeDetectionStrategy,
    Component,
    EventEmitter,
    Input,
    Output,
} from '@angular/core';

@Component({
    selector: 'movius-web-incoming-call',
    templateUrl: './incoming-call.component.html',
    styleUrls: ['./incoming-call.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IncomingCallComponent {
    @Input() peerName: string;

    @Output() accept = new EventEmitter();

    @Output() reject = new EventEmitter();

    constructor() {}
}
