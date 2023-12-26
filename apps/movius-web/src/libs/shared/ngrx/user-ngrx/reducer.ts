import { UserSettings } from '@movius/domain';
import { createReducer, on } from '@ngrx/store';
import { assoc, assocPath } from 'lodash/fp';
import { pipe } from 'rxjs';
import { Profile, StateStatus, User } from '../../../shared';
import { Address, CustomerSupport, UserFeatures } from '../../models';
import {
    login,
    loginMsGraphFails,
    loginMsGraphSuccess,
    loginSuccess,
    logout,
    logoutMsGraph,
    setE911AddressAccepted,
    setGDPRStatusAccepted,
    setGDPRStatusAcceptedSuccess,
    updateUserExchangeSyncSettings,
} from './actions';

export interface UserState {
    status: StateStatus;
    user: User | null;
    profile: Profile;
    address: Address | null;
    features: UserFeatures;
    settings: UserSettings;
    customerSupport: CustomerSupport | null;
}

const initialSettings: UserSettings = {
    exchange: {
        syncInterval: 'never',
    },
};

const initialFeatures: UserFeatures = {
    gdprStatus: 'unknown',
    e911Status: 'unknown',
    exchangeSyncStatus: 'unknown',
    allowCalls: false,
    allowMessages: false,
};

const initialState: UserState = {
    status: { kind: 'StateStatusInitial' },
    user: null,
    profile: null,
    address: null,
    features: initialFeatures,
    settings: initialSettings,
    customerSupport: null,
};

const logoutMsGraphHandler = (
    state: UserState,
    _: ReturnType<typeof logoutMsGraph>
) =>
    pipe(
        assocPath(['features', 'exchangeSyncStatus'], 'disabled'),
        assocPath(['settings'], initialSettings)
    )(state) as UserState;

const _userReducer = createReducer<UserState>(
    initialState,
    on(login, (state) =>
        assoc('status', { kind: 'StateStatusLoading' }, state)
    ),
    on(
        loginSuccess,
        (
            _,
            {
                dateTime,
                user,
                profile,
                address,
                features,
                settings,
                customerSupport,
            }
        ) => ({
            status: {
                kind: 'StateStatusLoaded',
                dateTime,
            },
            user,
            profile,
            address,
            features: features || initialFeatures,
            settings: settings || {
                exchange: {
                    syncInterval: '30min',
                },
            },
            customerSupport,
        })
    ),
    on(loginMsGraphSuccess, (state, { userName }) => {
        console.log('userName', userName);
        return assocPath(
            ['features', 'exchangeSyncStatus'],
            { enabled: { email: userName } },
            state
        );
    }),
    on(
        loginMsGraphFails,
        assocPath(['features', 'exchangeSyncStatus'], 'disabled') as (
            x: UserState
        ) => UserState
    ),
    on(logout, (_) => ({
        status: {
            kind: 'StateStatusInitial',
        },
        user: null,
        profile: null,
        peers: [],
        address: null,
        features: initialFeatures,
        settings: initialSettings,
        customerSupport: null,
    })),
    on(setGDPRStatusAcceptedSuccess, (state, { isAccepted }) => ({
        ...state,
        features: {
            ...state.features,
            gdprStatus: isAccepted ? 'enabled_accepted' : 'enabled_declined',
        },
    })),
    on(setE911AddressAccepted, (state, { address }) => ({
        ...state,
        address,
        features: { ...state.features, e911Status: 'enabled_accepted' },
    })),
    on(updateUserExchangeSyncSettings, (state, { settings }) =>
        assocPath(['settings', 'exchange'], settings, state)
    ),
    on(logoutMsGraph, logoutMsGraphHandler)
);

export const userReducer = (state, action) => {
    return _userReducer(state, action);
};
