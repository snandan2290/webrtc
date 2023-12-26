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
import { SharedModule } from '../shared';
import {
    AddPhotoComponent,
    ContactInformationComponent,
    ContactsWorkspaceComponent,
    SyncContactsComponent,
} from './components';
import { EditContactModule } from './components/edit-contact/edit-contact.module';
import { ContactsRoutingModule } from './contacts-routing.module';
import { MsGraphContactsSyncSchedulerService } from './services';
import { SuchAsPipe } from './utils';
import { ScrollingModule } from '@angular/cdk/scrolling';

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
        ContactsWorkspaceComponent,
        ContactInformationComponent,
        SuchAsPipe,
        SyncContactsComponent,
        AddPhotoComponent,
    ],
    providers: [SuchAsPipe, MsGraphContactsSyncSchedulerService],
    imports: [
        EditContactModule,
        ...angularModules,
        SharedModule,
        ContactsRoutingModule,
        ...nzModules,
        ScrollingModule,
    ],
    exports: [ContactsWorkspaceComponent],
})
export class ContactsModule {}
