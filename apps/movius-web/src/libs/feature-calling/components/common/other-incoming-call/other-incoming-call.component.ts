import {
    ChangeDetectionStrategy,
    Component,
    EventEmitter,
    Input,
    OnInit,
    Output,
} from '@angular/core';
import { UserContact } from 'apps/movius-web/src/libs/feature-contacts/models';
import {
    formatPhoneToInternational,
    getContactCallTitle,
    getContactCallTitleAndSubtitle,
} from 'apps/movius-web/src/libs/shared';
import { SuspendedActiveCall } from '../../../models';

@Component({
    selector: 'movius-web-other-incoming-call',
    templateUrl: './other-incoming-call.component.html',
    styleUrls: ['./other-incoming-call.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OtherIncomingCallComponent implements OnInit {
    @Input() call: SuspendedActiveCall;
    @Input() peer: UserContact;

    @Input()
    isTitleVisible: boolean = true;

    @Input()
    isPhoneVisible: boolean = true;

    @Output() accept = new EventEmitter();
    @Output() reject = new EventEmitter();

    constructor() {}

    ngOnInit(): void {}

    getContactCallTitle = getContactCallTitle;

    get isEstablishing() {
        return this.call.isEstablishing;
    }

    getContactCallTitleAndSubtitle = getContactCallTitleAndSubtitle;

    formatNumber = formatPhoneToInternational
}
