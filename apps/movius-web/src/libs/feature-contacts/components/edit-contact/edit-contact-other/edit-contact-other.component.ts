import {
    ChangeDetectionStrategy,
    ChangeDetectorRef,
    Component,
    Input,
    OnDestroy,
    OnInit,
} from '@angular/core';
import { FormGroup, AbstractControl as AC } from 'ngx-strongly-typed-forms';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

export interface ContactOther {
    personalWebPage: string;
    significantOther: string;
    birthday: string;
}

@Component({
    selector: 'movius-web-edit-contact-other',
    templateUrl: './edit-contact-other.component.html',
    styleUrls: ['../edit-contact.shared/edit-contact.shared.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EditContactOtherComponent implements OnInit, OnDestroy {
    private readonly destroy$ = new Subject();
    @Input() formGroup: FormGroup<ContactOther>;

    constructor(private readonly cdr: ChangeDetectorRef) {}

    ngOnInit(): void {
        this.formGroup.valueChanges
            .pipe(takeUntil(this.destroy$))
            .subscribe(() => {
                this.cdr.markForCheck();
            });
    }

    ngOnDestroy() {
        this.destroy$.next();
    }

    //YAGNI: CB:10Sep2021: No upbound-event on remove for simplicity.
    //YAGNI: CB:10Sep2021: Process at higher-level in case of increased complexity.
    removeData(control: AC<string>) {
        control.setValue(null);
    }
}
