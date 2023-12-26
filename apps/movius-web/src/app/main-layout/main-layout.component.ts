import {
    AfterViewInit,
    ChangeDetectionStrategy,
    ChangeDetectorRef,
    Component,
    ElementRef,
    OnDestroy,
    OnInit,
    ViewChild,
    ViewContainerRef,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Actions, ofType } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import { SipService } from '@scalio/sip';
import { filter as _filter, flatten, pipe, values } from 'lodash/fp';
import { NzModalService } from 'ng-zorro-antd/modal';
import { BehaviorSubject, combineLatest, Observable, Subject } from 'rxjs';
import {
    distinctUntilChanged,
    map,
    takeUntil,
    withLatestFrom,
} from 'rxjs/operators';
import {
    callHangUpComplete,
    CallingService,
    PopoverCallingService,
    selectActiveCalls,
    selectPeersCallingStates,
} from '../../libs/feature-calling';
import {
    addIncomingSessionMessage,
    MessagingDataAccessService,
    PeerChatMessageView,
    selectPeerMessages,
    selectThreads,
} from '../../libs/feature-messaging';
import { SupportWorkspaceComponent } from '../../libs/feature-support';
import {
    CustomerHelpDetailsComponent,
    CustomNzModalService,
    DataService,
    deleteMSGraphContacts,
    EmergencyTermsComponent,
    formatPhoneToInternational,
    getFeatureEnabled,
    logout,
    selectFeatures,
    selectIsE911Declined,
    selectUserStateStatus,
    SipUserService,
    StateStatus,
    User,
    PhoneNumberService
} from '../../libs/shared';
import { CookieService } from 'ngx-cookie-service';
import { AuthDataAccessService } from '../../libs/shared/services/auth.data-access.service';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';
import {LoggerFactory} from '@movius/ts-logger';
import { AppComponent } from '../app.component';
import { E911SettingsWorkspaceComponent, PasswordSettingsComponent, TermsPrivacySettingsComponent } from '../../libs/feature-settings/components';
import { MessagingService } from '../../libs/feature-messaging';
import { AuthService } from '../../libs/shared';
import { selectPeersMessages as newMsgCountCheck } from '../../libs/feature-messaging';
const logger = LoggerFactory.getLogger("")

export interface MainLayoutView {
    isSyncExchangeAvailable: any;
    isE911Declined: boolean;
    hasNewMessages: boolean;
    hasNewCalls: boolean;
    userStateStatus: StateStatus;
    isE911Available:boolean;
}

const safePlayCall = async (htmlElement: HTMLAudioElement, component: MainLayoutComponent) => {
    try {
        if (component.hasIncoming) {
            await htmlElement.play();
        }
    } catch(e) {
        return setTimeout(() => safePlayCall(htmlElement, component), 300);
    }
};

const safePlayMessage = async (htmlElement: HTMLAudioElement) => {
    try {
        await htmlElement.play();
    } catch {
        return setTimeout(() => safePlayMessage(htmlElement), 300);
    }
};

