import { HttpErrorResponse } from '@angular/common/http';
import {
    ChangeDetectionStrategy,
    ChangeDetectorRef,
    Component,
    OnInit,
    ViewChild,
} from '@angular/core';
import { Actions, ofType } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import { NzModalService } from 'ng-zorro-antd/modal';
import { NzNotificationService } from 'ng-zorro-antd/notification';
import { merge, Observable, Subject } from 'rxjs';
import { mapTo, startWith, takeUntil } from 'rxjs/operators';
import {
    logout,
    updatePassword,
    updatePasswordFails,
    updatePasswordSuccess,
} from '../../../shared/';
import { PwdFormComponent } from '../../../shared/components/password/pwd-form/pwd-form.component';

export type ResultType = 'None' | 'Error' | 'Success';
export interface NewPasswordData {
    password: string;
    retypedPassword: string;
}

const getApiErrorMessage = (error: HttpErrorResponse) => {
    const internalError = error.error;
    if (internalError) {
        if (internalError.apiReturnCode === 13000) {
            return 'Invalid Credentials';
        } else if(internalError.apiReturnCode === 25001){
            return 'The username or password you entered do not match.';
        }else if (
            internalError.apiReturnCode === 23501 ||
            internalError.apiReturnCode === 23502
        ) {
            return 'Account is not active. Please contact your administrator for further assistance';
        } else if (internalError.apiReturnCode === 23701) {
            return 'MultiLine Desktop is disabled for your Organization, please contact your administrator.';
        }
    }
    return error.statusText === 'Unknown Error'
        ? 'Authentication failed'
        : error.statusText;
};

@Component({
    selector: 'movius-web-password-settings',
    templateUrl: './password-settings.component.html',
    styleUrls: ['./password-settings.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PasswordSettingsComponent implements OnInit {
    @ViewChild('pwdForm') pwdForm: PwdFormComponent;

    isSaving$: Observable<boolean>;
    errorMessage: string;

    private readonly destroy$ = new Subject();
    resultType: ResultType = 'None';

    constructor(
        actions: Actions,
        private readonly store: Store,
        private readonly notification: NzNotificationService,
        cdr: ChangeDetectorRef,
        private readonly modalService: NzModalService,
    ) {
        this.isSaving$ = merge(
            actions.pipe(ofType(updatePassword), mapTo(true)),
            actions.pipe(
                ofType(updatePasswordSuccess, updatePasswordFails),
                mapTo(false)
            )
        ).pipe(startWith(false));

        actions
            .pipe(ofType(updatePasswordSuccess), takeUntil(this.destroy$))
            .subscribe((r) => {
                // this.createSuccessMessage();
                this.resultType = 'Success';
                cdr.markForCheck();
            });

        actions
            .pipe(ofType(updatePasswordFails), takeUntil(this.destroy$))
            .subscribe((resp) => {
                const msg = getApiErrorMessage(resp.error);
                this.errorMessage = msg;
                this.resultType = 'Error';
                cdr.markForCheck();
            });
    }

    ngOnInit(): void {}

    onSave(val) {
        if(val.password !== '' && !(val['password'].includes('|') || val['password'].includes('&'))){
            this.store.dispatch(
                updatePassword({
                    oldPassword: val.oldPassword,
                    newPassword: val.password,
                    otp: null,
                    onSuccess: 'logout',
                })
            );
        } else {
            this.errorMessage = 'Invalid Password';
            this.resultType = 'Error';
        }
    }

    clearAllFields() {
        this.pwdForm.clearAllFields();
        this.errorMessage = '';
        this.resultType = 'None';
        this.modalService.closeAll()
    }

    createSuccessMessage(): void {
        this.notification.blank('The password is changed.', null, {
            nzClass: 'custom-notification--success',
            nzCloseIcon: null,
        });
    }

    createErrorMessage(error = ''): void {
        error = !!error ? ` ${error}` : error;
        this.notification.blank(
            'The password is not changed.' + error + '.',
            null,
            {
                nzClass: 'custom-notification--error',
                nzCloseIcon: null,
            }
        );
    }

    ngOnDestroy() {
        this.destroy$.next();
    }
}
