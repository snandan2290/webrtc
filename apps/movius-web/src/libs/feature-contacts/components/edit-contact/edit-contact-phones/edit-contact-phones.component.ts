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
import { AbstractControl } from '@angular/forms';
import { noPhonePlus } from 'apps/movius-web/src/libs/shared';
import { FormArray, FormGroup } from 'ngx-strongly-typed-forms';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import * as lpn from 'google-libphonenumber';

export type PhoneType =
    | 'BusinessPhone'
    | 'MobilePhone'
    | 'HomePhone'
    | 'Other'
    | 'OrganizationMain'
    | 'Pager'
    | 'BusinessFax'
    | 'HomeFax'
    | 'OtherFax'
    | 'AssistantPhone'
    | 'CallbackPhone'
    | 'RadioPhone'
    | 'Telex'
    | 'TTY';

export interface ContactPhone {
    phone: string;
    orgPhone: string;
    type: PhoneType;
}

@Component({
    selector: 'movius-web-edit-contact-phones',
    templateUrl: './edit-contact-phones.component.html',
    styleUrls: ['../edit-contact.shared/edit-contact.shared.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EditContactPhonesComponent implements OnInit, OnDestroy {
    private readonly destroy$ = new Subject();
    @Input() formArray: FormArray<ContactPhone>;
    @Input() preferredCountryCode: string;
    @Input() preferredCountryName: string;

    @Output() remove = new EventEmitter<number>();
    phoneUtil: any = lpn.PhoneNumberUtil.getInstance();
    invalidNum: boolean = false;

    constructor(private readonly cdr: ChangeDetectorRef) {}

    ngOnInit(): void {
        this.invalidNum = (sessionStorage.getItem('invalidNum') == null || sessionStorage.getItem('invalidNum') == undefined) ? false : true;
        this.formArray.valueChanges
            .pipe(takeUntil(this.destroy$))
            .subscribe(() => {
                this.cdr.markForCheck();
            });
    }

    ngOnDestroy() {
        this.destroy$.next();
    }


    setCountryCodeForPhone(index: number, value: string) {
        let phoneNo:any;
        let finalNumberValue:any;
        
        if (!this.formArray.controls[index]) {
            return;
        }
        const val = this.formArray.controls[index].value;
        const sameCodeOrEmpty = !val?.phone || !noPhonePlus(val?.phone).startsWith(value);
        if( this.formArray.value[index]["phone"]){
            phoneNo = this.phoneUtil.parse('+' + this.formArray.value[index]["phone"], "");
            finalNumberValue = { ...val, phone: '+'+ value + phoneNo.values_[2] };
        } else {
            finalNumberValue = { ...val, phone: '+' + value };
        }
        if (sameCodeOrEmpty) {
            this.formArray.controls[index].patchValue(finalNumberValue);
        }
    }

    prependNumberWithPlus(control) {
        const current = control?.value;
        if(!current) {
            return;
        }
        if(current.replace('\+','') === '911'){
            control.patchValue('911');
            return;
        }
        if(current.startsWith('+')){
            return;
        }
        control.patchValue('+' + current);
    }



    removePhnNumber(index, numberType, phnCntrls) {
        if(phnCntrls.length == 1 && numberType == 'MobilePhone'){
            const val = this.formArray.controls[0].value;
            let finalNumberValue:any;
            finalNumberValue = { ...val, phone: '+' + 1, type: 'BusinessPhone' };
            this.formArray.controls[index].patchValue(finalNumberValue);
        } else {
            this.remove.emit(index)
        }
    }

}
