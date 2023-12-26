import {
    ChangeDetectionStrategy,
    Component,
    EventEmitter,
    Input,
    Output,
} from '@angular/core';

@Component({
    selector: 'movius-web-ongoing-call',
    templateUrl: './ongoing-call.component.html',
    styleUrls: ['./ongoing-call.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OngoingCallComponent {
    @Input() type: 'incoming' | 'outgoing';

    @Input() peerName: string;
    @Input() isMute = false;
    @Input() isHold = false;

    @Output() mute = new EventEmitter<boolean>();
    @Output() hold = new EventEmitter<boolean>();
    @Output() hangUp = new EventEmitter();

    constructor() {}

    onMute(isMute: boolean) {
        this.isMute = isMute;
        this.mute.next(isMute);
    }

    onHold(isHold: boolean) {
        this.isHold = isHold;
        this.hold.next(isHold);
    }
}
