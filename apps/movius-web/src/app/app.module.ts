import { registerLocaleData } from '@angular/common';
import { HttpClientModule, HTTP_INTERCEPTORS } from '@angular/common/http';
import en from '@angular/common/locales/en';
import {
    ApplicationRef,
    APP_INITIALIZER,
    DoBootstrap,
    ErrorHandler,
    NgModule,
} from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { EncryptService } from '@movius/encrypt';
import {
    MSGraphAuthService,
    MsGraphModule,
    MSGraphService,
} from '@movius/msgraph';
import { EffectsModule } from '@ngrx/effects';
import { ActionReducer, Store, StoreModule } from '@ngrx/store';
import { StoreDevtoolsModule } from '@ngrx/store-devtools';
import { SipConfig, SipModule, SipService } from '@scalio/sip';
import { MsGraphConfig } from 'libs/msgarph/src/lib/signin/sigin.models';
import { MockSipService } from 'libs/sip/src/lib/mock-sip.service';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDropDownModule } from 'ng-zorro-antd/dropdown';
import { en_US, NZ_I18N } from 'ng-zorro-antd/i18n';
import { NzLayoutModule } from 'ng-zorro-antd/layout';
import { NzMenuModule } from 'ng-zorro-antd/menu';
import { NzModalModule, NzModalService } from 'ng-zorro-antd/modal';
import { NzPopoverModule } from 'ng-zorro-antd/popover';
import { storeLogger } from 'ngrx-store-logger';
import { NgxStronglyTypedFormsModule } from 'ngx-strongly-typed-forms';
import { environment } from '../environments/environment';
import {
    ActiveCallsEffects,
    activeCallsReducer,
    CallingHistoryEffects,
    callingHistoryReducer,
} from '../libs/feature-calling';
import { ContactsEffects, contactsReducer } from '../libs/feature-contacts';
import { MessagingEffects, messagingReducer } from '../libs/feature-messaging';
import {
    AUTH_CONFIG,
    CheckOnlineStatusSettings,
    CHECK_ONLINE_STATUS_SETTINGS,
    ConfirmDialogComponent,
    DbContext,
    SharedModule,
} from '../libs/shared';
import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { IconsProviderModule } from './icons-provider.module';
import {
    HttpBaseUrlInterceptor,
    HttpXmlInterceptor,
    HTTP_BASE_URL_CONFIG,
} from './interceptors';
import { MainLayoutComponent } from './main-layout/main-layout.component';
import { CookieService } from 'ngx-cookie-service';
import * as bowser from 'bowser';
import {LoggerFactory} from '@movius/ts-logger';
import { SettingsModule } from '../libs/feature-settings';
export const ts_logger = LoggerFactory.getLogger("")

registerLocaleData(en);

const angularModules = [
    BrowserModule,
    FormsModule,
    ReactiveFormsModule,
    HttpClientModule,
    BrowserAnimationsModule,
];

const ngZorroModules = [
    IconsProviderModule,
    NzLayoutModule,
    NzMenuModule,
    NzModalModule,
    NzButtonModule,
    NzPopoverModule,
    NzDropDownModule,
];

const routingModules = [AppRoutingModule];

const solutionModules = [SharedModule];

//@ts-ignore
const isCypress = window.Cypress;

const sipConfig: SipConfig = {
    ...(environment.useMoviusServer
        ? environment.sipMovius
        : environment.sipTest),
    onFixContactRegisterer: environment.useMoviusServer
        ? (options, contact, registerer) => {
            // Fix contact to work with movius server
            // take VIA token
            const token = /<sip:(\w+)\@([\w\.]+)/.exec(contact.toString())[2];
            const user = options.uri.user;
            const contactHeaderValue = `"${user}"<sips:${user}@${token};rtcweb-breaker=yes;transport=wss>;click2call=no;+g.oma.sip-im;+audio;language="en"`;
            contact.uri.user = user;
            registerer['generateContactHeader'] = (expires) => {
                return contactHeaderValue;
            };
        }
        : undefined,
};

if (!!window['MOVIUS_ICE_GATHERING_TIMEOUT']) {
    sipConfig.iceGatheringTimeout = parseInt(
        window['MOVIUS_ICE_GATHERING_TIMEOUT']
    );
}

