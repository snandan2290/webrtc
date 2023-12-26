import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { SharedModule } from '../shared';
import { AuthRoutingModule } from './auth-routing.module';
import {
    AuthComponent,
    ConfirmComponent,
    ForgotPasswordComponent,
    LoginComponent,
    PasswordComponent,
    PinComponent,
    ResetPasswordComponent,
} from './components';
import { ResetPasswordDataAccessService } from './services/reset-password.data-access.service';

const angularModules = [CommonModule, ReactiveFormsModule];

const routingModules = [AuthRoutingModule];

const ngZorroModules = [NzModalModule];

@NgModule({
    declarations: [
        AuthComponent,
        LoginComponent,
        PinComponent,
        PasswordComponent,
        ConfirmComponent,
        ResetPasswordComponent,
        ForgotPasswordComponent,
    ],
    imports: [
        ...angularModules,
        ...routingModules,
        SharedModule,
        ...ngZorroModules,
    ],
    providers: [ResetPasswordDataAccessService],
    exports: [
        AuthComponent,
        LoginComponent,
        PinComponent,
        PasswordComponent,
        ConfirmComponent,
    ],
})
export class AuthModule {}
