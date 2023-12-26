import { DragDropModule } from '@angular/cdk/drag-drop';
import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzAutocompleteModule } from 'ng-zorro-antd/auto-complete';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDividerModule } from 'ng-zorro-antd/divider';
import { NzLayoutModule } from 'ng-zorro-antd/layout';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzNotificationModule } from 'ng-zorro-antd/notification';
import { NzPopoverModule } from 'ng-zorro-antd/popover';
import { SharedModule } from '../shared';
import { CallingRoutingModule } from './calling-routing.module';
import * as CC from './components/';

export const angularModules = [CommonModule, FormsModule];

export const nzModules = [
    NzLayoutModule,
    NzNotificationModule,
    NzModalModule,
    NzPopoverModule,
    NzAutocompleteModule,
    NzDividerModule,
    NzButtonModule,
];

@NgModule({
    declarations: [
        CC.CallingWorkspaceComponent,
        CC.ActiveOutgoingCallComponent,
        CC.ActiveIncomingCallComponent,
        CC.InactiveCallComponent,
        CC.CallWorkspaceComponent,
        CC.ActiveCallComponent,
        CC.ActiveOngoingCallComponent,
        CC.ActiveIncomingCallComponent,
        CC.PopoverCallComponent,
        CC.PopoverIncomingCallComponent,
        CC.PopoverOngoingCallComponent,
        CC.PopoverOutgoingCallComponent,
        CC.PopoverCallStackComponent,
        CC.PhoneKeyboardComponent,
        CC.NewCallWorkspaceComponent,
        CC.NewCallInactiveComponent,
        CC.TypeOfCallComponent,
        CC.CallControlButtonComponent,
        CC.OtherIncomingCallComponent,
        CC.OnHoldCallComponent,
        CC.EmptyCallsComponent,
        CC.CallTimerComponent,
        CC.LongPressDirective,
        CC.DetailsWorkspaceCallsComponent,
    ],
    imports: [
        ...angularModules,
        SharedModule,
        CallingRoutingModule,
        ...nzModules,
        DragDropModule,
    ],
    exports: [CC.CallingWorkspaceComponent],
    providers: [],
})
export class CallingModule {
    constructor() {}
}
