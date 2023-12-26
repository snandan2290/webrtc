import {
    ChangeDetectionStrategy,
    Component,
    EventEmitter,
    Input,
    OnInit,
    Output,
    ViewChild,
} from '@angular/core';
import { UserContactGhost } from '../../../feature-contacts/models';
import { CallingStatus, ContactSelectedValue } from '../../../shared';
import {
    ContactSelectorComponent,
    preserveAutocompleteClassName,
} from '../../../shared/components/contact-selector/contact-selector.component';
import { CallControlButtonTypes } from '../common';

export type NumberError = 'conference_number' | 'invalid_number' | 'destination-911';

export type NewCallStatus = CallingStatus | NumberError;

@Component({
    selector: 'movius-web-new-call-inactive',
    templateUrl: './new-call-inactive.component.html',
    styleUrls: ['./new-call-inactive.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NewCallInactiveComponent implements OnInit {
    @Input() callingStatus: NewCallStatus;
    @ViewChild(ContactSelectorComponent)
    contactSelector: ContactSelectorComponent;

    @Output() call = new EventEmitter<string>();
    @Output() voiceMail = new EventEmitter();
    @Output() numberChanged = new EventEmitter<string>();

    callControlTypes = CallControlButtonTypes;
    selectedContact: ContactSelectedValue;
    @Input() peers: UserContactGhost[];

    inputValue?: string = '';
    getConnectionErrorValue: any;

    readonly preserveAutocompleteClassName: string = preserveAutocompleteClassName;
    e911UserStatus: any;

    constructor() {
    }

    ngOnInit(): void { }

    disableCallButton() {
        this.e911UserStatus = sessionStorage.getItem("_USER_E911_STATUS_");
        if (this.e911UserStatus !== "enabled_accepted")
            return (this.callingStatus !== 'allowed');
        else {
            return (this.callingStatus !== 'allowed');
        }
    }

    onPhoneButtonClicked(input: string) {
        this.contactSelector.onExternalInputTriggered(input);
    }

    onCall(val: string) {
        if (!!val) {
            let cleanVal = val.replace(/\s+/g, '').replace(/\+/g, '');

            //TODO: CB:05Jul2021: TECH-DEBT: Consider adding field with the set of special numbres here: 911,112 etc. Not only nine-one-one.
            if (cleanVal?.indexOf(this.selectedContact?.code) === 0) {
                let onlyNumber = cleanVal?.slice(this.selectedContact?.code?.length);
                if (onlyNumber === "911") {
                    this.selectedContact.multiline = '911';
                    cleanVal = onlyNumber;
                }
            }

            this.call.next(cleanVal);
        }
    }

    onValueChanged(event) {
        this.selectedContact = event;
        this.inputValue = this.selectedContact?.multiline;
        this.numberChanged.emit(this.inputValue);
    }


    public getConnectionError(event :any){
      this.getConnectionErrorValue = event;
    }
}
