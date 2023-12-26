import {
    ChangeDetectionStrategy,
    Component,
    EventEmitter,
    Input,
    Output,
} from '@angular/core';
import { UserContact } from '../../../feature-contacts/models';
import { getContactCallSubTitle, getContactCallTitle, getContactCallTitleAndSubtitle } from '../../../shared';
import { SuspendedActiveCall } from '../../models';
import { CallControlButtonTypes } from '../common';

@Component({
    selector: 'movius-web-active-incoming-call',
    templateUrl: './active-incoming-call.component.html',
    styleUrls: ['./active-incoming-call.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ActiveIncomingCallComponent {
    @Input() peer: UserContact;
    @Input() call: SuspendedActiveCall;
    @Input() isAnonymous: boolean;

    @Output() accept = new EventEmitter();
    @Output() reject = new EventEmitter();

    callControlTypes = CallControlButtonTypes;

    getContactCallTitle = getContactCallTitle;

    getContactCallSubTitle = getContactCallSubTitle;

    getContactCallTitleAndSubtitle = getContactCallTitleAndSubtitle;
}
