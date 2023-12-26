import { ChangeDetectorRef, Input, OnDestroy } from '@angular/core';
import { Component, OnInit, AfterViewInit } from '@angular/core';
import {
    FormGroup,
    AbstractControl,
    ValidatorFn,
    Validators,
    FormBuilder,
} from '@angular/forms';
import { debounceTime, distinctUntilChanged, takeUntil } from 'rxjs/operators';
import { Subject, BehaviorSubject, Observable } from 'rxjs';
import { matchValidator } from '../../../utils/auth-utils';
import { FormModel } from '../../../utils';
import { ResetPasswordDataAccessService } from 'apps/movius-web/src/libs/feature-auth/services/reset-password.data-access.service';


export interface ClientPasswordData {
    oldPassword: string;
    password: string;
    confirmPassword: string;
}

export interface ValidatorInfo {
    isValid: boolean;
    information: string;
}

class CustomValidators {
    //TODO: CB:30Oct2020: Extract common fn generator.
    static oneSpecialCharacterValidator(): ValidatorFn {
        return (control: AbstractControl): { [key: string]: any } | null => {
           const specialCharNotAllowed: string[] = [ '&' ,'|'];
            let hasSpecial = /.*(?=[^\p{L}0-9\s]).*/u.test(
                control.value
            );
            if (hasSpecial ===  true) {
                if (specialCharNotAllowed.some((char) => control.value.includes(char))) {
                    hasSpecial = false;
                }
            }
            return hasSpecial
                ? {}
                : { oneSpecialCharacterValidator: { value: control.value } };
        };
    }

    //TODO: CB:30Oct2020: Extract common fn generator.
    static oneUppercaseValidator(): ValidatorFn {
        return (control: AbstractControl): { [key: string]: any } | null => {
            const hasUppercase = /.*(?=[A-Z]).*/.test(control.value);
            return hasUppercase
                ? {}
                : { oneUppercaseValidator: { value: control.value } };
        };
    }

    //TODO: CB:30Oct2020: Extract common fn generator.
    static oneLowercaseValidator(): ValidatorFn {
        return (control: AbstractControl): { [key: string]: any } | null => {
            const hasLowercase = /.*(?=[a-z]).*/.test(control.value);
            return hasLowercase
                ? {}
                : { oneLowercaseValidator: { value: control.value } };
        };
    }

    //TODO: CB:30Oct2020: Extract common fn generator.
    static oneDigitValidator(): ValidatorFn {
        return (control: AbstractControl): { [key: string]: any } | null => {
            const hasDigit = /.*(?=[0-9]).*/.test(control.value);
            return hasDigit
                ? {}
                : { oneDigitValidator: { value: control.value } };
        };
    }
}

export type PwdFormStyle = 'Normal' | 'NoBorders';
export type ValidationStyle = 'Normal' | 'Wide';

@Component({
    selector: 'movius-web-pwd-form',
    templateUrl: './pwd-form.component.html',
    styleUrls: ['./pwd-form.component.scss'],
})
export class PwdFormComponent implements OnInit, OnDestroy, AfterViewInit {
    @Input() ignoreOldPassword = false;
    @Input() passwordInvalid;

    //readonly maxPwdLength: number = 20;

    static readonly specialCharValidatorText: string = 'one special character (eg: $, #, @, !,%,^,*,(,), etc.)';
    //TODO CB:30Oct2020: Sample pwd validators. Need reqs from Movius.
    static readonly pwdValidators: {
        [key: string]: { val: ValidatorFn; info: string };
    } = {
            [Validators.minLength.name.toLowerCase()]: {
                val: Validators.minLength(8),
                info: 'minimum 8 characters',
            },
            // [Validators.maxLength.name.toLowerCase()]: {
            //     val: Validators.maxLength(20),
            //     info: 'maximum 20 characters',
            // },
            [CustomValidators.oneSpecialCharacterValidator.name.toLowerCase()]: {
                val: CustomValidators.oneSpecialCharacterValidator(),
                info: PwdFormComponent.specialCharValidatorText,
            },
            [CustomValidators.oneUppercaseValidator.name.toLowerCase()]: {
                val: CustomValidators.oneUppercaseValidator(),
                info: 'one Uppercase',
            },
            [CustomValidators.oneLowercaseValidator.name.toLowerCase()]: {
                val: CustomValidators.oneLowercaseValidator(),
                info: 'one Lowercase',
            },
            [CustomValidators.oneDigitValidator.name.toLowerCase()]: {
                val: CustomValidators.oneDigitValidator(),
                info: 'one Number',
            },
        };

    @Input()
    style: PwdFormStyle = 'Normal';
    @Input()
    validation: ValidationStyle = 'Normal';

    //@Output()
    //reportOnSave: Subject<string> = new Subject<string>();

    complexityPwdValidators: {
        [key: string]: { val: ValidatorFn; info: string };
    };

    passwordForm: FormGroup;
    passedValidatorsPct$: BehaviorSubject<number> = new BehaviorSubject(0);
    validatorErrorInfo$: Subject<Array<ValidatorInfo>> = new Subject();

    isOldPwdVisible = false;
    isPwdVisible = false;
    isPwdConfirmVisible = false;

    private totalPwdComplexityValidators: number;
    private destroy$ = new Subject();

