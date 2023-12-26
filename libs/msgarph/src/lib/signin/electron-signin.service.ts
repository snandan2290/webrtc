import { Inject, Injectable } from '@angular/core';
import { ElectronService } from 'ngx-electron';
import { ISignIn, MsGraphConfig, MS_GRAPH_CONFIG } from './sigin.models';

@Injectable({
    providedIn: 'root',
})
export class MSGraphElectronSignInService implements ISignIn {
    private accessToken: string;
    public authenticated = false;

    constructor(
        @Inject(MS_GRAPH_CONFIG) private readonly config: MsGraphConfig,
        private readonly electronService: ElectronService
    ) {}

    // Prompt the user to sign in and
    // grant consent to the requested permission scopes
    async signIn(): Promise<any> {

        this.electronService.ipcRenderer.invoke('login', this.config);

        return new Promise((resolve, reject) => {
            // TODO : dispose listeners
            this.electronService.ipcRenderer.once(
                'loginSuccess',
                (_, token) => {
                    this.accessToken = token;
                    resolve(token);
                }
            );

            this.electronService.ipcRenderer.once('loginError', (_, error) => {
                reject(error);
            });
        });
    }

    // Silently request an access token
    async getAccessToken(): Promise<string> {
        return Promise.resolve(this.accessToken);
    }

    signOut() {
        this.accessToken = null;
    }
}
