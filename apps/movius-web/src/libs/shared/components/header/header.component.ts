import { Component, Input,Output, OnInit, ViewContainerRef, EventEmitter } from '@angular/core';
import { formatPhoneToInternational, getFeatureEnabled } from '../../utils/common-utils';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';
import { NzModalService } from 'ng-zorro-antd/modal';
import { E911SettingsWorkspaceComponent } from '../../../feature-settings/components/e911/e911-settings-workspace/e911-settings-workspace.component';
import { TermsPrivacySettingsComponent } from '../../../feature-settings/components/terms-privacy-settings/terms-privacy-settings.component';
import { CustomerHelpDetailsComponent } from '../customer-help-details/customer-help-details.component';
import { PasswordSettingsComponent } from '../../../feature-settings/components/password-settings/password-settings.component';
import { User } from '../../models/user';


@Component({
    selector: 'movius-web-header',
    templateUrl: './header.component.html',
    styleUrls: ['./header.component.scss'],
})
export class HeaderComponent implements OnInit {
    appEmbededStatus: string;
    isMobileDevice: boolean;
    userLoginDetails: string;
    imgCustomBrandingLogo: any;
    @Input() isCollapsed: boolean;
    @Input() showHeader: boolean;
    @Input() isLocationEnabled: string;
    @Input() is911Message:string;
    @Input() popOverContent: string;
    @Input() teamsLocationEnabled: boolean;
    @Input() composeMessageType: any;
    @Input() userInfo: User;
    @Input() view: any;
    @Input() MuteinboundCallAndMsgSound:boolean;
    @Output() MuteStatus = new EventEmitter<boolean>();
    @Output() onLogoutCLicked = new EventEmitter();


    rootUserInfo: any;
    rootFirstName: any;
    rootLastName: any;
    rootEmailId: any;


    constructor(private domSanitizer: DomSanitizer,
        private readonly modalService: NzModalService,
        private viewContainerRef: ViewContainerRef,


        ) {}

    formatNumber = formatPhoneToInternational;


    ngOnInit(): void {
        this.appEmbededStatus = getFeatureEnabled();
        this.isMobileDevice =
            sessionStorage.getItem('Contex_res')?.toLowerCase() === 'ios' ||
            sessionStorage.getItem('Contex_res')?.toLowerCase() === 'android'
                ? true
                : false;

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
        // this.isCollapsed = true;
        this.getUserDetails();
        this.appEmbededStatus = getFeatureEnabled();
    }

    toggleMode(){
        if (document.documentElement.classList.contains(`theme-dark`)) {
            document.documentElement.classList.remove('theme-light', 'theme-dark');
        } else {
            document.documentElement.classList.remove('theme-light', 'theme-dark');
            document.documentElement.classList.add(`theme-dark`);
        }
    }

    changeMuteStatus(status: boolean) {
        this.MuteStatus.emit(status)
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

    isTeamsSSO(): boolean {
        if (sessionStorage.getItem('isLogingViaTeams') === 'true') {
            return true;
        } else {
            return false;
        }
    }

    showWarningIcon() {
        if(this.teamsLocationEnabled != undefined && this.appEmbededStatus === 'messaging' && this.composeMessageType !== 'whatsapp') {
            return !this.teamsLocationEnabled;
        }
        else {
            return this.isLocationEnabled === 'denied' && this.is911Message;
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

    isMessaging(){
        return this.appEmbededStatus == "messaging" ? " shell__title--font_teams" : "shell__title--font"
    }

    GetTheme(){
        let theme = localStorage.getItem("Theme")
        return theme ? "Dark" : null
    }
}
