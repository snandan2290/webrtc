import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { Store } from '@ngrx/store';
import * as bowser from 'bowser';
import { NzModalRef } from 'ng-zorro-antd/modal';
import { combineLatest, Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import {
    CallingService,
    selectActiveCalls,
    selectRawCallingHistory,
} from '../../../feature-calling';
import {
    AuthService,
    CallingStatus,
    DataService,
    FormModel,
    selectCallingStatus,
    selectCustomerSupport,
    withHttp,
} from '../../../shared';
import { cleanPhoneNumber } from '../../../shared/utils/common-utils';
import {LoggerFactory} from '@movius/ts-logger';
const logger = LoggerFactory.getLogger("")

interface SupportEmailData {
    name: string;
    emailId: string;
    phoneNumber: string;
    message: string;
}

export interface SupportView {
    isCallEnabled: boolean;
    callingLog: string[];
    callingStatus: CallingStatus;
    support: {
        phone: string;
        email: string;
    };
}

@Component({
    selector: 'movius-web-support-workspace',
    templateUrl: './support-workspace.component.html',
    styleUrls: ['./support-workspace.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SupportWorkspaceComponent implements OnInit {
    readonly supportTelephone: string = this.authService.customerSupport.phone;
    readonly supportEmail: string = this.authService.customerSupport.email;
    readonly knowledgeBaseLink: string = 'help.moviuscorp.com';
    readonly view$: Observable<SupportView>;
    e911UserStatus: any;
    callingStatus_tmp: CallingStatus;
    callingStatus: CallingStatus;

    readonly getMailFormat = (
        appName = '',
        appVersion = '',
        osVersion = '',
        browserVersion = '',
        device = '',
        companyOrgId = '',
        multiLineUrl = '',
        virtualNumber = '',
        incidentIds = [''],
        callingLog = ['']
    ) => {
        return `
        Please describe the issue you are experiencing here

        Got a screenshot? Add as an attachment.

        ==Do Not Remove This Information==

        App Name : ${appName}
        App Version : ${appVersion}
        OS Version : ${osVersion}

        Browser Version: ${browserVersion}
        Device : MultiLine Desktop
        Company/Org ID : ${companyOrgId}
        MultiLine Desktop URL: ${multiLineUrl}
        Virtual Number : ${virtualNumber}
        Incident IDs: 
        \t${incidentIds?.join(',\r\n\t')}

        Last calls :
        ${callingLog?.join(',\r\n\t')}`;
    };

    supportForm: FormGroup;
    private readonly logLength: number = 15;
    getConnectionErrorValue: any;

    constructor(
        private readonly _formBuilder: FormBuilder,
        private readonly _modal: NzModalRef,
        private readonly router: Router,
        private readonly callingService: CallingService,
        private readonly store: Store,
        private readonly authService: AuthService,
        private dataService : DataService,
    ) {

        const model: FormModel<SupportEmailData> = {
            name: ['', [Validators.required]],
            emailId: ['', [Validators.required, Validators.email]],
            phoneNumber: ['', [Validators.required]],
            message: ['', [Validators.required]],

        };

        const callingLog$ = store.select(selectRawCallingHistory()).pipe(
            map((item) => {
                return item.slice(0, this.logLength);
            })
        );

        const callingStatus$ = store.select(selectCallingStatus);
        callingStatus$.subscribe(res => {
            this.callingStatus = res;
        });

        const activeCallsNumber$ = store
            .select(selectActiveCalls)
            .pipe(map((activeCalls) => Object.keys(activeCalls).length));

        this.supportForm = this._formBuilder.group(model);
        this.view$ = combineLatest([
            store.select(selectCustomerSupport),
            callingLog$,
            activeCallsNumber$,
            callingStatus$
        ]).pipe(
            map(([support, callingLog, activeCallsNumber, callingStatus]) => ({
                support,
                callingLog,
                isCallEnabled: activeCallsNumber === 0,
                callingStatus
            }))
        );
    }

    ngOnInit(): void { }

    destroyModal(isPositive: boolean) {
        this._modal.destroy(isPositive);
    }

    onEmailClick(callingLog: string[]) {
        this.dataService.setELKStatus(true);
        let appVersionNumber:any; 
        localStorage.getItem('Version') ? appVersionNumber = localStorage.getItem('Version') : appVersionNumber = 'v0.1.0';
        let postsID = []
        if(sessionStorage.getItem("__ELK_SERVER_DOMAIN__")!== null){
            logger.sendPOSTlog("emailSupportClick")
            const postID_err = sessionStorage.getItem("incidentIDS_ERROR")
            const postID_cli = sessionStorage.getItem("incidentIDS_CLIENT")
            if(postID_err !== null || postID_cli !== null){
                if(postID_err !== null){
                    let postID_errs = postID_err.split("\n")
                    for(let i = 0;i<postID_errs.length;i++){
                        const post_time_and_id = postID_errs[i].split(":::")
                        postsID.push(post_time_and_id[1])
                    }
                    sessionStorage.removeItem("incidentIDS_ERROR")
                }
                if(postID_cli !== null){
                    const postID_cli_time_id = postID_cli.split(":::")
                    postsID.push(postID_cli_time_id[1]);
                    sessionStorage.removeItem("incidentIDS_CLIENT")
                }
            }
        }
        const sysInfo = bowser.getParser(window.navigator.userAgent);
        const mail = this.getMailFormat(
            'MultiLine Desktop',
            appVersionNumber,
            `${sysInfo.getOSName()} ${sysInfo.getOSVersion()}`,
            `${sysInfo.getBrowserName()} ${sysInfo.getBrowserVersion()}`,
            `${sysInfo.getPlatformType()} ${sysInfo.getBrowserName()}`,
            this.authService.apiAuthOrgId,
            `${window['MOVIUS_MS_GRAPH_LOGOUT_URL']}`,
            this.authService.apiIdentity,
            postsID,
            callingLog
        );
        const data = `mailto:${this.supportEmail}?subject=${encodeURI(
            'Technical support'
        )}&body=${encodeURI(mail)}`;
        //window.location.assign(data);
        window.open(data, '_blank');
        setTimeout(()=>{
            this.dataService.setELKStatus(false);
        },5000)
    }

    onClose() {
        this._modal.close();
    }

    goToLink(url: string) {
        window.open(withHttp(url), '_blank');
    }

    onPhoneClick() {
        const mlNumber = cleanPhoneNumber(this.supportTelephone);
        this.callingService.startUnknownMultilineSession(mlNumber);
        /*
        this.router.navigate(['calling', 'call', mlNumber], {
            state: { data: getCallNowPayload() },
        });
        */
    }

    get disbaledCallButton() {
        this.e911UserStatus = sessionStorage.getItem("_USER_E911_STATUS_");
        // console.log("SupportWorkspaceComponent:: e911UserStatus::" + this.e911UserStatus)
        // console.log("SupportWorkspaceComponent:: callingStatus_tmp::" + this.callingStatus_tmp)
        if (this.getConnectionErrorValue) {
            this.callingStatus_tmp = 'network-error'
            return true;
        } else {
            this.callingStatus_tmp = null;
            if (this.e911UserStatus === 'disabled') {
                return this.callingStatus !== 'allowed';
            }
            if (this.e911UserStatus === "enabled_accepted" &&
                this.callingStatus === 'allowed') {
                return false;
            } else {
                return true;
            }
        }
    }

    public getConnectionError(event: any) {
        this.getConnectionErrorValue = event;
    }
}
