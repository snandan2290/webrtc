import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { PickerModule } from '@ctrl/ngx-emoji-mart';
import { NzDividerModule } from 'ng-zorro-antd/divider';
import { NzDropDownModule } from 'ng-zorro-antd/dropdown';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzLayoutModule } from 'ng-zorro-antd/layout';
import { NzToolTipModule } from 'ng-zorro-antd/tooltip';
import { NzPopoverModule } from 'ng-zorro-antd/popover';
import { NzListModule } from 'ng-zorro-antd/list';
import { NzImageModule, NzImageService } from 'ng-zorro-antd/image';
import { LinkyModule } from 'ngx-linky';
import { SharedModule } from '../shared';
import * as MC from './components';
import { MessagingRoutingModule } from './messaging-routing.module';
import { ClipboardModule } from '@angular/cdk/clipboard';
import { NzNotificationModule } from 'ng-zorro-antd/notification';
import { SettingsModule } from '../feature-settings';
import { ContactsModule } from '../feature-contacts';
import { ContactTitlePipe } from './pipes/contact-title.pipe';
import {A11yModule} from '@angular/cdk/a11y';
import {DragDropModule} from '@angular/cdk/drag-drop';
import {PortalModule} from '@angular/cdk/portal';
import {ScrollingModule} from '@angular/cdk/scrolling';
import {CdkStepperModule} from '@angular/cdk/stepper';
import {CdkTableModule} from '@angular/cdk/table';
import {CdkTreeModule} from '@angular/cdk/tree';
import {MatAutocompleteModule} from '@angular/material/autocomplete';
import {MatBadgeModule} from '@angular/material/badge';
import {MatBottomSheetModule} from '@angular/material/bottom-sheet';
import {MatButtonModule} from '@angular/material/button';
import {MatButtonToggleModule} from '@angular/material/button-toggle';
import {MatCardModule} from '@angular/material/card';
import {MatCheckboxModule} from '@angular/material/checkbox';
import {MatChipsModule} from '@angular/material/chips';
import {MatStepperModule} from '@angular/material/stepper';
import {MatDatepickerModule} from '@angular/material/datepicker';
import {MatDialogModule} from '@angular/material/dialog';
import {MatDividerModule} from '@angular/material/divider';
import {MatExpansionModule} from '@angular/material/expansion';
import {MatGridListModule} from '@angular/material/grid-list';
import {MatIconModule} from '@angular/material/icon';
import {MatInputModule} from '@angular/material/input';
import {MatListModule} from '@angular/material/list';
import {MatMenuModule} from '@angular/material/menu';
import {MatNativeDateModule, MatRippleModule} from '@angular/material/core';
import {MatPaginatorModule} from '@angular/material/paginator';
import {MatProgressBarModule} from '@angular/material/progress-bar';
import {MatProgressSpinnerModule} from '@angular/material/progress-spinner';
import {MatRadioModule} from '@angular/material/radio';
import {MatSelectModule} from '@angular/material/select';
import {MatSidenavModule} from '@angular/material/sidenav';
import {MatSliderModule} from '@angular/material/slider';
import {MatSlideToggleModule} from '@angular/material/slide-toggle';
import {MatSnackBarModule} from '@angular/material/snack-bar';
import {MatSortModule} from '@angular/material/sort';
import {MatTableModule} from '@angular/material/table';
import {MatTabsModule} from '@angular/material/tabs';
import {MatToolbarModule} from '@angular/material/toolbar';
import {MatTooltipModule} from '@angular/material/tooltip';
import {MatTreeModule} from '@angular/material/tree';
import {OverlayModule} from '@angular/cdk/overlay';
import { ThreadScrollDirective } from './components/messaging-workspace/thread-scroll.directive';
import { ChatScrollDirective } from './components/chat/chat-scroll.directive';
// import { HeaderComponent } from './components/header/header.component';

const nzModules = [
    NzLayoutModule,
    NzInputModule,
    NzDropDownModule,
    NzPopoverModule,
    NzDividerModule,
    NzNotificationModule,
    NzToolTipModule,
    NzImageModule,
    NzListModule
];

const matImports = [
    A11yModule,
    ClipboardModule,
    CdkStepperModule,
    CdkTableModule,
    CdkTreeModule,
    DragDropModule,
    MatAutocompleteModule,
    MatBadgeModule,
    MatBottomSheetModule,
    MatButtonModule,
    MatButtonToggleModule,
    MatCardModule,
    MatCheckboxModule,
    MatChipsModule,
    MatStepperModule,
    MatDatepickerModule,
    MatDialogModule,
    MatDividerModule,
    MatExpansionModule,
    MatGridListModule,
    MatIconModule,
    MatInputModule,
    MatListModule,
    MatMenuModule,
    MatNativeDateModule,
    MatPaginatorModule,
    MatProgressBarModule,
    MatProgressSpinnerModule,
    MatRadioModule,
    MatRippleModule,
    MatSelectModule,
    MatSidenavModule,
    MatSliderModule,
    MatSlideToggleModule,
    MatSnackBarModule,
    MatSortModule,
    MatTableModule,
    MatTabsModule,
    MatToolbarModule,
    MatTooltipModule,
    MatTreeModule,
    OverlayModule,
    PortalModule,
    ScrollingModule,
];
@NgModule({
    declarations: [
        MC.MessagingWorkspaceComponent,
        MC.ChatWorkspaceComponent,
        MC.ChatComponent,
        MC.MessageFormComponent,
        MC.StartWorkspaceComponent,
        MC.DetailsWorkspaceComponent,
        MC.ChatItemComponent,
        MC.EmptyMessagesComponent,
        MC.GroupMessageParticipantsComponent,
        MC.DisplaySelectedImageComponent,
        MC.WhatsAppTemplateComponent,
        MC.MessageContactSelectorComponent,
        MC.OptInWhatsappTemplateComponent,
        ContactTitlePipe,
        ThreadScrollDirective,
        ChatScrollDirective,
        // HeaderComponent
    ],
    imports: [
        CommonModule,
        FormsModule,
        SharedModule,
        ReactiveFormsModule,
        MessagingRoutingModule,
        LinkyModule,
        PickerModule,
        SettingsModule,
        ContactsModule,
        ClipboardModule,
        ...nzModules,
        ...matImports,
    ],
    exports: [MC.MessagingWorkspaceComponent],
})
export class MessagingModule {
    constructor() {}
}
