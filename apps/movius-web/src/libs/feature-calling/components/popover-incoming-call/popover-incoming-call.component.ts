import {
    ChangeDetectionStrategy,
    Component,

    EventEmitter,
    Input,
    Output
} from '@angular/core';
import { UserContact } from '../../../feature-contacts/models';
import { SuspendedActiveCall } from '../../models';
import { CallControlButtonTypes } from '../common';

@Component({
    selector: 'movius-web-popover-incoming-call',
    templateUrl: './popover-incoming-call.component.html',
    styleUrls: ['./popover-incoming-call.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PopoverIncomingCallComponent {
    @Input() peer: UserContact;
    @Input() call: SuspendedActiveCall;
    @Input() isStacked: boolean = false;

    @Output() accept = new EventEmitter();
    @Output() reject = new EventEmitter();

    callControlTypes = CallControlButtonTypes;

    constructor() {}

}
