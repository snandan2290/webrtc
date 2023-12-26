import {
    ChangeDetectionStrategy,
    ChangeDetectorRef,
    Component,
    EventEmitter,
    Input,
    Output,
} from '@angular/core';
import { Validators } from '@angular/forms';
import {
    FormArray,
    FormControl,
    FormBuilder,
    FormGroup,
} from 'ngx-strongly-typed-forms';

import { ContactAddress } from '@movius/domain';
import {
    Address,
    convertAddressToContactAddress,
    convertContactAddressToAddress,
    DataService,
    FormModel,
    setE911Address,
    UserDataAccessService,
} from '../../../../shared';
import { Store } from '@ngrx/store';

@Component({
    selector: 'movius-web-e911-edit-form',
    templateUrl: './e911-edit-form.component.html',
    styleUrls: ['./e911-edit-form.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class E911EditFormComponent {
    @Input() address: Address;
    addressForm: FormGroup<Address>;
    processing = false;
    errorMessage: string = null;
    getConnectionErrorValue: any;

    @Output() continue = new EventEmitter<Address[] | Address>();
    @Output() cancel = new EventEmitter();

    constructor(
        private readonly _formBuilder: FormBuilder,
        private readonly userDataAccessService: UserDataAccessService,
        private readonly cdr: ChangeDetectorRef,
        readonly dataService: DataService,
        private readonly store: Store,
    ) {}

    ngOnInit(): void {
        this.addressForm = this._formBuilder.group<Address>({
            street: [
                this.address?.street || '',
                [Validators.required, Validators.maxLength(95)],
            ],
            street2: [
                this.address?.street2 || '',
                [Validators.maxLength(95)],
            ],
            city: [
                this.address?.city,
                [Validators.required, Validators.maxLength(35)],
            ],
            country: [this.address?.country || 'US', [Validators.required]],
            state: [
                this.dataService.getCountryNameWCode(this.address?.state) || '',
                [Validators.required, Validators.maxLength(35)],
            ],
            postal: [
                this.address?.postal || '',
                [Validators.required, Validators.maxLength(5)],
            ],
            firstName: [
                this.address?.firstName || '',
                [Validators.required, Validators.maxLength(53)],
            ],
            lastName: [
                this.address?.lastName || '',
                [Validators.required, Validators.maxLength(52)],
            ],
            houseNumber: [
                this.address?.houseNumber || '',
                [Validators.required, Validators.maxLength(10)],
            ],
        });
    }

    getCustomValidationMessage(maxLength: number) {
        return {
            required: 'Please enter first name',
            maxlength: `Maximum length is ${maxLength}`,
        };
    }

    async onContinue() {
        if (this.addressForm.valid) {
            this.processing = true;
            this.errorMessage = null;
            try {
                this.addressForm.value.state = this.addressForm.value.state.split("(")[1].split(")")[0]
                const address = this.addressForm.value;
                const addresses = await this.userDataAccessService
                    .e911GetAddressesList(address)
                    .toPromise();
                if (addresses === 'found') {
                    this.store.dispatch(
                        setE911Address({
                            address,
                            requireUpdate: false,
                        })
                    );
                    this.continue.emit(address);
                } else {
                    this.continue.emit(addresses);
                }
            } catch (err) {
                if (err.status === 500 || this.getConnectionErrorValue == true) {
                    this.errorMessage = 'Internet connection error';
                } else {
                    this.errorMessage = 'Unit/Apt Number/Street Number not recognized (Do not include street name).';
                }
            } finally {
                this.processing = false;
                this.cdr.markForCheck();
            }
        }
    }

    onCancel() {
        this.cancel.emit();
    }

    public getConnectionError(event: any) {
        this.getConnectionErrorValue = event;
    }
}