class WebSocketErrorHandler implements ErrorHandler {
    handleError(error) {
        ts_logger.error(error.stack);
        console.log(error);
    }
}

if (!!window['MOVIUS_SIP_AGENT']) {
    sipConfig.userAgentString = window['MOVIUS_SIP_AGENT'];
}

if (!!window['MOVIUS_REGISTERER_EXPIRES_TIMEOUT']) {
    sipConfig.registererExpiresTimeout = parseInt(
        window['MOVIUS_REGISTERER_EXPIRES_TIMEOUT']
    );
}

// logger for e2e specs

export function logger(reducer: ActionReducer<any>): any {
    // default, no options
    return storeLogger()(reducer);
}

export const metaReducers = environment.production ? [] : [logger];

//

const ngrxModules = [
    EffectsModule.forRoot(),
    StoreModule.forRoot(
        {
            activeCalls: activeCallsReducer,
            callingHistory: callingHistoryReducer,
            contacts: contactsReducer,
            messaging: messagingReducer,
        },
        { metaReducers }
    ),
    EffectsModule.forRoot([
        CallingHistoryEffects,
        ContactsEffects,
        MessagingEffects,
        ActiveCallsEffects,
    ]),
    StoreDevtoolsModule.instrument(),
];

// bootstrap domain
const mapBrowserVersion = (ver: string) => ver && ver.replace(/\./g, '');

export function initializeApp(
    dbContext: DbContext,
    encryptService: EncryptService,
    modalService: NzModalService
) {
    const notSupportedMessage = `
        It looks like you are using a web browser version that we don't support.
        <br/>
        <br/>
        Recommended browser versions:
        <br/>
        <p>Chrome ${window['MOVIUS_CHROME_MIN_VERSION']}+, Safari ${window['MOVIUS_SAFARI_MIN_VERSION']}+, Microsoft Edge ${window['MOVIUS_EDGE_MIN_VERSION']}+</p>
    `;
    return async () => {
        try {
            await dbContext.init(2, encryptService);
        } catch (e) {
          console.log("ERROR while DBContext init::" + e.message);
        }

        try {
            const sysInfo = bowser.getParser(window.navigator.userAgent);
            const browserName = sysInfo.getBrowserName();
            const browserVersion = mapBrowserVersion(
                sysInfo.getBrowserVersion()
            );
            const edgeMinVersion =
                window['MOVIUS_EDGE_MIN_VERSION'] &&
                mapBrowserVersion(window['MOVIUS_EDGE_MIN_VERSION']);
            const safariMinVersion =
                window['MOVIUS_SAFARI_MIN_VERSION'] &&
                mapBrowserVersion(window['MOVIUS_SAFARI_MIN_VERSION']);
            const chromeMinVersion =
                window['MOVIUS_CHROME_MIN_VERSION'] &&
                mapBrowserVersion(window['MOVIUS_CHROME_MIN_VERSION']);
            const firefoxMinVersion =
                window['MOVIUS_FIREFOX_MIN_VERSION'] &&
                mapBrowserVersion(window['MOVIUS_FIREFOX_MIN_VERSION']);

            let fNotSupportedVersion = false;
            if (
                chromeMinVersion &&
                browserName === 'Chrome' &&
                chromeMinVersion > browserVersion
            ) {
                fNotSupportedVersion = true;
            } else if (
                edgeMinVersion &&
                browserName === 'Microsoft Edge' &&
                edgeMinVersion > browserVersion
            ) {
                fNotSupportedVersion = true;
            } else if (
                safariMinVersion &&
                browserName === 'Safari' &&
                safariMinVersion > browserVersion
            ) {
                fNotSupportedVersion = true;
            } else if (
                firefoxMinVersion &&
                browserName === 'Firefox' &&
                firefoxMinVersion > browserVersion
            ) {
                fNotSupportedVersion = true;
            }

            if (fNotSupportedVersion) {
                return modalService
                    .create({
                        nzContent: ConfirmDialogComponent,
                        nzClosable: false,
                        nzMaskClosable: false,
                        nzComponentParams: {
                            titleTxt: 'Browser not supported',
                            subTitleTxt: notSupportedMessage,
                            type: 'Normal',
                            appearance: 'Centered',
                        },
                        nzBodyStyle: {
                            width: '26rem',
                        },
                        nzWidth: '26rem',
                        nzFooter: null,
                    })
                    .afterClose.toPromise();
            }
        } catch (e) {
            return modalService
                .create({
                    nzContent: ConfirmDialogComponent,
                    nzClosable: false,
                    nzMaskClosable: false,
                    nzComponentParams: {
                        titleTxt: 'Browser not supported',
                        subTitleTxt:
                            'You might be browsing in Firefox private mode which is not supported by the application',
                        type: 'Normal',
                        appearance: 'Centered',
                    },
                    nzBodyStyle: {
                        width: '26rem',
                    },
                    nzWidth: '26rem',
                    nzFooter: null,
                })
                .afterClose.toPromise();
        }
    };
}

