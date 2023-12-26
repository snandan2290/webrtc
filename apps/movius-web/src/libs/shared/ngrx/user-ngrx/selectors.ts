import { createFeatureSelector, createSelector } from '@ngrx/store';
import { CallingStatus, MessagingStatus } from '../../models';
import {
    selectAppState,
    selectTransportStatus,
    TransportStatus,
} from '../app-ngrx';
import { UserState } from './reducer';

export const selectUserState = createFeatureSelector<UserState>('user');
export const selectActiveSessions = createFeatureSelector('activeCalls');

export const selectUser = createSelector(
    selectUserState,
    (state) => state.user
);

export const selectCustomerSupport = createSelector(
    selectUserState,
    (state) => state.customerSupport
);

export const selectUserId = createSelector(
    selectUser,
    (user) => user && user.multiLine
);

export const selectUserStateStatus = createSelector(
    selectUserState,
    (state) => state?.status
);

export const selectProfile = createSelector(
    selectUserState,
    (state) => state.profile
);

export const selectAddress = createSelector(
    selectUserState,
    (state) => state.address
);

export const selectFeatures = createSelector(
    selectUserState,
    (state) => state.features
);

export const selectIsE911Declined = createSelector(
    selectFeatures,
    (features) => features.e911Status === 'enabled_declined'
);

export const selectGDPRIsAccepted = createSelector(
    selectFeatures,
    (features) => features.gdprStatus === 'enabled_accepted'
);

export const selectAllowCalls = createSelector(
    selectFeatures,
    (features) => features.allowCalls
);

export const selectAllowMessages = createSelector(
    selectFeatures,
    (features) => features.allowMessages
);

export const selectIsMsGraphSyncEnabled = createSelector(
    selectFeatures,
    (address) => address.exchangeSyncStatus['enabled']
);

export const selectIsMsGraphSyncOff = createSelector(
    selectFeatures,
    (address) => address.exchangeSyncStatus === 'off'
);


export const selectMsGraphProfileEmail = createSelector(
    selectFeatures,
    (address) =>
        address.exchangeSyncStatus['enabled'] &&
        address.exchangeSyncStatus['enabled'].email
);

export const selectHasActiveSessions = createSelector(
    selectActiveSessions,
    (activeSessions) => Object.entries(activeSessions).length > 0
);

export const selectUserSettings = createSelector(
    selectUserState,
    (state) => state && state.settings
);

export const selectUserExchangeSettings = createSelector(
    selectUserSettings,
    (settings) => settings && settings.exchange
);

//
const getCallingStatus = (
    activeSessionsCount: number,
    e911Declined: boolean,
    callsAllowed: boolean,
    //transportStatus: TransportStatus
): CallingStatus => {
    // if (transportStatus === 'disconnected') {
    //     return 'network-error';
    // } else 
    if (!callsAllowed) {
        return 'calls-not-allowed';
    } 

    // This condition is always return E911-declined due to this it is commeted unless there are other errors
    // else if (e911Declined) { 
    //     return 'e911-declined';
    // }

    else if (activeSessionsCount > 0) {
        return 'another-active-call';
    }else if(sessionStorage.getItem('mic_enable_status') == 'false'){
        return 'mic-not-allowed';
    } else {
        return 'allowed';
    }
};

export const selectCallingStatus = createSelector(
    selectIsE911Declined,
    selectAllowCalls,
    selectActiveSessions,
    selectTransportStatus,
    (isE911Declined, allowCalls, activeSessions) =>
        getCallingStatus(
            Object.keys(activeSessions).length,
            isE911Declined,
            allowCalls
        )
);

export const selectMessagingStatus = createSelector(
    selectAllowMessages,
    (allowMessages) => 'allowed' as MessagingStatus // always allowed (WDC-580), server should handle this case itself
    //(allowMessages ? 'allowed' : 'messages-not-allowed') as MessagingStatus
);
