import {
    ChangeDetectionStrategy,
    Component,
    ElementRef,
    EventEmitter,
    HostListener,
    Input,
    OnInit,
    OnChanges,
    Output,
    ViewChild,
    ChangeDetectorRef,
} from '@angular/core';
import {
    FormBuilder,
    FormControl,
    FormGroup,
    Validators,
} from '@angular/forms';
import { ActivatedRoute, NavigationEnd, NavigationStart, Router } from '@angular/router';
import {
    AuthService,
    cleanPhoneNumber,
    DbContext,
    FormModel,
    getPeerNumberWOSpecialChars,
    allowedSpecialCharacters,
    MessagingStatus,
    SipUserService,
    CustomNzModalService,
    ConfirmDialogComponent,
    convertFileToBlob,
    base64toFile,
    chkOnlyAlphabets,
} from '../../../shared';
import { Store } from '@ngrx/store';
import { selectHash, selectWhatsAppOptInStatus } from './../../ngrx/selectors';

import { NzModalRef, NzModalService } from 'ng-zorro-antd/modal';
import { LoggerFactory } from '@movius/ts-logger';
import { session } from 'electron';
import { Observable, fromEvent, merge, of } from 'rxjs';
import { mapTo, map, switchMap} from 'rxjs/operators';
import { MMSService } from '../../services/mms.service';
import { MessagingService } from '../../services';
import { MessageContactSelectorComponent } from '../message-contact-selector/message-contact-selector.component';


const logger = LoggerFactory.getLogger("");

export interface ChatInput {
    message: string;
}

export let browserRefresh = false;

interface MessageToMultiline {
    multiline: string;
    message: string;
}

const noWhitespaceValidator = (control: FormControl) => {
    const isWhitespace = (control.value || '').trim().length === 0;
    const isValid = !isWhitespace;
    return isValid ? null : { whitespace: true };
};

const MESSAGE_MAX_BYTES_COUNT = 3000;

const stringBytesCount = (s: string) => {
    return encodeURI(s).split(/%..|./).length - 1;
}

