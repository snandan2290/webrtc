import {
    AfterViewInit,
    ChangeDetectionStrategy,
    ChangeDetectorRef,
    Component,
    OnInit,
} from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ResetPasswordDataAccessService } from '../../services/reset-password.data-access.service';

@Component({
    selector: 'movius-web-forgot-password',
    templateUrl: './forgot-password.component.html',
    styleUrls: ['./forgot-password.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ForgotPasswordComponent implements OnInit {
    error: string;
    emailForm: FormGroup;
    lockButton = false;
    constructor(
        private readonly formBuilder: FormBuilder,
        private readonly resetPasswordDataAccess: ResetPasswordDataAccessService,
        private readonly router: Router,
        private readonly activatedRoute: ActivatedRoute,
        private readonly cdr: ChangeDetectorRef
    ) {}

    ngOnInit(): void {
        const email = this.activatedRoute.snapshot.params['email'];
        //#region Init email form
        const modelEmail = {
            email: [email || '', [Validators.required, Validators.email]],
        };
        this.emailForm = this.formBuilder.group(modelEmail);
        this.onForgot();
    }

    async onForgot() {
        this.lockButton = true;
        const email = this.emailForm.value.email;
        try {
            await this.resetPasswordDataAccess
                .triggerResetPassword(email)
                .toPromise();
            this.router.navigate([
                '/auth/pin',
                { email, isResetPassword: true },
            ]);
        } catch (err) {
            this.lockButton = false;
            this.error = 'User with this email does not exist';
            this.cdr.markForCheck();
        }
    }
}
