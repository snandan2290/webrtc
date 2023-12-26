import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzListModule } from 'ng-zorro-antd/list';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { CallComponent } from './call/call.component';
import { IncomingCallComponent } from './incoming-call/incoming-call.component';
import { MultiAudioPanelComponent } from './multi-audio-panel.component';
import { OngoingCallComponent } from './ongoing-call/ongoing-call.component';
import { OutgoingCallComponent } from './outgoing-call/outgoing-call.component';

@NgModule({
    declarations: [
        MultiAudioPanelComponent,
        CallComponent,
        IncomingCallComponent,
        OutgoingCallComponent,
        OngoingCallComponent,
    ],
    imports: [
        BrowserModule,
        CommonModule,
        NzTabsModule,
        NzButtonModule,
        NzListModule,
        NzCardModule,
        NzIconModule,
    ],
    exports: [MultiAudioPanelComponent],
    providers: [],
})
export class MultiAudioPanelModule {}
