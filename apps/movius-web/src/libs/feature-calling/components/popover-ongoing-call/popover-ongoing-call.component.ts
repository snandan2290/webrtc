import {
    ChangeDetectionStrategy,
    Component,
    EventEmitter,
    Input,
    OnDestroy,
    Output,
} from '@angular/core';
import { Subject } from 'rxjs';
import { UserContact } from '../../../feature-contacts/models';
import { OngoingActiveCall } from '../../models';
import { CallControlButtonTypes } from '../common';

@Component({
    selector: 'movius-web-popover-ongoing-call',
    templateUrl: './popover-ongoing-call.component.html',
    styleUrls: ['./popover-ongoing-call.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PopoverOngoingCallComponent implements OnDestroy {
    @Input() peer: UserContact;
    @Input() call: OngoingActiveCall;

    @Output() mute = new EventEmitter<boolean>();
    @Output() hold = new EventEmitter<boolean>();

    @Output() reject = new EventEmitter();
    @Output() swap = new EventEmitter();

    destroy$ = new Subject();

    callControlTypes = CallControlButtonTypes;

    onMute(isMute: boolean) {
        this.mute.next(isMute);
    }

    onHold(isHold: boolean) {
        this.hold.next(isHold);
    }

    ngOnDestroy(): void {
        this.destroy$.next();
    }
}
