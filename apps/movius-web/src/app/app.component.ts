import { ChangeDetectorRef, Component, EventEmitter, HostListener, OnDestroy, OnInit, Output } from '@angular/core';
// import { Actions, ofType } from '@ngrx/effects';
import { NavigationEnd, Router } from '@angular/router';
// import { HttpClient } from '@angular/common/http';
import { Store } from '@ngrx/store';
import { Subject, BehaviorSubject } from 'rxjs';
import { addIncomingSessionMessage, checkIncomingSessionSelfMessage, loadLatestVoiceMail, messageRead, selectPeersMessages, selectPeerThreads, updatePictureRetryThresholdReached } from '../libs/feature-messaging/ngrx';
import { readMessage, SipService, SipUser  } from '@scalio/sip';
import { SipUserInfo, SipUserService } from '../libs/shared';
//import { SipUser } from '@scalio/sip';
import { any, uniqBy } from 'lodash/fp';
import { CookieService } from 'ngx-cookie-service';

import {
    map,
    takeUntil,
} from 'rxjs/operators';
import { CallingTimerService } from '../libs/feature-calling/services';
import {
    MessagingService,
    resendPendingMessages,
    updateCacheStore
} from '../libs/feature-messaging';
import { AuthService, CustomNzModalService, DbContext, getBaseUrl, getFeatureEnabled, session_keys, sortParticipantsAsID, TeamsErrorDisplayComponent } from '../libs/shared';
import { loadInitialHistory } from '../libs/feature-calling';
import {loadInitialHistory as loadMessageHistory}  from '../libs/feature-messaging/ngrx';
import {  LoggerFactory } from '@movius/ts-logger';
// import { Renderer2 } from '@angular/core';
// import { resolve } from 'url';
import { Message, MessageState } from '@movius/domain';
import { app, authentication,teamsCore,pages, dialog} from '@microsoft/teams-js';
import { location } from "@microsoft/teams-js";
import { messageInfoType } from 'libs/domain/src/lib/models/messageInfo';
import { LoadingComponent } from '../libs/shared/components/loading/loading.component';
import { AuthDataAccessService } from '../libs/shared/services/auth.data-access.service';
import { AccessDeniedContainer } from '../libs/shared/components/access-denied/access-denied.component';
const logger = LoggerFactory.getLogger("")
const sleep = (ms) => new Promise(r => setTimeout(r, ms));



@Component({
    selector: 'movius-web-root',
    templateUrl: './app.component.html',
    styleUrls: ['./app.component.scss'],
})
export class AppComponent implements OnInit, OnDestroy {
    private readonly destroy$ = new Subject();
    cookieValue: any;
    userActivity;
    userInactive: Subject<any> = new Subject();
    seconds = 11;
    intervalId = 0;
    intervalResendMessageId = 0;
    peerids = [];
    isIframe = false;
    getConnectionErrorValue;
    appEmbededStatus: string;
    teamsEmail: string;
    isViaTeamsMobile$ = new BehaviorSubject(false);
    baseURL:string;



