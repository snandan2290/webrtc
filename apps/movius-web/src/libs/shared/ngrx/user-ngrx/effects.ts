import { Injectable } from '@angular/core';
import {ActivatedRoute, Router} from '@angular/router';
import { EncryptService } from '@movius/encrypt';
import { MSGraphAuthService, MSGraphService } from '@movius/msgraph';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import { omit } from 'lodash/fp';
import { EMPTY, of } from 'rxjs';
import {
    catchError,
    delay,
    filter,
    map,
    mergeMap,
    switchMap,
    tap,
    take,
    withLatestFrom,
} from 'rxjs/operators';
import { updateUserExchangeSyncSettingsSuccess } from '.';
import {
    AuthService,
    ConfirmDialogComponent,
    CustomNzModalService,
    DbContext,
    FeatureStatus,
    OnboardingComponent,
    selectUser,
    StartLoginResult,
    User,
    UserDataAccessService,
} from '../../../shared';
import { AuthDataAccessService } from '../../services/auth.data-access.service';
import { getFeatureEnabled, mapFromMsGraphContact } from '../../utils';
import {
    activateUser,
    activateUserFails,
    activateUserSuccess,
    activateSSOUser,
    activateSSOUserSuccess,
    activateSSOUserFails,
    checkGDPRStatus,
    goPin,
    initMsGraph,
    login,
    loginFails,
    loginMsGraph,
    loginMsGraphFails,
    loginMsGraphSuccess,
    loginSuccess,
    logout,
    logoutMsGraph,
    setE911Address,
    setE911AddressAccepted,
    setGDPRStatusAccepted,
    setGDPRStatusAcceptedSuccess,
    updatePassword,
    updatePasswordFails,
    updatePasswordSuccess,
    updateUserExchangeSyncSettings,
    reloadUserCheck,
    reloadCehckSuccess,
} from './actions';
import { selectFeatures, selectProfile } from './selectors';
import { LoggerFactory } from '@movius/ts-logger';
const logger = LoggerFactory.getLogger("")

const getLogoutUrl = () => {
    return window.document.baseURI;
};

@Injectable()
export class UserEffects {
    appEmbededStatus: string;
    constructor(
        private readonly actions$: Actions,
        private readonly authService: AuthService,
        private readonly authDataService: AuthDataAccessService,
        private readonly userDataAccess: UserDataAccessService,
        private readonly router: Router,
        private readonly modalService: CustomNzModalService,
        private readonly store: Store,
        private readonly dbContext: DbContext,
        private readonly encryptService: EncryptService,
        private readonly msgraphAuthService: MSGraphAuthService,
        private readonly msgraphService: MSGraphService,
        private readonly activatedRoute: ActivatedRoute
    ) { 
        this.appEmbededStatus = getFeatureEnabled();
    }

    private readonly user$ = this.store.select(selectUser);