    constructor(
        private readonly _formBuilder: FormBuilder,
        private _cdr: ChangeDetectorRef,
        public resetPasswordDataAccess:ResetPasswordDataAccessService
    ) {}

    ngAfterViewInit() {
        this.processValidationChanged();
        this._cdr.detectChanges();
    }

    ngOnInit(): void {
        //#region Init validators

        const vldsEntries = Object.entries(PwdFormComponent.pwdValidators);

        const allValidators = vldsEntries.map(([key, value]) => value.val);
        const pwdValidators = [Validators.required, ...allValidators];
        const confirmValidators = [
            Validators.required,
            matchValidator('password'),
        ];

        this.complexityPwdValidators = Object.assign(
            {},
            ...vldsEntries
                .filter(
                    ([key, value]) =>
                        key != Validators.maxLength.name.toLowerCase()
                )
                .map(([k, v]) => ({ [k]: v }))
        );
        this.totalPwdComplexityValidators = Object.keys(
            this.complexityPwdValidators
        ).length;
        //#endregion Init validators

        //#region Init pwd form
        const modelPwd: FormModel<ClientPasswordData> = {
            oldPassword: [
                '',
                this.isOldPwdVisible ? Validators.required : undefined,
            ],
            password: [
                '',
                [...pwdValidators, matchValidator('confirmPassword')],
            ],
            confirmPassword: ['', confirmValidators],
        };
        this.passwordForm = this._formBuilder.group(modelPwd);
        //#endregion Init pwd form

        //#region Init complexity-calc logic
        this.passwordForm.valueChanges
            .pipe(
                debounceTime(200),
                distinctUntilChanged(),
                takeUntil(this.destroy$)
            )
            .subscribe((_) => {
                this.processValidationChanged();
            });
        //#endregion Init complexity-calc logic
    }

    private processValidationChanged() {
        let complexityErrorCount = 0;
        let pwdCtrl = this.passwordForm?.controls['password'];
        if (!!pwdCtrl) {
            let valRes: ValidatorInfo[];
            const allTypes = Object.keys(
                PwdFormComponent.pwdValidators
            ).map((e) => e.toLowerCase());
            if (pwdCtrl.errors) {
                const complexityTypes = Object.keys(
                    this.complexityPwdValidators
                ).map((e) => e.toLowerCase());

                let errors = Object.keys(pwdCtrl.errors).map((e) =>
                    e.toLowerCase()
                );
                const isEmpty = errors.includes(Validators.required.name);
                if (isEmpty) {
                    errors = complexityTypes;
                }
                const complexityErr = isEmpty
                    ? complexityTypes
                    : errors.filter((e) => complexityTypes.includes(e));
                const allErr = errors.filter((e) => allTypes.includes(e));
                complexityErrorCount += Object.keys(complexityErr).length;

                valRes = allTypes.map((e) => {
                    return {
                        isValid: !allErr.includes(e),
                        information: PwdFormComponent.pwdValidators[e].info,
                    };
                });
            } else {
                valRes = allTypes.map((e) => {
                    return {
                        isValid: true,
                        information: PwdFormComponent.pwdValidators[e].info,
                    };
                });
            }
            this.validatorErrorInfo$.next(valRes);
        }

        const passedPct =
            (this.totalPwdComplexityValidators - complexityErrorCount) /
            this.totalPwdComplexityValidators;
        this.passedValidatorsPct$.next(passedPct);

        this.passwordForm.controls['password'].updateValueAndValidity();
        this.passwordForm.controls['confirmPassword'].updateValueAndValidity();
    }

    /*onSave(){
        const val = this.passwordForm.value;
        this.reportOnSave.next(val);
    }*/

    clearAllFields() {
        this.passwordForm.controls['password'].setValue(null);
        this.passwordForm.controls['confirmPassword'].setValue(null);
        this.passwordForm.controls['oldPassword'].setValue(null);
        this.passwordForm.reset();
        this.resetPasswordDataAccess.passwordInvalid = false;
    }

    ngOnDestroy() {
        this.destroy$.next();
        this.destroy$.complete();
    }

    mapValidatorToFriendlyName(srcValidator: string) {
        if(srcValidator === PwdFormComponent.specialCharValidatorText){
            return this.validation === 'Wide' ? 'one special character (eg: $, #, @, !,%,^,* etc.)' : srcValidator
        }
        return srcValidator;
    }

    public validError(value:any){
        const password = value.target.value;
        const newPassword = this.passwordForm.controls['password'].value;
        const confirmPassword = this.passwordForm.controls['confirmPassword'].value
        const passwordValidationCondition = (newPassword !== null && newPassword.includes('|') || newPassword.includes('&')) || (confirmPassword !== null && confirmPassword.includes('|') || confirmPassword.includes('&'));
        if (passwordValidationCondition) {
            if (password.length >= 0 || password === '') {
                if (passwordValidationCondition || (password !== null && password.includes('|') || password.includes('&'))) {
                    this.resetPasswordDataAccess.passwordInvalid = true;
                } else {
                    this.resetPasswordDataAccess.passwordInvalid = false;
                }
            }
        } else {
            this.resetPasswordDataAccess.passwordInvalid = false;
        }
    }
}
