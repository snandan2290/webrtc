import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDividerModule } from 'ng-zorro-antd/divider';
import { NzDropDownModule } from 'ng-zorro-antd/dropdown';
import { NzGridModule } from 'ng-zorro-antd/grid';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzLayoutModule } from 'ng-zorro-antd/layout';
import { NzListModule } from 'ng-zorro-antd/list';
import { NzNotificationModule } from 'ng-zorro-antd/notification';
import { NzRadioModule } from 'ng-zorro-antd/radio';
import { NzSwitchModule } from 'ng-zorro-antd/switch';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { SharedModule } from '../shared';
import {
    ConnectContactSettingsComponent,
    ContactSettingsComponent,
    E911AddressEditComponent,
    E911AddressListComponent,
    E911AddressViewComponent,
    E911EditFormComponent,
    E911SettingsWorkspaceComponent,
    EmergencySettingsComponent,
    PasswordSettingsComponent,
    PrivacySettingsComponent,
    SettingsWorkspaceComponent,
    TermsPrivacySettingsComponent,
} from './components';
import { SettingsRoutingModule } from './settings-routing.module';
import { ResetPasswordDataAccessService } from '../feature-auth/services/reset-password.data-access.service';

const angularModules = [CommonModule, FormsModule, ReactiveFormsModule];
const nzModules = [
    NzLayoutModule,
    NzGridModule,
    NzInputModule,
    NzSwitchModule,
    NzDividerModule,
    NzButtonModule,
    NzListModule,
    NzRadioModule,
    NzDropDownModule,
    NzNotificationModule,
    NzAlertModule,
];

@NgModule({
    declarations: [
        SettingsWorkspaceComponent,
        EmergencySettingsComponent,
        ContactSettingsComponent,
        ConnectContactSettingsComponent,
        TermsPrivacySettingsComponent,
        PasswordSettingsComponent,
        PrivacySettingsComponent,
        E911AddressListComponent,
        E911EditFormComponent,
        E911AddressViewComponent,
        E911SettingsWorkspaceComponent,
        E911AddressEditComponent,
    ],
    imports: [
        ...angularModules,
        SharedModule,
        SettingsRoutingModule,
        ...nzModules,
    ],
    providers:[ResetPasswordDataAccessService],
    exports: [SettingsWorkspaceComponent],
})
export class SettingsModule {}
