import { Subject } from 'rxjs';
//
import {
    Bye,
    Info,
    Message,
    Notification,
    Referral,
    SessionDelegate,
    SessionDescriptionHandler,
} from 'sip.js';
import { IncomingRequestMessage } from 'sip.js/lib/core';

export interface ByeSessionEvent {
    kind: 'ByeSessionEvent';
    bye: Bye;
}

export interface InfoSessionEvent {
    kind: 'InfoSessionEvent';
    info: Info;
}

export interface InviteSessionEvent {
    kind: 'InviteSessionEvent';
    request: IncomingRequestMessage;
    response: string;
    statusCode: number;
}

export interface MessageSessionEvent {
    kind: 'MessageSessionEvent';
    message: Message;
    body: string;
}

export interface NotifySessionEvent {
    kind: 'NotifySessionEvent';
    notification: Notification;
}

export interface ReferSessionEvent {
    kind: 'ReferralSessionEvent';
    referral: Referral;
}

export interface SessionDescriptionHandlerEvent {
    kind: 'SessionDescriptionHandlerEvent';
    sessionDescriptionHandler: SessionDescriptionHandler;
    provisional: boolean;
}

export type SessionEvent =
    | ByeSessionEvent
    | InfoSessionEvent
    | InviteSessionEvent
    | MessageSessionEvent
    | NotifySessionEvent
    | ReferSessionEvent
    | SessionDescriptionHandlerEvent;

export const createSessionObservableDelegate = () => {
    // https://github.com/onsip/SIP.js/blob/master/docs/api.md
    const subj = new Subject<SessionEvent>();
    const delegate: SessionDelegate = {
        onBye: (bye: Bye) => {
            subj.next({ kind: 'ByeSessionEvent', bye });
        },
        onInfo: (info: Info) => {
            subj.next({ kind: 'InfoSessionEvent', info });
        },
        onInvite: (
            request: IncomingRequestMessage,
            response: string,
            statusCode: number
        ) => {
            subj.next({
                kind: 'InviteSessionEvent',
                request,
                response,
                statusCode,
            });
        },
        onMessage: (message: Message) => {
            subj.next({
                kind: 'MessageSessionEvent',
                message,
                body: message.request.data,
            });
        },
        onNotify: (notification: Notification) => {
            subj.next({
                kind: 'NotifySessionEvent',
                notification,
            });
        },
        onRefer: (referral: Referral) => {
            subj.next({
                kind: 'ReferralSessionEvent',
                referral,
            });
        },
        onSessionDescriptionHandler: (
            sessionDescriptionHandler: SessionDescriptionHandler,
            provisional: boolean
        ) => {
            subj.next({
                kind: 'SessionDescriptionHandlerEvent',
                sessionDescriptionHandler,
                provisional,
            });
        },
    };

    return { delegate, stream: subj };
};