    constructor(
        // actions: Actions,
        // Start handling messages right from the application start !
        private messagingService: MessagingService,
        private modalService: CustomNzModalService,
        // initialize here to not to miss call actions
        callingTimerService: CallingTimerService,
        // private readonly sipUserService: SipUserService,
        // private http: HttpClient,
        private authService: AuthService,
        private router: Router,
        public sipService: SipService,
        public sipUserService: SipUserService,
        //public sipUser: SipUser,
        private readonly dbContext: DbContext,
        private readonly store: Store,
        private cookieService: CookieService,
        // private renderer: Renderer2,
        private authDataService: AuthDataAccessService,
        private readonly cdr: ChangeDetectorRef

    ) {
        sessionStorage.removeItem('loadInitialHistoryStoreSuccessHandler');
        this.cookieValue = this.cookieService.get('sso_response'); // To Get Cookie
        console.log('cookie value - ', this.cookieValue)
        const isMobileDevice = ((sessionStorage.getItem('Contex_res')?.toLowerCase() === "ios") || (sessionStorage.getItem('Contex_res')?.toLowerCase() === "android"))
        this.appEmbededStatus = getFeatureEnabled();
        this.baseURL = getBaseUrl();
        logger.debug("Logged into " + this.appEmbededStatus + " application.")
        if (this.appEmbededStatus !== "messaging") {
            sessionStorage.setItem("oidc", JSON.stringify(this.cookieValue));
        }
        this.loadDataTosessionFromLocal();
        window.addEventListener('unload', this.saveSessionData);

        this.setTimeout();
        //this.versionCheckAPiCall();
        this.userInactive.subscribe(() => {
            logger.debug('User has been inactive for 30 Mins');
            //this.refresh();
            //this.versionCheckAPiCall();
        });
        callingTimerService.timers$
            .pipe(takeUntil(this.destroy$))
            .subscribe(() => { });

        const peerMessages$ = store
            .select(selectPeersMessages(sipService.getUserUri))
            .pipe(
                map((m) => m.filter((f) => f.messages.length > 0)),
                map((m) => uniqBy((x) => x.peer?.multiLine, m))
            );
        peerMessages$.subscribe(peers => {
            if (peers.length > 0) {
                this.peerids = peers;
            }
        });

        let browsercheck = this.fnBrowserDetect();
        if (this.appEmbededStatus != "messaging" && browsercheck != "safari") {
            try {
                navigator.permissions.query(
                    { name: 'microphone' }
                ).then(function (permissionStatus) {
                    logger.debug('microphone permission state', permissionStatus.state); // granted, denied, prompt
                    permissionStatus.onchange = function () {
                        logger.debug("Permission changed to " + permissionStatus.state);
                        if (permissionStatus.state == 'denied') {
                            logger.debug('To enable calling functionality, please permit to access the microphone');
                            sessionStorage.setItem('mic_enable_status', 'false');
                        } else if (permissionStatus.state == 'prompt') {
                            logger.debug('To enable calling functionality, please permit to access the microphone in the prompt popup');
                        } else {
                            sessionStorage.setItem('mic_enable_status', 'true');
                        }
                    }
                })
            } catch (e) {
                logger.debug("Error in permissions");
            }
        }
    }

    // Load data from localStorage to sessionStorage.
    loadDataTosessionFromLocal = () =>{
        if(this.appEmbededStatus == "messaging"){
            session_keys.map((key)=>{
                if(localStorage.getItem(key)){
                    sessionStorage.setItem(key,localStorage.getItem(key))
                }
            })
        }
    }

    toggleMode(toggle:boolean) {
        if(toggle){
            document.documentElement.classList.remove('theme-light', 'theme-dark');
            document.documentElement.classList.add("theme-dark");
            localStorage.setItem("Theme","Dark")
        }else{
            document.documentElement.classList.remove('theme-light', 'theme-dark');
            localStorage.removeItem("Theme");
        }

    }

    // Load data from sessionStorage to localStorage on window unloads.
    saveSessionData = () => {
        if(this.appEmbededStatus == "messaging"){
            this.store.dispatch(
                updateCacheStore()
            );
            session_keys.map((key)=>{
                if(sessionStorage.getItem(key)){
                    localStorage.setItem(key, sessionStorage.getItem(key) );
                }else{
                    localStorage.removeItem(key)
                }
            })
        }

      };

