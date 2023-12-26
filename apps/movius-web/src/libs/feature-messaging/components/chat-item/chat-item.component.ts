import {
    ChangeDetectionStrategy,
    Component,
    ElementRef,
    EventEmitter,
    Input,
    OnChanges,
    OnInit,
    Output,
    ViewContainerRef,
} from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { ActivatedRoute, Router } from '@angular/router';
import { select, Store } from '@ngrx/store';
import { SipService } from '@scalio/sip';
import { any, uniqBy } from 'lodash/fp';
import { NzModalRef, NzModalService } from 'ng-zorro-antd/modal';
import { NzImageModule, NzImageService } from 'ng-zorro-antd/image';
import { BehaviorSubject, combineLatest, Observable } from 'rxjs';
import { filter, map, skipUntil, startWith, take } from 'rxjs/operators';
import { getFeatureEnabled, getValidPeerId, isTimeCrossed } from './../../../shared/utils/common-utils';


import {
    ConfirmDialogComponent,
    convertBinaryToBlob,
    DateTimeService,
    DbContext,
    filterState,
    cleanPhoneNumber,
    AuthService
} from '../../../shared';
import { PeerMessagingState } from '../../models';
import { PeerChatMessageView, selectMessageSearchText, selectPeersMessages, updateDownloadAPIErrorStatus, updateDownloadAPISuccess } from '../../ngrx';
import { sendCustomerOptInRequest } from '../../../feature-contacts/ngrx/index';
import { MessagingDataAccessService } from '../../services';
import { MessagingService } from '../../services/messaging.service';
import { LoggerFactory } from '@movius/ts-logger';
import { hideMessageThread,  } from './../../ngrx/actions';
import { selectPeersMessagesIsLoaded, selectWhatsAppOptInStatus } from './../../ngrx/selectors';
import { I } from '@angular/cdk/keycodes';

const logger = LoggerFactory.getLogger("")

export interface PeerChatMessageComponentView extends PeerChatMessageView {
    isDateBefore: boolean;
    isFirstNotRead: false | number;
    dateFormatted: string;
    batchIndex: number;
    nextBatchSignal: boolean;
}

export interface MessagingWorkspaceViewState {
    sessions: PeerMessagingState[];
}

