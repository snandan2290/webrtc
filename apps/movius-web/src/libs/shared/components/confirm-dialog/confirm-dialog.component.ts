import {
    ChangeDetectionStrategy,
    Component,
    Input,
    OnInit,
} from '@angular/core';
import { NzModalRef } from 'ng-zorro-antd/modal';
import { CustomNzModalService } from '../..';

type DialogType = 'Normal' | 'Error';
type AppearanceType = 'Normal' | 'Centered';

@Component({
    selector: 'movius-web-confirm-dialog',
    templateUrl: './confirm-dialog.component.html',
    styleUrls: ['./confirm-dialog.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConfirmDialogComponent implements OnInit {
    @Input() cancelBtnTxt: string;
    @Input() applyBtnTxt: string;
    @Input() titleTxt: string;
    @Input() subTitleTxt: string;
    @Input() infoTitleTxt: string;
    @Input() type: DialogType = 'Normal';
    @Input() appearance: AppearanceType = 'Normal';
    @Input() applyBtnTxtCenter: string;

    @Input()
    onOkAction: () => any;

    @Input()
    onCancelAction: () => any;

    constructor(private modal: NzModalRef, private nzModalService:CustomNzModalService) {}

    ngOnInit(): void {}

    onApply() {
        let ok;
        if (!!this.onOkAction) {
            ok = this.onOkAction();
        }
        this.modal.close(ok);
        this.nzModalService.closeModalPassingData = 'closed';
    }

    onCancel() {
        let cancel;
        if (!!this.onCancelAction) {
            cancel = this.onCancelAction();
        }
        this.modal.close(cancel);
    }
}