    login$ = createEffect(() =>
        this.actions$.pipe(
            ofType(login),
            switchMap(async ({ email, password, redirectUrl, sso_access_token }) => {
                try {
                    const {
                        startLoginResult,
                        finishLoginResult,
                    } = await this.tryLogin(email, password, sso_access_token);


                    if (finishLoginResult?.features?.actstatus == false) {
                        logger.debug('checkAccountStatus Condition check::account suspended');
                        if(this.appEmbededStatus == 'mldt'){
                            this.store.dispatch(logout());
                        } else {
                            this.router.navigate([
                                '/auth/login',
                                { info: "Account is suspended." },]);
                            return;
                        }
                    }

                    if (!!finishLoginResult) {
                        return loginSuccess({
                            ...finishLoginResult,
                            dateTime: new Date().toISOString(),
                            email,
                            redirectUrl,
                            customerSupport: finishLoginResult.customerSupport,
                        });
                    } else {
                        //SSO Check
                        if (sessionStorage.getItem('ssoToken') != "\"\""
                            && sessionStorage.getItem('ssoToken') != null
                            && typeof (sessionStorage.getItem('ssoToken')) != 'undefined') {
                            //here need to call activate user with dummy otp

                            const ident = sessionStorage.getItem('__api_identity__');
                            const mail_id = sessionStorage.getItem('userEmail');
                            const  org_id = sessionStorage.getItem('__api_auth_org_id__');
                            const data = {identity: ident, name: mail_id, orgId: org_id, activated: "false"};
                            const otp = '123456';
                            if(sessionStorage.getItem("isLogingViaTeams") === "true" && startLoginResult.activated ) {
                                //this.store.dispatch(activateSSOUser({ otp, data: data as any }));
                                return activateSSOUserSuccess({ data: data as any, otp });
                                
                            } else {
                                this.store.dispatch(activateSSOUser({ otp, data: data as any }));
                            }
                            



/*                            return loginSuccess({
                                ...finishLoginResult,
                                dateTime: new Date().toISOString(),
                                email,
                                redirectUrl,
                                customerSupport: finishLoginResult.customerSupport,
                            });*/
                        }
                        else {
                            const result = omit(
                                'encryptConfig',
                                startLoginResult
                            ) as StartLoginResult;
                            return goPin({
                                result,
                                newWebSignIn: startLoginResult.newWebSignIn,
                            });
                        }

                    }
                } catch (error) {
                    await this.authService.logout();
                    return loginFails({ error });
                }
            })
        )
    );

    /*/
    loginSuccessActivateExchangeSettings$ = createEffect(() =>
        this.actions$.pipe(
            ofType(loginSuccess),
            map(({ settings }) =>
                updateUserExchangeSyncSettings({
                    settings: settings.exchange,
                })
            )
        )
    );
    */

    checkUserAuth$ = createEffect(() =>
        this.actions$.pipe(
            ofType(reloadUserCheck),
            take(1),
            switchMap(async () => {
                const {status,error} = await this.checkUserAuth()
                if(status){
                    this.authService.clearReloadSessions()
                    sessionStorage.clear();
                    this.router.navigate([
                        '/auth/login',
                        { info: error },
                    ]);
                    this.authDataService.unauthorized.next({status : false, details : error})
                    return loginFails({error:error});
                }else{
                    return reloadCehckSuccess()
                }
            }),
        )
    );

    updateUserExchangeSyncSettings$ = createEffect(() =>
        this.actions$.pipe(
            ofType(updateUserExchangeSyncSettings),
            withLatestFrom(this.user$),
            switchMap(async ([{ settings }, user]) => {
                const {
                    exchangeNextSyncTime,
                } = await this.dbContext.profile.updateSettings(
                    user.multiLine,
                    {
                        exchange: settings,
                    }
                );
                return updateUserExchangeSyncSettingsSuccess({
                    settings,
                    exchangeNextSyncTime,
                });
            })
        )
    );

    goPin$ = createEffect(
        () =>
            this.actions$.pipe(
                ofType(goPin),
                tap(async ({ result, newWebSignIn }) => {
                    if (newWebSignIn) {
                        await this.authService.triggerPasswordOtp();
                    }
                    this.router.navigate(['/auth/pin'], {
                        queryParams: { ...result, newWebSignIn },
                    });
                })
            ),
        { dispatch: false }
    );

    activateUser$ = createEffect(() =>
        this.actions$.pipe(
            ofType(activateUser),
            switchMap(async ({ otp, data }) => {
                try {
                    await this.authService.activateUser(otp, data);
                    return activateUserSuccess({ data, otp });
                } catch (error) {
                    return activateUserFails({ error });
                }
            })
        )
    );

    activateUserSuccess$ = createEffect(
        () =>
            this.actions$.pipe(
                ofType(activateUserSuccess),
                tap(({ data, otp }) => {
                    //this redirect was wrote at pin.component based on condition
                    
                    // this.router.navigate(['/auth', 'password'], {
                    //     queryParams: { set_new: true, ...data, otp },
                    // });
                })
            ),
        { dispatch: false }
    );

