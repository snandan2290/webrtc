import {
    AfterViewInit,
    ChangeDetectionStrategy,
    ChangeDetectorRef,
    Component,
    OnInit,
} from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Actions, ofType } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import { merge, Observable, Subject, timer } from 'rxjs';
import { mapTo, scan, startWith, takeUntil, takeWhile } from 'rxjs/operators';
import {
    formatPhoneToNationalPasswordPage,
    formatPhoneToNational,
    updatePassword,
    updatePasswordFails,
    updatePasswordSuccess,
} from '../../../shared';
import { ResetPasswordDataAccessService } from '../../services/reset-password.data-access.service';

@Component({
    selector: 'movius-web-password',
    templateUrl: './password.component.html',
    styleUrls: ['./password.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PasswordComponent implements OnInit, AfterViewInit {
    readonly isNewPassword: boolean;

    emailForm: FormGroup;

    isForgotPwdSent = false;
    isResetPwdMode = true;
    destroy$ = new Subject();
    otp: string;

    multilineNumberAssigned: string;
    isSaving$: Observable<boolean>;

    timer$: Observable<number> = timer(0, 1000).pipe(
        scan((acc) => --acc, 15 * 60),
        takeUntil(this.destroy$),
        takeWhile((x) => x >= 0)
    );
    
    constructor(
        private readonly _formBuilder: FormBuilder,
        private readonly activatedRoute: ActivatedRoute,
        private _cdr: ChangeDetectorRef,
        private readonly store: Store,
        actions: Actions,
        private readonly resetPasswordDataAccess: ResetPasswordDataAccessService,
        private readonly router: Router
    ) {
        this.isSaving$ = merge(
            actions.pipe(ofType(updatePassword), mapTo(true)),
            actions.pipe(
                ofType(updatePasswordSuccess, updatePasswordFails),
                mapTo(false)
            )
        ).pipe(startWith(false));

        this.isResetPwdMode = !this.activatedRoute.snapshot.queryParams[
            'set_new'
        ];
        this.isNewPassword = !this.activatedRoute.snapshot.queryParams[
            'forgot'
        ];
        this.multilineNumberAssigned = this.activatedRoute.snapshot.queryParams[
            'identity'
        ];

        this.otp = this.activatedRoute.snapshot.queryParams['otp'];

        this.timer$.subscribe({
            next: (val) => {
                if (val === 0) {
                    router.navigate([
                        '/auth/login',
                        { info: 'timeoutExpired' },
                    ]);
                }
            },
        });
    }

    ngOnInit(): void {
        sessionStorage.setItem("pwd_change","true");
        const modelEmail = {
            email: ['', [Validators.required, Validators.email]],
        };
        this.emailForm = this._formBuilder.group(modelEmail);
    }

    ngAfterViewInit() {
        this._cdr.detectChanges();
    }

    async onSave(val) {
        if(val.password !== '' && !(val['password'].includes('|') || val['password'].includes('&'))){
            this.store.dispatch(
                updatePassword({
                    newPassword: val.password,
                    oldPassword: null,
                    otp: this.otp,
                    onSuccess: 'login',
                })
            );
            this.destroy$.next();
        } else {
            this.resetPasswordDataAccess.passwordInvalid = true;
        }
    }

    async onForgot() {
        const email = this.emailForm.value.email;
        await this.resetPasswordDataAccess
            .triggerResetPassword(email)
            .toPromise();
        this.isForgotPwdSent = true;
        this.router.navigate(['/auth/pin', { email, isResetPassword: true }], {
            queryParamsHandling: 'merge',
        });
    }

    formatNumber = formatPhoneToNationalPasswordPage;
}
