import { Component, Input, OnInit } from '@angular/core';
import { NzModalRef } from 'ng-zorro-antd/modal';
import { UserContactGhost } from '../../../feature-contacts/models';
import { filterNameOrPhone, getContactFriendlyName } from '../../utils';

@Component({
    selector: 'movius-web-add-to-existing-contact',
    templateUrl: './add-to-existing-contact.component.html',
    styleUrls: ['./add-to-existing-contact.component.scss']
})
export class AddToExistingContactComponent implements OnInit {

    @Input() contacts: UserContactGhost[];

    searchTerm: string;
    filteredData: UserContactGhost[];

    constructor(
        private readonly _modal: NzModalRef,
    ) {
        //TODO: CB:29Mar2021: Sample method impl.
        //TODO: CB:29Mar2021: Map sourceContacts to contacts;
        this.contacts = [
            <any>{
                contact: {
                    firstName: "one-first",
                    lastName: "one-last"
                },
                isAdded: false
            },
            <any>{
                contact: {
                    firstName: "two-first",
                    lastName: "two-last"
                },
                isAdded: false
            },
            <any>{
                contact: {
                    firstName: "three-first",
                    lastName: "three-last"
                },
                isAdded: false
            },
            <any>{
                contact: {
                    firstName: "one-first",
                    lastName: "one-last"
                },
                isAdded: false
            },
            <any>{
                contact: {
                    firstName: "two-first",
                    lastName: "two-last"
                },
                isAdded: false
            },
            <any>{
                contact: {
                    firstName: "three-first",
                    lastName: "three-last"
                },
                isAdded: false
            },
            <any>{
                contact: {
                    firstName: "one-first",
                    lastName: "one-last"
                },
                isAdded: false
            },
            <any>{
                contact: {
                    firstName: "two-first",
                    lastName: "two-last"
                },
                isAdded: false
            },
            <any>{
                contact: {
                    firstName: "three-first",
                    lastName: "three-last"
                },
                isAdded: false
            }
        ];
        this.filteredData = this.contacts;
    }

    ngOnInit(): void {
    }

    onClose() {
        this._modal.close();
    }

    handleSearch(term: string) {
        if(!term) {
            this.filteredData = this.contacts;
        }
        this.filteredData = this.contacts.filter(c => {
            return filterNameOrPhone(c, term);
        })
    }

    handleAdd(index: number) {
        //TODO: CB:29Mar2021: Sample method impl.
        (<any>this.filteredData[index]).isAdded = true;
    }

    getContactFriendlyName = getContactFriendlyName;

}
