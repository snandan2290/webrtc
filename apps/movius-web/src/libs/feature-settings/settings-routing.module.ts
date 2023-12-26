import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import {
    ContactSettingsComponent,
    E911SettingsWorkspaceComponent,
    PasswordSettingsComponent,
    PrivacySettingsComponent,
    SettingsWorkspaceComponent,
    TermsPrivacySettingsComponent,
} from './components';

const routes: Routes = [
    {
        path: '',
        component: SettingsWorkspaceComponent,
        children: [
            {
                path: '',
                pathMatch: 'full',
                redirectTo: 'e911',
            },
            {
                path: 'e911',
                pathMatch: 'full',
                component: E911SettingsWorkspaceComponent,
            },
            {
                path: 'contact',
                pathMatch: 'full',
                component: ContactSettingsComponent,
            },
            {
                path: 'terms-privacy',
                pathMatch: 'full',
                component: TermsPrivacySettingsComponent,
            },
            {
                path: 'password',
                pathMatch: 'full',
                component: PasswordSettingsComponent,
            },
            {
                path: 'privacy-settings',
                pathMatch: 'full',
                component: PrivacySettingsComponent,
            },
        ],
    },
];

@NgModule({
    imports: [RouterModule.forChild(routes)],
    exports: [RouterModule],
})
export class SettingsRoutingModule {}
