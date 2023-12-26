import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { UserContact } from 'apps/movius-web/src/libs/feature-contacts/models';
import { ActiveCall } from '../../../models';
import { CallControlButtonTypes } from '../call-control-button/call-control-button.component';

@Component({
    selector: 'movius-web-on-hold-call',
    templateUrl: './on-hold-call.component.html',
    styleUrls: ['./on-hold-call.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OnHoldCallComponent {

    @Input() call: ActiveCall;
    @Input() peer: UserContact;
    @Output() reject = new EventEmitter();
    @Output() swap = new EventEmitter();

    callControlTypes = CallControlButtonTypes;
}
