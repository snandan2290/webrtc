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

export interface ContactWork {
    company: string;
    jobTitle: string;
    yomiCompany: string;
}

@Component({
    selector: 'movius-web-edit-contact-work',
    templateUrl: './edit-contact-work.component.html',
    styleUrls: ['../edit-contact.shared/edit-contact.shared.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EditContactWorkComponent implements OnInit, OnDestroy {
    private readonly destroy$ = new Subject();
    @Input() formGroup: FormGroup<ContactWork>;

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
