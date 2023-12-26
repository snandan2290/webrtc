import { Component, Input, OnInit, Output } from '@angular/core';
import { Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { CallingStatus, DbContext, selectCallingStatus } from 'apps/movius-web/src/libs/shared';
import { Subject } from 'rxjs';

@Component({
    selector: 'movius-web-empty-calls',
    templateUrl: './empty-calls.component.html',
    styleUrls: ['./empty-calls.component.scss'],
})
export class EmptyCallsComponent implements OnInit {
    @Input() callingStatus: CallingStatus;
    @Output() callClicked = new Subject();
    callingStatus_tmp: CallingStatus;
    e911UserStatus: any;
    getConnectionErrorValue: any;

    constructor(readonly router: Router,
        private readonly dbContext: DbContext,
        private readonly store: Store,) {
        const callingStatus$ = store.select(selectCallingStatus);
        callingStatus$.subscribe(res => {
            this.callingStatus_tmp = res;
        });
    }

    ngOnInit(): void {
        this.getAllParticipants();
        this.getContactUsers();
    }

    onCall() {
        this.callClicked.next();
    }

    async getAllParticipants() {
        await this.dbContext.message.getAllParticipants();
    }

    async getContactUsers() {
        sessionStorage.getItem('__api_identity__');
    }

    get disbaledCallButton() {
        this.e911UserStatus = sessionStorage.getItem("_USER_E911_STATUS_");
        // console.log("SupportWorkspaceComponent:: e911UserStatus::" + this.e911UserStatus)
        // console.log("SupportWorkspaceComponent:: callingStatus_tmp::" + this.callingStatus_tmp)
        if (this.e911UserStatus === 'disabled') {
            return this.callingStatus_tmp !== 'allowed';
        }
        if (this.e911UserStatus === "enabled_accepted" &&
            this.callingStatus_tmp === 'allowed') {
            return false;
        } else {
            return true;
        }
    }

    public getConnectionError(event :any){
      this.getConnectionErrorValue = event;
    }
}
