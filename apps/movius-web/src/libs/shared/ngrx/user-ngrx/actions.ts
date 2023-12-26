import { Contact, ExchangeSyncSettings, UserSettings } from '@movius/domain';
import { createAction, props } from '@ngrx/store';
import {
    Address,
    CustomerSupport,
    Profile,
    User,
    UserFeatures,
} from '../../models';
import { StartLoginResult } from '../../services';

export const login = createAction(
    '[User] Login',
    props<{ email: string; password?: string; redirectUrl?: string, sso_access_token?: string }>()
);

export const loginSuccess = createAction(
    '[User] Login Success',
    props<{
        dateTime: string;
        user: User;
        profile: Profile;
        address: Address | null;
        email: string;
        features: UserFeatures;
        settings: UserSettings;
        isInitialLogin: boolean;
        redirectUrl?: string;
        customerSupport: CustomerSupport;
    }>()
);

export const reloadUserCheck = createAction('[User] Reload user check');

export const reloadCehckSuccess = createAction('[User] Reload user check success');

export const checkGDPRStatus = createAction('[User] Check GDPR Status');

export const loginFails = createAction(
    '[User] Login Fails',
    props<{ error: any }>()
);

export const goPin = createAction(
    '[User] Go Pin',
    props<{ result: StartLoginResult; newWebSignIn: boolean }>()
);

export const activateUser = createAction(
    '[User] Activate User',
    props<{ otp: string; data: StartLoginResult }>()
);

export const activateUserSuccess = createAction(
    '[User] Activate User Success',
    props<{ data: StartLoginResult; otp: string }>()
);

export const activateUserFails = createAction(
    '[User] Activate User Fails',
    props<{ error: any }>()
);

export const updatePassword = createAction(
    '[User] Update Password',
    props<{
        oldPassword: string;
        newPassword: string;
        otp: string;
        onSuccess: 'login' | 'logout';
    }>()
);

export const updatePasswordSuccess = createAction(
    '[User] Update Password Success',
    props<{ email: string; password: string; onSuccess: 'login' | 'logout' }>()
);

export const updatePasswordFails = createAction(
    '[User] Update Password Fails',
    props<{ error: any }>()
);

export const logout = createAction('[User] Logout');

export const setE911Address = createAction(
    '[User] Set E911 Address',
    props<{ address: Address; requireUpdate: boolean }>()
);

export const setE911AddressAccepted = createAction(
    '[User] Set E911 Address Accepted',
    props<{ address: Address }>()
);

export const updateUserExchangeSyncSettings = createAction(
    '[User] Update User Exchange Settings',
    props<{ settings: ExchangeSyncSettings }>()
);

export const updateUserExchangeSyncSettingsSuccess = createAction(
    '[User] Update User Exchange Settings Success',
    props<{
        settings: ExchangeSyncSettings;
        exchangeNextSyncTime: 'never' | number;
    }>()
);

// Will try to init msgarph with previously stored credentials
export const initMsGraph = createAction('[User] Init MsGraph');

export const loginMsGraph = createAction('[User] Login MsGraph');

export const loginMsGraphSuccess = createAction(
    '[User] Login MsGraph Success',
    props<{
        resetContacts: boolean;
        contacts: Contact[] | 'not-loaded';
        userName: string;
    }>()
);

export const loginMsGraphFails = createAction(
    '[User] Login MsGraph Fails',
    props<{ error: any }>()
);

//

export const logoutMsGraph = createAction(
    '[User] Logout MsGraph',
    props<{ resetContacts: boolean }>()
);

export const deleteMSGraphContacts = createAction(
    '[User] Delete All MsGraph',
);

//
export const setGDPRStatusAccepted = createAction(
    '[User] Set GDPR Status Accepted',
    props<{ isAccepted: boolean }>()
);

export const setGDPRStatusAcceptedSuccess = createAction(
    '[User] Set GDPR Status Accepted Success',
    props<{ isAccepted: boolean }>()
);


export const activateSSOUser = createAction(
    '[User] Activate SSO User',
    props<{ otp: string; data: StartLoginResult }>()
);

export const activateSSOUserSuccess = createAction(
    '[User] Activate SSO User Success',
    props<{ data: StartLoginResult; otp: string }>()
);

export const activateSSOUserFails = createAction(
    '[User] Activate SSO User Fails',
    props<{ error: any }>()
);