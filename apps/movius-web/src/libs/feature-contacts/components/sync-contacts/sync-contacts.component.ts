import {
    ChangeDetectionStrategy,
    ChangeDetectorRef,
    Component,
    OnInit,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Actions, ofType } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import { selectContactGhosts, selectContacts } from '../../../feature-contacts';
import { SipService } from '@scalio/sip';
import { UserContact } from '../../../feature-contacts/models';
import { take } from 'rxjs/operators';
import { loginMsGraph, loginMsGraphFails } from '../../../shared';
import {
    importFromMsGraphFails,
    importFromMsGraphSuccess,
} from '../../ngrx/actions';
import {Observable} from "rxjs";
import { AuthDataAccessService } from '../../../shared/services/auth.data-access.service';

type SyncUiStates = 'not-sync' | 'syncing' | 'error';

@Component({
    selector: 'movius-web-sync-contacts',
    templateUrl: './sync-contacts.component.html',
    styleUrls: ['./sync-contacts.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SyncContactsComponent implements OnInit {
    readonly peers$: Observable<UserContact[]>;
    state: SyncUiStates = 'not-sync';

    constructor(
        private readonly store: Store,
        private readonly actions: Actions,
        private readonly router: Router,
        private readonly activatedRoute: ActivatedRoute,
        private readonly cdr: ChangeDetectorRef,
        sipService: SipService,
        private readonly authDataAccess: AuthDataAccessService
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
        if (result.type === '[Contacts] Import From MsGraph Success') {
            localStorage.setItem('contactSync','true');
            //this.router.navigateByUrl('.', {skipLocationChange: true});
            this.peers$.subscribe(contacts => {
                                this.router.navigate(['.', contacts[0].id], {
                                    relativeTo: this.activatedRoute,
                                });
                            });
        } else {
            const error = result.error;
            console.log('sync contacts error', error);
            this.state = 'error';
            this.cdr.markForCheck();

           if(sessionStorage.getItem('ssoToken') != null){
            const refereshTokenResponse = await this.authDataAccess
            .refresh_token_on_expiry();
            console.log('resp', refereshTokenResponse);
           }
        }
    }

    onCreateLocal() {
        this.router.navigate(['add'], {
            relativeTo: this.activatedRoute,
        });
    }

    onTryAgain() {
        this.state = 'not-sync';
    }

}
