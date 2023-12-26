import {
    ChangeDetectionStrategy,
    ChangeDetectorRef,
    Component,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Observable, Subject, timer } from 'rxjs';
import { scan, takeUntil, takeWhile } from 'rxjs/operators';
import { ResetPasswordDataAccessService } from '../../services/reset-password.data-access.service';
import { Store } from '@ngrx/store';
import {
    updatePassword,
} from '../../../shared';

@Component({
    selector: 'movius-web-reset-password',
    templateUrl: './reset-password.component.html',
    styleUrls: ['./reset-password.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ResetPasswordComponent {
    error: string;
    lockButton = false;
    email: string;
    otp: string;
    destroy$ = new Subject();

    timer$: Observable<number> = timer(0, 1000).pipe(
        scan((acc) => --acc, 15 * 60),
        takeUntil(this.destroy$),
        takeWhile((x) => x >= 0)
    );

    constructor(
        private readonly route: ActivatedRoute,
        public readonly resetPasswordDataAccess: ResetPasswordDataAccessService,
        private readonly router: Router,
        private readonly cdr: ChangeDetectorRef,
        private readonly store: Store,
    ) {
        this.email = this.route.snapshot.params['email'] || this.route.snapshot.queryParamMap.get('email');
        this.otp = this.route.snapshot.params['otp'] || this.route.snapshot.queryParamMap.get('otp');

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

    async onReset({ password }: { password: string }) {
        this.lockButton = true;
        if(password !== '' && !(password.includes('|') || password.includes('&'))){
            try {
                // await this.resetPasswordDataAccess
                //     .updatePassword(this.email, password, this.otp)
                //     .toPromise();
                //this.router.navigate(['/auth/login']);
                this.store.dispatch(
                    updatePassword({
                        newPassword: password,
                        oldPassword: null,
                        otp: this.otp,
                        onSuccess: 'login',
                    })
                );
                this.destroy$.next();
            } catch (err) {
                this.lockButton = false;
                this.error = err.error.message;
                this.cdr.markForCheck();
            }
        }
    }
}
