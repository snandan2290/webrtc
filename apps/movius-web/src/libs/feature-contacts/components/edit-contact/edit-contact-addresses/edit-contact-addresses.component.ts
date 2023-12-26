import {
    ChangeDetectionStrategy,
    ChangeDetectorRef,
    Component,
    EventEmitter,
    Input,
    OnDestroy,
    OnInit,
    Output,
} from '@angular/core';
import { ContactAddress, ContactAddressType } from '@movius/domain';
import { FormArray } from 'ngx-strongly-typed-forms';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Component({
    selector: 'movius-web-edit-contact-addresses',
    templateUrl: './edit-contact-addresses.component.html',
    styleUrls: ['../edit-contact.shared/edit-contact.shared.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EditContactAddressesComponent implements OnInit, OnDestroy {
    private readonly destroy$ = new Subject();
    @Input() formArray: FormArray<ContactAddress>;
    @Output() remove = new EventEmitter<number>();

    constructor(private readonly cdr: ChangeDetectorRef) {}

    ngOnInit(): void {
        this.formArray.valueChanges
            .pipe(takeUntil(this.destroy$))
            .subscribe(() => {
                this.cdr.markForCheck();
            });
    }

    getAddressTypeLabel(addressType: ContactAddressType) {
        switch (addressType) {
            case 'BusinessAddress':
                return 'Business';
            case 'HomeAddress':
                return 'Home';
            case 'OtherAddress':
                return 'Other';
        }
    }

    ngOnDestroy() {
        this.destroy$.next();
    }
}
