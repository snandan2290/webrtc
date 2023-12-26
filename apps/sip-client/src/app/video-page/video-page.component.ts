import { AfterContentInit, Component, OnDestroy } from '@angular/core';
import { SipService, SipUser } from '@scalio/sip';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

const getVideoElement = (id: string) => {
    const el = document.getElementById(id);
    if (!(el instanceof HTMLVideoElement)) {
        throw new Error(`Element "${id}" not found or not a video element.`);
    }
    return el;
};

@Component({
    selector: 'movius-web-video-page',
    templateUrl: './video-page.component.html',
    styleUrls: ['./video-page.component.scss'],
})
export class VideoPageComponent implements AfterContentInit, OnDestroy {
    private readonly destroy$ = new Subject();

    user1: SipUser;
    user2: SipUser;

    constructor(private readonly sipService: SipService) {}

    private initUsers() {
        try {
            this.user1 = this.sipService.createUser('alice', 'Alice');
            this.user2 = this.sipService.createUser('bob', 'Bob');

            this.user1.userEvents$
                .pipe(takeUntil(this.destroy$))
                .subscribe((evt) => console.log('user 1 evt', evt));
            this.user2.userEvents$
                .pipe(takeUntil(this.destroy$))
                .subscribe((evt) => console.log('user 2 evt', evt));
        } catch (err) {
            console.warn('init err', err);
        }
    }

    ngAfterContentInit(): void {
        setTimeout(() => this.initUsers(), 1000);
    }

    ngOnDestroy() {
        this.destroy$.next();
        if (this.user1) {
            this.sipService.stopUser(this.user1);
        }
        if (this.user2) {
            this.sipService.stopUser(this.user2);
        }
    }

    onConnect(user: SipUser) {
        this.sipService.startUser(user);
    }

    onRegister(user: SipUser) {
        this.sipService.registerUser(user);
    }

    onBeginSession(user: SipUser, target: SipUser) {
        this.sipService.inviteUser(user, target);
    }

    onEndSession(user: SipUser) {}

    onUnregister(user: SipUser) {
        this.sipService.unregisterUser(user);
    }

    onDisconnect(user: SipUser) {
        this.sipService.stopUser(user);
    }

    onSendMessage(user: SipUser, target: SipUser, msg: string) {}
}
