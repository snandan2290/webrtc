// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { Injectable } from '@angular/core';
import { Client } from '@microsoft/microsoft-graph-client';
import { MSGraphSignInService } from './signin';
import { MSUser } from './user';

@Injectable()
export class MSGraphAuthService {
    public authenticated = false;
    public user: MSUser;
    constructor(private readonly signinService: MSGraphSignInService) {}

    // Prompt the user to sign in and
    // grant consent to the requested permission scopes
    async signIn(): Promise<void> {
        const result = await this.signinService.signIn();

        if (result) {
            this.updateAuthenticatedUser();
        }
    }

    // Sign out
    async signOut(silent = false) {
        await this.signinService.signOut(silent);
        this.user = null;
        this.authenticated = false;
    }

    // Silently request an access token
    async getAccessToken(): Promise<string> {
        //const token = await this.signinService.getAccessToken();
        let token = null;
        if (sessionStorage.getItem('ssoToken') != null){
            token = sessionStorage.getItem('ssoToken');
        } else {
            token = await this.signinService.getAccessToken();
        }
        this.updateAuthenticatedUser();
        return token;
    }

    private updateAuthenticatedUser() {
        this.authenticated = true;
        const userName = this.signinService.activeAccountUserName;
        this.user = {
            displayName: userName,
            email: userName,
            avatar: null,
        };
    }
}
