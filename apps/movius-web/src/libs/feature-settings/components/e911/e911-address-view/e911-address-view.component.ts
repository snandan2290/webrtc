import {
    ChangeDetectionStrategy,
    Component,
    EventEmitter,
    Input,
    OnInit,
    Output,
    ViewContainerRef,
} from '@angular/core';
import { NzModalService } from 'ng-zorro-antd/modal';
import {
    Address,
    getAddressString,
    getContactAddressString,
    getFeatureEnabled,
} from '../../../../shared';
import { E911TermsConditionComponent } from '../../e911-terms-condition/e911-terms-condition.component';

export interface E911AddressView {
    isEdit: boolean;
    addresses: Address[];
    // stored emergency index
    activeId: number;
    //
    selectedAddress: Address;
}

@Component({
    selector: 'movius-web-e911-address-view',
    templateUrl: './e911-address-view.component.html',
    styleUrls: ['./e911-address-view.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class E911AddressViewComponent implements OnInit {
    @Input() address: Address;
    @Output() edit = new EventEmitter();
    appEmbededStatus: string;

    constructor(
        private viewContainerRef: ViewContainerRef,
        private readonly modalService: NzModalService,
    ) {}

    get addressString() {
        return getAddressString(this.address);
    }

    onEdit() {
        this.edit.emit();
    }

    ngOnInit () {
        this.appEmbededStatus = getFeatureEnabled();
    }

    onE911TermsClicked() {
        if ( this.appEmbededStatus === 'messaging') {
            this.modalService.create({
                nzContent: E911TermsConditionComponent,
                nzWidth: '46rem',
                nzFooter: null,
                nzKeyboard: false,
                nzViewContainerRef: this.viewContainerRef,
                nzMaskClosable: false,
                nzStyle: {
                    top: '10px',
                },
            });
        } else {
            const win = window.open(
                window.location.origin + '/login/e911_tandc',
                '_blank'
            );
            win.focus();
        }
    }
}
