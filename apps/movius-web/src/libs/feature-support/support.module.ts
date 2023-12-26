import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDividerModule } from 'ng-zorro-antd/divider';
import { NzGridModule } from 'ng-zorro-antd/grid';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzLayoutModule } from 'ng-zorro-antd/layout';
import { NzListModule } from 'ng-zorro-antd/list';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzPopoverModule } from 'ng-zorro-antd/popover';
import { NzRadioModule } from 'ng-zorro-antd/radio';
import { NzSwitchModule } from 'ng-zorro-antd/switch';
import { SharedModule } from '../shared';
import { SupportWorkspaceComponent } from './components';
import { SupportRoutingModule } from './support-routing.module';

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
    NzModalModule,
    NzPopoverModule,
];

@NgModule({
    declarations: [SupportWorkspaceComponent],
    imports: [
        ...angularModules,
        SharedModule,
        SupportRoutingModule,
        ...nzModules,
    ],
    exports: [SupportWorkspaceComponent],
})
export class SupportModule {}
