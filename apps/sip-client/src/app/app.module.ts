import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { IconDefinition } from '@ant-design/icons-angular';
import * as AllIcons from '@ant-design/icons-angular/icons';
import { SipConfig, SipModule } from '@scalio/sip';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NZ_ICONS } from 'ng-zorro-antd/icon';
import { NzListModule } from 'ng-zorro-antd/list';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { environment } from '../environments/environment';
import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { AudioPageComponent } from './audio/audio-page/audio-page.component';
import { AudioPanelComponent } from './audio/audio-panel/audio-panel.component';
import { ChatMessageComponent } from './group-chat/chat-message/chat-message.component';
import { ChatMessagesComponent } from './group-chat/chat-messages/chat-messages.component';
import { ChatPageComponent } from './group-chat/chat-page/chat-page.component';
import { ChatComponent } from './group-chat/chat/chat.component';
import { MultiAudioPageComponent } from './multi-audio/multi-audio-page/multi-audio-page.component';
import { MultiAudioPanelModule } from './multi-audio/multi-audio-panel/multi-audio-panel.module';
import { VideoPageComponent } from './video-page/video-page.component';

const antDesignIcons = AllIcons as {
    [key: string]: IconDefinition;
};

const icons: IconDefinition[] = Object.keys(antDesignIcons).map(
    (key) => antDesignIcons[key]
);

const sipConfig: SipConfig = {
    ...environment.sip,
    onFixContactRegisterer: (options, contact, registerer) => {
        // Fix contact to work with movius server
        // take VIA token
        const token = /<sip:(\w+)\@([\w\.]+)/.exec(contact.toString())[2];
        const user = options.uri.user;
        const contactHeaderValue = `"${user}"<sips:${user}@${token};rtcweb-breaker=yes;transport=wss>;click2call=no;+g.oma.sip-im;+audio;language="en"`;
        contact.uri.user = user;
        registerer['generateContactHeader'] = (expires) => {
            return contactHeaderValue;
        };
    },
};

@NgModule({
    declarations: [
        AppComponent,
        ChatPageComponent,
        VideoPageComponent,
        AudioPageComponent,
        MultiAudioPageComponent,
        ChatComponent,
        ChatMessagesComponent,
        ChatMessageComponent,
        AudioPanelComponent,
    ],
    imports: [
        BrowserModule,
        CommonModule,
        SipModule.forRoot(sipConfig),
        AppRoutingModule,
        NzTabsModule,
        NzButtonModule,
        NzListModule,
        MultiAudioPanelModule,
    ],
    providers: [
        {
            provide: NZ_ICONS,
            useValue: icons,
        },
    ],
    bootstrap: [AppComponent],
})
export class AppModule {}