    updatePassword$ = createEffect(() =>
        this.actions$.pipe(
            ofType(updatePassword),
            switchMap(async ({ otp, newPassword, oldPassword, onSuccess }) => {
                try {
                    const urlParams = new URLSearchParams(window.location.search);
                    if (oldPassword && !otp) {
                        await this.authService.updatePasswordUsingOldPassword(
                            oldPassword,
                            newPassword,
                            this.authService.apiName || urlParams.get('email')
                        );
                    } else {
                        await this.authService.updatePasswordUsingOtp(
                            newPassword,
                            otp,
                            this.authService.apiName || urlParams.get('email')
                        );
                    }

                    return updatePasswordSuccess({
                        email: this.authService.apiName || urlParams.get('email'),
                        password: newPassword,
                        onSuccess,
                    });
                } catch (err) {
                    return updatePasswordFails({ error: err });
                }
            })
        )
    );

    updatePasswordSuccess$ = createEffect(() =>
        this.actions$.pipe(
            ofType(updatePasswordSuccess),
            switchMap(({ email, password, onSuccess }) =>
                onSuccess === 'login'
                    ? of(login({ email, password }))
                    : of(logout()).pipe(delay(3000))
            )
        )
    );

    loginSuccessRedirect$ = createEffect(
        () =>
            this.actions$.pipe(
                ofType(loginSuccess),
                tap(({ redirectUrl }) => {
                    if (this.appEmbededStatus === 'messaging') {
                        this.router.navigate([redirectUrl || '/messaging']);
                    } else {
                        this.router.navigate([redirectUrl || '/calling']);
                    }
                })
            ),
        { dispatch: false }
    );

    logout$ = createEffect(
        () =>
            this.actions$.pipe(
                ofType(logout),
                tap(() => {
                    this.authService.clearReloadSessions()
                    if (this.appEmbededStatus === 'messaging') {
                        const baseURI = getLogoutUrl().slice(0, -1)
                        this.authService.logout();
                        location.href = `${baseURI}?embedded=messaging`; 
                    } else {
                        this.authService.logout();
                        location.href = getLogoutUrl();
                    }
                    //setTimeout(() => (location.href = getLogoutUrl()), 1000);
                })
            ),
        { dispatch: false }
    );

    private showOnboardingModal = (
        askE911Address: boolean,
        isStandalone: boolean,
        exchangeSyncDisabled: boolean
    ) =>
        this.modalService
            .create({
                nzContent: OnboardingComponent,
                nzComponentParams: {
                    askE911Address,
                    isStandalone,
                    exchangeSyncDisabled,
                },
                nzStyle: {
                    position: 'relative',
                    top: '53px',
                },
                nzMask: true,
                nzFooter: null,
                nzClosable: false,
                nzMaskClosable: false,
                nzKeyboard: false,
            })
            .afterClose.pipe(map(() => null));

