import { Component, OnInit } from '@angular/core';
import { Store } from '@ngrx/store';
import { SipService } from '@scalio/sip';
import { BehaviorSubject, combineLatest, Observable, fromEvent, merge, of } from 'rxjs';
import { map, mapTo, tap} from 'rxjs/operators';
import {
    AuthService,
    GeneralFailureType,
    selectFeatures,
    selectTransportStatus,
    SipUserService,
} from '../../../shared';
import {LoggerFactory} from '@movius/ts-logger';

import { PeerCallingState } from '../../../feature-calling/models';


import {
    selectPeersCallingStates,
} from '../../../feature-calling/ngrx';

const logger = LoggerFactory.getLogger("")

export interface SettingsView {
    isPrivacyAvailable: boolean;
    isE911Available: boolean;
    isSyncExchangeAvailable: boolean;
    generalFailure?: string;
    generalFailureType?: GeneralFailureType;
}

@Component({
    selector: 'movius-web-settings-workspace',
    templateUrl: './settings-workspace.component.html',
    styleUrls: ['./settings-workspace.component.scss'],
})
export class SettingsWorkspaceComponent implements OnInit {
    readonly view$: Observable<SettingsView>;
    isSSOUser: boolean;
    seconds = 11;
    reregister_val = 0;
    intervalId = 0;
    readonly serverConnectionError$ = new BehaviorSubject<string>(null);
    online$: Observable<boolean>;
    getConnectionErrorValue: any;

    constructor(store: Store, private sipUserService: SipUserService, private authService: AuthService, sipService: SipService) {
        this.view$ = combineLatest([
            store.select(selectFeatures),
            store.select(selectTransportStatus),
        ]).pipe(
            map(([features, transportStatus]) => ({
                isE911Available:
                    features.e911Status === 'enabled_accepted' ||
                    features.e911Status === 'enabled_declined',
                isPrivacyAvailable: features.gdprStatus !== 'disabled',
                isSyncExchangeAvailable: features.exchangeSyncStatus !== 'off',
                generalFailure:
                        this.getTransportStatus(transportStatus),
                    generalFailureType: (transportStatus == 'disconnected'
                        ? 'NoConnection'
                        : 'Common') as GeneralFailureType,
            }))
        );


        const ongoingSessions$ = store
        .select(selectPeersCallingStates(sipService.getUserUri))
        .pipe(
            map((sessions) =>
                sessions.filter(
                    (f) =>
                        (f.active || []).length > 0 &&
                        (f.active[0].kind === 'OngoingActiveCall' ||
                            f.active[0].kind === 'SuspendedActiveCall')
                )
            ),
            tap(console.log)
        ) as Observable<PeerCallingState[]>;


        ongoingSessions$.subscribe(ongoingSessions => {
            console.log('ongoing sessions count', ongoingSessions.length)
            if(ongoingSessions.length != 0){
                sessionStorage.setItem('call_is_active', 'true');
            } else {
                sessionStorage.setItem('call_is_active', 'false');
            }
        });
    }

    ngOnInit(): void {
        this.isSSOUser = false;

        if (sessionStorage.getItem('ssoToken') != "\"\""
            && sessionStorage.getItem('ssoToken') != null
            && typeof (sessionStorage.getItem('ssoToken')) != 'undefined') {
            this.isSSOUser = true;
        }
    }

    public getConnectionError(event :any){
        this.getConnectionErrorValue = event;
    }

    getTransportStatus(transportStatus: string) {
        let status = ''
        return status;
    }
}
