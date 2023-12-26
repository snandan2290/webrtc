import { InjectionToken } from '@angular/core';

export interface MsGraphConfig {
    clientId: string;
    redirectUrl: string;
    scopes: string[];
}

export const MS_GRAPH_CONFIG = new InjectionToken<MsGraphConfig>(
    'MS_GRAPH_CONFIG'
);

export interface ISignIn {
    signIn(): Promise<any>;
    getAccessToken(): Promise<string>;
    signOut(): void;
}
