import { ElementRef } from '@angular/core';
import { PeerChatMessageView } from '../../ngrx';

export class ChatItemObserver {
    constructor(
        private readonly emitMsgVisible: (msgId: string, i: number) => void
    ) {}

    // https://developer.mozilla.org/en-US/docs/Web/API/Intersection_Observer_API
    private readonly targetContainer = document.querySelector(
        'movius-web-chat-workspace .chatspace'
    );

    observers: { [id: string]: IntersectionObserver } = {};

    update(
        messages: PeerChatMessageView[],
        elements: ElementRef<HTMLElement>[],
        checkNotify: (msg: PeerChatMessageView, i: number) => boolean
    ) {
        messages.forEach((msg, i) => {
            const f = checkNotify(msg, i);
            if (f && !this.observers[msg.id]) {
                this.initNotifyVisibleObserver(
                    msg?.id,
                    elements[i]?.nativeElement,
                    i
                );
            } else if (!f && this.observers[msg.id]) {
                this.resetNotifyVisibleObserver(msg.id);
            }
        });
    }

    dispose() {
        //console.log('ChatItemObserver:dispose');
        Object.keys(this.observers).forEach((k) =>
            this.resetNotifyVisibleObserver(k)
        );
    }

    private initNotifyVisibleObserver(
        msgId: string,
        elem: HTMLElement,
        i: number
    ) {
        //console.log(`ChatItemObserver:initNotifyVisibleObserver for ${msgId}`);

        if (this.observers[msgId]) {
            console.warn(
                `ChatItemObserver:initNotifyVisibleObserver for ${msgId} already activated`
            );
        } else {
            const options: IntersectionObserverInit = {
                root: this.targetContainer,
                rootMargin: '0px',
                //threshold: 0.2,
                threshold: 0.75,
            };

            const observer = new IntersectionObserver((evt) => {
                if (evt[0].isIntersecting) {
                    this.resetNotifyVisibleObserver(msgId);
                    this.emitMsgVisible(msgId, i);
                }
            }, options);

            observer.observe(elem);

            this.observers[msgId] = observer;
        }
    }

    private resetNotifyVisibleObserver(msgId: string) {
        //console.log(`ChatItemObserver:resetNotifyVisibleObserver for ${msgId}`);

        const observer = this.observers[msgId];

        if (!observer) {
            console.log(
                `ChatItemObserver:resetNotifyVisibleObserver for ${msgId} not exist`
            );
        } else {
            observer.disconnect();
            delete this.observers[msgId];
        }
    }
}
