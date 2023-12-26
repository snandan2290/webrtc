import {
    ChangeDetectionStrategy,
    Component,
    EventEmitter,
    Input,
    Output,
} from '@angular/core';
import { UserContact } from '../../../feature-contacts/models';
import { SessionState } from '../../../shared';
import { ActiveCall } from '../../models';

@Component({
    selector: 'movius-web-popover-call',
    templateUrl: './popover-call.component.html',
    styleUrls: ['./popover-call.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PopoverCallComponent {
    @Output() accept = new EventEmitter();
    @Output() cancel = new EventEmitter();
    @Output() mute = new EventEmitter<boolean>();
    @Output() hold = new EventEmitter<boolean>();
    @Output() swap = new EventEmitter();

    @Input() peer: UserContact;
    @Input() call: ActiveCall;

    @Input() isStacked: boolean = false;

    get isOutgoingCall() {
        return (
            this.call.kind === 'SuspendedActiveCall' &&
            this.call.direction === 'outgoing'
        );
    }

    get isIncomingCall() {
        return (
            this.call.kind === 'SuspendedActiveCall' &&
            this.call.direction === 'incoming'
        );
    }

    get isOngoingCall() {
        return this.call.kind === 'OngoingActiveCall';
    }
}
