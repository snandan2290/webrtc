import { HttpErrorResponse } from '@angular/common/http';
import { ThrowStmt } from '@angular/compiler';
import {
    ChangeDetectionStrategy,
    ChangeDetectorRef,
    Component,
    OnDestroy,
    OnInit,
} from '@angular/core';
import {
    FormBuilder,
    FormGroup,
    ValidationErrors,
    Validators,
} from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Actions, ofType } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import { merge, Observable, Subject } from 'rxjs';
import { mapTo, startWith, takeUntil } from 'rxjs/operators';
import {
    FormModel,
    getFeatureEnabled,
    login,
    loginFails,
    loginSuccess,
    TeamsErrorDisplayComponent,
    topLevelDomainEmailValidator,
} from '../../../shared';
import { AuthDataAccessService } from '../../../shared/services/auth.data-access.service';
import { ResetPasswordDataAccessService } from '../../services/reset-password.data-access.service';
import { CookieService } from 'ngx-cookie-service';
import { LoggerFactory } from '@movius/ts-logger';
// import { LoadingComponent } from '../../../shared/components/loading/loading.component';
import { NzModalService } from 'ng-zorro-antd/modal';
import { isEmpty } from 'lodash/fp';
const logger = LoggerFactory.getLogger("")

export interface ClientLoginData {
    email: string;
    password: string;
    sso_access_token: string;
}

const noNumbersError: string = 'NUMBERS_NOT_AVAILABLE';

const getApiErrorMessage = (error: HttpErrorResponse) => {
    const internalError = error.error;
    if (internalError) {
        logger.debug('get_api_error_message::apiReturnCode::', internalError.apiReturnCode);
        if (internalError.apiReturnCode === 14001) {
            return 'sso_redirect';
        }
        if (internalError.apiReturnCode === 13000) {
            return 'Invalid Credentials';
        } else if (internalError.apiReturnCode === 25001) {
            return 'The username or password you entered do not match.';
        } else if (internalError.apiReturnCode === 23501) {
            return 'Account is suspended.';
        } else if (internalError.apiReturnCode === 23502) {
            return 'Account is suspended.';
        } else if (internalError.apiReturnCode === 23701) {
            return 'MultiLine Desktop is disabled for your Organization.';
        } else if (internalError.apiReturnCode === 23504 || internalError.apiReturnCode === 22018) {
            return 'Error logging in.';
        } else if (internalError.apiReturnCode === 23503 || internalError.apiReturnCode === 24005) {
            return 'MultiLine Messaging for MS Teams is not enabled for this email ID.';
        } else if (internalError.apiReturnCode) {
            return ''
        }
    }
    return error.statusText === 'Unknown Error'
        ? 'Authentication failed'
        : 'Sorry! Unexpected error, please try again later'//error.statusText;
};

const extractErrorCode = (error: any) => {
    logger.debug('extractErrorCode::', error);
    return error.error ? error.error.message : error.message || error;
}

const mapSendErrorMessage = (extractedError: any) => {
    if (extractedError === noNumbersError) {
        return 'Sorry, no numbers available. Please contact your Administrator and request for a MultiLine number';
    } else if( extractedError != '') {
        return extractedError
    } else {
        return 'Sorry! Unexpected error, please try again later';
    }
};

