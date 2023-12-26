import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDividerModule } from 'ng-zorro-antd/divider';
import { NzDropDownModule } from 'ng-zorro-antd/dropdown';
import { NzGridModule } from 'ng-zorro-antd/grid';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzLayoutModule } from 'ng-zorro-antd/layout';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSwitchModule } from 'ng-zorro-antd/switch';
import { NzUploadModule } from 'ng-zorro-antd/upload';
import { SharedModule } from '../../../shared';
import { EditContactNameComponent } from './edit-contact-name/edit-contact-name.component';
import { EditContactLayoutComponent } from './edit-contact-layout/edit-contact-layout.component';
import { EditContactEmailsComponent } from './edit-contact-emails/edit-contact-emails.component';
import { EditContactPhonesComponent } from './edit-contact-phones/edit-contact-phones.component';
import { EditContactAddressesComponent } from './edit-contact-addresses/edit-contact-addresses.component';
import { EditContactWorkComponent } from './edit-contact-work/edit-contact-work.component';
import { EditContactOtherComponent } from './edit-contact-other/edit-contact-other.component';

const angularModules = [CommonModule, FormsModule, ReactiveFormsModule];
const nzModules = [
    NzLayoutModule,
    NzGridModule,
    NzInputModule,
    NzSwitchModule,
    NzDividerModule,
    NzButtonModule,
    NzModalModule,
    NzSelectModule,
    NzUploadModule,
    NzDropDownModule,
];

@NgModule({
    declarations: [
        EditContactLayoutComponent,
        EditContactNameComponent,
        EditContactEmailsComponent,
        EditContactPhonesComponent,
        EditContactAddressesComponent,
        EditContactWorkComponent,
        EditContactOtherComponent,
    ],
    imports: [...angularModules, SharedModule, ...nzModules],
    exports: [EditContactLayoutComponent],
})
export class EditContactModule {}
