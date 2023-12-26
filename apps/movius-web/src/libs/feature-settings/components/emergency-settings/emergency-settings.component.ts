import {
    ChangeDetectionStrategy,
    Component,
    OnDestroy,
    OnInit,
} from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Store } from '@ngrx/store';
import { BehaviorSubject, combineLatest, Observable, Subject } from 'rxjs';
import { map, takeUntil } from 'rxjs/operators';
import { Address, FormModel, selectAddress } from '../../../shared';

export interface EmergencyView {
    isEdit: boolean;
    addresses: Address[];
    // stored emergency index
    activeId: number;
    //
    selectedAddress: Address;
}

@Component({
    selector: 'movius-web-emergency-settings',
    templateUrl: './emergency-settings.component.html',
    styleUrls: ['./emergency-settings.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EmergencySettingsComponent implements OnInit, OnDestroy {
    private readonly destroy$ = new Subject();
    private readonly isEdit$ = new BehaviorSubject(false);
    private readonly selectedId$ = new BehaviorSubject(null);
    readonly view$: Observable<EmergencyView>;

    addressForm: FormGroup;

    constructor(
        private readonly _formBuilder: FormBuilder,
        private readonly store: Store
    ) {
        const addresses$ = store.select(selectAddress);
        let addrs = [
            {
                id: 1,
                mlnumber: 'string',
                street: 'string',
                street2: 'string',
                city: 'string',
                postal: 'string',
                state: 'string',
                country: 'string',
            },
            {
                id: 2,
                mlnumber: 'string',
                street: 'string2',
                street2: 'string2',
                city: 'string2',
                postal: 'string2',
                state: 'string2',
                country: 'string2',
            },
        ];
        this.view$ = combineLatest([this.isEdit$, addresses$]).pipe(
            map(
                ([isEdit, address]) =>
                    ({
                        addresses: addrs,
                        activeId: 1,
                        isEdit: isEdit,
                        selectedAddress: addrs[0],
                    } as any)
            )
        );
    }

    ngOnInit(): void {
        const model: FormModel<Address> = {
            street: ['', [Validators.required]],
            street2: ['', []],
            city: ['', [Validators.required]],
            country: ['', [Validators.required]],
            state: ['', [Validators.required]],
            postal: ['', [Validators.required]],
        };

        this.addressForm = this._formBuilder.group(model);

        const selectedAddress$ = this.view$.pipe(map((view) => null));

        selectedAddress$.pipe(takeUntil(this.destroy$)).subscribe((val) => {
            if (val) {
                this.addressForm.setValue(val);
            } else {
                this.addressForm.reset();
            }
        });
    }

    ngOnDestroy() {
        this.destroy$.next();
    }

    async onSave(view: EmergencyView) {
        if (this.addressForm.valid) {
            /*
            const emergency: Address = this.addressForm.value;
            const selectedIndex = view.selectedId;
            const emergencyList =
                selectedIndex === -1
                    ? [emergency, ...view.emergency]
                    : assoc([selectedIndex], emergency, view.emergency);
            const emergencyIndex = selectedIndex === -1 ? 0 : selectedIndex;

            
            this.store
                .dispatch(
                    updateProfileAddress({
                        emergency: emergencyList,
                        activeEmergencyIndex: emergencyIndex,
                    })
                );
            */

            // TODO : Wait complete
            this.isEdit$.next(false);
        }
    }

    onCancel(view: EmergencyView) {
        this.selectedId$.next(view.activeId);
        this.isEdit$.next(false);
    }

    onEdit() {
        console.log('onEdit');
        this.isEdit$.next(true);
    }

    onE911TermsClicked() {
        const win = window.open(
            window.location.origin + '/e911-terms',
            '_blank'
        );
        win.focus();
    }
}
