import { Injectable } from '@angular/core';
import { ExchangeSyncInterval } from '@movius/domain';
import { MSGraphService } from '@movius/msgraph';
import { Store } from '@ngrx/store';
import { Subject } from 'rxjs';

@Injectable()
export class MsGraphContactsSyncSchedulerService {
    readonly setNextSync$ = new Subject<number | 'never'>();

    private getIntervalMs(interval: ExchangeSyncInterval) {
        switch (interval) {
            case '30min':
                return 30 * 1000 * 60;
            case '1hour':
                return 60 * 1000 * 60;
            case '2hours':
                return 2 * 60 * 1000 * 60;
            case '4hours':
                return 4 * 60 * 1000 * 60;
            case '12hours':
                return 12 * 60 * 1000 * 60;
            default:
                return 'never';
        }
    }

    reschedule(interval: ExchangeSyncInterval) {
        const ms = this.getIntervalMs(interval);
        this.setNextSync$.next(ms === 'never' ? ms : new Date().getTime() + ms);
    }
}
