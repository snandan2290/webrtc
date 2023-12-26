import {
    ChangeDetectionStrategy,
    Component,
    OnDestroy,
    OnInit,
    ViewChildren,
} from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Actions, ofType } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import { BehaviorSubject, merge, Observable, Subject, timer } from 'rxjs';
import {
    map,
    mapTo,
    scan,
    startWith,
    takeUntil,
    takeWhile,
} from 'rxjs/operators';
import {
    activateUser,
    activateUserFails,
    activateUserSuccess,
    AuthService,
    getMinutes,
    getSeconds,
} from '../../../shared';
import { ResetPasswordDataAccessService } from '../../services/reset-password.data-access.service';

@Component({
    selector: 'movius-web-pin',
    templateUrl: './pin.component.html',
    styleUrls: ['./pin.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PinComponent implements OnInit, OnDestroy {
    @ViewChildren('inputs') inputs;

    pinForm: FormGroup;
    pinCount = 6;
    pinFields: any;

    destroy$ = new Subject();
    isSending$: Observable<boolean>;
    isResetPassword: boolean;
    email: string;
    newWebSignIn = false;

    timer$: Observable<number> = timer(0, 1000).pipe(
        scan((acc) => --acc, 5 * 60),
        takeUntil(this.destroy$),
        takeWhile((x) => x >= 0)
    );

    timerResendPin$: Observable<number> = timer(0, 1000).pipe(
        scan((acc) => --acc, 2 * 60),
        takeUntil(this.destroy$),
        takeWhile((x) => x >= 0)
    );

    readonly resetError$ = new BehaviorSubject<string>(null);
    readonly error$: Observable<string>;
    onPressResendOption: boolean = false;
    isDisabledResend = 'pin__resend';

    constructor(
        private readonly _formBuilder: FormBuilder,
        private readonly store: Store,
        private readonly activatedRoute: ActivatedRoute,
        actions: Actions,
        private readonly router: Router,
        private readonly resetPasswordDataAccessService: ResetPasswordDataAccessService,
        private readonly authService: AuthService
    ) {
        const pinValidators = [Validators.required, Validators.maxLength(1)];
        const model = {};

        //TODO CB:14Oct2020: Implement typed generic solution.
        this.pinFields = [...new Array(6).keys()].map((e) => 'digit' + e);
        for (let el of this.pinFields) {
            model[el] = ['', pinValidators];
        }

        this.pinForm = this._formBuilder.group(model);

        // 1 - invited
        // 2 - onboarded with MML or web client
        // TODO : Don't need to call when state is 2 !!!
        this.isSending$ = merge(
            actions.pipe(ofType(activateUser), mapTo(true)),
            actions.pipe(
                ofType(activateUserSuccess, activateUserFails),
                mapTo(false)
            )
        ).pipe(startWith(false));

        const activateError$ = actions.pipe(
            ofType(activateUserFails),
            map(({ error }) => {
                return error.message;
            })
        );

        this.error$ = merge(activateError$, this.resetError$);

        this.isResetPassword = this.activatedRoute.snapshot.params[
            'isResetPassword'
        ];
        this.email =
            this.activatedRoute.snapshot.params['email'] ||
            this.activatedRoute.snapshot.queryParams['name'];

        this.newWebSignIn =
            this.activatedRoute.snapshot.params['newWebSignIn'] === 'true';

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
        sessionStorage.setItem("pin_page","true");
        this.onPressResendOption = true;
        this.isDisabledResend = 'pin_title';
        this.timerResendPin$.subscribe({
            next: (val) => {
                if (val === 0) {
                    this.onPressResendOption = false;
                    this.isDisabledResend = 'pin__resend';
                    this.onPressResendOption = false;
                }
            },
        });
     }

    ngOnDestroy() {
        this.destroy$.next();
    }

    async onSubmit() {
        const otpVal = this.pinForm.value;
        const otp =
            otpVal['digit0'].toString() +
            otpVal['digit1'].toString() +
            otpVal['digit2'].toString() +
            otpVal['digit3'].toString() +
            otpVal['digit4'].toString() +
            otpVal['digit5'].toString();
        if (!this.isResetPassword && this.isResetPassword !== undefined && !this.newWebSignIn) {
            const data = this.activatedRoute.snapshot.queryParams;
            this.store.dispatch(activateUser({ otp, data: data as any }));
        } else {
            let isPinValid;
            // We don't need this try block here,
            try {
                isPinValid = await this.resetPasswordDataAccessService
                    .verifyPin(this.email, otp, this.authService.apiAuthToken).toPromise();
            } catch (e) {
                // This will again cause Exception, which is not handled. Hence commenting out
                // isPinValid = null;  
            }
            if (isPinValid === undefined) {
                this.resetError$.next('Incorrect PIN');
            } else {
                const data = this.activatedRoute.snapshot.queryParams;
                this.store.dispatch(activateUser({ otp, data: data as any }));
                this.destroy$.next();
                if(this.isResetPassword !== undefined){
                    this.router.navigate(['/auth/reset-password'], {
                        queryParamsHandling: 'merge',
                        queryParams: { otp, email: this.email },
                    });
                } else {
                    this.router.navigate(['/auth', 'password'], {
                        queryParams: { set_new: true, ...data, otp },
                    });
                }
            }
        }
    }

    async onResendPin() {
        if (this.onPressResendOption === false) {
            this.onPressResendOption = true;
            this.isDisabledResend = 'pin_title';
            this.timerResendPin$.subscribe({
                next: (val) => {
                    if (val === 0) {
                        this.onPressResendOption = false;
                        this.isDisabledResend = 'pin__resend';
                        this.onPressResendOption = false;
                    }
                },
            });
            if (!this.isResetPassword) {
                await this.resetPasswordDataAccessService
                    .resendPin(
                        this.email,
                        this.authService.apiAuthToken,
                        this.authService.apiAuthOrgId
                    )
                    .toPromise();
            } else {
                await this.resetPasswordDataAccessService
                    .triggerResetPassword(this.email)
                    .toPromise();
            }
        }

    }

    public onPastePin(event: ClipboardEvent){
        let clipboardData = event.clipboardData;
        let spittedValue = clipboardData.getData('text').split('');
        this.pinForm.patchValue({
            'digit0':spittedValue[0],
            'digit1':spittedValue[1],
            'digit2':spittedValue[2],
            'digit3':spittedValue[3],
            'digit4':spittedValue[4],
            'digit5':spittedValue[5],
        }); 
    }

    onPinInput(itemIndex: number, event: InputEvent) {
        //CB: TECH: 13May2021: Also possible with <input type="text" maxlength="1" oninput="this.value=this.value.replace(/[^0-9]/g,'');">
        //CB: TECH: 13May2021: Consider simplify.
        //this.cropInputToSingle(itemIndex, event);
        if (event?.data?.replace(/[^0-9]*/g, '')?.length === 0) {
            //No move focus on non-digit input
            return;
        }

        this.resetError$.next(null);

        if (
            event.inputType === 'deleteContentBackward' ||
            itemIndex >= this.pinCount - 1
        ) {
            return;
        }
        if(event.inputType !== 'deleteContentForward'){
            this.inputs?.find((_, i) => i === itemIndex + 1)?.nativeElement.focus();
        }
    }

    onKeyPress(itemIndex: number, event: any){
        if(event.keyCode === 8 && event.keyCode === 46){
            this.inputs?.find((_, i) => i === itemIndex)?.nativeElement.focus();
        }
        if(event.keyCode === 37){
            this.inputs?.find((_, i) => i === itemIndex - 1)?.nativeElement.focus();
        }
        if(event.keyCode === 39){
            this.inputs?.find((_, i) => i === itemIndex + 1)?.nativeElement.focus();
        }
    }

    onPinClear(itemIndex: number) {
        this.resetError$.next(null);
        if (itemIndex <= 0) {
            return;
        }
        //this.inputs?.find((_, i) => i === itemIndex - 1)?.nativeElement.focus();
    }

    clearPin() {
        this.resetError$.next(null);
        for (const pin of this.pinFields) {
            this.pinForm.controls[pin].setValue('');
        }
        this.inputs?.toArray()[0]?.nativeElement.focus();
    }

    getMinutes = getMinutes;

    getSeconds = getSeconds;
}
