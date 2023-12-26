import { formatDate, KeyValue } from '@angular/common';
import { Component, Input, OnInit , OnChanges} from '@angular/core';
import { Contact } from '@movius/domain';
import {
    capitalizeFirstLetter,
    getAddressString,
    toSpacedCamelCase,
    addPulsToMultilineNumber,
    chkonlydigits
} from '../../utils/common-utils';
import { format, parse } from 'date-fns';

export const getSeveralAccessor = (
    container: {
        [index: string]: string;
    },
    value: string
) => {
    const count = Object.keys(container)?.filter((e) => e.startsWith(value))
        .length;
    return !container[value] ? value : `${value} (${count + 1})`;
};

export const toView = (contact: Contact): { [index: string]: string } => {
    let result: { [index: string]: string } = {};

    contact?.phones?.forEach((phone, index) => {
        const acc = getSeveralAccessor(result, toSpacedCamelCase(phone.type));
        result[acc] = phone.phone
            ? phone.phone
            : phone.orgPhone;
    });

    contact?.addresses?.forEach((addr, index) => {
        const acc = getSeveralAccessor(result, toSpacedCamelCase(addr.type));
        result[acc] = getAddressString(addr);
    });

    contact?.emails?.forEach((email, index) => {
        const emType = email?.type?.toLowerCase();
        const acc = getSeveralAccessor(
            result,
            toSpacedCamelCase(
                (!emType) ||
                (emType === 'unknown') ||
                (emType?.includes(email?.email?.toLowerCase())) ||
                (emType?.includes(email?.type?.toLowerCase())) ||
                (email?.email?.toLowerCase()?.includes(emType)) ||
                (emType?.includes('@') || emType?.includes(contact?.firstName) || emType?.includes(contact?.lastName))
                ? 'BusinessEmail'
                : email.type
            )
        );
        result[acc] = email.email;
    });

    Object.keys(contact?.work || {}).forEach((w) => {
        !!contact?.work[w]
            ? (result[toSpacedCamelCase(w)] = contact?.work[w])
            : void 0;
    });

    /*Object.keys(contact?.nameExtras || {}).forEach((ext) => {
        !!contact?.nameExtras[ext]
            ? (result[toSpacedCamelCase(ext)] = contact?.nameExtras[ext])
            : void 0;
    });*/

    Object.keys(contact?.other || {}).forEach((oth) => {
        !!contact?.other[oth]
            ? (result[toSpacedCamelCase(oth)] =
                  oth === 'birthday'
                      ? contact?.other[oth]
                          ? format(new Date(contact?.other[oth]), 'MM/dd/yyyy')
                          : null
                      : contact?.other[oth])
            : void 0;
    });

    const restFields = ['chat', 'note'];
    Object.keys(contact || {}).forEach((rest) => {
        !!rest &&
        !!contact &&
        restFields.some((e) => e === rest) &&
        !!contact[rest]
            ? (result[toSpacedCamelCase(rest)] = contact[rest])
            : void 0;
    });

    return result;
};



@Component({
    selector: 'movius-web-contact-details',
    templateUrl: './contact-details.component.html',
    styleUrls: ['./contact-details.component.scss'],
})
export class ContactDetailsComponent implements OnInit , OnChanges{
    @Input()
    userInfoFields: { [index: string]: string };

    constructor() {}

    ngOnInit(): void {}

    ngOnChanges(){
        let resultObject = {};
        resultObject['Business Phone'] = this.userInfoFields['Business Phone'];
        resultObject['Business Phone (2)'] = this.userInfoFields['Business Phone (2)'];
        resultObject['Mobile Phone'] = this.userInfoFields['Mobile Phone'];
        resultObject['Home Phone'] = this.userInfoFields['Home Phone'];
        resultObject['Home Phone (2)'] = this.userInfoFields['Home Phone (2)'];
        resultObject['Business Email'] = this.userInfoFields['Business Email'];
        resultObject['Business Email (2)'] = this.userInfoFields['Business Email (2)'];
        resultObject['Business Email (3)'] = this.userInfoFields['Business Email (3)'];
        resultObject['company'] = this.userInfoFields['company'];
        resultObject['job Title'] = this.userInfoFields['job Title'];
        resultObject['Business Address'] = this.userInfoFields['Business Address'];
        resultObject['Home Address'] = this.userInfoFields['Home Address'];
        resultObject['Other Address'] = this.userInfoFields['Other Address'];
        resultObject['birthday'] = this.userInfoFields['birthday'];
        resultObject['note'] = this.userInfoFields['note'];
        resultObject['personal Web Page'] = this.userInfoFields['personal Web Page'];
        resultObject['significant Other'] = this.userInfoFields['significant Other'];
        resultObject['yomi Company'] = this.userInfoFields['yomi Company'];
        resultObject['chat'] = this.userInfoFields['chat'];
        for (const key in resultObject) {
            // if (resultObject[key] === undefined || resultObject[key].length <= 3) {
            if (resultObject[key] === undefined) {
              delete resultObject[key];
            }
        } 
        this.userInfoFields = resultObject;
    }

   

    keys(obj): string[] {
        return Object.keys(obj);
    }

    originalOrder = (
        a: KeyValue<number, string>,
        b: KeyValue<number, string>
    ): number => {
        return 0;
    };

    capitalizeFirstLetter = capitalizeFirstLetter;

    addPulsToMultilineNumber = addPulsToMultilineNumber;

    chkonlydigits = chkonlydigits

    getDetailsValue (value) {
        return chkonlydigits(value.includes('+') ? value.replace('+','') : value) ? capitalizeFirstLetter(addPulsToMultilineNumber(value)) :  capitalizeFirstLetter(value)
    }
}
