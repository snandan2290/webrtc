import { AfterContentInit, Component, OnDestroy, OnInit } from '@angular/core';
import { SipUser, SipService } from '@scalio/sip';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { ParticipantsProvider } from '../audio-panel/audio-panel.component';

const getAudioElement = (id: string) => {
    const el = document.getElementById(id);
    if (!(el instanceof HTMLAudioElement)) {
        throw new Error(`Element "${id}" not found or not a audio element.`);
    }
    return el;
};

@Component({
    selector: 'movius-web-audio-page',
    templateUrl: './audio-page.component.html',
    styleUrls: ['./audio-page.component.scss'],
    providers: [ParticipantsProvider],
})
export class AudioPageComponent {
    constructor(private readonly participantsProvider: ParticipantsProvider) {}

    onUserConnected(user: SipUser) {
        this.participantsProvider.participants.next([
            ...this.participantsProvider.participants.value,
            user,
        ]);
    }

    onUserDisconnected(uri: string) {
        this.participantsProvider.participants.next(
            this.participantsProvider.participants.value.filter(
                (f) => f.uri !== uri
            )
        );
    }
}
