import {
    ChangeDetectionStrategy,
    ChangeDetectorRef,
    Component,
    OnInit,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Actions, ofType } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import { take } from 'rxjs/operators';
import {
    importFromMsGraphFails,
    importFromMsGraphSuccess,
} from '../../../feature-contacts/ngrx/actions';
import {
    loginMsGraph,
    loginMsGraphFails,
    logoutMsGraph,
} from '../../../shared';
import { selectContactGhosts, selectContacts } from '../../../feature-contacts';
import { SipService } from '@scalio/sip';
import { UserContact } from '../../../feature-contacts/models';
import {Observable} from "rxjs";

type SyncUiStates = 'not-sync' | 'syncing' | 'error';

@Component({
    selector: 'movius-web-connect-contacts-settings',
    templateUrl: './connect-contacts-settings.component.html',
    styleUrls: ['./connect-contacts-settings.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConnectContactSettingsComponent implements OnInit {
    state: SyncUiStates = 'not-sync';
    readonly peers$: Observable<UserContact[]>;

    constructor(
        private readonly store: Store,
        private readonly actions: Actions,
        private readonly cdr: ChangeDetectorRef,
        private readonly activatedRoute: ActivatedRoute,
        private readonly router: Router,
        sipService: SipService,
    ) {
        this.peers$ = store.select(selectContactGhosts(sipService.getUserUri));
    }

    ngOnInit(): void {}

    async onSync() {
        this.state = 'syncing';
        // TODO : handle error
        const waiter$ = this.actions.pipe(
            ofType(
                importFromMsGraphSuccess,
                importFromMsGraphFails,
                loginMsGraphFails
            ),
            take(1)
        );
        this.store.dispatch(loginMsGraph());
        const result = await waiter$.toPromise();
        if (result.type !== '[Contacts] Import From MsGraph Success') {
            const error = result.error;
            console.log('sync contacts error', error);
            this.state = 'error';
            this.cdr.markForCheck();
        } else {
            localStorage.setItem('contactSync','true');
            this.peers$.subscribe(contacts => {
                this.router.navigate(['.', contacts[0].id], {
                    relativeTo: this.activatedRoute,
                });
            });
        }
    }

    onTryAgain() {
        this.state = 'not-sync';
        //return this.onSync();
    }

    onDisableExchangeSync() {
        this.store.dispatch(logoutMsGraph({ resetContacts: true }));
    }
}
