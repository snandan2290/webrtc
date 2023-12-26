import { Component, OnInit } from '@angular/core';
import { NzModalRef } from 'ng-zorro-antd/modal';

@Component({
    selector: 'movius-web-emergency-terms',
    templateUrl: './emergency-terms.component.html',
    styleUrls: ['./emergency-terms.component.scss']
})
export class EmergencyTermsComponent implements OnInit {

    constructor(private readonly _modal: NzModalRef) { }

    ngOnInit(): void {
    }

    destroyModal(doApply: boolean): void {
        this._modal.destroy(doApply)
    }

}
