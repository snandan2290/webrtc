import { Component, EventEmitter, OnInit, Output } from '@angular/core';

@Component({
    selector: 'movius-web-contact-sync-fail',
    templateUrl: './contact-sync-fail.component.html',
    styleUrls: ['./contact-sync-fail.component.scss'],
})
export class ContactSyncFailComponent implements OnInit {
    @Output()
    tryAgain = new EventEmitter();

    constructor() {}

    ngOnInit(): void {}
}
