import {
    ChangeDetectionStrategy,
    Component,
    EventEmitter,
    Input,
    Output,
} from '@angular/core';
import {
    Address,
    getAddressString,
    UserDataAccessService,
} from '../../../../shared';

@Component({
    selector: 'movius-web-e911-address-list',
    templateUrl: './e911-address-list.component.html',
    styleUrls: ['./e911-address-list.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class E911AddressListComponent {
    activeIndex = 0;

    @Input() addresses: Address[];

    @Output() updated = new EventEmitter<Address>();
    @Output() cancel = new EventEmitter<Address>();

    constructor(
        private readonly userDataAccessService: UserDataAccessService
    ) {}

    getAddressString(address: Address) {
        return getAddressString(address);
    }

    async onSave() {
        const address = this.addresses[this.activeIndex];
        await this.userDataAccessService
            .e911UpdateSubscriber(address)
            .toPromise();
        this.updated.emit(address);
    }

    onCancel() {
        this.cancel.emit();
    }
}
