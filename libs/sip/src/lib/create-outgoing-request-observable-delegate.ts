import { Subject } from 'rxjs';
import { shareReplay } from 'rxjs/operators';
import { IncomingResponse, OutgoingRequestDelegate } from 'sip.js/lib/core';

export interface AcceptOutgoingRequestEvent {
    kind: 'AcceptOutgoingRequestEvent';
    response: IncomingResponse;
}

export interface ProgressOutgoingRequestEvent {
    kind: 'ProgressOutgoingRequestEvent';
    response: IncomingResponse;
}

export interface RedirectOutgoingRequestEvent {
    kind: 'RedirectOutgoingRequestEvent';
    response: IncomingResponse;
}

export interface RejectOutgoingRequestEvent {
    kind: 'RejectOutgoingRequestEvent';
    response: IncomingResponse;
}

export interface TryingOutgoingRequestEvent {
    kind: 'TryingOutgoingRequestEvent';
    response: IncomingResponse;
}

export type OutgoingRequestEvent =
    | AcceptOutgoingRequestEvent
    | ProgressOutgoingRequestEvent
    | RedirectOutgoingRequestEvent
    | RejectOutgoingRequestEvent
    | TryingOutgoingRequestEvent;

export const createOutgoingRequestDelegate = () => {
    // https://github.com/onsip/SIP.js/blob/master/docs/api.md
    const subj = new Subject<OutgoingRequestEvent>();
    const delegate: OutgoingRequestDelegate = {
        onAccept: (response: IncomingResponse) => {
            subj.next({ kind: 'AcceptOutgoingRequestEvent', response });
        },
        onProgress: (response: IncomingResponse) => {
            subj.next({ kind: 'ProgressOutgoingRequestEvent', response });
        },
        onRedirect: (response: IncomingResponse) => {
            subj.next({ kind: 'RedirectOutgoingRequestEvent', response });
        },
        onReject: (response: IncomingResponse) => {
            subj.next({ kind: 'RejectOutgoingRequestEvent', response });
        },
        onTrying: (response: IncomingResponse) => {
            subj.next({ kind: 'TryingOutgoingRequestEvent', response });
        },
    };

    return { delegate, stream: subj };
};