    loginSuccess$ = createEffect(() =>
        this.actions$.pipe(
            ofType(loginSuccess),
            switchMap(({ user, features, isInitialLogin }) =>
                // e911 enabled but still not known
                features.e911Status === 'enabled_declined'
                    ? this.userDataAccess.e911GetStatus().pipe(
                        map((e911Status) => {
                            const featureStatus: FeatureStatus =
                                e911Status === 'not_init' ||
                                    e911Status === 'unknown'
                                    ? 'unknown'
                                    : e911Status === 'accepted'
                                        ? 'enabled_accepted'
                                        : 'enabled_declined';
                            if (featureStatus === 'unknown') { // this is same as not accepted so
                                sessionStorage.setItem('_USER_E911_STATUS_', 'enabled_declined');
                            } else {
                                sessionStorage.setItem('_USER_E911_STATUS_', featureStatus);
                            }
                            return {
                                e911Status: featureStatus,
                                user,
                                isInitialLogin,
                                features,
                            };
                        })
                    )
                    : of({
                        e911Status: features.e911Status,
                        user,
                        isInitialLogin,
                        features,
                    })
            ),

            switchMap(async (result) => {
                if (result.features.exchangeSyncStatus === 'off') {
                    await this.msgraphAuthService.signOut(true);
                    return result;
                } else {
                    return result;
                }
            }),
            switchMap((result) => {
                if (result.isInitialLogin) {
                    const askE911Address =
                        result.e911Status === 'unknown' ||
                        result.e911Status === 'enabled_declined';
                    let exchangeSyncDisabled =
                        result.features.exchangeSyncStatus === 'off';
                    // if (this.appEmbededStatus === 'messaging') {
                    //     return of(null);
                    // }
                    if (!askE911Address && exchangeSyncDisabled) {
                        return of(null);
                    } else {
                        // if (this.appEmbededStatus === 'messaging' && !exchangeSyncDisabled && !askE911Address) {
                        //     // NOTE : if exchange is supported in future for desktop MLDT 
                        //     // with embedded flag turned on.. remove this if case
                        //     return of(null);
                        // }
                        // if (this.appEmbededStatus === 'messaging') {
                        //     exchangeSyncDisabled = true;
                        // }
                        return this.showOnboardingModal(
                            askE911Address,
                            false,
                            exchangeSyncDisabled
                        ).pipe(
                            switchMap(() => {
                                if (result.e911Status === 'enabled_accepted') {
                                    return this.userDataAccess.e911LookupSubscriber();
                                } else {
                                    return of(null);
                                }
                            })
                        );
                    }
                } else if (
                    (result && result.e911Status === 'unknown') ||
                    result.e911Status === 'enabled_declined'
                ) {
                    // e911 unknown or declined, show onboarding
                    return this.showOnboardingModal(true, true, true);
                } else if (
                    !localStorage.getItem('contactSync') && this.authDataService.exchangeDataProperty
                ) {
                    if (this.appEmbededStatus === 'messaging') {
                       return of(null)
                    }
                    // e911 unknown or declined, show onboarding
                    this.authDataService.exchangePopUpUpdate(false);
                    return this.showOnboardingModal(false, false, true);
                } else if (result && result.e911Status === 'enabled_accepted') {
                    return this.userDataAccess.e911LookupSubscriber().pipe(
                        switchMap((address) => {
                            if (!address) {
                                // status accepted but address not found, request address once again
                                // Address will set from modal
                                return this.showOnboardingModal(
                                    true,
                                    true,
                                    true
                                );
                            } else {
                                return of(address);
                            }
                        }),
                        catchError(() => of('none'))
                    );
                } else {
                    return of(null);
                }
            }),
            mergeMap((address) =>
                address && address !== 'none'
                    ? [
                        setE911AddressAccepted({ address }),
                        checkGDPRStatus(),
                        initMsGraph(),
                    ]
                    : [checkGDPRStatus(), initMsGraph()]
            )
        )
    );

    setE911Address$ = createEffect(() =>
        this.actions$.pipe(
            ofType(setE911Address),
            switchMap(async ({ address, requireUpdate }) => {
                if (requireUpdate) {
                    await this.userDataAccess
                        .e911UpdateSubscriber(address)
                        .toPromise();
                }
                await this.userDataAccess.e911Accept().toPromise();
                return setE911AddressAccepted({ address });
            })
        )
    );

    setE911AddressAccepted$ = createEffect(
        () =>
            this.actions$.pipe(
                ofType(setE911AddressAccepted),
                filter(({ address }) => !!address),
                withLatestFrom(this.user$),
                tap(async ([{ address }, user]) => {
                    await this.dbContext.profile.updateAddress(
                        user.multiLine,
                        address
                    );
                })
            ),
        { dispatch: false }
    );

