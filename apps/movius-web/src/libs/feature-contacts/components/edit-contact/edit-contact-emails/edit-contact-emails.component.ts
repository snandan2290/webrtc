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
import { FormArray } from 'ngx-strongly-typed-forms';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Component({
    selector: 'movius-web-edit-contact-emails',
    templateUrl: './edit-contact-emails.component.html',
    styleUrls: ['../edit-contact.shared/edit-contact.shared.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EditContactEmailsComponent implements OnInit, OnDestroy {
    private readonly destroy$ = new Subject();
    @Input() formArray: FormArray<string>;
    @Output() remove = new EventEmitter<number>();

    constructor(private readonly cdr: ChangeDetectorRef) {}

    ngOnInit(): void {
        this.formArray.valueChanges
            .pipe(takeUntil(this.destroy$))
            .subscribe(() => {
                this.cdr.markForCheck();
            });
    }

    ngOnDestroy() {
        this.destroy$.next();
    }
}