    fnBrowserDetect() {
        let userAgent = navigator.userAgent;
        let browserName;
        if (userAgent.match(/chrome|chromium|crios/i)) {
            browserName = "chrome";
        } else if (userAgent.match(/firefox|fxios/i)) {
            browserName = "firefox";
        } else if (userAgent.match(/safari/i)) {
            browserName = "safari";
        } else if (userAgent.match(/opr\//i)) {
            browserName = "opera";
        } else if (userAgent.match(/edg/i)) {
            browserName = "edge";
        } else {
            browserName = "No browser detection";
        }
        return browserName;
    }

    register_back_button(){
        pages.backStack.registerBackButtonHandler(() => {
            pages.backStack.navigateBack()
            dialog.url.submit()
            return true;
        })
    }

    async getUserLocation() {
          location.getLocation({ allowChooseLocation: true, showMap: true },(error,location)=>{logger.debug("Location Error",error); logger.debug("Location",location)})
    }


    async getAuthTkn() {
        try {
            sessionStorage.setItem("isLogingViaTeams", "true")
            // this.getUserLocation()
            logger.debug("initialize finished");
        } catch (e) {
            sessionStorage.removeItem("isLogingViaTeams")
            logger.debug("Not opened in teams window", e);
            return
        }
        try {
            await app.getContext().then(
                (res) => {
                    logger.debug("getContext res", res);
                    sessionStorage.setItem('userEmail', res.user.userPrincipalName);
                    sessionStorage.setItem('Contex_res', res.app.host.clientType);
                    this.setTheme(res.app.theme)
                    if ((res.app.host.clientType === "ios") || (res.app.host.clientType === "android")) {
                        localStorage.setItem("device","mobile")
                        this.authDataService.loadViaTeamsMobileEvent(true);
                    }else{
                        localStorage.setItem("device","other")
                    }
                    //this.isViaTeamMobile.next(true);
                    //if(res.app.host.clientType === 'ios'){
                    //   this.router.navigate(['access-denied'])
                    //   this.authDataService.loaderSpinnerEvent(false);
                    //		return
                    //}
                }, (err) => {
                    logger.debug("getContext result", err.stack);
                }
            );

            logger.debug("getContext finished");
        } catch (e) {
            logger.debug("Error in getContext");
        }
        try {
            await authentication.getAuthToken()
                .then(
                    (res) => {
                        sessionStorage.setItem("authToken",res);
                        logger.debug("getAuthToken finished");
                        this.authDataService.tokenRecieved.next(true)
                    },
                    (err) => {
                        this.authDataService.teamsError.next({status:true,details:err.stack})
                        logger.debug("authToken error", err.stack);
                    }
                );
        } catch (e) {
            logger.debug("getAuthToken error", e)
            this.authDataService.teamsError.next({status:true,details:"about to start app initialize"})
        }
    }

    async getReloadAuthToken(){
        authentication.getAuthToken()
                .then(
                    (res) => {
                        let previosauth = sessionStorage.getItem("authToken")
                        sessionStorage.setItem("authToken",res);
                        if((previosauth && previosauth != res) || !previosauth || !sessionStorage.getItem("userEmail")){
                            this.clearReloadSessions()
                            this.getReloadContext()
                        }else{
                            this.getThemeFromContext()
                        }
                        if(!sessionStorage.getItem("__api_auth_token__")){
                            this.authDataService.tokenRecieved.next(true)
                        }
                        logger.debug("getAuthToken finished");
                    },
                    (err) => {
                        logger.debug("authToken error", err.stack);
                        sessionStorage.removeItem("authToken");
                        this.authDataService.teamsError.next({status:true,details:err.stack})
                    }
                );
    }

    async getThemeFromContext(){
        app.getContext().then((res) => {
            logger.debug("getContext res for theme", res);
            this.setTheme(res.app.theme)
        })
    }

    async getReloadContext(){
        await app.getContext().then(
            (res) => {
                console.log(res)
                logger.debug("getContext res", res);
                this.setTheme(res.app.theme)
                sessionStorage.setItem('userEmail', res.user.userPrincipalName);
                sessionStorage.setItem('Contex_res', res.app.host.clientType);
                document.body.classList.remove('light-theme', 'dark-theme');
                document.body.classList.add(`dark-theme`);
                if ((res.app.host.clientType === "ios") || (res.app.host.clientType === "android")) {
                    localStorage.setItem("device","mobile")
                    this.authDataService.loadViaTeamsMobileEvent(true);
                }else{
                    localStorage.setItem("device","others")
                }
                this.authDataService.tokenRecieved.next(true)
            }, (err) => {
                logger.debug("getContext result", err.stack);
            }
        );
    }

    setTheme(theme:string){
        if(theme != 'default'){
            logger.debug("Theme:: Dark");
            this.toggleMode(true);
        } else {
            logger.debug("Theme:: default");
            this.toggleMode(false);
        }
        this.authDataService.themeupdate.next(true)
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

    public access_denied() {
        this.modalService
            .create({
                nzContent: AccessDeniedContainer,
                nzComponentParams: {
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
    public loaderModalOpen() {
        this.modalService
            .create({
                nzContent: LoadingComponent,
                nzComponentParams: {
                },
                nzStyle: {
                    height: '100%',
                    width: '100%',
                    top: '0px',
                    margin: '0px',
                    maxWidth :'100vw',
                },
                nzMask: false,
                nzFooter: null,
                nzClosable: false,
                nzMaskClosable: false,
                nzKeyboard: false,
            })
    }

    resendPendingMessages() {
        this.store.dispatch(
            resendPendingMessages()
        );
    }

    setTimeout() {
        this.userActivity = setInterval(() => this.userInactive.next(undefined), parseInt(window['MOVIUS_INACTIVE_TIMEOUT']) * 60 * 1000);
    }

    refresh(): void {
        window.location.reload();
    }

    @HostListener('window:mousemove') refreshUserState() {
        clearTimeout(this.userActivity);
        this.setTimeout();
    }

    async versionCheckAPiCall() {
        let response = await fetch('/movius-web/version', { cache: 'no-store' });
        if (response.status !== 200) {
            logger.debug(response);
            throw new Error(response.type);
        } else {
            // read response stream as text
            let textFromFile = await response.text();
            if (localStorage.getItem('Version') !== textFromFile) {
                this.setLocalStorage(textFromFile);
                this.refresh();
            }
        }

    }

    setLocalStorage(arg) {
        localStorage.setItem('Version', arg);
    }



    async ngOnInit() {
        //document.body.classList.remove('light-theme', 'theme-dark');
        // document.body.classList.add(`theme-dark`);
        //this.toggleMode()
        if (this.appEmbededStatus === "messaging") {
            await app.initialize();
            this.teamsRegisterLoadingAndUnloading()
            this.teamsRegisterThemeChangeHandler();
            this.register_back_button()
            this.authDataService.loaderSpinnerEvent(true);
            this.loaderModalOpen()
            if(!sessionStorage.getItem("authToken") || !sessionStorage.getItem("isLogingViaTeams") )
            {
                this.getAuthTkn();
            }else{
                this.getReloadAuthToken()
            }
            app.notifySuccess()
            this.routeIndexToTop()
            this.router.events.subscribe(event=>{
                if (event instanceof NavigationEnd) {
                    this.routeIndexToTop()
                }
            })
        }
        this.isIframe = window !== window.parent && !window.opener;
        Notification.requestPermission();
    }

    routeIndexToTop(){
        if (this.appEmbededStatus == 'messaging') {
            window.history.pushState(
                { html: 'index.html', redirect: 'Reload' },
                '',
                this.baseURL
            );
        }
    }

    teamsRegisterThemeChangeHandler(){
        app.registerOnThemeChangeHandler((theme)=>{
            this.setTheme(theme);
            this.cdr.markForCheck();
            this.cdr.detectChanges()
        })
    }
    teamsRegisterLoadingAndUnloading(){

        teamsCore.registerOnLoadHandler((data) => {
            this.register_back_button()
            console.log("got load from TEAMS", data.contentUrl, data.entityId);
            /*const sipUserInformation = JSON.parse(sessionStorage.getItem('sipuserdata'));
            const sipUserInfo: SipUserInfo = {
                id: sipUserInformation.id,
                name: sipUserInformation.name,
                password: sipUserInformation.password,
                skipGenerateNameToken: true,
                extraHeaders: sipUserInformation.extraHeaders,
                config: sipUserInformation.config,
            };
            this.sipUserService.register(sipUserInfo);*/
            app.notifySuccess();
            this.store.dispatch(
                loadMessageHistory()
            );
        });

        teamsCore.registerBeforeUnloadHandler((readyToUnload) => {
            logger.debug("Ready to unload called");
            sessionStorage.setItem("teams_unhold","true");
            logger.sendPOSTlog()
            readyToUnload();
            /*this.sipService.unregisterUser(this.sipUserService.getActiveSipUser);
            if(this.sipUserService.secondarysipUser){
                this.sipService.unregisterUser(this.sipUserService.secondarysipUser);
            }*/
            return true;
        });
    }

    clearReloadSessions(){
        sessionStorage.removeItem("reload_device");
        sessionStorage.removeItem("reload_orgbrand");
        sessionStorage.removeItem("reload_userinfo");
        localStorage.removeItem("cacheRehidrate");
    }

    // lOADER FEATURE IS DISABLED IN THE INDEX.HTML
    // ngAfterViewInit() {
    //     let loader = this.renderer.selectRootElement('#loader');
    //     this.renderer.setStyle(loader, 'display', 'none');
    // }

    ngOnDestroy() {
        this.clearTimer();
        this.clearTimerPendingMessage();
        this.destroy$.next();
    }

    start() {
        this.countDown();
        //this.resendPendingMessage();
    }

    stop() {
        this.clearTimer();
    }

    private countDown() {
        //logger.debug('countDown');
        if (null === sessionStorage.getItem("_API_PROCESSING_RETRY_QUEUE_")) {
            sessionStorage.setItem("_API_PROCESSING_RETRY_QUEUE_", "NO")
        } else {
            sessionStorage.setItem("_API_PROCESSING_RETRY_QUEUE_", "NO")
        }
        this.clearTimer();
        this.intervalId = window.setInterval(() => {
            this.seconds -= 1;
            // Iterate based on session value
            const sessionKeys = Object.keys(sessionStorage)
            const isLostMsgAvailable = sessionKeys.filter((LstMsgs) => LstMsgs.startsWith('LostMessage-Msg-'))
            if (isLostMsgAvailable.length !== 0) {
                for (let i = 0; i <= isLostMsgAvailable.length - 1; i++) {

                    const LstMsgDetails = JSON.parse(sessionStorage.getItem(isLostMsgAvailable[i]))

                    //const msgIdExists = this.messageIdCheck(LstMsgDetails["messageId"]);
                    //if(!msgIdExists){
                    if(sessionStorage.getItem('processing-'+LstMsgDetails["messageId"]) != null){
                        logger.debug('Message is getting processed, discard the sync message');
                    } else {
                        sessionStorage.setItem('processing-'+LstMsgDetails["messageId"],"yes")
                        logger.debug('app.component::adding message for peer: ', LstMsgDetails["peerid"]);
                        sessionStorage.removeItem(isLostMsgAvailable[i]);
                        const userMlNumber = sessionStorage.getItem('__api_identity__');
                        sessionStorage.setItem('incomingGroupParticipants', JSON.stringify(LstMsgDetails["partiesList"]));
                        let allNumbers = "";

                        if (LstMsgDetails["isGroupMsg"] === true) {
                            allNumbers = LstMsgDetails["peerid"];
                            sessionStorage.setItem('participants', LstMsgDetails["partiesList"]);
                            this.dbContext.message.addParticipants(allNumbers, LstMsgDetails["partiesList"], LstMsgDetails["threadId"]);
                            sessionStorage.setItem(allNumbers, LstMsgDetails["partiesList"]);
                            sessionStorage.setItem(LstMsgDetails["threadId"], JSON.stringify(LstMsgDetails["partiesList"].replaceAll("|", ",")));
                        } else {
                            sessionStorage.setItem('participants', null);
                        }
                        let messageInfo = {};
                        if (LstMsgDetails["multimediaId"]) {
                            let fromNumber = LstMsgDetails["fromNumber"]
                            if (LstMsgDetails["messageChannelType"] === "whatsapp") {
                                fromNumber = LstMsgDetails["fromNumber"] != sessionStorage.getItem('__api_identity__') ? "whatsapp:" + LstMsgDetails["fromNumber"] : LstMsgDetails["fromNumber"]
                            }
                            messageInfo = {
                                id: LstMsgDetails["messageId"],
                                session_id: LstMsgDetails["multimediaId"], // mms_session for now, can hold multiple session_id of diff msg types
                                multimediaStatus: 'not-initiated',
                                messageType: 'picture',
                                parties_list: LstMsgDetails["parties_list"] ? LstMsgDetails["parties_list"] : "",
                                from: fromNumber,
                                to: LstMsgDetails["to"],
                                multimediaContentType: LstMsgDetails["multimediaType"],
                            }
                        }
                        if (LstMsgDetails["contactMlNumber"] === userMlNumber) {
                            let peerId = LstMsgDetails["messageRecipient"];
                            peerId = allNumbers === "" ? LstMsgDetails["messageRecipient"] : allNumbers;
                            logger.warn('received self-message, accept it', LstMsgDetails);
                            //this.messagingService.getSameContentMsgWithInTimeLimit(LstMsgDetails["content"], LstMsgDetails["messageTime"]);
                            messageInfo["from"] = sessionStorage.getItem('__api_identity__');
                            messageInfo["to"] = LstMsgDetails["messageRecipient"];
                            let fromNumber = LstMsgDetails["fromNumber"]
                            if (LstMsgDetails["messageChannelType"] === "whatsapp") {
                                fromNumber = LstMsgDetails["fromNumber"] != sessionStorage.getItem('__api_identity__') ? "whatsapp:" + LstMsgDetails["fromNumber"] : LstMsgDetails["fromNumber"]
                            }
                            if(peerId){
                                this.store.dispatch(
                                    checkIncomingSessionSelfMessage({
                                        peerId,
                                        messageId: LstMsgDetails["messageId"],
                                        fromNum: fromNumber,
                                        content: LstMsgDetails["content"],
                                        dateTime: LstMsgDetails["messageTime"],
                                        isSystem: LstMsgDetails["isSystem"],
                                        threadId: LstMsgDetails["threadId"],
                                        parties_list: LstMsgDetails["partiesList"],
                                        messageType: LstMsgDetails["multimediaId"] ? "picture" : "text",
                                        messageInfo: messageInfo
                                    })
                                );
                            }
                        } else {
                            allNumbers = allNumbers === "" ? LstMsgDetails["contactMlNumber"] : allNumbers;
                            //Check incoming whatsapp lost message and update the from Num
                            const systemCafeHeader = LstMsgDetails["system_type"];
                            let fromNumber = LstMsgDetails["messageChannelType"] != 'normalMsg' ? `whatsapp:${LstMsgDetails["fromNumber"]}` : allNumbers;
                            let body_content = LstMsgDetails["content"]
                            this.store.dispatch(
                                addIncomingSessionMessage({
                                    peerId: fromNumber,
                                    messageId: LstMsgDetails["messageId"],
                                    fromNum: LstMsgDetails["fromNumber"],
                                    content: body_content,
                                    dateTime: LstMsgDetails["messageTime"],
                                    isSystem: LstMsgDetails["isSystem"],
                                    threadId: LstMsgDetails["threadId"],
                                    parties_list: LstMsgDetails["partiesList"],
                                    messageType: LstMsgDetails["multimediaId"] ? "picture" : "text",
                                    messageInfo: messageInfo,
                                    stype: systemCafeHeader ? Number(systemCafeHeader) : null,
                                    messageChannelType: LstMsgDetails["messageChannelType"]
                                })
                            )
                        }
                        sessionStorage.removeItem('processing-'+LstMsgDetails["messageId"])
                    }
                    if  (LstMsgDetails["system_type"] === "30" && LstMsgDetails["content"].includes("and shared chat history")) {
                        this.messagingService.loadPeerHistory(LstMsgDetails["threadId"]);
                    }
                //}
                }
            }
            if (sessionStorage.getItem('LostMessage-Voicemail') === 'Voicemail') {
                this.store.dispatch(
                    loadLatestVoiceMail()
                );
                sessionStorage.removeItem('LostMessage-Voicemail');
            }
            if (sessionStorage.getItem('LostMessage-Calllog') === 'Calllog') {
                logger.debug('Procsessing lost call log SIP messages');
                /* To DO -  We need to pull only the delata call log not whole all the time
                should be addressed in clean-up */
                /* let start_ts = null;
                this.dbContext.call.getLatesrtCallTs(sessionStorage.getItem('__api_identity__'))
                    .then((starttime: string) => {
                        start_ts = Date.parse(starttime) / 1000
                    });
                logger.debug("Proccessing Call log notification"); */
                this.store.dispatch(
                    loadInitialHistory()
                );
                sessionStorage.setItem('LostMessage-Calllog', null)
            }
            if (JSON.parse(sessionStorage.getItem('LostMessage-readStatus')) !== null) {
                let lostReadStatusMSG: readMessage[] = [];
                lostReadStatusMSG = JSON.parse(JSON.parse(JSON.stringify(sessionStorage.getItem('LostMessage-readStatus'))));
                logger.debug("Proccessing lost message read staus SIP messages!!");
                logger.debug(lostReadStatusMSG);
                let sipMessage: readMessage;
                for (var message of lostReadStatusMSG) {
                    logger.debug("Updtae read time of thread:", message.thread, ' to ', message.timestamp);
                    loadInitialHistory()
                    this.store.dispatch(
                        messageRead({
                            peerId: message.peerid,
                            messageId: message.message,
                            dateTime: message.timestamp,
                            threadId: message.thread,
                            isSystem: true
                        })
                    );
                }
                sessionStorage.setItem('LostMessage-readStatus', null)
            }
            //}
            // Execute the retryQueue here
            if (this.getConnectionErrorValue === false) {
                if ("NO" === sessionStorage.getItem("_API_PROCESSING_RETRY_QUEUE_")) {
                    //console.log("Starting  processing the retry queue setting session value for _API_PROCESSING_RETRY_QUEUE_ -> YES")
                    sessionStorage.setItem("_API_PROCESSING_RETRY_QUEUE_", "YES")
                    const retryQueue = new Promise(async (resolve) => {
                        const queueMessages = await this.messagingService.getAllRetryQueue();
                        resolve({
                            queueMessages
                        })
                    })
                    retryQueue.then(async (res) => {
                        const queue = JSON.parse(JSON.stringify(res))
                        const data = queue.queueMessages;
                        if (data.length > 0) {
                            logger.info("Found failed MMS upload request::", data);
                            data.forEach(async (element, index) => {
                                if (element.failedCount < 7) {
                                    logger.debug("Retry the retryQueue entry::", element);
                                    let media = null;
                                    let mms_id = element.id;
                                    let sent_to = element.data.sent_to;
                                    let sent_by = element.data.sent_by;
                                    let iswhatsapp = element.data.whatsapp ? true : false;
                                    let participants = element.data.whatsapp ? element.data.participats.length > 1 ? element.data.participats.join("|") : element.data.participats.toString : undefined;
                                    let targetUri = element.data.targetUri ? element.data.targetUri : element.targetUri;
                                    let threadid = (iswhatsapp && element.data.threadid) ? element.data.threadid : undefined
                                    let forward = element.isforward;
                                    const fromMdeia = new Promise(async (resolve, reject) => {
                                        const mmsMedia = await this.messagingService.getMediaById(element.id);
                                        resolve({ mmsMedia })
                                    })
                                    fromMdeia.then(async value => {
                                        const mmsmedia = value
                                        media = mmsmedia["mmsMedia"];
                                        let mmsBlobData;
                                        let mmsContentType;
                                        let mmsFilename;
                                        if (undefined === media) { // Media NOT FOUND in media table
                                            logger.info("Delete the retryQueue entry", element.id, " which is not available in media");
                                            await this.messagingService.deleteRetryQueueById(element.id);
                                        } else { // Media FOUND in media table
                                            logger.info("Media found for failed MMS", mms_id, "media::", media)
                                            mmsBlobData = media.data;
                                            mmsContentType = mmsBlobData.type;
                                            mmsFilename = media.fileName;
                                            const mmsFile = new File([mmsBlobData], mmsFilename,
                                                {
                                                    type: mmsContentType,
                                                    lastModified: Date.now()
                                                }
                                            )
                                            if (null !== media) {
                                                const info = {
                                                    sentBy: sent_by,
                                                    sentTo: sent_to,
                                                    mmsId: mms_id,
                                                    isWhatsAppThreadId: threadid
                                                };
                                                await this.messagingService.uploadMMS(mmsFile, info).subscribe(async response => {
                                                    logger.debug("Retry MMS", element.failedCount + 1, "res:::", response)
                                                    if (response.root && response.root.return == 0) {
                                                        sessionStorage.setItem("__API_RETRY_MMS_PARTICIPANTS__", participants);
                                                        const mmsDttails = {
                                                            mms_type: mmsContentType,
                                                            mms_id: element.id
                                                        }
                                                        const waDetails = {
                                                            iswhatsapp: iswhatsapp,
                                                            participants: participants,
                                                            threadid: threadid
                                                        }
                                                        const isGroup = info["sentTo"].split("|").length > 2 ? true : false
                                                        const group_parties = participants ? participants : isGroup ? info["sentTo"] : undefined;
                                                        await this.messagingService.retryMultimediaMessage(mmsDttails, targetUri, forward, isGroup, group_parties, waDetails);
                                                        logger.info("Delete the retryQueue entry", element.id, " which is success on retry!!");
                                                        await this.messagingService.deleteRetryQueueById(element.id);
                                                        data.splice(index, 1)
                                                        if (0 === data.length) {
                                                            //logger.debug("Finished processing the retry queue setting session value for _API_PROCESSING_RETRY_QUEUE_ -> NO")
                                                            sessionStorage.setItem("_API_PROCESSING_RETRY_QUEUE_", "NO")
                                                        }
                                                        sessionStorage.removeItem("__API_RETRY_MMS_PARTICIPANTS__");
                                                    } else {
                                                        if (24001 === (response.error.apiReturnCode)) {
                                                            logger.info("Upload MMS failed because of 'Too many requests' within given time. Will be retried later.");
                                                            await sleep(10 * 1000); // seconds * 1000 milliseconds
                                                            data.splice(index, 1)
                                                            if (0 === data.length) {
                                                                //logger.debug("Finished processing the retry queue setting session value for _API_PROCESSING_RETRY_QUEUE_ -> NO")
                                                                sessionStorage.setItem("_API_PROCESSING_RETRY_QUEUE_", "NO")
                                                            }
                                                        } else {
                                                            logger.info("Update the retry cond for retryQueue", element.id, " from ", element.failedCount, " -> ", element.failedCount + 1);
                                                            element.failedCount = element.failedCount + 1;
                                                            await this.messagingService.updateRetryQueueEntry(element);
                                                            data.splice(index, 1)
                                                            if (0 === data.length) {
                                                                //logger.debug("Finished processing the retry queue setting session value for _API_PROCESSING_RETRY_QUEUE_ -> NO")
                                                                sessionStorage.setItem("_API_PROCESSING_RETRY_QUEUE_", "NO")
                                                            }
                                                        }
                                                    }
                                                });
                                            }
                                        }
                                    });
                                } else {
                                    let peerId = element.data.sent_to.indexOf("|") === -1 ? element.data.sent_to : sortParticipantsAsID(element.data.sent_to.split("|"));
                                    this.store.dispatch(
                                        updatePictureRetryThresholdReached({
                                            peerId: peerId.includes('whatsapp') ? element.data.threadid : peerId,
                                            mms_id: element.id
                                        })
                                    )
                                    const media = await this.dbContext.message.updateRtryRchdInMediaRtnMedia(element.id);
                                    let sent_to = '';
                                    if ((element.data.sent_to != null || element.data.sent_to != undefined) && element.data.sent_to.includes('|')) {
                                        sent_to = (element.data.sent_to.split('|')[0] != sessionStorage.getItem('__api_identity__')) ? element.data.sent_to.split('|')[0] : element.data.sent_to.split('|')[1]
                                    } else {
                                        sent_to = element.data.sent_to;
                                    }


                                    let sent_by = element.data.sent_by;
                                    let participants = element.data.participants;
                                    const state: MessageState = {
                                        kind: "PicMsgRetryThresholdReached"
                                    }
                                    const messageInfo: messageInfoType = {
                                        id: element.id,
                                        session_id: element.id, // mms_session for now, can hold multiple session_id of diff msg types
                                        multimediaStatus: 'downloaded',
                                        messageType: "picture",
                                        parties_list: participants,
                                        from: sent_by,
                                        to: sent_to,
                                        multimediaContentType: media.data.type
                                    }
                                    const message: Message = {
                                        id: element.id,
                                        userId: sent_by,
                                        peerId: peerId,
                                        threadId: element.data.threadid,
                                        callId: undefined,
                                        sentTime: new Date().toISOString(),
                                        content: 'Multimedia Message',
                                        state: state,
                                        isSystem: false,
                                        messageType: "picture",
                                        messageInfo: messageInfo
                                    }
                                    const isGroup = sent_to.split("|").length > 2 ? true : false;
                                    await this.dbContext.message.addOrUpdateAllMessageInfo([messageInfo]);
                                    await this.dbContext.message.addOrIgnoreMessage(sessionStorage.getItem("__api_identity__"), message, isGroup);
                                    logger.info("Delete the retryQueue entry", element.id, " which has reached the retry threshould");
                                    await this.messagingService.deleteRetryQueueById(element.id);
                                }

                            });
                        } else {
                            //logger.debug("Re-setting the session value for _API_PROCESSING_RETRY_QUEUE_ -> NO")
                            sessionStorage.setItem("_API_PROCESSING_RETRY_QUEUE_", "NO")
                        }
                    });
                }

            }
        }, 5000);
    }

    private resendPendingMessage() {
        this.clearTimerPendingMessage();
        this.intervalResendMessageId = window.setInterval(() => {
            this.seconds -= 1;
            //this.resendPendingMessages();
        }, 60000);
    }

    clearTimer() {
        clearInterval(this.intervalId);
    }

    clearTimerPendingMessage() {
        clearInterval(this.intervalResendMessageId);
    }

    public getConnectionError(event: any) {
        this.getConnectionErrorValue = event;
    }

    // async messageIdCheck(messageId){
    //     const msgIdExists = await this.dbContext.message.checkMsgIdExistsorNot(messageId);
    //     if(msgIdExists){
    //         console.log('AppComponent: Blocking following msg since allready exists msg in db with same id:', messageId);
    //         sessionStorage.removeItem('LostMessage-Msg-'+messageId);
    //         return true;
    //     }else {
    //         return false;
    //     }
    // }

}