    checkGDPRStatus$ = createEffect(() =>
        this.actions$.pipe(
            ofType(checkGDPRStatus),
            withLatestFrom(
                this.store.select(selectFeatures),
                this.store.select(selectProfile)
            ),
            switchMap(([_, { gdprStatus }, profile]) => {
                if (
                    gdprStatus === this.modalService.ModalStatus ||
                    gdprStatus === 'unknown'
                ) {
                    /*
                    const termsLink = `<a class="terms-link" href=${
                        window.location.origin + '/gdpr-terms'
                    }?email=${encodeURIComponent(
                        profile.email
                    )} target="_blank">Terms & Conditions</a>`;
                    */
                    const termsLink = `<a class="terms-link" href=${window.location.origin + '/login/tandc'
                        } target="_blank">Terms and Privacy Policy</a>`;

                    const newTermsTitle = 'New Terms & Conditions';
                    const newTermsContent = `The ${termsLink}  of this service has changed. Please accept the revised policy to continue.`;

                    const defaultTermsTitle = 'Privacy Settings';
                    const defaultTermsContent = `This application requires the use of your personal data as defined in ${termsLink}. You currently have this setting turned off. Turn on the setting to continue to use this service.`;

                    const rejectNewTermsTitle = 'New Terms & Conditions';
                    const rejectNewTermsContent =
                        'Are you sure? Once you reject, your account will be suspended and you will no longer be able to use this service. Your admin will be notified.';

                    const isNewTerms = gdprStatus === 'unknown';

                    const ask$ = () => {
                        let ok = false;
                        const ref = this.modalService.create({
                            nzContent: ConfirmDialogComponent,
                            nzComponentParams: {
                                titleTxt: isNewTerms
                                    ? newTermsTitle
                                    : defaultTermsTitle,
                                subTitleTxt: isNewTerms
                                    ? newTermsContent
                                    : defaultTermsContent,
                                applyBtnTxt: isNewTerms ? 'Accept' : 'Turn On',
                                cancelBtnTxt: isNewTerms ? 'Reject' : 'Cancel',
                                onOkAction: () => {
                                    ok = true;
                                },
                            },
                            nzBodyStyle: {
                                width: '26rem',
                            },
                            nzWidth: '26rem',
                            nzFooter: null,
                        });
                        return ref.afterClose.pipe(
                            switchMap(() => {
                                return isNewTerms && !ok
                                    ? this.modalService
                                        .create({
                                            nzContent: ConfirmDialogComponent,
                                            nzComponentParams: {
                                                titleTxt: rejectNewTermsTitle,
                                                subTitleTxt: rejectNewTermsContent,
                                                applyBtnTxt: 'Confirm',
                                                cancelBtnTxt: 'Cancel',
                                                onOkAction: () => {
                                                    ok = false;
                                                },
                                                onCancelAction: () => {
                                                    ok = true;
                                                },
                                            },
                                            nzBodyStyle: {
                                                width: '26rem',
                                            },
                                            nzWidth: '26rem',
                                            nzFooter: null,
                                        })
                                        .afterClose.pipe(
                                            switchMap(() =>
                                                ok ? ask$() : of(false)
                                            )
                                        )
                                    : of(ok);
                            })
                        );
                    };
                    return ask$();
                } else {
                    return EMPTY;
                }
            }),
            switchMap((result) => {
                if (result) {
                    return this.userDataAccess.gdprUpdate(true).pipe(
                        map(() =>
                            setGDPRStatusAcceptedSuccess({
                                isAccepted: true,
                            })
                        )
                    );
                } else {
                    this.authService
                        .logout()
                        .then(() => (location.href = getLogoutUrl()));
                    return EMPTY;
                }
            })
        )
    );

    setGDPRStatusAccepted$ = createEffect(() =>
        this.actions$.pipe(
            ofType(setGDPRStatusAccepted),
            tap(async ({ isAccepted }) => {
                await this.userDataAccess.gdprUpdate(isAccepted).toPromise();
                if (!isAccepted) {
                    sessionStorage.clear();
                    await this.authService
                        .logout()
                        .then(() => (location.href = getLogoutUrl()));
                }
            }),
            map(({ isAccepted }) =>
                setGDPRStatusAcceptedSuccess({ isAccepted })
            )
        )
    );

