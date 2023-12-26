import { Component, OnInit } from '@angular/core';
import { startsWith } from 'lodash';
import { combineLatest, merge, Observable, of } from 'rxjs';
import { catchError, map, switchMap, withLatestFrom } from 'rxjs/operators';
import { UserDataAccessService } from '../../../shared';

export interface TermsPrivacySettingsView {
    text: string;
    status: 'loaded' | 'error' | 'loading';
}

@Component({
    selector: 'movius-web-terms-privacy-settings',
    templateUrl: './terms-privacy-settings.component.html',
    styleUrls: ['./terms-privacy-settings.component.scss'],
})
export class TermsPrivacySettingsComponent implements OnInit {
    view$: Observable<TermsPrivacySettingsView>;

    constructor(userDataAccess: UserDataAccessService) {
        const initial$ = of({
            text: null as string,
            status: 'loading' as 'loading',
        });
        const text$ = userDataAccess.getGDPRTerms().pipe(
            map((text) => ({ text, status: 'loaded' as 'loaded' })),
            catchError(() => of({ text: null, status: 'error' as 'error' }))
        );

        this.view$ = merge(initial$, text$);
    }

    ngOnInit(): void {}
}