@Component({
    selector: 'movius-web-main-layout',
    templateUrl: './main-layout.component.html',
    styleUrls: ['./main-layout.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MainLayoutComponent implements OnInit, AfterViewInit, OnDestroy {
    public hasIncoming: boolean = false;
    readonly view$: Observable<MainLayoutView>;

    imgCustomBrandingLogo: SafeUrl | string;
    userLoginDetails: string;
    isNotCypress = true;
    isCollapsed = false;
    isSupportOpened$ = new BehaviorSubject(false);
    rootUserInfo: any;
    rootFirstName: any;
    rootLastName: any;
    rootEmailId: any;
    MuteinboundCallAndMsgSound: boolean = false;

    @ViewChild('soundOutgoing') soundOutgoing: ElementRef<HTMLAudioElement>;
    @ViewChild('soundIncoming') soundIncoming: ElementRef<HTMLAudioElement>;
    @ViewChild('soundIncomingSecondary') soundIncomingSecondary: ElementRef<
        HTMLAudioElement
    >;
    @ViewChild('soundMessage') soundMessage: ElementRef<HTMLAudioElement>;
    @ViewChild('soundCallEnd') soundCallEnd: ElementRef<HTMLAudioElement>;

    private readonly destroy$ = new Subject();
    isConnectionLost: any;
    showLeftSideMenu: boolean;
    appEmbededStatus: string;
    showHeader: boolean = false;
    isMobileDevice:boolean = false;
    isLocationEnabled: string;
    is911Message:string;
    popOverContent: string;
    teamsLocationEnabled: boolean;
    composeMessageType: any;
    constructor(
        private readonly callingService: CallingService,
        private readonly popoverCallingService: PopoverCallingService,
        private readonly sipUserService: SipUserService,
        private viewContainerRef: ViewContainerRef,
        private readonly modalService: NzModalService,
        private readonly nzmodalService: CustomNzModalService,
        private readonly store: Store,
        private readonly actions: Actions,
        cdr: ChangeDetectorRef,
        sipService: SipService,
        private cookieService: CookieService,
        private readonly activatedRoute: ActivatedRoute,
        private readonly router: Router,
        private readonly authDataService: AuthDataAccessService,
        private dataService: DataService,
        private domSanitizer: DomSanitizer,
        private appComponent: AppComponent,
        private messagingDataAccessService: MessagingDataAccessService,
        private messagingService: MessagingService,
        private readonly authService: AuthService,
        private phoneNumberService: PhoneNumberService,
    ) {
        this.isMobileDevice = ((sessionStorage.getItem('Contex_res')?.toLowerCase() === "ios") || (sessionStorage.getItem('Contex_res')?.toLowerCase() === "android"))
            ? true : false;
        if (sessionStorage.getItem('callAndMsgMuteStatus') !== null) {
            this.MuteinboundCallAndMsgSound =
                sessionStorage.getItem('callAndMsgMuteStatus') === 'true'
                    ? true
                    : false;
        } else {
            sessionStorage.setItem('callAndMsgMuteStatus', 'false');
        }
        
        sessionStorage.removeItem('pwd_change');
        sessionStorage.removeItem('pin_page');
        popoverCallingService.init(viewContainerRef, cdr);
        const hasNewMessages$ = store.select(newMsgCountCheck(sipService.getUserUri)).pipe(
            map(
                pipe(
                    values,
                    flatten,
                    _filter((msg) => msg.newCount != 0),
                    (x) => x.length > 0
                )
            )
        );
        const hasNewCalls$ = store
            .select(selectPeersCallingStates(sipService.getUserUri))
            .pipe(
                map((m) =>
                    m.some((x) =>
                        x.history.some(
                            (y) =>
                                y.kind === 'HistorySessionCompleted' &&
                                !y.viewed
                        )
                    )
                )
            );

        this.view$ = combineLatest([
            store.select(selectIsE911Declined),
            hasNewMessages$,
            hasNewCalls$,
            store.select(selectUserStateStatus),
            store.select(selectFeatures),
        ]).pipe(
            map(
                ([
                    isE911Declined,
                    hasNewMessages,
                    hasNewCalls,
                    userStateStatus,
                    features,
                ]) => ({
                    isE911Declined,
                    hasNewMessages,
                    hasNewCalls,
                    userStateStatus,
                    isE911Available:
                        features.e911Status === 'enabled_accepted' ||
                        features.e911Status === 'enabled_declined',
                    isSyncExchangeAvailable:
                        features.exchangeSyncStatus !== 'off',
                })
            )
        );
        //@ts-ignore
        this.isNotCypress = !window.Cypress;
        this.authDataService.freshOnboardUserDataPass.subscribe((data) => {
            //console.log('onboardComp', data);
            if (data === true) {
                this.nzmodalService.ModalStatus = 'enabled_declined';
            }
        });
        this.dataService.checkConnectionStatus.subscribe((data) => {
            this.isConnectionLost = data;
        });
        this.deleteExchangeContactsOnDisabled();
        this.messagingService.is911Message.subscribe((res: any) => {
            this.is911Message = res;
        });
        this.messagingService.isLocationEnabled.subscribe((res:any) => {
            this.isLocationEnabled = res;
        });
        this.popOverContent = 'Location permission is required for texting 911. Please enable and reload the application.';
        this.messagingService.isTeamsLocationEnabled.subscribe((res: any) => {
            this.teamsLocationEnabled = res;
        });
        this.authService.onComposeMessageTypeSelected.subscribe(type => {
            this.composeMessageType = type;
          })
        //this.teamsLocationEnabled = sessionStorage.getItem('teams_location');
    }

    get userInfo(): User {
        sessionStorage.setItem('loggedInuserCntCode',this.phoneNumberService.getUserCountryCode(this.sipUserService.user));
        sessionStorage.setItem('loggedInuserCntName',this.phoneNumberService.getUserCountryName(this.sipUserService.user));
        return this.sipUserService.user;
    }

    changeMuteStatus(status: boolean) {
        this.MuteinboundCallAndMsgSound = status;
        sessionStorage.setItem('callAndMsgMuteStatus', status.toString());
    }

    openSupportModal() {
        this.isSupportOpened$.next(true);
        this.modalService
            .create({
                //nzTitle: 'Support',
                //TODO: CB:14Jan2020: TECH-DEBT - Bad practice - magic values. Refactor.
                nzContent: SupportWorkspaceComponent,
                nzStyle: {
                    position: 'absolute',
                    width: '25rem',
                    height: '24.25rem',
                    top:
                        window.innerHeight > 780
                            ? 'calc(75vh - 12.125rem)'
                            : 'calc(50vh - 12.125rem)',
                    left: '5vw',
                },
                nzMask: false,
                nzClosable: false,
                nzFooter: null,
            })
            .afterClose.subscribe((e) => {
                this.isSupportOpened$.next(false);
            });
    }

    isTeamsSSO(): boolean {
        if (sessionStorage.getItem('isLogingViaTeams') === 'true') {
            return true;
        } else {
            return false;
        }
    }

    openE911TermsModal() {
        this.modalService.create({
            nzTitle: 'E911 Terms & Conditions',
            nzContent: EmergencyTermsComponent,
            nzFooter: null,
        });
    }

    ngOnInit() {
        this.appComponent.start();
        this.sipUserService.setRegistererTimer();
        this.userLoginDetails = sessionStorage.getItem('__api_user_info__');
        if (this.userLoginDetails !== null) {
            const loginDetails = JSON.parse(this.userLoginDetails);
            if (loginDetails.root.root.operator_icon !== '') {
                this.imgCustomBrandingLogo = this.domSanitizer.bypassSecurityTrustUrl(
                    `data:image/png;base64,${loginDetails.root.root.operator_icon}`
                );
            } else {
                this.imgCustomBrandingLogo =
                    'assets/icons/movius/auth/mml_logo.svg';
            }
        }
        this.isCollapsed = true;
        this.getUserDetails();
        this.appEmbededStatus = getFeatureEnabled();
        if (this.appEmbededStatus === 'messaging') {
            this.navigateToMessagingPage();
        }
    }

    getUserDetails() {
        this.rootUserInfo = JSON.parse(
            sessionStorage.getItem('__api_user_info__')
        );
        if (
            !(this.rootUserInfo.root.first_name === undefined) &&
            !(this.rootUserInfo.root.last_name === undefined) &&
            !(this.rootUserInfo.root.user_mail_id === undefined)
        ) {
            this.rootFirstName =
                this.rootUserInfo.root.first_name === ''
                    ? ''
                    : this.getOnlyAlphabet(
                          this.rootUserInfo.root.first_name
                      ).substring(0, 1) === null
                    ? ''
                    : this.getOnlyAlphabet(this.rootUserInfo.root.first_name);
            this.rootLastName =
                this.rootUserInfo.root.last_name === ''
                    ? ''
                    : this.getOnlyAlphabet(
                          this.rootUserInfo.root.last_name
                      ).substring(0, 1) === null
                    ? ''
                    : this.getOnlyAlphabet(this.rootUserInfo.root.last_name);
            this.rootEmailId = this.rootUserInfo.root.user_mail_id;
        } else {
            this.rootFirstName = '';
            this.rootLastName = '';
            this.rootEmailId = '';
        }
    }

    getOnlyAlphabet(name: string): string {
        let index = null;
        for (let i = 0; i < name.length; i++) {
            let char = name.charCodeAt(i);
            if ((char >= 97 && char <= 122) || (char >= 65 && char <= 90)) {
                index = i;
                break;
            }
        }
        if (index != null) {
            let charString = name.substring(index);
            return charString;
        }
        return '';
    }

    ngAfterViewInit() {
        const that = this;
        this.callingService.setUpAudioMedia(this.destroy$);

        this.actions
            .pipe(ofType(callHangUpComplete), takeUntil(this.destroy$))
            .subscribe(() => {
                this.soundCallEnd.nativeElement.play();
            });

        const activeCalls$ = this.store.select(selectActiveCalls).pipe(
            map((activeCalls) => {
                const activeCallsList = Object.values(activeCalls);
                const ongoingActiveCalls = activeCallsList.filter(
                    (f) => f.kind === 'OngoingActiveCall'
                );
                const incomingActiveCalls = activeCallsList.filter(
                    (f) =>
                        f.direction === 'incoming' &&
                        f.kind === 'SuspendedActiveCall'
                );
                const outgoingActiveCalls = activeCallsList.filter(
                    (f) =>
                        f.direction === 'outgoing' &&
                        f.kind === 'SuspendedActiveCall' &&
                        f.isEstablishing === true
                );
                return {
                    hasIncomingActiveCalls: incomingActiveCalls.length > 0,
                    hasOutgoingActiveCalls: outgoingActiveCalls.length > 0,
                    hasOngoingActiveCalls: ongoingActiveCalls.length > 0,
                };
            })
        );

        const hasOutgoingActiveCalls$ = activeCalls$.pipe(
            map(({ hasOutgoingActiveCalls }) => hasOutgoingActiveCalls),
            distinctUntilChanged()
        );

        const hasIncomingActiveCalls$ = activeCalls$.pipe(
            map(({ hasIncomingActiveCalls }) => hasIncomingActiveCalls),
            distinctUntilChanged()
        );

        const hasOngoingActiveCalls$ = activeCalls$.pipe(
            map(({ hasOngoingActiveCalls }) => hasOngoingActiveCalls),
            distinctUntilChanged()
        );

        hasOutgoingActiveCalls$
            .pipe(takeUntil(this.destroy$))
            .subscribe((has) => {
                if (!this.soundOutgoing) {
                    return;
                }
                if (has) {
                    this.soundOutgoing.nativeElement.play();
                } else {
                    this.soundOutgoing.nativeElement.pause();
                }
            });

        combineLatest([hasIncomingActiveCalls$, hasOngoingActiveCalls$])
            .pipe(takeUntil(this.destroy$))
            .subscribe(([hasIncoming, hasOngoing]) => {
                this.hasIncoming = hasIncoming;
                if (!this.soundIncoming || !this.soundIncomingSecondary) {
                    return;
                }
                if (hasIncoming) {
                    if (this.MuteinboundCallAndMsgSound === false) {
                        if (hasOngoing) {
                            //this.soundIncomingSecondary.nativeElement.play();
                            safePlayCall(
                                this.soundIncomingSecondary.nativeElement,
                                that
                            );
                        } else {
                            //this.soundIncoming.nativeElement.play();
                            safePlayCall(
                                this.soundIncoming.nativeElement,
                                that
                            );
                        }
                    }
                } else {
                    this.soundIncomingSecondary.nativeElement.pause();
                    this.soundIncoming.nativeElement.pause();
                }
            });

        // messages
        setTimeout(
            () =>
                this.actions
                    .pipe(
                        takeUntil(this.destroy$),
                        ofType(addIncomingSessionMessage),
                        withLatestFrom(this.store.select(selectThreads))
                    )
                    .subscribe(([{ content, peerId, threadId }, threads]) => {
                        // peerid for group message to mute or unmute condition
                        const notificationSound = threads[peerId] ? threads[peerId] : threads[threadId]
                        if (
                            this.soundMessage &&
                            content &&
                            this.isMobileDevice === true ? false : !notificationSound?.isMuted &&
                            this.MuteinboundCallAndMsgSound === false
                        ) {
                            //this.soundMessage.nativeElement.play();
                            safePlayMessage(this.soundMessage.nativeElement);
                        }
                    }),
            2500
        );
    }

    ngOnDestroy() {
        this.destroy$.next();
        this.popoverCallingService.dispose();
    }

    onLogout() {
        this.cookieService.delete(
            'sso_response',
            '/',
            'moviuscorp.net',
            true,
            'None'
        );
        logger.debug('user logging out');
        localStorage.removeItem('selectedGroup');
        sessionStorage.clear();
        this.sipUserService.clearRegistererInterval();
        this.appComponent.clearTimer();
        this.appComponent.clearTimerPendingMessage();
        if (this.appEmbededStatus === 'messaging') {
            const baseURI = window.document.baseURI.slice(0, -1);
            location.href = `${baseURI}?embedded=messaging`;
        } else {
            this.store.dispatch(logout());
        }
        if (this.soundOutgoing) {
            this.soundOutgoing.nativeElement.pause();
        }
        if (this.soundIncomingSecondary) {
            this.soundIncomingSecondary.nativeElement.pause();
        }
        if (this.soundIncoming) {
            this.soundIncoming.nativeElement.pause();
        }
        if (this.soundMessage) {
            this.soundMessage.nativeElement.pause();
        }
    }

    formatNumber = formatPhoneToInternational;

    onCallingClick($event: MouseEvent) {
        $event.preventDefault();
        $event.stopPropagation();

        if (
            !this.activatedRoute.firstChild.snapshot.url
                .map((m) => m.path)
                .includes('calling')
        ) {
            this.router.navigate(['/calling']);
        }
    }

    onMessagingClick($event: MouseEvent) {
        $event.preventDefault();
        $event.stopPropagation();

        if (
            !this.activatedRoute.firstChild.snapshot.url
                .map((m) => m.path)
                .includes('messaging')
        ) {
            this.router.navigate(['/messaging']);
        }
    }

    onContactsClick($event: MouseEvent) {
        $event.preventDefault();
        $event.stopPropagation();

        if (
            !this.activatedRoute.firstChild.snapshot.url
                .map((m) => m.path)
                .includes('contacts')
        ) {
            this.router.navigate(['/contacts']);
        }
    }

    onSettingsClick($event: MouseEvent) {
        $event.preventDefault();
        $event.stopPropagation();
        let isSyncExchangeAvailable;
        let isE911Available;
        this.view$.subscribe((e) => {
            isSyncExchangeAvailable = e.isSyncExchangeAvailable;
            isE911Available = e.isE911Available;
        });
        if (
            !this.activatedRoute.firstChild.snapshot.url
                .map((m) => m.path)
                .includes('settings')
        ) {
            if (isE911Available) {
                this.router.navigate(['/settings/e911']);
            } else if (isSyncExchangeAvailable) {
                this.router.navigate(['/settings/contact']);
            } else {
                this.router.navigate(['/settings/password']);
            }
        }
    }

    deleteExchangeContactsOnDisabled() {
        let isSyncExchangeAvailable;
        this.view$.subscribe((e) => {
            isSyncExchangeAvailable = e.isSyncExchangeAvailable;
        });
        if (!isSyncExchangeAvailable) {
            return this.store.dispatch(deleteMSGraphContacts());
        }
    }

    navigateToMessagingPage() {
        if (
            !this.activatedRoute.firstChild.snapshot.url
                .map((m) => m.path)
                .includes('messaging')
        ) {
            this.router.navigate(['/messaging']);
        }
    }

    openE911Msg() {
        this.modalService.create({
            nzContent: E911SettingsWorkspaceComponent,
            nzWidth: '44rem',
            nzFooter: null,
            nzKeyboard: false,
            nzViewContainerRef: this.viewContainerRef,
            nzMaskClosable: false,
            nzStyle: {
                top: '50px',
            },
        });
    }

    openchangePasswordMsg() {
        this.modalService.create({
            nzContent: PasswordSettingsComponent,
            nzWidth: '48rem',
            nzFooter: null,
            nzKeyboard: false,
            nzViewContainerRef: this.viewContainerRef,
            nzClosable: false,
            nzMaskClosable: false,
            nzStyle: {
                margin: '0 auto 0 auto',
                top: '50px',
            },
        });
    }

    openTermsAndConditionMsg() {
        this.modalService.create({
            nzContent: TermsPrivacySettingsComponent,
            nzWidth: '46rem',
            nzFooter: null,
            nzKeyboard: false,
            nzViewContainerRef: this.viewContainerRef,
            nzClosable: true,
            nzMaskClosable: false,
            nzStyle: {
                margin: '0 auto 0 auto',
                top: '10px',
            },
        });
    }

    openHelpDetails() {
        this.modalService.create({
            nzContent: CustomerHelpDetailsComponent,
            nzFooter: null,
            nzKeyboard: false,
            nzViewContainerRef: this.viewContainerRef,
            nzClosable: true,
            nzMaskClosable: false,
            nzBodyStyle: {
                width: '32rem',
                height: '17rem',
            },
            nzWidth: '32rem',
        });
    }

    toggelHeaderView() {
        this.showHeader = !this.showHeader;
    }

    updateSearch(searchTerm: string) {
        this.messagingDataAccessService.watchSearchData(searchTerm);
    }


    getFooterHeight() {
        return '3.375rem'; // this.isMobileDevice ? '3.375rem' : '6.375rem'
    }

    getFooterDisplay() {
        return this.isMobileDevice ? 'flex' : 'block'
    }

    getFooterMaxHeight() {
        return '3.375rem'; // this.isMobileDevice ? '3.375rem' : '6.375rem'
    }

    showWarningIcon() {
        if(this.teamsLocationEnabled != undefined && this.appEmbededStatus === 'messaging' && this.composeMessageType !== 'whatsapp') {
            return !this.teamsLocationEnabled;
        }
        else {
            return this.isLocationEnabled === 'denied' && this.is911Message;
        }
    }
}