@Component({
    selector: 'movius-web-chat-item',
    templateUrl: './chat-item.component.html',
    styleUrls: ['./chat-item.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChatItemComponent implements OnInit, OnChanges {
    private _notifyVisibleObserver: IntersectionObserver;
    _sessionId: string;
    _optInRequestCount: number;
    _peer_multiLine:string;
    @Input() message: PeerChatMessageComponentView;

    @Output() displayed = new EventEmitter();
    @Output() remove = new EventEmitter();
    @Output() forward = new EventEmitter();
    @Output() copy = new EventEmitter();
    @Output() scrollToBottom = new EventEmitter();
    contactNameExt: string;
    readonly view$: Observable<MessagingWorkspaceViewState>;
    readonly search$ = new BehaviorSubject<string>(null);

    loadedPic: boolean = false
    getConnectionErrorValue: any;
    showToggleSpinner: boolean;
    imageFileName: any;
    multimediaType: any;
    @Output() loadedImages = new EventEmitter();

    @Input() loadedPictureMessage_chat : Observable<any>;
    @Input() cnt_id : Observable<number>;
    // @Input() peer_multiLine : Observable<any>;
    @Input() isWhatsappOptinAccepted : Observable<any>;
    appEmbededStatus: any;
    loadFirstThreadMsg: string;
    loadNextThreadMsg: string;
    systemMessages = [
        "The contact hasn’t responded to the opt-in request for more than 24 hours. You can try sending the request again.",
        "The contact hasn’t responded for more than 24 hours. Please use the template button in the bottom-left to select a message to send.",
        "Looks like this contact hasn't enabled WhatsApp.",
        "To Re-Engage the conversation, please send guest a request",
        "You've sent the contact an opt-in request. You'll be able to start messaging after the contact accepts your request.",
        "The contact has opted in. You can start messaging now.",
        "You left the conversation.",
        "The contact has opted out. You can't send requests or messages to the contact anymore."
    ];
    sessionThreads: PeerMessagingState[];
    isWhatsAppThread: boolean;
    urlId: any;
    // @Input() optInRequestCount : Observable<number>;
    @Input() set optInRequestCount(val: number){
        if (this.optInRequestCount !== val) {
            this._optInRequestCount = val;
        }
    }

    @Input() set peer_multiLine(val: string){
        if (this.peer_multiLine !== val) {
            this._peer_multiLine = val;
        }
    }


    @Input() lastIncommingMessageAt : Observable<any>;
    @Input() whatsOptInReqStatus : Observable<number>;

    @Input() set sessionId(val: string){
        if (this.sessionId !== val) {
            this._sessionId = val;
        }
    }

    get peer_multiLine(){
        return this._peer_multiLine;
    }
    get optInRequestCount(){
        return this._optInRequestCount;
    }
    get sessionId(){
        return this._sessionId;
    }
    get notifyIfVisible() {
        return !!this._notifyVisibleObserver;
    }

    isActive = false;
    isSelf = false;
    isGroupChat = false;
    parties_list = "";
    msg: any;
    urlList: any;
    contactName: string;
    afterReadCountUpdate: any;
    imageUrl: any;
    intervalId: any;
    modalRef: NzModalRef;
    private observer: IntersectionObserver;
    mmsObserver: { [id: string]: IntersectionObserver } = {};
    isLogingViaTeams: string
    searchItem:string = '';
    chatId = null;
    disableOptinRequest: boolean;
    whatsAppStatus = null;
    whatsAppMessageEnabled = sessionStorage.getItem('__enable_whatsapp_message__') ==="true";
    isMobileDevice: Boolean = false;

    constructor(
        private readonly dateTimeService: DateTimeService,
        private readonly router: Router,
        private readonly dbContext: DbContext,
        private readonly messagingService: MessagingService,
        private readonly dataAccessService: MessagingDataAccessService,
        private readonly store: Store,
        sipService: SipService,
        private sanitizer: DomSanitizer,
        public modalService: NzModalService,
        private viewContainerRef: ViewContainerRef,
        private el: ElementRef,
        public nzImageService: NzImageService,
        private activatedRoute: ActivatedRoute,
        private readonly authService: AuthService,
        ) {
            this.isMobileDevice = ((sessionStorage.getItem('Contex_res')?.toLowerCase() === "ios") || (sessionStorage.getItem('Contex_res')?.toLowerCase() === "android"))
            ? true : false;
            this.isLogingViaTeams = sessionStorage.getItem("isLogingViaTeams");
            this.appEmbededStatus = getFeatureEnabled();
            this.store.pipe(select(selectMessageSearchText)).subscribe(
                resp =>{
                    this.searchItem = resp ? resp : '';
                }
            )
            const isLoaded$ = store
            .select(selectPeersMessagesIsLoaded)
            .pipe(startWith(false));
            const id$ = this.activatedRoute.params.pipe(
                map(({ id }) => id)
            );

            // this.isLogingViaTeams = "true";
            this.showToggleSpinner = true
            this.urlList = this.router.url.split('/')
            const peerMessages$ = store
            .select(selectPeersMessages(sipService.getUserUri))
            .pipe(
                map((m) => m.filter((f) => f.messages.length > 0)),
                // map((m) => uniqBy((x) => x.peer.multiLine, m))
            );
        this.view$ = combineLatest([
            peerMessages$,
            this.search$,
            id$
        ]).pipe(
            map(
                ([
                    state,
                    search,
                    id
                ]) => ({
                    sessions: filterState(state, search),
                    isGroup: state.filter((session) => {
                        this.urlId = id;
                        if (session.threadId === id || session.peerId === id) {
                            this.isGroupChat = session.isGroup
                            this.isWhatsAppThread = session.messageChannelType != 'normalMsg'
                        }
                    }),
                })
            )
        );

        activatedRoute.params.subscribe(params =>{
            this.chatId = params['id'];
        });


         // open first thread Message
        this.view$
            .pipe(skipUntil(isLoaded$.pipe(filter((f) => !!f))), take(1))
            .subscribe((view) => {
                // wait till contacts loaded on Message Component
                if (view.sessions.length) {
                    this.sessionThreads = view.sessions;
                    if (view.sessions[0].messageChannelType == 'whatsapp') {
                        this.loadFirstThreadMsg = view.sessions[0].threadId
                    } else {
                        this.loadFirstThreadMsg = view.sessions[0].peer?.id
                    }
                    if(view.sessions.length > 1){
                        if (view.sessions[1].messageChannelType == 'whatsapp') {
                            this.loadNextThreadMsg = view.sessions[1].threadId
                        } else {
                            this.loadNextThreadMsg = view.sessions[1].peer?.id
                        }
                    }
                }
            });
    }

    // async showImage(message) {
    //     if(sessionStorage.getItem("outboundPic") === message.messageInfo.session_id
    //     || sessionStorage.getItem("inboundPic") === message.messageInfo.session_id){
    //         this.imageUrl = await this.getImage(message);
    //     }
    // }

    get imageStatus() {
        const msg = this.message.state.kind
        return msg === "PictureMessageAPIError"
        || msg === "PicMsgRetryThresholdReached";
        // return msg === "PictureMessageAPISending"
        // || msg === "PictureMessageAPIError"
        // || msg === "PicMsgRetryThresholdReached";
    }

    GetTheme(){
        let theme = localStorage.getItem("Theme")
        return theme ? "Dark" : null
    }

    get imageDownloadStatus() {
        const message = this.message;
        return message.messageInfo !== undefined
            && message.messageInfo.multimediaStatus
            && message.messageInfo.multimediaStatus === 'failure'
    }



    async getImage(message) {
        return new Promise(async (resolve, reject)=>{
            if(message.state.kind !== "PictureMessageAPISending" &&
            message.messageInfo.multimediaStatus && message.messageInfo.multimediaStatus !== 'failure'){
                const media = await this.dbContext.message.getMediaById(message.messageInfo.session_id);
                const messageInfo = await this.dbContext.message.getMessageInfo(message.id);

                let from, to;
                if(messageInfo){
                    from = messageInfo.from;
                    to = messageInfo.to;
                }else{
                    from = message.messageInfo.from;
                    to = message.messageInfo.to;
                }
                if (media) {
                    // if(message.messageInfo.multimediaStatus !== 'downloaded'){
                    //     // this if case is not needed, this needs to be removed and
                    //     // the db change for updating the download status needs to be added.
                    //     // so on refresh the message will have the exact detail about multimediaStatus
                    //     this.store.dispatch(
                    //         updateDownloadAPISuccess({
                    //             peerId: message.peerId,
                    //             msg_id: message.id,
                    //         })
                    //     )
                    // }
                    this.imageFileName = media.fileName;
                    this.multimediaType = media.data.type;
                    const blob = await URL.createObjectURL(media.data);
                    const blobUrl = this.sanitizer.bypassSecurityTrustUrl(blob);
                    resolve(blobUrl)
                } else {
                    if(message.state.kind === "PicMsgRetryThresholdReached" || message.state.kind === "PictureMessageAPIError"){
                        this.showToggleSpinner = false;
                        return;
                    }
                    const identity = sessionStorage.getItem("__api_identity__");
                    const sent_by = from;
                    const sent_to = to;
                    const multimediaId = message.messageInfo.session_id;
                    let is_wa_pic = false
                    let wa_from;

                    is_wa_pic = (message.peerId == message.threadId  || message.fromNumber.includes('whatsapp')) || (message.messageInfo && ( message?.peerId?.includes('whatsapp') || message?.messageInfo?.from.includes('whatsapp') || message.messageInfo.parties_list && message.messageInfo.parties_list.includes('whatsapp')))
                    if (is_wa_pic) {
                         wa_from = message.peerId
                    }
                    if(sessionStorage.getItem('download-'+this.message.messageInfo.session_id) != 'yes'){
                    const msg = await this.dbContext.message.getMessage(message.id)
                    const threadId = message.threadId || msg?.threadId ;
                    console.log("Parameters are sent_by = " +  sent_by + ", sent_to = " + sent_to + ", is_wa_pic = " + is_wa_pic + ", threadId = "+ threadId + ", multimediaId = " + multimediaId)
                    await this.dataAccessService.getMultiMediaData(sent_by, sent_to, multimediaId, threadId, wa_from, is_wa_pic).subscribe(async data => {
                        const mmsDataResponse = data.root.data;
                        this.imageFileName = data.root.filename;
                        this.multimediaType = data.root.content_type;
                        const blob = convertBinaryToBlob(mmsDataResponse, this.multimediaType);
                        const blobBinary = await URL.createObjectURL(convertBinaryToBlob(mmsDataResponse, this.multimediaType));
                        const blobUrl = this.sanitizer.bypassSecurityTrustUrl(blobBinary);

                        await this.dbContext.message.addOrUpdateMedia(identity, {
                            id: multimediaId,
                            data: blob,
                            fileName: this.imageFileName,
                            update_r_download_time: new Date().toISOString()
                        });
                        const getPeerId = getValidPeerId(message?.messageInfo?.parties_list);
                        this.store.dispatch(
                            updateDownloadAPISuccess({
                                peerId: getPeerId?.includes('whatsapp') ? message?.threadId : getPeerId,
                                msg_id: message.id,
                            })
                        )
                        resolve(blobUrl)
                    }, err => {
                        this.showToggleSpinner = false;
                        sessionStorage.removeItem('download-'+message.messageInfo.session_id)
                        const getPeerId = getValidPeerId(message?.messageInfo?.parties_list);
                        this.store.dispatch(
                            updateDownloadAPIErrorStatus({
                                peerId: getPeerId?.includes('whatsapp') ? message?.threadId : getPeerId,
                                msg_id: message.id,
                                error: err.error
                            })
                        )
                    })
                    logger.debug("Media Table entry not found, download_mms called and obtained the data");
                  }
                }

            }else{
                if(message.messageInfo.multimediaStatus && message.messageInfo.multimediaStatus === 'failure'){
                    this.showToggleSpinner = false;
                }
            }
        })
    }


    async loadImage() {
        if (this.message && this.message.messageType && this.message.messageType == "picture") {
            this.showToggleSpinner = true;
            this.imageUrl = await this.getImage(this.message);
            if(this.imageUrl){
                this.showToggleSpinner = false;
            }
        }
    }

    ngOnInit(): void {
        this.chatId;
        this.isSelf = this.message.from === 'me';
        if (this.isSelf !== true) {
            this.msg = this.message;
            if (typeof (this.msg.peerId) === 'undefined') {
                this.msg.peerId = this.urlList[this.urlList.length - 1];
            }
        }


        this.observer = new IntersectionObserver(async entries => {
            if (entries[0].isIntersecting === true) {
                if (this.message.messageType != 'text') {
                    const media = await this.dbContext.message.getMediaById(this.message?.messageInfo?.session_id);
                    if (media) {
                        this.showToggleSpinner = false;
                        this.imageUrl = await this.getImage(this.message);
                        logger.debug('Found Media::imageUrl', this.imageUrl);
                    } else {
                        console.log('no media found');
                        await this.loadImage()
                    }
                }
            } else if (sessionStorage.getItem('imageLoaded') == undefined) {
                sessionStorage.setItem('imageLoaded', 'true');
                //console.log('came to load image block');
                await this.loadImage()
            }

        }, {
            threshold: 0.2
        });
        this.observer.observe(this.el.nativeElement as HTMLElement);
    }

    ngOnChanges() {
        this.observer = new IntersectionObserver(async entries => {
            if (entries[0].isIntersecting === true) {
                if(this.message.state.kind === "PictureMessageAPIError" || this.message.state.kind === "PicMsgRetryThresholdReached"){
                    await this.loadImage();
                }
            }
        }, {
            threshold: 0.2
        });
        this.observer.observe(this.el.nativeElement as HTMLElement);
        // this.showImage(this.message);
        this.view$.subscribe((e) => {
            if (this.msg !== undefined) {
                const newCountData = e.sessions.filter((e) => e.peer?.id === this.msg.peerId)
                if (newCountData.length > 0) {
                    this.afterReadCountUpdate = newCountData[0].newCount;
                }
            }
        })
        this.store.select(selectWhatsAppOptInStatus(this.urlId)).subscribe(whatsAppResp =>{
            this.whatsAppStatus = whatsAppResp;
        });

       //For avoiding Select All from the contextmenu which will select whole webpage
        window.onmouseup = (mup) => {
            let t = document.getSelection();
            if(t.type == "Range"){
                window.onselectstart = (c) => {
                    c.preventDefault();
                };
            } else {
                window.onselectstart = (c) => {
                    return true;
                };
            }
        }

        window.ontouchend = (mup) => {
            logger.debug('called ontouchend event');
            let t = document.getSelection();
            if(t.type == "Range"){
                window.onselectstart = (c) => {
                    logger.debug('called onSelectstart event');
                    c.preventDefault();
                };
            } else {
                window.onselectstart = (c) => {
                    return true;
                };
            }
        }

    }

    getContactName(fromNum: string): string {
        fromNum = fromNum?.includes('whatsapp:') ? fromNum?.replace('whatsapp:','') : fromNum;
        return this.messagingService.getAllContactName(fromNum);
    }


    formatTime(time: string) {
        return this.dateTimeService.formatOnlyTimeDefault(time);
    }

    public getConnectionError(event: any) {
        this.getConnectionErrorValue = event;
    }

    imagePreview(imageBlob: any): any {
        if (this.message.messageInfo.multimediaStatus
            && this.message.messageInfo.multimediaStatus !== 'failure'
            && this.message.messageInfo.multimediaStatus !== 'deleted-in-server' && this.showToggleSpinner === false) {

            const screenHeight = window.screen.availHeight;
            const _40percent = Math.round((screenHeight/100)*40)
            const _60percent = Math.round((screenHeight/100)*60)

            const images = [
                {
                    src: imageBlob,
                    alt: 'ng-zorro'
                }
            ];
            const imageUrl = imageBlob["changingThisBreaksApplicationSecurity"];
            const _img = new Image();
            _img.src = imageUrl;

            if(_img.naturalHeight > _img.naturalWidth){
                images[0]['height'] = (_img.naturalHeight > _40percent)? _40percent+'px':_img.naturalHeight+'px';
            }else{
                images[0]['width'] = (_img.naturalWidth > _60percent)? _60percent+'px':_img.naturalWidth+'px';
            }

            this.nzImageService.preview(images, { nzZoom: 1.5, nzRotate: 0, nzKeyboard:false, nzMaskClosable:false });
            const lists = document.getElementsByClassName("ant-image-preview-operations")[0];
            const ele = `
            <a href="${imageUrl}" download="${this.imageFileName}">
                <li id="img-download" class="ant-image-preview-operations-operation ng-tns-c465-39 ng-star-inserted" style="">
                    <span nz-icon="" nztheme="outline" class="anticon ant-image-preview-operations-icon ng-tns-c465-39 anticon-zoom-out"
                    ng-reflect-nz-theme="outline" ng-reflect-nz-type="zoom-out">
                        <svg viewBox="64 64 896 896" focusable="false"
                            fill="#ffffff" width="1em" height="1em" class="ng-tns-c465-39" data-icon="download"
                            aria-hidden="true">
                            <path
                                d="M505.7 661a8 8 0 0012.6 0l112-141.7c4.1-5.2.4-12.9-6.3-12.9h-74.1V168c0-4.4-3.6-8-8-8h-60c-4.4 0-8 3.6-8 8v338.3H400c-6.7 0-10.4 7.7-6.3 12.9l112 141.8zM878 626h-60c-4.4 0-8 3.6-8 8v154H214V634c0-4.4-3.6-8-8-8h-60c-4.4 0-8 3.6-8 8v198c0 17.7 14.3 32 32 32h684c17.7 0 32-14.3 32-32V634c0-4.4-3.6-8-8-8z">
                            </path>
                        </svg>
                    </span>
                </li>
            </a>`
            this.isMobileDevice === true ? false : lists.insertAdjacentHTML('beforeend', ele);
        } else {
            if (this.message.messageInfo.multimediaStatus
                && this.message.messageInfo.multimediaStatus === 'deleted-in-server') {

                this.modalService.create({
                    nzContent: ConfirmDialogComponent,
                    nzComponentParams: {
                        titleTxt: 'Error',
                        subTitleTxt: 'Image is no longer available',
                        applyBtnTxt: 'Ok',
                    },
                    nzBodyStyle: {
                        width: '26rem',
                    },
                    nzWidth: '26rem',
                    nzKeyboard: false,
                    nzFooter: null,
                });

            }
        }
    }

    public get_wa_number(id){
        for (let i = 0; i < this.sessionThreads.length; i++) {
            if(this.sessionThreads[i].threadId === id){
                for (let j = 0; j < this.sessionThreads[i].participants?.length; j++) {
                    if (this.sessionThreads[i].participants[j].includes('whatsapp')){
                        return this.sessionThreads[i].participants[j]
                    }
                }
                //return this.sessionThreads[i]?.peerId.replaceAll(sessionStorage.getItem("__api_identity__"),'').replace('|','')
            }
        }
        return id
    }

    async resendOptInRequest(cnt_id: number, peer_multiLine) {
        this.disableOptinRequest = true;
        let id = cnt_id;
        const wa = this.get_wa_number(this.sessionId)
        this.store.dispatch(sendCustomerOptInRequest({
            peerId: wa,
            showConfirmPopup: false,
            threadId: this.sessionId
        }));
    }

    public lastsms(timestamp: string) {
        if(timestamp && this.whatsAppStatus?.lastIncommingMessageAt){
            const lastinboundsms = new Date(this.whatsAppStatus?.lastIncommingMessageAt.replace('ZZ', 'Z')).getTime();
            const lastmessagetime = new Date(timestamp.replace('ZZ', 'Z')).getTime();
            if(lastinboundsms > lastmessagetime)
                return true;
            else
                return false;
        }
        return false

    }

    public replacestring(data){
        //return data.replace(/Last message:[0-9UTC\s\-:]$/,'');
        return data.split("Last message")[0]
    }

    public isthislastmessage(date){
            if(date && this.whatsAppStatus?.lastIncommingMessageAt){
                const currentmessagetime = new Date(date.replace('ZZ', 'Z')).getTime();
                const lastincomingmessage = new Date(this.whatsAppStatus?.lastIncommingMessageAt.replace('ZZ', 'Z')).getTime();

                if (lastincomingmessage - currentmessagetime > window['MOVIUS_WHATSAPP_TIME_THRESHOLD']) {
                    return false;
                }
            }
            return true;
    }

    public optInRequestCountCheck(optInRequestCount: number,whatsOptInReqStatus: number, messageTime?: Date){
        //console.log("optInRequestCountCheck optInRequestCount = " + optInRequestCount)
        //console.log("optInRequestCountCheck whatsOptInReqStatus = " + whatsOptInReqStatus)
        //console.log("optInRequestCountCheck messageTime = " + messageTime.toDateString)
        //console.log("optInRequestCountCheck whatsAppDisabled = " + this.whatsAppStatus?.whatsAppDisabled)
        //console.log("optInRequestCountCheck Last incoming message = " + this.whatsAppStatus?.lastIncommingMessageAt)

            if(this.whatsAppStatus && !this.whatsAppStatus.whatsAppDisabled && this.whatsAppStatus?.lastIncommingMessageAt == null){
                return true;
            }else{
                let threadsholdTimeCrossed =  isTimeCrossed(this.whatsAppStatus?.lastIncommingMessageAt);

                if (whatsOptInReqStatus == 2 && this.whatsAppStatus.whatsAppDisabled &&
                    this.whatsAppStatus.whatsAppDisabled.sentTime && messageTime == this.whatsAppStatus.whatsAppDisabled.sentTime){
                    threadsholdTimeCrossed =  isTimeCrossed(this.whatsAppStatus.whatsAppDisabled.sentTime);
                }

                if(whatsOptInReqStatus == 2){
                   if (optInRequestCount <= 2 && threadsholdTimeCrossed){
                        this.disableOptinRequest = !this.whatsAppMessageEnabled ? true : false;
                        return true
                   }
                } else {
                    if (whatsOptInReqStatus == 5 && isTimeCrossed(messageTime) && this.isthislastmessage(messageTime)){
                        this.disableOptinRequest = !this.whatsAppMessageEnabled ? true : false;
                        return true
                   }
                    return false
                }
            }


    }
     public isMoreThen1Day(date, miliseconds=window['MOVIUS_WHATSAPP_TIME_THRESHOLD']){
        if(date && this.whatsAppStatus?.lastIncommingMessageAt){
            const lastMessageDateMilliseconds = new Date(date.replace('ZZ', 'Z')).getTime();
            const lastincomingmessage = new Date(this.whatsAppStatus?.lastIncommingMessageAt.replace('ZZ', 'Z')).getTime();
            if ((lastincomingmessage - lastMessageDateMilliseconds) > miliseconds) {
                return true;
            }
        }
        return false;
    }

    public optincrossed(optInRequestCount: number){
        if(optInRequestCount <= 2)
          return false;
        else
          return true;
    }

    public noWAResend(message,whatsOptInReqStatus){
    if(message.isSystem && message.content.startsWith('Looks like this contact')
        && this.optInRequestCountCheck(this.optInRequestCount, whatsOptInReqStatus, message.sentTime)
        && !this.lastsms(message.sentTime) && this.timecrossed(message.sentTime))
        return true
    else
        false

    }

    public noWAthread(message){
        if((message.content.startsWith('Looks like this contact')
        && !this.timecrossed(message.sentTime)) && !this.optinreachedlimit(this.optInRequestCount)){
            return true
        } else {
            return false
        }
    }


    public optinreachedlimit(optInRequestCount: number){
        if(optInRequestCount <= 3)
          return false;
        else
          return true;
    }

    public timecrossed(timestamp: string){
       return isTimeCrossed(timestamp)
    }


    onYesOptionForEnableWhatsApp(peer_multiLine) {
        if (sessionStorage.getItem('__enable_whatsapp_message__') === "true") {
            const id = this.chatId.includes('whatsapp:') ? this.chatId.replace('whatsapp:', '') : this.peer_multiLine.replace('whatsapp:', '');
            if (this.appEmbededStatus === 'messaging') {
                const sessionData = this.sessionThreads.filter((contact) => {
                    const getPeerId = contact.peer?.multiLine
                    if (getPeerId === id) {
                        return contact.peer?.multiLine
                    }
                })
                if (sessionData.length > 0) {
                    this.router.navigate([`/messaging/chat/${id}`]);
                } else {
                    this.authService.selectedMessageType('message')
                    this.router.navigate([`/messaging/chat/new`]);
                    this.authService.onOptInMsgPeerId(id);
                }
            } else {
                this.router.navigate([`/messaging/chat/${id}`]);
            }
            this.store.dispatch(hideMessageThread({
                peerId: this.chatId,
                threadId: this.sessionId,
                hideThread: true
            }));
        }
    }

    onNoOptionForEnableWhatsApp() {
        if(sessionStorage.getItem('__enable_whatsapp_message__') === "true"){
            this.store.dispatch(hideMessageThread({
                peerId: this.chatId,
                threadId: this.sessionId,
                hideThread: true
            }));
            if (this.appEmbededStatus === 'messaging') {
                if (this.chatId === this.loadFirstThreadMsg) {
                    this.router.navigate([`/messaging/chat/${this.loadNextThreadMsg}`]);
                } else {
                    this.router.navigate([`/messaging/chat/${this.loadFirstThreadMsg}`]);
                }
            } else {
                if (this.cnt_id) {
                    this.router.navigate([`/contacts/${this.cnt_id}`]);
                } else {
                    this.router.navigate([`/contacts`])
                }
            }
        }
    }

}
