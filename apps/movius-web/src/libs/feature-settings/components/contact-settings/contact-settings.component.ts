import { Component, OnInit } from '@angular/core';
import { ExchangeSyncInterval, ExchangeSyncSettings } from '@movius/domain';
import { Actions, ofType } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import { selectContactGhosts, selectContacts } from '../../../feature-contacts';
import { SipService } from '@scalio/sip';
import { UserContact } from '../../../feature-contacts/models';
import { combineLatest, Observable, merge } from 'rxjs';
import { map, mapTo, startWith } from 'rxjs/operators';
import {
    importFromMsGraph,
    importFromMsGraphFails,
    importFromMsGraphSuccess,
} from '../../../feature-contacts';
import {
    logoutMsGraph,
    selectIsMsGraphSyncEnabled,
    selectMsGraphProfileEmail,
    selectUserExchangeSettings,
    updateUserExchangeSyncSettings,
} from '../../../shared';

export interface ContactSettingsView {
    isMsGraphSyncEnabled: boolean;
    msGraphProfileEmail: string;
    exchangeSyncSettings: ExchangeSyncSettings;
    isSyncing: boolean;
}

@Component({
    selector: 'movius-web-contact-settings',
    templateUrl: './contact-settings.component.html',
    styleUrls: ['./contact-settings.component.scss'],
})
export class ContactSettingsComponent implements OnInit {
    readonly view$: Observable<ContactSettingsView>;
    public syncExchange:any;
    readonly peers$: Observable<UserContact[]>;
    isSSOUser: boolean;
    isContactSync: boolean;

    intervalOptions: [ExchangeSyncInterval, string][] = [
        ['never', 'Never'],
        ['30min', 'Every 30 minutes'],
        ['1hour', 'Every hour'],
        ['2hours', 'Every 2 hours'],
        ['4hours', 'Every 4 hours'],
        ['12hours', 'Every 12 hours'],
    ];

    constructor(private readonly store: Store, actions: Actions, sipService: SipService) {
        this.peers$ = store.select(selectContactGhosts(sipService.getUserUri));
        const isSyncing$ = merge(
            actions.pipe(ofType(importFromMsGraph), mapTo(true)),
            actions.pipe(
                ofType(importFromMsGraphFails, importFromMsGraphSuccess),
                mapTo(false)
            )
        ).pipe(startWith(false));

        this.view$ = combineLatest([
            store.select(selectUserExchangeSettings),
            store.select(selectMsGraphProfileEmail),
            isSyncing$,
        ]).pipe(
            map(([exchangeSyncSettings, msGraphProfileEmail, isSyncing]) => ({
                exchangeSyncSettings,
                isMsGraphSyncEnabled: !!msGraphProfileEmail,
                msGraphProfileEmail,
                isSyncing,
            }))
        );
    }

    ngOnInit(): void {
        if(localStorage.getItem('contactSync') == 'true'){
            this.syncExchange = true;
        } else {
            this.syncExchange = false;
        }
    this.isSSOUser = false;
        if (sessionStorage.getItem('ssoToken') != "\"\""
            && sessionStorage.getItem('ssoToken') != null
            && typeof (sessionStorage.getItem('ssoToken')) != 'undefined') {
            this.isSSOUser = true;
        }

        this.isContactSync = false;
        this.peers$.subscribe(peers => {
            console.log('peer length', peers.length);
            if(peers.length > 0){
                this.isContactSync = true;
            }
        });
        

    }

    onManualSync() {
        this.store.dispatch(
            importFromMsGraph({ resetContacts: false, contacts: 'not-loaded' })
        );
    }

    onSyncIntervalChange(syncInterval: ExchangeSyncInterval) {
        this.store.dispatch(
            updateUserExchangeSyncSettings({
                settings: {
                    syncInterval,
                },
            })
        );
    }

    onDisableExchangeSync() {
        this.store.dispatch(logoutMsGraph({ resetContacts: true }));
    }

    getEmail(view: any) {
        if (sessionStorage.getItem('ssoToken') == null){
            return sessionStorage.getItem('__api_name__');
        } else {
            return sessionStorage.getItem('userEmail');
        }
    }
}
