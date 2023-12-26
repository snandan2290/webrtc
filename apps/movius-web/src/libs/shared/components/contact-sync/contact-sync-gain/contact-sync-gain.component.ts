import { Component, Input, OnInit } from '@angular/core';

@Component({
    selector: 'movius-web-contact-sync-gain',
    templateUrl: './contact-sync-gain.component.html',
    styleUrls: ['./contact-sync-gain.component.scss']
})
export class ContactSyncGainComponent implements OnInit {

    @Input()
    doShowProgress: boolean = true;
    @Input()
    uiCaptionTxt: string = 'Exchange contacts sync in progress'
    constructor() { }

    ngOnInit(): void {
    }

}
