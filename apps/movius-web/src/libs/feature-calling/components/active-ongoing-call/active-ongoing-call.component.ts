import {
    ChangeDetectionStrategy,
    Component,
    EventEmitter,
    Input,
    OnInit,
    Output,
} from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { UserContact } from '../../../feature-contacts/models';
import {
    getContactCallSubTitle,
    getContactCallTitle,
    getContactCallTitleAndSubtitle,
    getTimeFromTimer,
} from '../../../shared';
import { ActiveCall } from '../../models';
import { CallingTimerService } from '../../services';
import { CallControlButtonTypes } from '../common';

@Component({
    selector: 'movius-web-active-ongoing-call',
    templateUrl: './active-ongoing-call.component.html',
    styleUrls: ['./active-ongoing-call.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ActiveOngoingCallComponent implements OnInit {
    @Input() peer: UserContact;
    @Input() call: ActiveCall;
    @Input() isMute = false;
    @Input() isHold = false;
    @Input() isAnonymous = false;

    @Output() keyClicked = new EventEmitter<string>();
    @Output() mute = new EventEmitter<boolean>();
    @Output() hold = new EventEmitter<boolean>();
    @Output() swap = new EventEmitter();

    @Output() reject = new EventEmitter();

    timer$: Observable<number>;

    isKbrdOpen = false;

    callControlTypes = CallControlButtonTypes;

    constructor(private readonly callingTimerService: CallingTimerService) {}

    ngOnInit() {
        this.timer$ = this.callingTimerService.timers$.pipe(
            map((calls) => calls[this.call.callId])
        );
    }

    onMute(isMute: boolean) {
        this.mute.next(isMute);
    }

    onHold(isHold: boolean) {
        this.hold.next(isHold);
    }

    onSwap() {
        this.swap.emit();
    }

    getTimeFromTimer = getTimeFromTimer;

    getContactCallTitle = getContactCallTitle;

    getContactCallSubTitle = getContactCallSubTitle;

    getContactCallTitleAndSubtitle = getContactCallTitleAndSubtitle;
}
