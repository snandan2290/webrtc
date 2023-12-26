import {
    ChangeDetectionStrategy,
    Component,
    EventEmitter,
    Input,
    Output,
} from '@angular/core';
import { UserContact } from '../../../feature-contacts/models';
import { ActiveCall } from '../../models';

@Component({
    selector: 'movius-web-active-call',
    templateUrl: './active-call.component.html',
    styleUrls: ['./active-call.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ActiveCallComponent {
    @Output() accept = new EventEmitter();
    @Output() cancel = new EventEmitter();
    @Output() mute = new EventEmitter<boolean>();
    @Output() hold = new EventEmitter<boolean>();
    @Output() keyClicked = new EventEmitter<string>();
    @Output() swap = new EventEmitter();

    @Input() isHold = false;
    @Input() isMute = false;
    @Input() isAnonymous: boolean;
    @Input() peer: UserContact;
    @Input() call: ActiveCall;

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
