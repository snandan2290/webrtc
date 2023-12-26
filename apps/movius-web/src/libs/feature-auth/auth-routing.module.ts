import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import {
    AuthComponent,
    ConfirmComponent,
    ForgotPasswordComponent,
    ResetPasswordComponent,
} from './components';
import { LoginComponent } from './components/login/login.component';
import { PasswordComponent } from './components/password/password.component';
import { PinComponent } from './components/pin/pin.component';

const routes: Routes = [
    {
        path: '',
        component: AuthComponent,
        children: [
            {
                path: 'password',
                component: PasswordComponent,
            },
            {
                path: 'forgot-password',
                component: ForgotPasswordComponent,
            },
            {
                path: 'reset-password',
                component: ResetPasswordComponent,
            },
            {
                path: 'login',
                component: LoginComponent,
            },
            {
                path: 'pin',
                component: PinComponent,
            },
            {
                path: 'confirm',
                component: ConfirmComponent,
            },
        ],
    },
];

@NgModule({
    imports: [RouterModule.forChild(routes)],
    exports: [RouterModule],
})
export class AuthRoutingModule {}