@Component({
    selector: 'movius-web-login',
    templateUrl: './login.component.html',
    styleUrls: ['./login.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginComponent implements OnInit, OnDestroy {
    errorMessage: string;
    doShowSignup = false;
    doShowSignup2 = true;
    loginForm: FormGroup;
    isPwdVisible = false;
    isSigning$: Observable<boolean>;
    email: string;
    error: string;
    info: string;
    ssoToken: string;
    userMessage: string;
    appExternalUrl = "";
    gdprstatus: string;
    emailError: boolean = false;
    emailErrorText: string;
    isViaTeamsMobile: boolean;

    private readonly destroy$ = new Subject();
    private static readonly errorMessages = {
        required: () => '',
        tldEmail: () => 'Invalid email format',
    };
    appEmbededStatus: any;
    turnoffTeamsLogin: boolean = false;

    constructor(
        private readonly _formBuilder: FormBuilder,
        private readonly cdr: ChangeDetectorRef,
        private readonly store: Store,
        actions: Actions,
        private readonly router: Router,
        private readonly activatedRoute: ActivatedRoute,
        private readonly resetPasswordDataAccess: ResetPasswordDataAccessService,
        private cookieService: CookieService,
        private authDataService: AuthDataAccessService,
        private readonly modalService: NzModalService,
    ) {
        this.appEmbededStatus = getFeatureEnabled();
        this.info = activatedRoute.snapshot.params['info'];
        this.userMessage = 'Enter your password to sign in';
        this.ssoToken = "";
        this.doShowSignup2 = true;
        this.gdprstatus = (sessionStorage.getItem('gdprstatus') == null || sessionStorage.getItem('gdprstatus') != 'false') ? 'true' : 'false';

        if (this.isViaTeams && (this.info != undefined || this.info != null)) {
            this.loadTeamsError(this.info);
            this.clearCookies();
            return;
        }
        
        this.isSigning$ = merge(
            actions.pipe(ofType(login), mapTo(true)),
            actions.pipe(ofType(loginFails, loginSuccess), mapTo(false))
        ).pipe(startWith(false));

        actions
            .pipe(takeUntil(this.destroy$), ofType(loginFails))
            .subscribe(({ error }) => {
                logger.debug('login error', error);

                if (error == 'Error: NUMBERS_NOT_AVAILABLE') {
                    sessionStorage.removeItem('ssoToken');
                }

                if (error instanceof HttpErrorResponse) {
                    const internalError = error.error;

                    if (internalError) {
                        logger.debug('InternalError::apiReturnCode::', internalError.apiReturnCode);
                        if (internalError.apiReturnCode === 14000) {
                            this.doShowSignup2 = true;
                            this.doShowSignup = true;
                            this.info = null;
                        }
                        else if (internalError.apiReturnCode === 14001) {
                            //window.open(internalError.redirect, "_self");
                            this.appExternalUrl = internalError.redirect;
                            this.onGoToPage();
                        } else if (internalError.apiReturnCode === 13000
                            || internalError.apiReturnCode === 25001
                            || internalError.apiReturnCode === 23501
                            || internalError.apiReturnCode === 23502
                            || internalError.apiReturnCode === 23701
                            || internalError.apiReturnCode === 23504
                            || internalError.apiReturnCode === 23503
                            || internalError.apiReturnCode === 24005
                            || internalError.apiReturnCode === 22018) {
                            this.clearCookies();
                        }
                    }

                    const message = getApiErrorMessage(error);
                    if (this.isViaTeams) {
                        this.loadTeamsError(message);
                        this.clearCookies();
                    } else {
                        if (message.includes('Invalid') || message.includes('username')) {
                            this.loginForm.setErrors({
                                send: message
                            });
                        } else if(message.includes("sso_redirect")){
                            logger.debug("SSO redirection");
                        } else {
                            this.loginForm.setErrors({
                                send: message +' '+'Please contact your Administrator.',
                            });
                        }
                    }
                } else {
                    const msg = extractErrorCode(error);
                    this.error = msg;
                    let authorisedAccess = false;

                    if(msg == 'You are not authorized to access the resource' || msg == 'MultiLine Messaging for MS Teams is not enabled for this email ID.'){
                        authorisedAccess = true;
                        this.authDataService.loadViaTeamsMobileEvent(true);
                        window['MOVIUS_EMBEDED_APP'] = 'messaging';
                        sessionStorage.setItem("isLogingViaTeams", "true");
                    }
                    this.appEmbededStatus = getFeatureEnabled();
                    if (this.isViaTeams || (!this.isViaTeams && authorisedAccess)) {
                        this.loadTeamsError(msg);
                        this.clearCookies();
                    }
                    const sendError = this.loginForm.setErrors({
                        send: mapSendErrorMessage(msg),
                    });

                    if(this.isViaTeams && isEmpty(error)){
                            this.loadTeamsError('Something went wrong.');
                        this.clearCookies();
                    }

                }
                logger.debug(this.loginForm.valid, this.loginForm.errors);
                this.authDataService.loaderSpinnerEvent(false);
                this.cdr.markForCheck();
            });

            this.authDataService.isViaTeamsMobileObs.subscribe(data => {
                this.isViaTeamsMobile = data;
            })

    }

    setTimeOutForTeamsLogin() {
        // setTimeout(() => {
        //     if (sessionStorage.getItem("userEmail") !== null
        //         && sessionStorage.getItem("userEmail") !== ''
        //         && sessionStorage.getItem("authToken") !== null
        //         && sessionStorage.getItem("authToken") !== '') {
        //         logger.debug("necessary condition for login is met");
        //         // this.onTeamsSSOSignIn()
        //     } else if (sessionStorage.getItem("teams_error_status") === "true") {
        //         const err = sessionStorage.getItem("teams_error_desc");
        //         this.loadTeamsError('Error logging in.' + err + ".");
        //         this.clearCookies();
        //     } else {
        //         logger.debug("came to if false part");
        //         this.setTimeOutForTeamsLogin()
        //     }
        // },
        //     1000)
    }

    ngOnInit(): void {
        logger.debug("ngOnInit called")
        const model: FormModel<ClientLoginData> = {
            email: ['', [Validators.required, topLevelDomainEmailValidator()]],
            password: ['', [Validators.required]],
            sso_access_token: ['', [Validators.required]],
        };

        this.loginForm = this._formBuilder.group(model);
        logger.debug('calling cookie method');

        this.authDataService.tokenRecieved.subscribe((res) => {
            if (this.isViaTeams && res && sessionStorage.getItem('userEmail')) {
                this.onTeamsSSOSignIn();
            }
        });
        this.authDataService.unauthorized.subscribe((res) => {
            if (!res.status) {
                this.store.dispatch(loginFails({error:res.details}))
            }
        });

        this.authDataService.teamsError.subscribe((res) => {
            if (res.status && res.details) {
                this.loadTeamsError('Error logging in.' + res.details + ".");
                this.clearCookies();
            }
        });

        if (this.isViaTeams) {
            this.setTimeOutForTeamsLogin();
        }
        else {
            this.ngOnCookie();
        }
    }


    get isViaTeams() {
        if (this.appEmbededStatus === 'messaging') //&& sessionStorage.getItem("isLogingViaTeams") === "true")
            return true
        else
            return false
    }

    ngOnDestroy() {
        this.destroy$.next();
    }

    onContinue() {
        this.loginForm.value.password = 'x';
        const val = this.loginForm.value;
        this.store.dispatch(login(val));
    }

    async onSignIn() {
        if (this.appEmbededStatus === 'messaging') //Comment this when running locally
            this.loginForm.value.sso_access_token = sessionStorage.getItem('authToken');
        this.loginForm.setErrors({});
        const val = this.loginForm.value;
        this.store.dispatch(login(val));
    }

    listOfErrors(control): string[] {
        this.emailError = false;
        return !!control.errors
            ? Object.keys(control.errors).map((field) =>
                LoginComponent.errorMessages[field](control.errors[field])
            )
            : [];
    }

    backToPage() {
        this.loginForm.get('password').reset();
    }

    getFormValidationErrors() {
        let res = [];
        Object.keys(this.loginForm.controls).forEach((key) => {
            const control: ValidationErrors = this.loginForm.get(key);
            if (control !== null) {
                res = [...res, this.listOfErrors(control).filter((e) => !!e)];
            }
        });
        return res;
    }

    async onForgotPassword() {
        const email = this.loginForm.value.email;

        try {
            await this.resetPasswordDataAccess
                .triggerResetPassword(email)
                .toPromise();
        } finally {
            this.router.navigate(
                ['..', 'pin', { email, isResetPassword: true }],
                {
                    relativeTo: this.activatedRoute,
                }
            );
        }
    }

    isSpecialErrorVisible() {
        return this.error === noNumbersError;
    }

    clearError() {
        this.error = null;
    }

    ngOnCookie() {
        logger.debug('cookie method');
        //const str = "{:email_address=>\"gunti.rao%40moviuscorp.com\",+:return=>\"0\",+:desc=>\"Success\",+:sso_access_token=>\"eyJ0eXAiOiJKV1QiLCJub25jZSI6IlhOcFFOQmZUN09ZVEhlMkoxWFlubWZ5RlNCUzdVTENQWWlmNXFaN0RjSUkiLCJhbGciOiJSUzI1NiIsIng1dCI6Im5PbzNaRHJPRFhFSzFqS1doWHNsSFJfS1hFZyIsImtpZCI6Im5PbzNaRHJPRFhFSzFqS1doWHNsSFJfS1hFZyJ9.eyJhdWQiOiIwMDAwMDAwMy0wMDAwLTAwMDAtYzAwMC0wMDAwMDAwMDAwMDAiLCJpc3MiOiJodHRwczovL3N0cy53aW5kb3dzLm5ldC9mZjA5YmJiOC1lNTRlLTRkMmMtYTNiZC0wYzgwN2U3MTY0MzEvIiwiaWF0IjoxNjI4MDgzNjgzLCJuYmYiOjE2MjgwODM2ODMsImV4cCI6MTYyODA4NzU4MywiYWNjdCI6MCwiYWNyIjoiMSIsImFjcnMiOlsidXJuOnVzZXI6cmVnaXN0ZXJzZWN1cml0eWluZm8iLCJ1cm46bWljcm9zb2Z0OnJlcTEiLCJ1cm46bWljcm9zb2Z0OnJlcTIiLCJ1cm46bWljcm9zb2Z0OnJlcTMiLCJjMSIsImMyIiwiYzMiLCJjNCIsImM1IiwiYzYiLCJjNyIsImM4IiwiYzkiLCJjMTAiLCJjMTEiLCJjMTIiLCJjMTMiLCJjMTQiLCJjMTUiLCJjMTYiLCJjMTciLCJjMTgiLCJjMTkiLCJjMjAiLCJjMjEiLCJjMjIiLCJjMjMiLCJjMjQiLCJjMjUiXSwiYWlvIjoiRTJaZ1lEZ1NMR0Z3dEtTUHRWaVZlOFd5TFRkTy9KcXZ3dFQ1bnYzUmExRlp3UnNKSEw0QSIsImFtciI6WyJwd2QiXSwiYXBwX2Rpc3BsYXluYW1lIjoiRGVza3RvcC9XZWIgQXBwIiwiYXBwaWQiOiJhZTFhZjkzNi02N2I4LTRiMzktODMzOS1jMDdhMTcxZjkyMmQiLCJhcHBpZGFjciI6IjEiLCJmYW1pbHlfbmFtZSI6IlJhbyIsImdpdmVuX25hbWUiOiJHdW50aSIsImlkdHlwIjoidXNlciIsImlwYWRkciI6IjEwMy41MS4yMi41OCIsIm5hbWUiOiJHdW50aSBSYW8iLCJvaWQiOiI3ZDQyMGZjNC1kMWEzLTQ5MTQtOGZmNi1lYWNmNjA4MzQyYjMiLCJvbnByZW1fc2lkIjoiUy0xLTUtMjEtMjM4NzE2NjQzNy0yNTQzNzgzNjAxLTIyMDcxNjA3Mi0yNzExMyIsInBsYXRmIjoiMyIsInB1aWQiOiIxMDAzMjAwMTQ4OTQ5QkNFIiwicmgiOiIwLkFWb0F1THNKXzA3bExFMmp2UXlBZm5Ga01UYjVHcTY0WnpsTGd6bkFlaGNma2kxYUFDZy4iLCJzY3AiOiJDb250YWN0cy5SZWFkLlNoYXJlZCBDb250YWN0cy5SZWFkV3JpdGUgZW1haWwgb3BlbmlkIFBlb3BsZS5SZWFkIHByb2ZpbGUiLCJzaWduaW5fc3RhdGUiOlsia21zaSJdLCJzdWIiOiJqN0dkTjZqdnJaVnJuWHZzYzhxdXh4NnlERGRkSkNiVDhlQ0x6aU5zQWQ0IiwidGVuYW50X3JlZ2lvbl9zY29wZSI6Ik5BIiwidGlkIjoiZmYwOWJiYjgtZTU0ZS00ZDJjLWEzYmQtMGM4MDdlNzE2NDMxIiwidW5pcXVlX25hbWUiOiJHdW50aS5SYW9ATW92aXVzQ29ycC5jb20iLCJ1cG4iOiJHdW50aS5SYW9ATW92aXVzQ29ycC5jb20iLCJ1dGkiOiJNb0xQeDEzUlkwcTdmV3ZzZXc4RkFnIiwidmVyIjoiMS4wIiwid2lkcyI6WyJiNzlmYmY0ZC0zZWY5LTQ2ODktODE0My03NmIxOTRlODU1MDkiXSwieG1zX3N0Ijp7InN1YiI6ImJFZFRCTWFrNjk4VG00d0I4RkhnMV9hc2dGXzA3aGFRNWNUdm8zRzNReTgifSwieG1zX3RjZHQiOjEzMjgxOTI0NzN9.LyLpIRQ3d4_Alr_lCQYiWg3wf77CuhPcwm8XEK-zdL1HuMV8uODJhzq5qA2p5AZsxoVBuOmHjVhCWqfxpm8OF3YMTVF_cS5389caLU5cQsTxV1ABxRCT865sUD5AzAI_DExFX_JtKn--xbCr_7RFgnBELfrAPC1ZwemBVvKh04yCUP10z_CLVVNQmWGd_zgyFBHIHR-2dHcM7d2b1zOPuv7OHvS5Bd-ivthGYm7XYsHoCcHoCLZHIbvH0nxP-Lrcjmel0h5fB5oFTybnRS87XQq2ZqaVqKEyes6vVk-ISnlRGYCVahkZ-F4YBlOnNp-iAAf6sePotvwgHn5AVeDJPA\"}";
        //const str2 = JSON.stringify(str);
        if (sessionStorage.getItem('oidc') != "\"\""
            && sessionStorage.getItem('oidc') != null
            && typeof (sessionStorage.getItem('oidc')) != 'undefined') {
            const values = JSON.parse(sessionStorage.getItem('oidc')).split(':');
            //const values = JSON.parse(str2).split(':');
            //const values = [];

            if (values.length > 0) {
                const email_address = values[values.length - 4].split('=>');
                const sso_token = values[values.length - 1].split('=>');
                let email = "";
                let validEmail = ''
                let token = "";

                if (email_address.length > 1) {
                    for (let i = 0; i < email_address[1].length; i++) {
                        if (email_address[1].charAt(i) == "\"") {
                            continue;
                        }
                        else if (email_address[1].charAt(i) == "\"") {
                            continue;
                        }
                        else if (email_address[1].charAt(i) == ",") {
                            continue;
                        }
                        else if (email_address[1].charAt(i) == "+") {
                            continue;
                        }
                        else if (email_address[1].charAt(i) == "") {
                            continue;
                        }

                        if (email == "") {
                            email = email_address[1].charAt(i);
                        } else {
                            email = email + email_address[1].charAt(i);
                        }
                    }

                    for (let i = 0; i < email.length; i++) {
                        if (email.charAt(i) == '4' || email.charAt(i) == '0') {
                            continue;
                        }

                        if (i == 0) {
                            validEmail = email.charAt(i);
                        } else {
                            if (email.charAt(i) == '%') {
                                validEmail = validEmail + '@';
                            } else {
                                validEmail = validEmail + email.charAt(i);
                            }
                        }
                    }

                    this.email = validEmail;
                }

                if (sso_token.length > 1) {
                    for (let i = 0; i < sso_token[1].length; i++) {
                        if (sso_token[1].charAt(i) == "\"") {
                            continue;
                        }
                        else if (sso_token[1].charAt(i) == "}") {
                            continue;
                        }
                        else if (sso_token[1].charAt(i) == "") {
                            continue;
                        }

                        if (token == "") {
                            token = sso_token[1].charAt(i);
                        } else {
                            token = token + sso_token[1].charAt(i);
                        }
                    }

                    this.ssoToken = token;
                }
            }

            //showing error message on using mail id which is not configured in azure for sso
            if (this.email == undefined) {
                this.emailError = true;
                this.emailErrorText = 'This Email ID is not registered on azure. Please enter a valid mail ID to proceed.';
            }

            if (this.gdprstatus == 'false') {
                logger.debug('clearing the mail id when gdpr status is set to false');
                //this.email = null;
                this.doShowSignup = false;
            }

            logger.debug('Cookie email - ', this.email);
            //logger.debug('Cookie sso token - ', this.ssoToken);

            if (this.email != null && this.ssoToken != null) {
                sessionStorage.setItem('userEmail', this.email);
                sessionStorage.setItem('ssoToken', this.ssoToken);
                this.onSSOSignIn();
            }
        }
    }

    clearCookies() {
        const isTeamsLogin = this.isViaTeams;
        sessionStorage.clear();
        localStorage.removeItem("cacheRehidrate")
        this.cookieService.delete("sso_response", "/", "moviuscorp.net", true, "None");
        this.loginForm.value.sso_access_token = "";
        if (isTeamsLogin) {
            this.turnoffTeamsLogin = true
            sessionStorage.setItem("isLogingViaTeams", "true");
        }
    }

    async onSSOSignIn() {
        logger.debug('calling sso login');
        this.loginForm.setErrors({});
        this.loginForm.value.email = this.email;
        this.loginForm.value.password = "x";
        this.loginForm.value.sso_access_token = this.ssoToken;
        this.userMessage = '';
        this.doShowSignup2 = false;
        this.doShowSignup = true;
        this.info = null;
        const val = this.loginForm.value;
        this.loginForm.setValue(val);
        this.store.dispatch(login(val));
    }

    async onTeamsSSOSignIn() {
        logger.debug('calling Teams sso login');
        this.loginForm.setErrors({});
        this.loginForm.value.email = sessionStorage.getItem('userEmail');
        this.loginForm.value.password = "x";
        this.loginForm.value.sso_access_token = sessionStorage.getItem('authToken');
        this.userMessage = '';
        this.doShowSignup2 = true;
        this.doShowSignup = true;
        this.info = null;
        const val = this.loginForm.value;
        this.loginForm.setValue(val);
        this.store.dispatch(login(val));
    }

    onGoToPage() {
        window.location.href = this.appExternalUrl;
    }

    loadTeamsError(errorText: string) {
        this.modalService
            .create({
                nzContent: TeamsErrorDisplayComponent,
                nzComponentParams: {
                    errorTeamsText: errorText,
                },
                nzStyle: {
                    height: '100%',
                    width: '100%',
                    top: '0px',
                    margin: '0px',
                },
                nzMask: false,
                nzFooter: null,
                nzClosable: false,
                nzMaskClosable: false,
                nzKeyboard: false,
            })
    }

}
