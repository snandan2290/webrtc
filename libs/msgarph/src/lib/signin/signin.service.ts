import { Inject, Injectable } from '@angular/core';
import { MsalService } from '@azure/msal-angular';
import { ISignIn, MsGraphConfig, MS_GRAPH_CONFIG } from './sigin.models';

declare var msalApp;

@Injectable({
    providedIn: 'root',
})
export class MSGraphSignInService implements ISignIn {
    private accessToken: string;
    private accessTokenExpiresOn: Date;
    public authenticated = false;
    private readonly authParams: any; /*AuthenticationParameters*/

    constructor(
        @Inject(MS_GRAPH_CONFIG) private readonly config: MsGraphConfig,
        private readonly msalService: MsalService
    ) {
        this.authParams = {
            appId: this.config.clientId,
            redirectUri: this.config.redirectUrl,
            scopes: config.scopes,
        };
    }

    private removeForceLoginVars(){
        sessionStorage.removeItem("newUserOnboarding")
        sessionStorage.removeItem("initMsGraphPath")
    }

    private checkAccount() {
        const accounts = this.msalService.instance.getAllAccounts();
        if (accounts.length === 0) {
            this.removeForceLoginVars()
            console.warn('Unexpected accounts count', accounts);
            localStorage.setItem('contactSync', 'false');
            throw new Error(`Unexpected accounts count`);
        } else {
            const isNewUserOnboarding = sessionStorage.getItem("newUserOnboarding")
            const isInitMsGraphPath = sessionStorage.getItem("initMsGraphPath")
            const isDifferentUser = sessionStorage.getItem("differentUserlLogin")
            if((isNewUserOnboarding === "true" || isDifferentUser == "true") && isInitMsGraphPath === "true"){
                this.removeForceLoginVars()
                console.warn('Unexpected accounts count', accounts);
                throw new Error(`Unexpected accounts count`);
            }else{
                /**for now just remove the session variables 
                 * need to revisit when working for different user logins
                 * when exchange is synced for prev user..
                 * 1) no new onboard but with init true check user diffs
                */
                this.removeForceLoginVars()
                accounts.forEach((act, index) => {
                    if(act.username.toUpperCase() === sessionStorage.getItem("__api_name__").toUpperCase()){
                       this.msalService.instance.setActiveAccount(accounts[index]);
                    }
                 });
            }
        }
    }

    // Prompt the user to sign in and
    // grant consent to the requested permission scopes
    async signIn(): Promise<any> {
        const result = await this.msalService
            .loginPopup({
                prompt: 'consent',
                scopes: this.config.scopes,
            })
            .toPromise();
        if (result) {
            return await this.getAccessToken();
        } else {
            return null;
        }
    }

    // Silently request an access token
    async getAccessToken(): Promise<string> {
        this.checkAccount();
        if (this.accessToken && new Date() < this.accessTokenExpiresOn) {
            return this.accessToken;
        }
        const result = await this.msalService
            .acquireTokenSilent(this.authParams)
            .toPromise();
        if (result) {
            this.accessToken = result.accessToken;
            this.accessTokenExpiresOn = result.expiresOn;
        }
        return this.accessToken;
    }

    get activeAccountUserName() {
        const account = this.msalService.instance.getActiveAccount();
        return account && account.username;
    }

    async signOut(silent = false) {
        this.accessToken = null;
        this.accessTokenExpiresOn = null;
        try {
            // https://github.com/AzureAD/microsoft-authentication-library-for-js/discussions/3123
            // https://github.com/AzureAD/microsoft-authentication-library-for-js/issues/2563
            // https://github.com/AzureAD/microsoft-authentication-library-for-js/issues/113
            // https://github.com/AzureAD/microsoft-authentication-library-for-js/issues/1386

            if (silent) {
                await this.msalService
                    .logout({ onRedirectNavigate: () => false })
                    .toPromise();
            } else {
                await this.msalService.logout();
            }
        } catch (err) {
            console.log('logout error', err);
            return null;
        }
    }
}