//
const msGraphConfig: MsGraphConfig = environment.msGraph;

if (msGraphConfig) {
    if (!!window['MOVIUS_MS_GRAPH_CLIENT_ID']) {
        msGraphConfig.clientId = window['MOVIUS_MS_GRAPH_CLIENT_ID'];
    }
    if (!!window['MOVIUS_MS_GRAPH_LOGOUT_URL']) {
        msGraphConfig.redirectUrl = window['MOVIUS_MS_GRAPH_LOGOUT_URL'];
    }
}

const baseUrl = window['MOVIUS_API_BASE_URL'] || environment.baseUrl;

// check online status
const checkOnlineStatusUrl =
    window['MOVIUS_CHECK_ONLINE_STATUS_URL'] ||
    environment.checkOnlineStatus?.checkUrl ||
    'https://upload.wikimedia.org/wikipedia/commons/c/ca/1x1.png';
const checkOnlineStatusInterval =
    +window['MOVIUS_CHECK_ONLINE_STATUS_INTERVAL'] ||
    environment.checkOnlineStatus?.checkInterval ||
    5000;

const checkOnlineStatusSettings: CheckOnlineStatusSettings = {
    checkInterval: checkOnlineStatusInterval,
    checkUrl: checkOnlineStatusUrl,
};
@NgModule({
    declarations: [AppComponent, MainLayoutComponent],
    imports: [
        ...routingModules,
        ...angularModules,
        ...ngZorroModules,
        ...solutionModules,
        ...ngrxModules,
        SettingsModule,
        SipModule.forRoot(sipConfig),
        MsGraphModule.forRoot(msGraphConfig),
        NgxStronglyTypedFormsModule,
    ],
    providers: [
        {
            provide: APP_INITIALIZER,
            useFactory: initializeApp,
            multi: true,
            deps: [DbContext, EncryptService, NzModalService],
        },
        { provide: NZ_I18N, useValue: en_US },
        { provide: AUTH_CONFIG, useValue: baseUrl },
        {
            provide: HTTP_BASE_URL_CONFIG,
            useValue: baseUrl,
        },
        {
            provide: HTTP_INTERCEPTORS,
            multi: true,
            useClass: HttpBaseUrlInterceptor,
        },
        {
            provide: HTTP_INTERCEPTORS,
            multi: true,
            useClass: HttpXmlInterceptor,
        },
        {
            provide: CHECK_ONLINE_STATUS_SETTINGS,
            useValue: checkOnlineStatusSettings,
        },
        {
            provide: ErrorHandler,
            useClass: WebSocketErrorHandler
        },
    ],
    // bootstrap: [AppComponent],
})
export class AppModule implements DoBootstrap {
    cookieValue: string;
    constructor(
        private readonly store: Store,
        private readonly msGraphService: MSGraphService,
        private readonly msGraphAuthService: MSGraphAuthService,
        private readonly sipService: SipService,
        // private cookieService: CookieService
    ) {
        // this.cookieValue = this.cookieService.get('sso_response'); // To Get Cookie
        // console.log('cookie value - ', this.cookieValue)
        // sessionStorage.setItem("oidc", JSON.stringify(this.cookieValue));
    }

    ngDoBootstrap(appRef: ApplicationRef) {
        appRef.bootstrap(AppComponent);

        //@ts-ignore
        if (window.Cypress) {
            //@ts-ignore
            window.appRef = appRef;
            //@ts-ignore
            window.appStore = this.store;
            //@ts-ignore
            window.msGraphService = this.msGraphService;
            //@ts-ignore
            window.msGraphAuthService = this.msGraphAuthService;
            //@ts-ignore
            window.mockSipService = this.sipService as MockSipService;
        }
    }
}
