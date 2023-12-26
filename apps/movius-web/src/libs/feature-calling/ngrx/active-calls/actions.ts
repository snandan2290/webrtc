import { createAction, props } from '@ngrx/store';
import { ActiveCallDirection } from '../../models/active-call';

export const callStarted = createAction(
    '[ActiveCalls] Call Started',
    props<{
        peerId: string;
        dateTime: string;
        callId: string;
        direction: ActiveCallDirection;
        isAnonymous?: boolean;
    }>()
);

export const callProgress = createAction(
    '[ActiveCalls] Call Progress',
    props<{
        dateTime: string;
        callId: string;
        statusCode: number;
    }>()
);

export const callAcceptStart = createAction(
    '[ActiveCalls] Call Accept Start',
    props<{ callId: string }>()
);

export const callAccepted = createAction(
    '[ActiveCalls] Call Accepted',
    props<{ callId: string; dateTime: string }>()
);

export const callMuteChanged = createAction(
    '[ActiveCalls] Call Muted Changed',
    props<{ callId: string; isMuted: boolean }>()
);

export const callHoldChanged = createAction(
    '[ActiveCalls] Call Hold Changed',
    props<{ callId: string; isHold: boolean }>()
);

export const callHangUp = createAction(
    '[ActiveCalls] Call HangUp',
    props<{ callId: string }>()
);

export const callHangUpComplete = createAction(
    '[ActiveCalls] Call HangUp Complete',
    props<{ callId: string }>()
);

export const callFails = createAction(
    '[ActiveCalls] Call Fails',
    props<{ callId: string }>()
);

export const callSetOnlyActive = createAction(
    '[ActiveCalls] Call Set Only Active',
    props<{ callId: string }>()
);
