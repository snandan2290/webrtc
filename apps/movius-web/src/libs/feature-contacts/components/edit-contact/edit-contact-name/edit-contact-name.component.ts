import {
    ChangeDetectionStrategy,
    ChangeDetectorRef,
    Component,
    ElementRef,
    EventEmitter,
    Input,
    OnDestroy,
    OnInit,
    Output,
} from '@angular/core';
import { FormGroup, FormControl } from 'ngx-strongly-typed-forms';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

export interface ContactName {
    title: string;
    firstName: string;
    lastName: string;
    middleName: string;
    nickName: string;
    suffix: string;
    yomiFirstName: string;
    yomiLastName: string;
}

@Component({
    selector: 'movius-web-edit-contact-name',
    templateUrl: './edit-contact-name.component.html',
    styleUrls: ['../edit-contact.shared/edit-contact.shared.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EditContactNameComponent implements OnInit, OnDestroy {
    private readonly destroy$ = new Subject();
    @Input() formGroup: FormGroup<ContactName>;
    @Output() removeTitle = new EventEmitter();
    @Output() removeSuffix = new EventEmitter();
    @Output() removeMiddlename = new EventEmitter();
    @Output() removeNickname = new EventEmitter();
    @Output() removeYomiNames = new EventEmitter();

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


    omit_special_char(event) {
        var k;
        k = event.charCode;
        return ((k > 64 && k < 91) || (k > 96 && k < 123) || k == 8 || k == 32 || k == 46 || k == 45 || k == 39 || (k >= 48 && k <= 57)) ;
    }
}
