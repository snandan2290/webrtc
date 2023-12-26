import {
    ChangeDetectionStrategy,
    Component,
    EventEmitter,
    Input,
    Output,
} from '@angular/core';
import { Address } from '../../../../shared';

export interface EditState {
    kind: 'edit';
}

export interface ConfirmState {
    kind: 'confirm';
    addresses: Address[];
}

export type StepState = EditState | ConfirmState;

@Component({
    selector: 'movius-web-e911-address-edit',
    templateUrl: './e911-address-edit.component.html',
    styleUrls: ['./e911-address-edit.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class E911AddressEditComponent {
    step: StepState = { kind: 'edit' };
    @Input() address: Address;
    @Output() cancel = new EventEmitter();
    @Output() updated = new EventEmitter<Address>();

    constructor() {}

    async onEditContinue(addresses: Address[] | Address) {
        if (Array.isArray(addresses)) {
            this.step = { kind: 'confirm', addresses };
        } else {
            this.onConfirmUpdated(addresses);
        }
    }

    onEditCancel() {
        this.cancel.emit();
    }

    onConfirmCancel() {
        this.cancel.emit();
    }

    onConfirmUpdated(address: Address) {
        this.step = { kind: 'edit' };
        this.address = address;
        this.updated.emit(address);
    }
}
