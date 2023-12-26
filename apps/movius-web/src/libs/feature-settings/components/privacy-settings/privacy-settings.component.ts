import {
    ChangeDetectionStrategy,
    ChangeDetectorRef,
    Component,
    OnInit,
} from '@angular/core';
import { Store } from '@ngrx/store';
import { NzModalService } from 'ng-zorro-antd/modal';
import { combineLatest, Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import {
    ConfirmDialogComponent,
    selectGDPRIsAccepted,
    selectProfile,
    setGDPRStatusAccepted,
    SipUserService,
} from '../../../shared';

export interface PrivacySettingsView {
    isAccepted: boolean;
    userEmail: string;
}

@Component({
    selector: 'movius-web-privacy-settings',
    templateUrl: './privacy-settings.component.html',
    styleUrls: ['./privacy-settings.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PrivacySettingsComponent {
    readonly view$: Observable<PrivacySettingsView>;
    getConnectionErrorValue: any;

    constructor(
        private readonly store: Store,
        private readonly modalService: NzModalService,
        private readonly cdr: ChangeDetectorRef
    ) {
        this.view$ = combineLatest([
            store.select(selectGDPRIsAccepted),
            store.select(selectProfile),
        ]).pipe(
            map(([isAccepted, profile]) => ({
                isAccepted,
                userEmail: profile.email,
            }))
        );
    }

    onTermsClicked(userEmail: string) {
        const win = window.open(`${window.location.origin}/login/tandc`);
        win.focus();
    }

    async onTermAcceptedChanged(userEmail: string, isAccepted: boolean) {
        if (!isAccepted) {
            const termsLink = `<a class="terms-link" href="${window.location.origin}/login/tandc" target="_blank">Terms & Conditions</a>`;
            const content = `This application requires the use of your personal data as defined in ${termsLink}. If you turn off the setting, you will no longer be able to use this service. Your admin will be notified.`;
            let ok = false;
            const ref = this.modalService.create({
                nzContent: ConfirmDialogComponent,
                nzComponentParams: {
                    titleTxt: 'Privacy Settings',
                    subTitleTxt: content,
                    applyBtnTxt: 'Turn Off',
                    cancelBtnTxt: 'Cancel',
                    onOkAction: () => {
                        ok = true;
                    },
                },
                nzBodyStyle: {
                    width: '26rem',
                },
                nzWidth: '26rem',
                nzFooter: null,
            });
            await ref.afterClose.toPromise();
            if (!ok) {
                return;
            }
        }
        this.store.dispatch(setGDPRStatusAccepted({ isAccepted }));
    }

    public getConnectionError(event: any) {
        this.getConnectionErrorValue = event;
    }
}
