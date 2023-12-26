import { Component } from '@angular/core';
import { User } from '../multi-audio-panel/multi-audio-panel.component';

@Component({
    selector: 'movius-web-multi-audio-page',
    templateUrl: './multi-audio-page.component.html',
    styleUrls: ['./multi-audio-page.component.scss'],
})
export class MultiAudioPageComponent {
    users: User[] = [
        {
            id: 'alice.dFXVYgn4R8vMY1Ia0noYYaxOMIeyUZf5',
            name: 'alice',
        },
        {
            id: 'bob.kh1utpJQWRdixsNeVeNgUyewQRh7Ui25',
            name: 'bob',
        },
        {
            id: 'daniel.kh1utpJQWRaaaaNeVeNgUyewQRh7Ui25',
            name: 'daniel',
        },
    ];
    /*
    users: User[] = [
        {
            id: 'f5c85833285076a63dd3a722beeb7c94',
            name: 'Test',
            password: 'TLePA2p',
        },
        {
            id: '63af82163702707576368003ef22cdd4',
            name: 'constantine@scal.io',
            password: 'vycR1jX',
        },
        {
            id: 'b64ad333846827f9de1ce40581fe6c62',
            name: 'maxp@scal.io',
            password: '4LVPkz9',
        },
    ];
    */

    constructor() {}

    getPeers(userId: string) {
        return this.users.filter((f) => f.id !== userId);
    }
}
