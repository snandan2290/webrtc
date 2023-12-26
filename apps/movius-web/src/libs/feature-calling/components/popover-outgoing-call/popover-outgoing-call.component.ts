import {
    ChangeDetectionStrategy,
    Component,
    EventEmitter,
    Input,
    Output,
} from '@angular/core';
import { UserContact } from '../../../feature-contacts/models';
import { OutgoingCall } from '../../models';
import { CallControlButtonTypes } from '../common';

@Component({
    selector: 'movius-web-popover-outgoing-call',
    templateUrl: './popover-outgoing-call.component.html',
    styleUrls: ['./popover-outgoing-call.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PopoverOutgoingCallComponent {
    @Input() peer: UserContact;
    @Input() call: OutgoingCall;
    @Output() cancel = new EventEmitter();

    callControlTypes = CallControlButtonTypes;
}
