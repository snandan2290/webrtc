import { Component, Input, OnInit } from '@angular/core';
import {
    getHours,
    getMinutes,
    getSeconds,
    getTimeFromTimer,
} from 'apps/movius-web/src/libs/shared';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { CallingTimerService } from '../../../services';

@Component({
    selector: 'movius-web-call-timer',
    templateUrl: './call-timer.component.html',
    styleUrls: ['./call-timer.component.scss'],
})
export class CallTimerComponent implements OnInit {
    @Input() callId: string;
    timer$: Observable<number>;

    constructor(private readonly callingTimerService: CallingTimerService) {}

    ngOnInit() {
        this.timer$ = this.callingTimerService.timers$.pipe(
            map((calls) => calls[this.callId])
        );
    }

    getTimeFromTimer = getTimeFromTimer;

    getHours = getHours;

    getMinutes = getMinutes;

    getSeconds = getSeconds;
}
