import { Injectable, NgModule } from '@angular/core';
import {
    ActivatedRoute,
    ActivatedRouteSnapshot,
    CanActivateChild,
    CanDeactivate,
    Resolve,
    Router,
    RouterModule,
    RouterStateSnapshot,
    Routes,
    UrlTree,
} from '@angular/router';
import { Actions, ofType } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import { merge, Observable } from 'rxjs';
import { mapTo, tap } from 'rxjs/operators';
import {
    AuthService,
    HtmlContainer,
    login,
    loginFails,
    loginSuccess,
    UserDataAccessService,
    AccessDeniedContainer,
    getFeatureEnabled
} from '../libs/shared';
import { MainLayoutComponent } from './main-layout/main-layout.component';

const callingModule = () =>
    import('../libs/feature-calling').then((m) => m.CallingModule);
const messagingModule = () =>
    import('../libs/feature-messaging').then((m) => m.MessagingModule);
const contactsModule = () =>
    import('../libs/feature-contacts').then((m) => m.ContactsModule);
const settingsModule = () =>
    import('../libs/feature-settings').then((m) => m.SettingsModule);
const supportModule = () =>
    import('../libs/feature-support').then((m) => m.SupportModule);
const authModule = () =>
    import('../libs/feature-auth').then((m) => m.AuthModule);

@Injectable()
class AuthorizeCanActivate implements CanActivateChild {
    constructor(
        private readonly authService: AuthService,
        private readonly router: Router,
        private readonly store: Store,
        private readonly actions: Actions
    ) {}

    canActivateChild(
        route: ActivatedRouteSnapshot,
        state: RouterStateSnapshot
    ) {
        if (!!this.authService.user) {
            return true;
        } else {
            if (this.authService.apiName) {
                if(sessionStorage.getItem("pin_page") === "true" || sessionStorage.getItem("pwd_change") === "true"){
                    return this.router.parseUrl('/auth/login');
                }else{
                    if(window['MOVIUS_EMBEDED_APP'] == "messaging")
                    {
                        if(sessionStorage.getItem('__api_auth_token__')){
                            this.store.dispatch(
                                login({
                                    email: this.authService.apiName,
                                    redirectUrl: state.url,
                                })
                            );
                        }else{
                           return this.router.parseUrl('/auth/login')
                        }
                    }else{
                        this.store.dispatch(
                            login({
                                email: this.authService.apiName,
                                redirectUrl: state.url,
                            })
                        );
                    }
                    // TODO : Handle login fails
                    return merge(
                        this.actions.pipe(ofType(loginSuccess), mapTo(true)),
                        this.actions.pipe(
                            ofType(loginFails),
                            mapTo(this.router.parseUrl('/auth/login'))
                        )
                    );
                }
            } else {
                return this.router.parseUrl('/auth/login');
            }
        }
    }
}

@Injectable()
export class DisableBackGuard implements CanDeactivate<unknown> {
    constructor() {}
 
    canDeactivate(
       component: unknown,
       currentRoute: ActivatedRouteSnapshot,
       currentState: RouterStateSnapshot,
       nextState?: RouterStateSnapshot
    ):
       | Observable<boolean | UrlTree>
       | Promise<boolean | UrlTree>
       | boolean
       | UrlTree {
        const isMobileDevice = ((sessionStorage.getItem('Contex_res')?.toLowerCase() === "ios") || (sessionStorage.getItem('Contex_res')?.toLowerCase() === "android"))
        ? true : false;
       const isDisabled = sessionStorage.getItem("isLogingViaTeams") !== "true" || !isMobileDevice;
       return isDisabled;
    }
 }

@Injectable({ providedIn: 'root' })
export class E911TermsResolver implements Resolve<string> {
    constructor(private service: UserDataAccessService) {}

    resolve() {
        return this.service.getE911Terms();
    }
}

@Injectable({ providedIn: 'root' })
export class GDPRTermsResolver implements Resolve<string> {
    constructor(private service: UserDataAccessService) {}

    resolve() {
        const urlParams = new URLSearchParams(window.location.search);
        const email = urlParams.get('email');
        return this.service.getGDPRTerms(email);
    }
}

@Injectable({ providedIn: 'root' })
export class TermsPrivacyResolver implements Resolve<string> {
    constructor(
        private service: UserDataAccessService,
        private readonly activatedRoute: ActivatedRoute
    ) {}

    resolve() {
        return this.service.getGDPRTerms(
            this.activatedRoute.snapshot.queryParams['email']
        );
    }
}

const appEmbededStatus = getFeatureEnabled() === 'messaging' ? true : false;
const isMobileDevice = ((sessionStorage.getItem('Contex_res')?.toLowerCase() === "ios") || (sessionStorage.getItem('Contex_res')?.toLowerCase() === "android"))
? true : false;


const routes: Routes = [
    { path: '', pathMatch: 'full', redirectTo: appEmbededStatus || isMobileDevice ? '/messaging' : '/calling' },
    {
        path: '',
        component: MainLayoutComponent,
        canActivateChild: [AuthorizeCanActivate],
        canDeactivate: [DisableBackGuard],
        children: [
            {
                path: 'calling',
                loadChildren: callingModule,
            },
            {
                path: 'messaging',
                loadChildren: messagingModule,
            },
            {
                path: 'contacts',
                loadChildren: contactsModule,
            },
            {
                path: 'settings',
                loadChildren: settingsModule,
            },
            {
                path: 'support',
                loadChildren: supportModule,
            },
        ],
    },
    {
        path: 'e911-terms',
        component: HtmlContainer,
        resolve: {
            html: E911TermsResolver,
        },
    },
    {
        path: 'gdpr-terms',
        component: HtmlContainer,
        resolve: {
            html: GDPRTermsResolver,
        },
    },
    {
        path: 'auth',
        loadChildren: authModule,
    },
    {
        path: 'access-denied',
        component: AccessDeniedContainer,
    },
];

@NgModule({
    imports: [
        RouterModule.forRoot(routes, {
            enableTracing: false,
        }),
    ],
    exports: [RouterModule],
    providers: [AuthorizeCanActivate, DisableBackGuard],
})
export class AppRoutingModule {}
