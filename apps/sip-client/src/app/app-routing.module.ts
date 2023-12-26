import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router'; // CLI imports router
import { AudioPageComponent } from './audio/audio-page/audio-page.component';
import { ChatPageComponent } from './group-chat/chat-page/chat-page.component';
import { MultiAudioPanelComponent } from './multi-audio/multi-audio-panel/multi-audio-panel.component';
import { VideoPageComponent } from './video-page/video-page.component';

export const routes: Routes = [
    {
        path: '',
        pathMatch: 'full',
        redirectTo: 'chat',
    },
    {
        path: '',
        children: [
            { path: 'chat', component: ChatPageComponent },
            { path: 'video', component: VideoPageComponent },
            { path: 'audio', component: AudioPageComponent },
            { path: 'multi-audio', component: MultiAudioPanelComponent },
        ],
    },
]; // sets up routes constant where you define your routes

// configures NgModule imports and exports
@NgModule({
    imports: [RouterModule.forRoot(routes, { enableTracing: false })],
    exports: [RouterModule],
})
export class AppRoutingModule {}