@Component({
    selector: 'movius-web-message-form',
    templateUrl: './message-form.component.html',
    styleUrls: ['./message-form.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    providers: [MessageContactSelectorComponent]

})
export class MessageFormComponent implements OnInit, OnChanges {
    isGroupMessageEnabled: any;
    isPictureMessageEnabled: any;
    maxMmsSize: any;
    isGroup: boolean;
    apiUserIdentity: string;
    myTextarea: any;
    isAnonymous: boolean;
    getConnectionErrorValue: any;
    public fileData: File | null = null;

    everythingLoaded: string = 'false';
    //public imagePath;
    imgURL: any;
    file: [null]
    composeMessageType: any;
    hashRecored: any;
    urlId: any;
    isWhatsAppGroupEnabled: any;
    infoMessage: any;
    showInfoMsg: boolean;


    onlineStatus$: Observable<boolean>;
    @Input() set selectedContactMultiline(newValue: string) {
        if (typeof (newValue) === "undefined") {
            this.isGroup = false;
            this.isGroupMessageEnabledClass = '';
            this.isAnonymous = false;
            this._selectedContactMultiline = newValue;
        }
        if (this.doStoreMsgSeparatelyForMultilines) {
            const oldValue = this.messageForm.value.message;
            this._messageToMultiline[this._selectedContactMultiline] = oldValue;

            const msgForNewMultiline = this._messageToMultiline[newValue];
            this.messageForm.patchValue({ message: msgForNewMultiline ?? '' });
        }
        this._selectedContactMultiline = newValue;
    }

    get selectedContactMultiline(): string {
        return this._selectedContactMultiline;
    }

    @Input() set showWhatsTemplate(newValue: boolean) {
        if (newValue !== undefined) {
            this._showWhatsTemplate = newValue;
        }
    }
    get showWhatsTemplate(): boolean {
        return this._showWhatsTemplate;
    }


    @Input() set isValNum(newValue: boolean) {
        if (newValue !== undefined) {
            this._isValNum = newValue;
        }
    }
    get isValNum(): boolean {
        return this._isValNum;
    }

    @ViewChild('fileInput') el: ElementRef;
    @Input() sendButtonError: string;
    @Input() messagingStatus: MessagingStatus;
    @Input() picMsgCancelledStatus: any;
    @Input() doStoreMsgSeparatelyForMultilines: boolean = true;

    @Output() messageSent = new EventEmitter<string>();
    @Output() mediaSent = new EventEmitter<any>();

    @HostListener('click')
    clickInside() {
        this.wasInside = true;
    }

    @HostListener('document:click')
    clickOutside() {
        if (!this.wasInside) {
            if (this.isEmojiActive) {
                this.isEmojiActive = false;
            }
        }
        this.wasInside = false;
    }

    isEmojiActive: boolean = false;
    isTemplateVisible: boolean = false;
    isPictureMessageActive: boolean = false;
    touchedTemplate: boolean = false;
    messageForm: FormGroup;
    defHeightNoScroll = 200;
    minscrollHeight = 50;
    isOverflowed = false;
    private wasInside = false;
    private _selectedContactMultiline: string;
    private _showWhatsTemplate: boolean = false;
    private _isValNum: boolean = true;
    private _messageToMultiline: MessageToMultiline[] = [];
    private _emergencyNumbers: string[] = [
        "119", "129", "17", "911", "112", "113", "102", "000", "999", "211",
        "117", "110", "122", "190", "993", "132", "133", "123", "111", "106",
        "11", "101", "991", "1730", "22", "191", "114", "199", "100", "130",
        "103", "193", "997", "18", "66", "902", "1011", "118", "0000", "15",
        "105", "995", "10111", "115", "197", "155", "903", "901", "192", "194", "108"
    ];
    private allowedCharcs: string[] = [
        '-', '+', '(', ')', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9', ','
    ];
    private _forbiddenEmoji = {
        //https://unicode.org/emoji/charts/emoji-versions.html
        //:relaxed: emoji
        '263A-FE0F': true,
        /////////////
        '1F970': true,
        '1F975': true,
        '1F976': true,
        '1F974': true,
        '1F973': true,
        '1F97A': true,
        '1F9B5': true,
        '1F9B6': true,
        '1F9B7': true,
        '1F9B4': true,
        '1F468-200D-1F9B0': true,
        '1F468-200D-1F9B1': true,
        '1F468-200D-1F9B3': true,
        '1F468-200D-1F9B2': true,
        '1F469-200D-1F9B0': true,
        '1F469-200D-1F9B1': true,
        '1F469-200D-1F9B3': true,
        '1F469-200D-1F9B2': true,
        '1F9B8': true,
        '1F9B8-200D-2642-FE0F': true,
        '1F9B8-200D-2640-FE0F': true,
        '1F9B9': true,
        '1F9B9-200D-2642-FE0F': true,
        '1F9B9-200D-2640-FE0F': true,
        '1F9B0': true,
        '1F9B1': true,
        '1F9B3': true,
        '1F9B2': true,
        '1F99D': true,
        '1F999': true,
        '1F99B': true,
        '1F998': true,
        '1F9A1': true,
        '1F9A2': true,
        '1F99A': true,
        '1F99C': true,
        '1F99F': true,
        '1F9A0': true,
        '1F96D': true,
        '1F96C': true,
        '1F96F': true,
        '1F9C2': true,
        '1F96E': true,
        '1F99E': true,
        '1F9C1': true,
        '1F9ED': true,
        '1F9F1': true,
        '1F6F9': true,
        '1F9F3': true,
        '1F9E8': true,
        '1F9E7': true,
        '1F94E': true,
        '1F94F': true,
        '1F94D': true,
        '1F9FF': true,
        '1F9E9': true,
        '1F9F8': true,
        '265F-FE0F': true,
        '1F9F5': true,
        '1F9F6': true,
        '1F97D': true,
        '1F97C': true,
        '1F97E': true,
        '1F97F': true,
        '1F9EE': true,
        '1F9FE': true,
        '1F9F0': true,
        '1F9F2': true,
        '1F9EA': true,
        '1F9EB': true,
        '1F9EC': true,
        '1F9F4': true,
        '1F9F7': true,
        '1F9F9': true,
        '1F9FA': true,
        '1F9FB': true,
        '1F9FC': true,
        '1F9FD': true,
        '1F9EF': true,
        '267E-FE0F': true,
        '1F3F4-200D-2620-FE0F': true,
        '1F929': true,
        '1F92A': true,
        '1F92D': true,
        '1F92B': true,
        '1F928': true,
        '1F92E': true,
        '1F92F': true,
        '1F9D0': true,
        '1F92C': true,
        '1F9E1': true,
        '1F91F': true,
        '1F932': true,
        '1F9E0': true,
        '1F9D2': true,
        '1F9D1': true,
        '1F9D4': true,
        '1F9D3': true,
        '1F9D5': true,
        '1F931': true,
        '1F9D9': true,
        '1F9D9-200D-2642-FE0F': true,
        '1F9D9-200D-2640-FE0F': true,
        '1F9DA': true,
        '1F9DA-200D-2642-FE0F': true,
        '1F9DA-200D-2640-FE0F': true,
        '1F9DB': true,
        '1F9DB-200D-2642-FE0F': true,
        '1F9DB-200D-2640-FE0F': true,
        '1F9DC': true,
        '1F9DC-200D-2642-FE0F': true,
        '1F9DC-200D-2640-FE0F': true,
        '1F9DD': true,
        '1F9DD-200D-2642-FE0F': true,
        '1F9DD-200D-2640-FE0F': true,
        '1F9DE': true,
        '1F9DE-200D-2642-FE0F': true,
        '1F9DE-200D-2640-FE0F': true,
        '1F9DF': true,
        '1F9DF-200D-2642-FE0F': true,
        '1F9DF-200D-2640-FE0F': true,
        '1F9D6': true,
        '1F9D6-200D-2642-FE0F': true,
        '1F9D6-200D-2640-FE0F': true,
        '1F9D7': true,
        '1F9D7-200D-2642-FE0F': true,
        '1F9D7-200D-2640-FE0F': true,
        '1F9D8': true,
        '1F9D8-200D-2642-FE0F': true,
        '1F9D8-200D-2640-FE0F': true,
        '1F993': true,
        '1F992': true,
        '1F994': true,
        '1F995': true,
        '1F996': true,
        '1F997': true,
        '1F965': true,
        '1F966': true,
        '1F968': true,
        '1F969': true,
        '1F96A': true,
        '1F963': true,
        '1F96B': true,
        '1F95F': true,
        '1F960': true,
        '1F961': true,
        '1F967': true,
        '1F964': true,
        '1F962': true,
        '1F6F8': true,
        '1F6F7': true,
        '1F94C': true,
        '1F9E3': true,
        '1F9E4': true,
        '1F9E5': true,
        '1F9E6': true,
        '1F9E2': true,
        '1F3F4-E0067-E0062-E0065-E006E-E0067-E007F': true,
        '1F3F4-E0067-E0062-E0073-E0063-E0074-E007F': true,
        '1F3F4-E0067-E0062-E0077-E006C-E0073-E007F': true,
        '1F971': true,
        '1F90E': true,
        '1F90D': true,
        '1F90F': true,
        '1F9BE': true,
        '1F9BF': true,
        '1F9BB': true,
        '1F9D1-200D-1F9B0': true,
        '1F9D1-200D-1F9B1': true,
        '1F9D1-200D-1F9B3': true,
        '1F9D1-200D-1F9B2': true,
        '1F9CF': true,
        '1F9CF-200D-2642-FE0F': true,
        '1F9CF-200D-2640-FE0F': true,
        '1F9D1-200D-2695-FE0F': true,
        '1F9D1-200D-1F393': true,
        '1F9D1-200D-1F3EB': true,
        '1F9D1-200D-2696-FE0F': true,
        '1F9D1-200D-1F33E': true,
        '1F9D1-200D-1F373': true,
        '1F9D1-200D-1F527': true,
        '1F9D1-200D-1F3ED': true,
        '1F9D1-200D-1F4BC': true,
        '1F9D1-200D-1F52C': true,
        '1F9D1-200D-1F4BB': true,
        '1F9D1-200D-1F3A4': true,
        '1F9D1-200D-1F3A8': true,
        '1F9D1-200D-2708-FE0F': true,
        '1F9D1-200D-1F680': true,
        '1F9D1-200D-1F692': true,
        '1F9CD': true,
        '1F9CD-200D-2642-FE0F': true,
        '1F9CD-200D-2640-FE0F': true,
        '1F9CE': true,
        '1F9CE-200D-2642-FE0F': true,
        '1F9CE-200D-2640-FE0F': true,
        '1F9D1-200D-1F9AF': true,
        '1F468-200D-1F9AF': true,
        '1F469-200D-1F9AF': true,
        '1F9D1-200D-1F9BC': true,
        '1F468-200D-1F9BC': true,
        '1F469-200D-1F9BC': true,
        '1F9D1-200D-1F9BD': true,
        '1F468-200D-1F9BD': true,
        '1F469-200D-1F9BD': true,
        '1F9D1-200D-1F91D-200D-1F9D1': true,
        '1F9A7': true,
        '1F9AE': true,
        '1F415-200D-1F9BA': true,
        '1F9A5': true,
        '1F9A6': true,
        '1F9A8': true,
        '1F9A9': true,
        '1F9C4': true,
        '1F9C5': true,
        '1F9C7': true,
        '1F9C6': true,
        '1F9C8': true,
        '1F9AA': true,
        '1F9C3': true,
        '1F9C9': true,
        '1F9CA': true,
        '1F6D5': true,
        '1F9BD': true,
        '1F9BC': true,
        '1F6FA': true,
        '1FA82': true,
        '1FA90': true,
        '1F93F': true,
        '1FA80': true,
        '1FA81': true,
        '1F9BA': true,
        '1F97B': true,
        '1FA71': true,
        '1FA72': true,
        '1FA73': true,
        '1FA70': true,
        '1FA95': true,
        '1FA94': true,
        '1FA93': true,
        '1F9AF': true,
        '1FA78': true,
        '1FA79': true,
        '1FA7A': true,
        '1FA91': true,
        '1FA92': true,
        '1F7E0': true,
        '1F7E1': true,
        '1F7E2': true,
        '1F7E3': true,
        '1F7E4': true,
        '1F7E5': true,
        '1F7E7': true,
        '1F7E8': true,
        '1F7E9': true,
        '1F7E6': true,
        '1F7EA': true,
        '1F7EB': true,
        '1F972': true,
        '1F636-200D-1F32B-FE0F': true,
        '1F62E-200D-1F4A8': true,
        '1F635-200D-1F4AB': true,
        '1F978': true,
        '2764-FE0F-200D-1F525': true,
        '2764-FE0F-200D-1FA79': true,
        '1F90C': true,
        '1FAC0': true,
        '1FAC1': true,
        '1F9D4-200D-2642-FE0F': true,
        '1F9D4-200D-2640-FE0F': true,
        '1F977': true,
        '1F935-200D-2642-FE0F': true,
        '1F935-200D-2640-FE0F': true,
        '1F470-200D-2642-FE0F': true,
        '1F470-200D-2640-FE0F': true,
        '1F469-200D-1F37C': true,
        '1F468-200D-1F37C': true,
        '1F9D1-200D-1F37C': true,
        '1F9D1-200D-1F384': true,
        '1FAC2': true,
        '1F408-200D-2B1B': true,
        '1F9AC': true,
        '1F9A3': true,
        '1F9AB': true,
        '1F43B-200D-2744-FE0F': true,
        '1F9A4': true,
        '1FAB6': true,
        '1F9AD': true,
        '1FAB2': true,
        '1FAB3': true,
        '1FAB0': true,
        '1FAB1': true,
        '1FAB4': true,
        '1FAD0': true,
        '1FAD2': true,
        '1FAD1': true,
        '1FAD3': true,
        '1FAD4': true,
        '1FAD5': true,
        '1FAD6': true,
        '1F9CB': true,
        '1FAA8': true,
        '1FAB5': true,
        '1F6D6': true,
        '1F6FB': true,
        '1F6FC': true,
        '1FA84': true,
        '1FA85': true,
        '1FA86': true,
        '1FAA1': true,
        '1FAA2': true,
        '1FA74': true,
        '1FA96': true,
        '1FA97': true,
        '1FA98': true,
        '1FA99': true,
        '1FA83': true,
        '1FA9A': true,
        '1FA9B': true,
        '1FA9D': true,
        '1FA9C': true,
        '1F6D7': true,
        '1FA9E': true,
        '1FA9F': true,
        '1FAA0': true,
        '1FAA4': true,
        '1FAA3': true,
        '1FAA5': true,
        '1FAA6': true,
        '1FAA7': true,
        '26A7-FE0F': true,
        '1F3F3-FE0F-200D-26A7-FE0F': true,
    };
    public href: string = "";
    public isGroupMessageEnabledClass: string;
    @ViewChild('msgTextArea') msgTextArea: ElementRef<HTMLInputElement>;
    @ViewChild('writeFieldWrapper') writeFieldWrapper: ElementRef;
    modalRef: NzModalRef;
    @Output() displayImageSelected = new EventEmitter();
    @Output() blobImageURL = new EventEmitter<any>();
    optInRequestStatus = null;
    peerData = null;
    whatsAppEnabledByOrg = sessionStorage.getItem('__enable_whatsapp_message__');
    ntwkStatus: boolean = true;
    isMobileDevice = false;
    enablePictureMessage: boolean;
    teamsLocationEnabled: boolean;
    constructor(
        private readonly formBuilder: FormBuilder,
        private readonly sipUserService: SipUserService,
        private router: Router,
        private readonly dbContext: DbContext,
        private readonly authService: AuthService,
        private readonly modalService: CustomNzModalService,
        private cd: ChangeDetectorRef,
        public modal: NzModalService,
        private readonly store: Store,
        private activatedRoute: ActivatedRoute,
        private mmsService : MMSService,
        private messagingService: MessagingService,
        private messageContactSelector: MessageContactSelectorComponent

    ) {

        this.store.select(selectHash).subscribe((res => {
            this.hashRecored = res;
        }))

        this.authService.onComposeMessageTypeSelected.subscribe(type => {
            this.composeMessageType = type;
        })

        const id$ = this.activatedRoute.params.pipe(
            map(({ id }) => id)
        );
        id$.pipe(
            switchMap((id: string) =>
                this.store.select(selectWhatsAppOptInStatus(id))
            )
        ).subscribe(wtspSts => {
            this.peerData = wtspSts;
            //console.log('MessageForm::optinRequestStatus', this.peerData);
            this.optInRequestStatus = this.peerData.whatsOptInReqStatus;

            if (this.peerData?.messageChannelType == 'whatsapp') {
                this.enablePictureMessage = JSON.parse(sessionStorage.getItem(
                    '__enable_whatsapp_picture_message__')) ? JSON.parse(sessionStorage.getItem(
                        '__enable_whatsapp_picture_message__')) : false;
            } else if (this.peerData?.messageChannelType == 'normalMsg') {
                this.enablePictureMessage = JSON.parse(sessionStorage.getItem(
                    '__enable_picture_message__')) ? JSON.parse(sessionStorage.getItem(
                        '__enable_picture_message__')) : false;
            } else if (this.peerData?.messageChannelType == undefined) {
                this.enablePictureMessage = JSON.parse(sessionStorage.getItem(
                    '__enable_picture_message__')) ? JSON.parse(sessionStorage.getItem(
                        '__enable_picture_message__')) : false;
            }
        });
        this.apiUserIdentity = sessionStorage.getItem('__api_identity__');
        const model: FormModel<ChatInput> = {
            message: ['', [Validators.required, noWhitespaceValidator]],
        };

        router.events.forEach((event) => {
            if (event instanceof NavigationStart) {
                this.href = event.url;
                this.setParticipants();
                this.saveDraftedMsg('');
            }
        });

        this.messageForm = this.formBuilder.group(model);
        this.displayImageSelected.emit(false);
        this.messagingService.isTeamsLocationEnabled.subscribe((res: any) => {
            this.teamsLocationEnabled = res;
        });
    }

    ngOnInit(): void {
        this.isMobileDevice = ((sessionStorage.getItem('Contex_res')?.toLowerCase() === "ios") || (sessionStorage.getItem('Contex_res')?.toLowerCase() === "android"))
            ? true : false;
        this.isGroupMessageEnabled = JSON.parse(this.authService.checkGroupMsgEnable);
        this.isWhatsAppGroupEnabled = this.authService.isWhatsappGroupEnabled;
        this.isPictureMessageEnabled = JSON.parse(this.authService.checkPictureMsgEnable);
        this.maxMmsSize = 1024 * 1024 * JSON.parse(this.authService.checkMaxMmsSize);
        this.href = this.router.url;
        this.setParticipants();
        this.displayImageSelected.emit(false);
            this.onlineStatus$ = merge(
                of(navigator.onLine),
                fromEvent(window, 'online').pipe(mapTo(true)),
                fromEvent(window, 'offline').pipe(mapTo(false))
            );
            this.onlineStatus$.subscribe(data => {
                logger.debug('General:: Network Status:', data);
                this.ntwkStatus = data;
            })
    }

    ngOnChanges() {
        this.urlId = this.activatedRoute.params['_value']['id']
        this.authService.onComposeRedirectData.subscribe(data => {
            if (data === true) {
                this.myTextarea = "";
            }
        })

        this.isTemplateVisible = false;
        if(this.msgTextArea && this.msgTextArea.nativeElement)
            this.autoGrow(this.msgTextArea.nativeElement)

    }

    getLocationStatusForE911() {
        if (this.selectedContactMultiline === '911' && sessionStorage.getItem("_USER_E911_STATUS_") == 'enabled_accepted' &&
            this.messagingService.locationDetails == undefined) {
            this.messageContactSelector.getUserLocation();
        }
    }

    enableEmojis() {
        this.getLocationStatusForE911();
        if (this.peerData && this.peerData.messageChannelType == 'whatsapp') {
            if (["2", "4", "5"].indexOf(this.peerData.whatsOptInReqStatus.toString()) >= 0 || this.whatsAppEnabledByOrg === "false" || this.showWhatsTemplate) {
                return;
            }
        }
        this.isEmojiActive = !this.isEmojiActive
    }

    disabledInputBox() {
        if(this.getConnectionErrorValue == true || this.messageError == 'destination-emergency-error'){
            return true;
        }else if (this.peerData?.messageChannelType == 'normalMsg' && !this.peerData?.isGroup && chkOnlyAlphabets(this.peerData?.participants ? this.peerData?.participants[0] : this.peerData?.participants)) {
            this.showInfoMsg = false;
            return true;
        }else if (this.whatsAppEnabledByOrg == 'false' && (this.peerData.messageChannelType == 'Line' || this.peerData.messageChannelType == 'WeChat')) {
            this.showInfoMsg = true;
            this.infoMessage = `${this.peerData.messageChannelType} message is disabled. Please contact your administrator`;
            return true;
        }else if (!this.isGroupMessageEnabled && this.peerData.isGroup && this.peerData.messageChannelType == 'normalMsg') {
            this.showInfoMsg = true;
            this.infoMessage = `Group message is disabled. Please contact your administrator`;
            return true;
        } else if (this.peerData.messageChannelType == 'whatsapp' && this.whatsAppEnabledByOrg == 'false' && !this.peerData.isGroup) {
            this.showInfoMsg = true;
            this.infoMessage = `Whatsapp message is disabled. Please contact your administrator`;
            return true;
        } else if (this.peerData.messageChannelType == 'whatsapp' && this.whatsAppEnabledByOrg == 'false' && this.peerData.isGroup) {
            this.showInfoMsg = true;
            this.infoMessage = `Whatsapp message is disabled. Please contact your administrator`;
            return true;
        }else if (this.peerData.messageChannelType == 'whatsapp' && this.whatsAppEnabledByOrg == 'true' && !this.isWhatsAppGroupEnabled && this.peerData.isGroup) {
            this.showInfoMsg = true;
            this.infoMessage = `Whatsapp Group message is disabled. Please contact your administrator`;
            return true;
        } else if (this.peerData.messageChannelType == 'whatsapp' && this.whatsAppEnabledByOrg == 'false' && !this.isWhatsAppGroupEnabled && this.peerData.isGroup) {
            this.showInfoMsg = true;
            this.infoMessage = `Whatsapp message is disabled. Please contact your administrator`;
            return true;
        } else if (this.peerData && this.peerData.messageChannelType == 'whatsapp') {
            if (this.whatsAppEnabledByOrg === "false" || (["2", "4", "5"].indexOf(this.peerData.whatsOptInReqStatus?.toString()) >= 0) || this.showWhatsTemplate) {
                this.showInfoMsg = false;
                return true;
            } else {
                this.showInfoMsg = false;
                return false;
            }
        }else if(this.peerData && this.peerData.messageChannelType != 'normalMsg' && this.peerData.whatsOptInReqStatus == '5') {    //if(this.peerData && this.peerData.isGroup && isUserLeftGroup(this.peerData.participants))
            this.showInfoMsg = false;
            return true;
        }
         else {
            if (this.composeMessageType == 'whatsapp' && this.href == "/messaging/chat/new") {
                this.showInfoMsg = false;
                return true;
            } else {
                this.showInfoMsg = false;
                return false;
            }
        }
    }

    onFocusTextArea(selectedContactMultiline,input) {
        if(selectedContactMultiline === '911' && sessionStorage.getItem("_USER_E911_STATUS_") == 'enabled_accepted' &&
                this.messagingService.locationDetails == undefined) {
            this.messageContactSelector.getUserLocation();
        }
        this.writeFieldWrapper.nativeElement.style.border = 'solid 0.0625rem #1f1e33';
        //this.writeFieldWrapper.nativeElement.style.background = '#ffffff';
        // this.autoGrow(input?.target)
    }

    onBlurTextArea(input) {
        this.writeFieldWrapper.nativeElement.style.border = 'none';
        //this.writeFieldWrapper.nativeElement.style.background = '#ffffff';
        // this.autoGrow(input)
    }

    disablePictureMsg() {
        if (this.peerData && this.peerData.messageChannelType == 'whatsapp') {
            return true;
        } else {
            if (this.composeMessageType == 'whatsapp' && this.href == "/messaging/chat/new") {
                return true;
            } else {
                return false;
            }
        }
    }

    ngAfterViewInit(): void {
        if (sessionStorage.getItem('draft-' + this.selectedContactMultiline) !== null && this.href === '/messaging/chat/' + this.selectedContactMultiline || this.href === this.href) {
            if(sessionStorage.getItem('draft-' + this.selectedContactMultiline) != 'null'){
                this.msgTextArea.nativeElement.value = sessionStorage.getItem('draft-' + this.selectedContactMultiline)
                this.messageForm.value.message = this.msgTextArea.nativeElement.value
                this.msgTextArea.nativeElement.focus();
            }
        }
        this.everythingLoaded = 'true';
        if (this.picMsgCancelledStatus == false) {
            if (this.isMobileDevice === false) {
                this.el.nativeElement.click();
            }
        }
    }

    toggleTemplate() {
        if (this.whatsAppEnabledByOrg === "true") {
            this.isTemplateVisible = !this.isTemplateVisible;
        }
    }

    handleTemplateSelection(template, input) {
        this.touchedTemplate = true;
        this.messageForm.patchValue({
            message: template.value
        });
        this.toggleTemplate();
        this.autoGrow(input);
    }

    onSendMessage() {
        this.isEmojiActive = false;
        this.isPictureMessageActive = false;
        this.touchedTemplate = false;
        this.messageSent.emit(this.messageForm.value.message);
        if (this.isTemplateVisible) {
            this.toggleTemplate();
        }
    }

    setParticipants() {
        if (this.href !== "/messaging/chat/new") {
            const length = this.href.split("/").length;
            const multiLine = this.href.split("/")[length - 1];
            this.isGroupCheck(multiLine);
        }
    }

    isGroupCheck(peer: any) {
        this.isGroup = false;
        this.isGroupMessageEnabledClass = "";
        this.isAnonymous = false;
        if (peer === 'unknown') {
            this.isAnonymous = true
        }
        let participants = null

        if (sessionStorage.getItem(peer) !== null && sessionStorage.getItem(peer) !== "" && peer !== "participants") {
            participants = sessionStorage.getItem(peer);
        } else if (sessionStorage.getItem("peerId-" + peer) !== null && sessionStorage.getItem("peerId-" + peer) !== "" && peer !== "participants") {
            participants = sessionStorage.getItem(peer);
        }

        if (participants !== null && participants !== "" && !this.isGroupMessageEnabled) {
            this.isGroup = true;
            sessionStorage.setItem('participants', participants);
            this.isGroupMessageEnabledClass = "isGroupMessageEnabledClass"
        } else {
            this.getParticipants(peer);
        }
    }

    async getParticipants(multiLine: string) {
        sessionStorage.setItem('CurrentThread', multiLine)
        const participants = await this.dbContext.message.getParticipants(multiLine);
        if (participants !== "" && participants.split("|").length > 2) {
            sessionStorage.setItem('participants', participants);
            sessionStorage.setItem(multiLine, JSON.stringify(participants));
        } else if (participants === "" && this.peerData.participants != undefined) {
            if (Array.isArray(this.peerData.participants)) {
                sessionStorage.setItem('participants', this.peerData.participants.join("|"));
                sessionStorage.setItem(multiLine, JSON.stringify(multiLine));
            } else {
                sessionStorage.setItem('participants', this.peerData.participants);
                sessionStorage.setItem(multiLine, JSON.stringify(multiLine));
            }
        } else {
            sessionStorage.setItem('participants', null);
            sessionStorage.setItem(multiLine, JSON.stringify(multiLine));
        }
        //Whatsapp as firstthread and Reload Issue fix
        if(sessionStorage.getItem(multiLine)?.replace('"', '')?.replace('"', '') == multiLine && participants.includes('whatsapp:')){
            logger.debug('Whatsapp as firstthread and Reload Issue fix::', participants);
            sessionStorage.setItem('participants', participants);
            sessionStorage.setItem(multiLine, JSON.stringify(participants));
        }
    }

    saveDraftedMsg(saveContent) {
        const msgChatURL = '/messaging/chat/' + this.selectedContactMultiline
        let msgChatURLWA = '';
        if(msgChatURL.includes('whatsapp')){
            msgChatURLWA = this.href.replace('/messaging/chat/', '')
        }
        if (this.href !== msgChatURL + '/details' && this.href !== msgChatURL + '/participants' && this.href !== msgChatURL && this.href.replace('/messaging/chat/', '') !== msgChatURLWA) {
            sessionStorage.removeItem('draft-' + this.selectedContactMultiline)
        } else {
            if (this.href === msgChatURL + '/details' || this.href == msgChatURL + '/participants' || this.href === msgChatURL || this.href.replace('/messaging/chat/', '') === msgChatURLWA) {
                if(this.msgTextArea){
                    sessionStorage.setItem('draft-' + this.selectedContactMultiline, this.msgTextArea?.nativeElement?.value)
                    sessionStorage.setItem('draft-' + msgChatURLWA, this.msgTextArea?.nativeElement?.value)
                }else {
                    sessionStorage.setItem('draft-' + this.selectedContactMultiline, sessionStorage.getItem('draft-' + msgChatURLWA))
                    sessionStorage.setItem('draft-' + msgChatURLWA, sessionStorage.getItem('draft-' + msgChatURLWA))
                }
            }
        }
        if(this.msgTextArea){
            this.autoGrow(this.msgTextArea?.nativeElement);
        }
    }

    GetTheme(){
        let theme = localStorage.getItem("Theme")
        return theme ? "Dark" : null
    }

    handleSendButton($event, input) {
        if (this.imgURL != "" && this.imgURL != undefined) {
            console.log('image url', this.imgURL);
            this.imgURL = '';
            this.isGroupMessageEnabledClass = "";
            this.mediaSent.emit(this.fileData);
        } else {
            //CB: 1Dec2020: Cmd+enter, ctrl+enter. Delete in case don't need.
            //(keydown.meta.enter)="handleSendButton($event)"
            //(keydown.control.enter)="handleSendButton($event)"
            if (
                !!this.messageError ||
                !this.messageForm.value.message ||
                !/\S/.test(this.messageForm.value.message)
            ) {
                $event.preventDefault();
                return;
            }
            this.onSendMessage();
            $event.preventDefault();
            this.messageForm.patchValue({ message: '' });
            this.autoGrow(input);
        }
    }

    addEmoji($event) {
        let messageValue;
        if (this.messageForm.value.message) {
            messageValue = this.messageForm.value.message
        } else {
            messageValue = '';
        }
        this.messageForm.patchValue({
            message: messageValue + $event.emoji.native,
        });
    }

    loadEmoji = (set, sheetSize) => {
        return 'assets/icons/emoji/emoji64.png';
    };

    autoGrow(input) {
        const defHeightNoScroll = this.defHeightNoScroll;
        // const scrollHeight = this.elementRef.nativeElement.querySelector('textarea').scrollHeight;

        // Adjust the textarea height until the maximum height is reached
        if(!input.style){
            this.msgTextArea.nativeElement.style.height= 38 + 'px';;
            return
        }
        input.style.height = 'auto';
        input.rows = 1;
        // input.style.height = input.scrollHeight > this.defHeightNoScroll ? this.defHeightNoScroll + 'px' : input.scrollHeight + 'px';
        if(input.scrollHeight > this.defHeightNoScroll){
            input.style.height = this.defHeightNoScroll + 'px';
            this.isOverflowed = true
            return
        }if(input.scrollHeight < this.minscrollHeight){
            input.style.height = 38 + 'px';
            return
        }else if(input.scrollHeight == this.minscrollHeight){
            input.rows = 1
            if(input.clientHeight != input.scrollHeight){
                input.rows = "auto"
            }
        }
        else{
            input.style.height = input.scrollHeight + 'px';
        }
        // if (localStorage.getItem('device') && localStorage.getItem('device') == 'mobile') {
        //     this.isOverflowed = true;
        // } else {
            // input.style.height = 'auto';
            // input.style.height = input.scrollHeight + 'px';
            // if (input.scrollHeight > input.clientHeight) {
            //     if (Math.abs(input.scrollHeight - input.clientHeight) > 16) {
            //         this.isOverflowed = true;
            //         return;
            //     }
            // }
            // if (
            //     input.scrollHeight === input.clientHeight &&
            //     input.clientHeight > defHeightNoScroll
            // ) {
            //     this.isOverflowed = false;
            //     return;
            // }
        // }

        // input.style.height = 'auto';
        // input.style.height = input.scrollHeight + 'px';

        this.touchedTemplate = false;
    }

    async preventMaxChar(input) {
        let value = input.value
        if (value.length >= MESSAGE_MAX_BYTES_COUNT) {
            input.value = value.substring(0, MESSAGE_MAX_BYTES_COUNT)
            this.messageForm.value.message = input.value
        }
    }

    get messageError() {
        //CB:16May2021: TECH-DEBT: Divergant changes - similar logic is detected in new-call-workspace.component.ts
        //CB:16May2021: TECH-DEBT: Divergant changes - refactor.
        let peerId;
        //this.getLocationStatusForE911();
        //peerId = this.hashRecored[this.selectedContactMultiline]?.participants?.includes('|')  ?
        //   this.hashRecored[this.selectedContactMultiline]?.participants?.join('') :
        //   peerId =    this.hashRecored[this.selectedContactMultiline]?.participants;
        //const peerId = this.hashRecored[this.selectedContactMultiline]?.participants;
        //if(peerId?.length == 1 && peerId[0]?.includes('whatsapp')){
        //    this.selectedContactMultiline = peerId[0]?.replace('whatsapp:', '');
        //}
        //if(!this.selectedContactMultiline?.includes('whatsapp') && !peerId?.includes('whatsapp')){
        if (this.selectedContactMultiline?.length == 36 && this.hashRecored) {
            if (this.hashRecored[this.selectedContactMultiline]?.threadId) {
                if (this.selectedContactMultiline?.length == 36) {
                    this.selectedContactMultiline = this.hashRecored[this.selectedContactMultiline]?.participants?.join('')
                }
            }
        }
        this.selectedContactMultiline = Array.isArray(this.selectedContactMultiline) ? this.selectedContactMultiline[0]?.multiline : this.selectedContactMultiline
        if (allowedSpecialCharacters(this.selectedContactMultiline, this.allowedCharcs)) {     // Check weather it is threadId or PeerId
            //this.selectedContactMultiline = this.peerData.messageChannelType != 'normalMsg' ? this.peerData?.participants?.join('') : this.selectedContactMultiline;
        }
        const destination = this.selectedContactMultiline;
        const isValnum = this._isValNum;
        if (this.messagingStatus === 'messages-not-allowed') {
            return 'messages-not-allowed';
        } else if (!destination || destination.length == 0) {
            return 'empty-destination';
        } else if ([',', ';', '#'].some((char) => destination.includes(char))) {
            return 'conference-destination';
        } else if (this.sipUserService.user.multiLine === getPeerNumberWOSpecialChars(destination)) {
            return 'self-destination';
        } else if (allowedSpecialCharacters(destination, this.allowedCharcs)) {
            return 'specialCharacterValidation';
        }else if (destination.startsWith('101') || destination.startsWith('100')) {
            return 'specialCharacterValidation';
        } else if (destination === null) {
            return 'invalid-data';
        } else if (/\D/.test(destination) && !destination.includes('whatsapp')) {
            const clear = cleanPhoneNumber(destination);
            return /\D/.test(clear) ? 'invalid-number' : null;
        } else if (this._emergencyNumbers.indexOf(destination) !== -1 &&
                   (sessionStorage.getItem('_USER_E911_STATUS_').includes('disabled') ||
                   sessionStorage.getItem('location_permission') == 'denied' ||
                   this.teamsLocationEnabled === false ||
                   this.composeMessageType == 'whatsapp')) {
            return 'destination-emergency-error'
        } else if (this.messageForm.invalid && (this.messageForm.value.message === undefined || this.messageForm.value.message === "")) {
            return 'empty-message';
        } else if (isValnum == false) {
            return 'empty-message';
        }

        //}else if (this.messageForm.invalid && (this.messageForm.value.message === undefined || this.messageForm.value.message === "")) {
        //    return 'empty-message';
        //
        return null;
    }

    filterEmoji = (emojiCode: string) => {
        const isInForbidden = this._forbiddenEmoji[emojiCode];
        return !isInForbidden;
    }

    public calculateImgSize(img) {
        // values of expected image max size
        let maxWidth = 1280.0;
        let maxHeight = 1280.0;
        let maxRatio = maxWidth / maxHeight

        // values of actual image size
        let actualWidth = img.width;
        let actualHeight = img.height;
        let imgRatio = actualWidth / actualHeight;

        if (actualHeight > maxHeight || actualWidth > maxWidth) {
            if (imgRatio < maxRatio) {
                //adjust width according to maxHeight
                imgRatio = maxHeight / actualHeight
                actualWidth = imgRatio * actualWidth
                actualHeight = maxHeight
            }
            else if (imgRatio > maxRatio) {
                //adjust height according to maxWidth
                imgRatio = maxWidth / actualWidth
                actualHeight = imgRatio * actualHeight
                actualWidth = maxWidth
            } else {
                actualHeight = maxHeight
                actualWidth = maxWidth
            }
        }
        return [actualWidth, actualHeight];
    }

    sendMMS(event) {
        this.isEmojiActive = false;
        this.mediaSent.emit(this.fileData);
        this.displayImageSelected.emit(false);
    }

    async compressImage(file, compressionType: 0 | 1 | 2) {
        /**
         * NOTE:
         * argument => compressionType:1|2
         * usage =>
         * value 1: the image has to be compressed to lower quality image of image/jpeg format
         * value 2: the image has to be compressed to same quality image of image/jpeg format
         */
        try {
            const orgFile = file;
            const blobURL = URL.createObjectURL(orgFile);
            const img = new Image();
            img.src = blobURL;
            await img.decode();
            const [newWidth, newHeight] = this.calculateImgSize(img);
            const canvas = document.createElement("canvas");
            canvas.width = newWidth;
            canvas.height = newHeight;
            const ctx = canvas.getContext("2d");
            ctx.drawImage(img, 0, 0, newWidth, newHeight);
            let blob: any;
            if (compressionType === 0) {
                blob = await new Promise(resolve => canvas.toBlob(resolve, "image/jpeg", 1));
            } else if (compressionType === 1) {
                blob = await new Promise(resolve => canvas.toBlob(resolve, "image/jpeg", 0.85));
            } else if (compressionType === 2) {
                logger.debug("file of type '", file.type, "' converted to file of type 'image/jpeg'")
                blob = await new Promise(resolve => canvas.toBlob(resolve, "image/jpeg", 1));
            }
            logger.debug("compression success");
            if (blob.size > this.maxMmsSize) {
                this.modalService.create({
                    nzContent: ConfirmDialogComponent,
                    nzComponentParams: {
                        titleTxt: 'Error',
                        subTitleTxt: 'Error performing compression and this image too large to send, max allowed size is ' + this.maxMmsSize / (1024 * 1024) + 'MB.',
                        applyBtnTxt: 'Ok',
                        onOkAction: () => {
                            document.getElementById('imageUpload').click();
                        },
                    },
                    nzBodyStyle: {
                        width: '26rem',
                    },
                    nzMaskClosable: false,
                    nzKeyboard: false,
                    nzWidth: '26rem',
                    nzFooter: null,
                });
            } else {
                return blob;
            }
        } catch (err) {
            // added as precautionary measure to show error when some issue happens with compression.
            this.modalService.create({
                nzContent: ConfirmDialogComponent,
                nzComponentParams: {
                    titleTxt: 'Error',
                    subTitleTxt: "Error while converting to image/jpeg. Please try sending another image",
                    applyBtnTxt: 'Ok',
                    onOkAction: () => {
                        document.getElementById('imageUpload').click();
                    },
                },
                nzBodyStyle: {
                    width: '26rem',
                },
                nzMaskClosable: false,
                nzKeyboard: false,
                nzWidth: '26rem',
                nzFooter: null,
            });

        }
    }

    async uploadFile(event) {
        let reader = new FileReader(); // HTML5 FileReader API
        let file = event.target.files[0];
        if (file.type.startsWith("image") && file.type === 'image/gif' && this.peerData.messageChannelType == 'whatsapp') {
            file = {}
            this.modalService.create({
                nzContent: ConfirmDialogComponent,
                nzComponentParams: {
                    titleTxt: 'Error',
                    subTitleTxt: 'The selected file type is not supported. Please select valid file type (.png, .jpg, .jpe, and .jpeg.) to proceed',
                    applyBtnTxt: 'Ok',
                    onOkAction: () => {
                        if (this.isMobileDevice === true) {
                            this.mmsService.isImageTypeGif.next(true);
                        } else {
                            this.mmsService.isImageTypeGif.next(true);
                        }
                    },
                },
                nzBodyStyle: {
                    width: '26rem',
                },
                nzMaskClosable: false,
                nzWidth: '26rem',
                nzKeyboard: false,
                nzFooter: null,
            }).afterClose.subscribe((data :any)=>{
                this.el.nativeElement.click();
            })
        }
        // checking max file size limit
        let fileSizeInMB = file.size;
        const fNameListWExt = file.name.split(".")
        let fileName = file.name.replace("." + fNameListWExt[fNameListWExt.length - 1], "");
        try {
            const blobURL = URL.createObjectURL(file);
            const img = new Image();
            img.src = blobURL;
            await img.decode();
        } catch (err) {
           if(err.message !== 'The source image cannot be decoded.'){
            this.modalService.create({
                nzContent: ConfirmDialogComponent,
                nzComponentParams: {
                    titleTxt: 'Error',
                    subTitleTxt: 'The selected file type is not supported. Please select valid file type (.png, .gif, .jpg, .jpe, and .jpeg.) to proceed',
                    applyBtnTxt: 'Ok',
                    onOkAction: () => {
                        document.getElementById('imageUpload').click();
                    },
                },
                nzBodyStyle: {
                    width: '26rem',
                },
                nzMaskClosable: false,
                nzWidth: '26rem',
                nzKeyboard: false,
                nzFooter: null,
            });
            return;
        }
        }

        if (fileSizeInMB <= this.maxMmsSize) {
            if (file.type.startsWith("image") && file.type != 'image/gif')
                file = await this.compressImage(file, 0);
        } else if (fileSizeInMB > this.maxMmsSize) {
            // do quality compression only when size if large and not of GIF format
            if (file.type.startsWith("image") && file.type != 'image/gif')
                file = await this.compressImage(file, 1);
        } else if (file.type.startsWith("image") && (file.type != 'image/gif' && file.type != 'image/jpeg')) {
            // do image conversion from present format to image.jpeg format
            file = await this.compressImage(file, 2);
        }
        if (file.type.startsWith("image")) {
            fileSizeInMB = file.size;
            if (fileSizeInMB > this.maxMmsSize) {
                this.modalService.create({
                    nzContent: ConfirmDialogComponent,
                    nzComponentParams: {
                        titleTxt: 'Error',
                        subTitleTxt: 'This image too large to send, max allowed size is ' + this.maxMmsSize / (1024 * 1024) + 'MB.',
                        applyBtnTxt: 'Ok',
                        onOkAction: () => {
                            document.getElementById('imageUpload').click();
                        },
                    },
                    nzBodyStyle: {
                        width: '26rem',
                    },
                    nzMaskClosable: false,
                    nzWidth: '26rem',
                    nzKeyboard: false,
                    nzFooter: null,
                });

                return;
            } else if (event.target.files && event.target.files[0]) {
                reader.readAsDataURL(file);

                // When file uploads set it to file formcontrol
                reader.onload = () => {
                    this.imgURL = reader.result;
                    file: reader.result
                }
                // ChangeDetectorRef since file is loading outside the zone
                this.isGroupMessageEnabledClass = "isGroupMessageEnabledClass";
            }
            if (!file.name) {
                file.name = fileName + "." + file.type.split("/")[1];
            }
            this.fileData = file;
            convertFileToBlob(this.fileData).then(data => {
                this.blobImageURL.emit({ blobUrl: data, file: this.fileData });
            })
        } else {
            this.modalService.create({
                nzContent: ConfirmDialogComponent,
                nzComponentParams: {
                    titleTxt: 'Error',
                    subTitleTxt: this.peerData?.messageChannelType == 'whatsapp' ? 'The selected file type is not supported. Please select valid file type (.png, .jpg, .jpe, and .jpeg.) to proceed' : 'The selected file type is not supported. Please select valid file type (.png, .gif, .jpg, .jpe, and .jpeg.) to proceed',
                    applyBtnTxt: 'Ok',
                    onOkAction: () => {
                        document.getElementById('imageUpload').click();
                    },
                },
                nzBodyStyle: {
                    width: '26rem',
                },
                nzMaskClosable: false,
                nzKeyboard: false,
                nzWidth: '26rem',
                nzFooter: null,
            });
        }
    }

    // Function to remove uploaded file
    removeUploadedFile() {
        let newFileList = Array.from(this.el.nativeElement.files);
        this.imgURL = '';
        file: [null]
        this.isGroupMessageEnabledClass = "";
        this.isPictureMessageActive = false;
    }

    getPicMsgStatus() {
        if (this.enablePictureMessage && this.getConnectionErrorValue == false && !this.peerData.isGroup) {
            return 'photoIco';
        } else if (this.enablePictureMessage && this.getConnectionErrorValue == false && this.peerData.isGroup) {
            return 'photoIco';
        } else if (this.enablePictureMessage && !this.isGroupMessageEnabled && this.getConnectionErrorValue == false && this.peerData.isGroup) {
            return 'photoIco-disabled';
        } else if (this.enablePictureMessage && this.getConnectionErrorValue == true) {
            return 'photoIco-disabled';
        }
        else {
            return 'photoIco-disabled';
        }
    }


    picImgTTipStatus() {
        if (this.enablePictureMessage && this.getConnectionErrorValue == false && !this.peerData.isGroup) {
            return null;
        } else if (this.enablePictureMessage && this.isGroupMessageEnabled && this.getConnectionErrorValue == false && this.peerData.isGroup) {
            return null;
        } else if (this.enablePictureMessage && !this.isGroupMessageEnabled && this.getConnectionErrorValue == false && this.peerData.isGroup) {
            return null;
        } else if (this.enablePictureMessage && this.getConnectionErrorValue == true) {
            return null;
        }
        else {
            if (this.everythingLoaded == 'true') {
                return 'hover';
            } else {
                return null;
            }
        }
    }

    public getConnectionError(event: any) {
        this.getConnectionErrorValue = event;
    }

    async onPaste(event, messageChannelType) {
        const items = (event.clipboardData || event.originalEvent.clipboardData).items;
        if (messageChannelType == 'Line' || messageChannelType == 'WeChat') {
            return items
        } else {
            const blob_url = await this.getUrlOnPaste(items)
            const file = base64toFile(blob_url, "copy_" + Date.now())
            const e = {
                target: { files: [file] }
            }
            this.uploadFile(e)
        }
    }

    getUrlOnPaste(items) {
        return new Promise((resolve, reject) => {
            for (let index in items) {
                const item = items[index];
                if (item.kind === 'file') {
                    const blob = item.getAsFile();
                    const reader = new FileReader();
                    reader.onload = function (event) {
                        resolve(event.target.result)
                    }; // data url!
                    reader.readAsDataURL(blob);
                }
            }
        })
    }

    includeArrayEmojisList() {
        if (localStorage.getItem('emoji-mart.frequently')) {
            const frequentlyUsedEmojisLength = Object.keys(JSON.parse(localStorage.getItem('emoji-mart.frequently'))).length
            if (frequentlyUsedEmojisLength) {
                if (frequentlyUsedEmojisLength > 1) {
                    return ['search', 'people', 'recent', 'nature', 'foods', 'activity', 'places', 'objects', 'symbols', 'flags'];
                } else {
                    return ['search', 'people', 'nature', 'foods', 'activity', 'places', 'objects', 'symbols', 'flags'];
                }
            }
        } else {
            return ['search', 'people', 'recent', 'nature', 'foods', 'activity', 'places', 'objects', 'symbols', 'flags'];
        }

    }

    getWidth() {
        return this.isMobileDevice ? "width-55" : " ";
    }

    getFormAnchorStyle() {
        return this.isMobileDevice ? this.disablePictureMsg() ? 'msgForm__operation-wopic' : 'msgForm__operation-wpic' : 'msgForm__operation'
    }
}
