import { Component, OnDestroy } from '@angular/core';
import { Subject } from 'rxjs';
import { User } from '../chat/chat.component';

@Component({
    selector: 'movius-web-chat-page',
    templateUrl: './chat-page.component.html',
    styleUrls: ['./chat-page.component.scss'],
})
export class ChatPageComponent implements OnDestroy {
    private readonly destroy$ = new Subject();

    users: User[] = [
        /*
        {
            id: 'f5c85833285076a63dd3a722beeb7c94',
            name: 'Test',
            password: 'TLePA2p',
        },
        */
        {
            // id: '14843123843',
            id: '18b678412c1098610f1bdddc2e03ef3e',
            identifier: '14847951879',
            name: 'naveen01327@gmail.com',
            password: 'fAsiAAE',
        },
        {
            id: '4c6592b432b215a7b7916e0b92998612',
            identifier: '14156789020',
            name: 'naveenkumar.c@moviuscorp.com',
            password: 'ydFkONs',
        },
    ];

    getPeers(userId: string) {
        return this.users.filter((f) => f.id !== userId);
    }

    ngOnDestroy() {
        this.destroy$.next();
    }
}