    loginMsGraph$ = createEffect(() =>
        this.actions$.pipe(
            ofType(loginMsGraph),
            switchMap(async () => {
                // Once login this is obrigatory to load user contacts, if contacts loading fails, then user is not logined
                try {
                    //if it is sso user need to skip this below signIn method and directly call try block by building
                    //this.graphClient object
                    if (sessionStorage.getItem('ssoToken') == null){
                        await this.msgraphAuthService.signIn();
                    }
                    try {
                        const msGraphContacts = await this.msgraphService.getContacts();
                        const contacts = msGraphContacts.map(
                            mapFromMsGraphContact
                        );
                        return loginMsGraphSuccess({
                            resetContacts: true,
                            contacts,
                            userName: this.msgraphAuthService.user.email,
                        });
                    } catch (error) {
                        if(JSON.parse(error.body).code === "InvalidAuthenticationToken"){
                            if(this.appEmbededStatus === 'messaging' && sessionStorage.getItem("isLogingViaTeams") === "true"){
                                const refereshTokenResponse = await this.authDataService.refresh_token_on_expiry().toPromise();
                                if (refereshTokenResponse.root.desc == 'Success' && refereshTokenResponse.root.sso_access_token != null) {
                                    sessionStorage.setItem('ssoToken', refereshTokenResponse.root.sso_access_token);
                                }
                                if (refereshTokenResponse.root.desc == 'Success' && refereshTokenResponse.root.refresh_token != null) {
                                    sessionStorage.setItem('refreshToken', refereshTokenResponse.root.refresh_token);
                                }
                                try{
                                    const msGraphContacts = await this.msgraphService.getContacts();
                                    const contacts = msGraphContacts.map(
                                        mapFromMsGraphContact
                                    );
                                    return loginMsGraphSuccess({
                                        resetContacts: true,
                                        contacts,
                                        userName: this.msgraphAuthService.user.email,
                                    });
                                }catch(error){
                                    throw error;
                                }
                            }
                        }
                        // this.msgraphAuthService.signOut();
                        throw error;
                    }
                } catch (error) {
                    return loginMsGraphFails({ error });
                }
            })
        )
    );

    initMsGraph$ = createEffect(() =>
        this.actions$.pipe(
            ofType(initMsGraph),
            withLatestFrom(this.store.select(selectFeatures)),
            tap(([_,feature])=>{
                if(feature.exchangeSyncStatus !== 'off'){
                    sessionStorage.setItem("initMsGraphPath","true")
                }
            }),
            filter(([_, features]) => features.exchangeSyncStatus !== 'off'),
            switchMap(() => this.msgraphAuthService.getAccessToken()),
            map(() =>
                loginMsGraphSuccess({
                    resetContacts: false,
                    contacts: null,
                    userName: this.msgraphAuthService.user.email,
                })
            ),
            catchError((error) => of(loginMsGraphFails({ error })))
        )
    );

    logoutMsGraph$ = createEffect(
        () =>
            this.actions$.pipe(
                ofType(logoutMsGraph),
                tap(() => {
                    // Give time for app cleanup (remove contacts)
                    setTimeout(() => this.msgraphAuthService.signOut(), 100);
                })
            ),
        { dispatch: false }
    );

    activateSSOUser$ = createEffect(() =>
        this.actions$.pipe(
            ofType(activateSSOUser),
            switchMap(async ({ otp, data }) => {
                try {
                    await this.authService.activateSSOUser(otp, data);
                    return activateSSOUserSuccess({ data, otp });
                } catch (error) {
                    return activateSSOUserFails({ error });
                }
            })
        )
    );

    activateSSOUserSuccess$ = createEffect(
        () =>
            this.actions$.pipe(
                ofType(activateSSOUserSuccess),
                tap(({ data, otp }) => {
                    if (sessionStorage.getItem('ssoToken') != "\"\""
                        && sessionStorage.getItem('ssoToken') != null
                        && typeof (sessionStorage.getItem('ssoToken')) != 'undefined') {
                        this.router.navigate(['/calling']);
                    }
                })
            ),
        { dispatch: false }
    );

