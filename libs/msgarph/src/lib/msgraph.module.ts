import { CommonModule } from '@angular/common';
import { ModuleWithProviders, NgModule } from '@angular/core';
import { MsalModule, MsalService, MSAL_INSTANCE } from '@azure/msal-angular';
import {
    BrowserCacheLocation,
    IPublicClientApplication,
    PublicClientApplication,
} from '@azure/msal-browser';
import { ElectronService, NgxElectronModule } from 'ngx-electron';
import { MSGraphAuthService } from './auth.service';
import { MSGraphService } from './graph.service';
import { MSGraphElectronSignInService, MSGraphSignInService } from './signin';
import { MsGraphConfig, MS_GRAPH_CONFIG } from './signin/sigin.models';

export function createSignInService(
    electronService: ElectronService,
    config: MsGraphConfig,
    msalService: MsalService
) {
    return !electronService.isElectronApp
        ? new MSGraphSignInService(config, msalService)
        : new MSGraphElectronSignInService(config, electronService);
}

const isIE =
    window.navigator.userAgent.indexOf('MSIE ') > -1 ||
    window.navigator.userAgent.indexOf('Trident/') > -1;

export function MSALInstanceFactory(
    config: MsGraphConfig
): IPublicClientApplication {
    return new PublicClientApplication({
        auth: {
            clientId: config.clientId,
            authority: 'https://login.microsoftonline.com/common',
            redirectUri: config.redirectUrl,
            postLogoutRedirectUri: config.redirectUrl,
        },
        cache: {
            cacheLocation: BrowserCacheLocation.LocalStorage,
            storeAuthStateInCookie: isIE, // set to true for IE 11
        },
    });
}

@NgModule({
    imports: [CommonModule, NgxElectronModule, MsalModule],
    providers: [MSGraphAuthService, MSGraphService],
})
export class MsGraphModule {
    static forRoot(config: MsGraphConfig): ModuleWithProviders<MsGraphModule> {
        return {
            ngModule: MsGraphModule,
            providers: [
                {
                    provide: MS_GRAPH_CONFIG,
                    useValue: config,
                },
                {
                    provide: MSAL_INSTANCE,
                    useValue: MSALInstanceFactory(config),
                },
                {
                    provide: MSGraphSignInService,
                    useFactory: createSignInService,
                    deps: [ElectronService, MS_GRAPH_CONFIG, MsalService],
                },
                MsalService,
            ],
        };
    }
}
