import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import {A11yModule} from '@angular/cdk/a11y';
import {ClipboardModule} from '@angular/cdk/clipboard';
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
import { EffectsModule } from '@ngrx/effects';
import { StoreModule } from '@ngrx/store';
import { NzAutocompleteModule } from 'ng-zorro-antd/auto-complete';
import { NzDropDownModule } from 'ng-zorro-antd/dropdown';
import { NzGridModule } from 'ng-zorro-antd/grid';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzLayoutModule } from 'ng-zorro-antd/layout';
import { NzPopoverModule } from 'ng-zorro-antd/popover';
import { NzProgressModule } from 'ng-zorro-antd/progress';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzDatePickerModule } from 'ng-zorro-antd/date-picker';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzTagModule } from 'ng-zorro-antd/tag';
import * as ShC from './components';
import * as ShD from './directives';
import * as ShP from './pipes';
import { AppEffects, appReducer, UserEffects, userReducer } from './ngrx';
import * as ShU from './utils';
import { LoadingComponent } from './components/loading/loading.component';
import { LoadSpinnerComponent } from './components/load-spinner/load-spinner.component';
import { AudioPlayerComponent } from './components/audio-player/audio-player.component';
import { TeamsErrorDisplayComponent } from './components';
import {HeaderComponent} from"../shared/components/header/header.component";
import { SpinnerComponent } from './components/spinner/spinner.component'

const nzImports = [
    NzLayoutModule,
    NzInputModule,
    NzAutocompleteModule,
    NzGridModule,
    NzDropDownModule,
    NzProgressModule,
    NzTagModule,
    NzSelectModule,
    NzIconModule,
    NzPopoverModule,
    NzDatePickerModule,
    NzInputNumberModule,
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

const angularImports = [CommonModule, FormsModule, ReactiveFormsModule];

@NgModule({
    declarations: [
        ShC.CommunicationItemComponent,
        ShC.PaneFrameComponent,
        ShC.SampleComponent,
        ShC.SearchBarComponent,
        ShC.SearchBarMessageLoginComponent,
        ShC.ContactSelectorComponent,
        ShC.ContactHeaderComponent,
        ShC.LabeledButtonComponent,
        ShC.EmergencyTermsComponent,
        ShC.CountrySelectorComponent,
        ShC.OnboardingComponent,
        ShD.HoverClassDirective,
        ShC.ContactDetailsComponent,
        ShC.UiSlideInputComponent,
        ShC.ContactSyncGainComponent,
        ShC.ContactSyncFailComponent,
        ShC.PwdFormComponent,
        ShC.PwdStrengthComponent,
        ShC.UiCtaButtonComponent,
        ShC.UiSlidingToggleSwitchComponent,
        ShC.ShowErrorsComponent,
        ShC.ContactLogoComponent,
        ShC.HighlightedTextComponent,
        ShC.AddToExistingContactComponent,
        ShU.CamelCapPipe,
        ShD.NgZorroKeepDropdownDirective,
        ShC.ConfirmDialogComponent,
        ShC.SelectContactsDialogComponent,
        ShC.UiSlideDropdownComponent,
        ShD.OneNumberInputDirective,
        ShC.SharedDetailsWorkspaceComponent,
        ShC.GeneralFailureComponent,
        ShC.AccessDeniedContainer,
        LoadingComponent,
        LoadSpinnerComponent,
        ShC.AudioPlayerComponent,
        TeamsErrorDisplayComponent,
        ShP.HighlighterPipe,
        ShC.CustomerHelpDetailsComponent,
        ShC.MessageChannelTypeIconComponent,
        HeaderComponent,
        SpinnerComponent
    ],
    imports: [
        ...nzImports,
        ...angularImports,
        ...matImports,
        EffectsModule.forFeature([UserEffects, AppEffects]),
        StoreModule.forFeature('user', userReducer),
        StoreModule.forFeature('app', appReducer),
        ScrollingModule,
    ],
    exports: [
        ShC.CommunicationItemComponent,
        ShC.PaneFrameComponent,
        ShC.SampleComponent,
        ShC.SearchBarComponent,
        ShC.SearchBarMessageLoginComponent,
        ShC.ContactSelectorComponent,
        ShC.ContactHeaderComponent,
        ShC.LabeledButtonComponent,
        ShC.CountrySelectorComponent,
        ShC.ContactDetailsComponent,
        ShC.UiSlideInputComponent,
        ShC.UiSlideDropdownComponent,
        ShC.UiCtaButtonComponent,
        ShC.UiSlidingToggleSwitchComponent,
        ShC.ContactSyncGainComponent,
        ShC.ContactSyncFailComponent,
        ShC.PwdFormComponent,
        ShC.PwdStrengthComponent,
        ShC.ShowErrorsComponent,
        ShC.ContactLogoComponent,
        ShC.AddToExistingContactComponent,
        ShU.CamelCapPipe,
        ShD.NgZorroKeepDropdownDirective,
        ShD.OneNumberInputDirective,
        ShC.SharedDetailsWorkspaceComponent,
        ShC.GeneralFailureComponent,
        ShC.AudioPlayerComponent,
        ShC.AccessDeniedContainer,
        ShC.HighlightedTextComponent,
        ShP.HighlighterPipe,
        ShC.MessageChannelTypeIconComponent,
        HeaderComponent,
        SpinnerComponent
    ],
    providers: [],
})
export class SharedModule {}
