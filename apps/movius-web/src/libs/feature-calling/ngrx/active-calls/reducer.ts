import { createReducer, on } from '@ngrx/store';
import { assoc, omit, update, mapValues, assocPath } from 'lodash/fp';
import {
    ActiveCall,
    OngoingActiveCall,
    SuspendedActiveCall,
} from '../../models/active-call';
import {
    callAccepted,
    callAcceptStart,
    callFails,
    callHangUpComplete,
    callHoldChanged,
    callMuteChanged,
    callProgress,
    callSetOnlyActive,
    callStarted,
} from './actions';

export interface ActiveCallsState {
    [key: string]: ActiveCall;
}

//
const initialState: ActiveCallsState = {};

const callSetOnlyActiveHandler = (
    state: ActiveCallsState,
    { callId }: ReturnType<typeof callSetOnlyActive>
) => {
    return mapValues((val: ActiveCall) => {
        return val.kind === 'OngoingActiveCall'
            ? val.callId === callId
                ? val.status === 'on-hold'
                    ? { ...val, status: 'active' as 'active', isHold: false }
                    : val
                : val.status === 'active'
                ? { ...val, status: 'on-hold' as 'on-hold', isHold: true }
                : val
            : val;
    }, state);
};

const callHangUpCompleteHandler = (
    state: ActiveCallsState,
    { callId }: ReturnType<typeof callHangUpComplete | typeof callFails>
) => {
    const updState = omit([callId], state);
    const keys = Object.keys(updState);
    if (keys.length === 1) {
        return assoc([keys[0], 'status'], 'active', updState);
    } else {
        return updState;
    }
};

const _activeCallsReducer = createReducer(
    initialState,
    on(
        callStarted,
        (state, { peerId, dateTime, callId, direction, isAnonymous }) => ({
            ...state,
            [callId]: {
                kind: 'SuspendedActiveCall',
                peerId,
                startedDateTime: dateTime,
                callId,
                direction,
                isAnonymous,
                isEstablishing: true,
                isAccepted: false,
            } as SuspendedActiveCall,
        })
    ),
    on(callProgress, (state, { callId, statusCode }) =>
        // sometimes progress event sent after call hangup
        statusCode === 183 && state[callId]
            ? assocPath([callId, 'isEstablishing'], false, state)
            : state
    ),
    on(callAcceptStart, (state, { callId }) =>
        assocPath([callId, 'isAccepted'], true, state)
    ),
    on(callAccepted, (state, { dateTime, callId }) => ({
        ...state,
        [callId]: {
            ...state[callId],
            acceptedDatTime: dateTime,
            kind: 'OngoingActiveCall',
            status: 'active',
        } as OngoingActiveCall,
    })),
    on(callMuteChanged, (state, { callId, isMuted }) =>
        assoc([callId, 'isMuted'], isMuted, state)
    ),
    on(callHoldChanged, (state, { callId, isHold }) =>
        assoc([callId, 'isHold'], isHold, state)
    ),
    on(callHangUpComplete, callHangUpCompleteHandler),
    on(callFails, callHangUpCompleteHandler),
    on(callSetOnlyActive, callSetOnlyActiveHandler)
);

export const activeCallsReducer = (state, action) => {
    return _activeCallsReducer(state, action);
};