    private checkUserAuth =async () => {
        let refereshTokenResponse:any
            try{
                refereshTokenResponse = await this.authDataService.refresh_token_on_expiry().toPromise();
            }catch(e){
                logger.debug("unauthorized hit "+refereshTokenResponse +" " + e.error.message)
                refereshTokenResponse = e
            }
            let code = refereshTokenResponse.root ? refereshTokenResponse.root.return : refereshTokenResponse.error ? refereshTokenResponse.error.apiReturnCode : null
            if(code == 23701) {
                return {status : true, error : "MultiLine Desktop is disabled for your Organization."}
            } else if(code == 23501 || code == 23502){
                return {status : true, error : "Account is suspended."}
            }
            else if(code && (code == 13000 || code == "13000" || code == 24005 || code == "24005")) {
                logger.debug('checkUserAuth code::', code);
                let err = this.unauthorizedUser(refereshTokenResponse)
                if(code == 24005 || code == "24005" || code == 13000 || code == "13000"){
                    err = "MultiLine Messaging for MS Teams is not enabled for this email ID."
                }
                return {status : true, error : err}
            }
            return {status : false, error : ""}
    }

    // privates
    async truncateDB() {
        const objStrToTruncate = [
            'messages',
            'messageThreads',
            'participants',
            'settings',
            'addresses',
            'calls',
            'callsViewed',
            'contacts',
            'messageInfo',
            'media',
            'retryQueue'
        ]
        // 'profiles' //object store truncations not completing 
        //  before getFinishLoginResult so commenting out
        objStrToTruncate.forEach(async element => {
            await this.dbContext.message.truncateObjectStore(element)
        });
    }

    private tryLogin = async (email: string, password: string, sso_access_token: string) => {
        if (password) {
            const startLoginResult = await this.authService.startLogin(
                email,
                password,
                sso_access_token
            );
            if (startLoginResult.activated === false || (startLoginResult.newWebSignIn === true &&
                         sessionStorage.getItem('ssoToken') == null)) {
                    logger.debug("Scenario : onboarding")
                    //localStorage.removeItem('contactSync');
                    //await this.truncateDB()
                    sessionStorage.setItem("newUserOnboarding","true")
                    //logger.debug("clearing indexedDB data")
            }

            if (startLoginResult.activated && !startLoginResult.newWebSignIn) {
                const finishLoginResult = await this.getFinishLoginResult(
                    email
                );
                return { startLoginResult, finishLoginResult };
            } else {
                return { startLoginResult, finishLoginResult: null };
            }
        } else {

                const finishLoginResult = await this.getFinishLoginResult(email);
                this.authDataService.cacheReload.next(true);
                return { startLoginResult: null, finishLoginResult };
            }
    };

    private unauthorizedUser(refereshTokenResponse){
        let errResponse:string
        try{
            if(refereshTokenResponse.root){
                errResponse =  refereshTokenResponse.root.desc ? refereshTokenResponse.root.desc : 'You are not authorized to access the resource'
            }else if(refereshTokenResponse.error){
                errResponse =  refereshTokenResponse.error.message ? refereshTokenResponse.error.message : 'You are not authorized to access the resource'
            }else{
                errResponse = "You are not authorized to access the resource"
            }
        }catch(e){
            errResponse = "You are not authorized to access the resource"
        }
        return errResponse
    }

    private getFinishLoginResult = async (email: string) => {
        const {
            user: sipUser,
            features,
            encryptConfig,
            customerSupport,
        } = await this.authService.finishLogin();
        const user: User = {
            id: sipUser.userId,
            uri: sipUser.uri,
            multiLineUri: sipUser.uri,
            name: sipUser.userName,
            img: null,
            multiLine: sipUser.userName,
            firstName: null,
            lastName: null,
        };

        await this.encryptService.setConfig({
            secretKey: encryptConfig.key,
            iv: encryptConfig.iv,
        });

        // if its first time login profile still not exists
        const profileStatus = await this.dbContext.profile.isProfileExist(
            user.multiLine
        );
        if (!profileStatus.isProfileExist || profileStatus.isOtherProfilesExist) {
            sessionStorage.setItem("differentUserlLogin","true");
            localStorage.removeItem('contactSync');
            await this.truncateDB()
            logger.debug("General:: Clearing IndexedDB Data");
            await this.dbContext.profile.createProfile(user.multiLine, email);
        }

        const {
            profile,
            address,
            settings,
        } = await this.dbContext.profile.getProfileAndAddress(user.multiLine);
        return {
            user,
            profile,
            address,
            features,
            settings,
            customerSupport,
            isInitialLogin: !profileStatus.isProfileExist,
        };
    };
}
