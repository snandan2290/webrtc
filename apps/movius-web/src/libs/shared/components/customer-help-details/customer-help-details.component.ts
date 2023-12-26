import { Component, ElementRef, Input, OnInit, ViewChild } from '@angular/core';
import { LoggerFactory } from '@movius/ts-logger';
import { NzModalRef, NzModalService } from 'ng-zorro-antd/modal';
import { DataService } from '../../services';
import { ConfirmDialogComponent } from '../confirm-dialog/confirm-dialog.component';
import { Observable, fromEvent, merge, of } from 'rxjs';
import { mapTo} from 'rxjs/operators';
const logger = LoggerFactory.getLogger("")

@Component({
    selector: 'movius-web-customer-help-details',
    templateUrl: './customer-help-details.component.html',
    styleUrls: ['./customer-help-details.component.scss']
})
export class CustomerHelpDetailsComponent implements OnInit{
    messageTextLength: number = 0;
    remainingText: number = 250;
    public value:string;
    getConnectionErrorValue: any;
    onlineStatus$: Observable<boolean>;

    constructor(
        private readonly modalService: NzModalService,
        private readonly _modal: NzModalRef,
        private dataService : DataService,
    ) {}

    ngOnInit(): void {}

    valueChange(value) {
        this.messageTextLength = value.length;
        this.remainingText = 250 - value.length;
    }

    submitDetailsELKServer() {
        // this.dataService.setELKStatus(true);
        this._modal.close();
        let postsID = []
        logger.sendPOSTlog("helpSupportClick");
        logger.sendPOSTlogHelp(this.value)
        const postID_err = sessionStorage.getItem("incidentIDS_ERROR")
        const postID_cli = sessionStorage.getItem("incidentIDS_CLIENT")
        if (postID_err !== null || postID_cli !== null) {
            if (postID_err !== null) {
                let postID_errs = postID_err.split("\n")
                for (let i = 0; i < postID_errs.length; i++) {
                    const post_time_and_id = postID_errs[i].split(":::")
                    postsID.push(post_time_and_id[1])
                }
                sessionStorage.removeItem("incidentIDS_ERROR")
            }
            if (postID_cli !== null) {
                const postID_cli_time_id = postID_cli.split(":::")
                postsID.push(postID_cli_time_id[1]);
                sessionStorage.removeItem("incidentIDS_CLIENT")
            }
        }
        this.submitSuccessConfirmation();
    }

    submitSuccessConfirmation() {
        this.modalService.create({
            nzContent: ConfirmDialogComponent,
            nzComponentParams: {
                infoTitleTxt:
                    'Thank you for your feedback. We will look into this and get back to you soon',
                applyBtnTxtCenter: 'Ok',
            },
            nzClosable: false,
            nzBodyStyle: {
                width: '24rem',
            },
            nzWidth: '24rem',
            nzFooter: null,
        });
        setTimeout(()=>{
            this.dataService.setELKStatus(false);
        },5000)
    }

    public getConnectionError(event :any) {
        this.onlineStatus$ = merge(
            of(navigator.onLine),
            fromEvent(window, 'online').pipe(mapTo(true)),
            fromEvent(window, 'offline').pipe(mapTo(false))
        );
        this.onlineStatus$.subscribe(data => {
            logger.debug('General:: Network Status:', data);
            this.getConnectionErrorValue = data;
        })

    }
}