import {
    AfterViewInit,
    Component,
    ElementRef,
    EventEmitter,
    Input,
    OnDestroy,
    OnInit,
    Output,
    ViewChild,
} from '@angular/core';
import { sortBy, uniq } from 'lodash/fp';
import { NzAutocompleteTriggerDirective } from 'ng-zorro-antd/auto-complete';
import { CountrySelectorComponent } from '../country-selector/country-selector.component';
import { UserContactGhost } from '../../../feature-contacts/models';
import { User } from '../../models';
import { uiPhoneNumberFormatRegex } from '../../utils';
import { capitalizeFirstLetter, checkCCodeInNumber, cleanPhoneNumber, noPhonePlus, noSpace, toSpacedCamelCase } from '../../utils/common-utils';
import { Subject } from 'rxjs';
import {
    debounceTime, distinctUntilChanged, takeUntil,
} from 'rxjs/operators';
import { PhoneNumberService, SipUserService } from '../../services';
import { getContactRealNumber } from '../../../shared';

const sortContact = (contact: UserContactGhost) => {
    const fullName = [contact.firstName !== null? contact.firstName?.trim() : contact.firstName,
        contact.lastName !== null ? contact.lastName?.trim() : contact.lastName].join(' ');
    return fullName.toLowerCase().trim() || 'zzzzzzzzzzzzzzzzzzz';
};

export interface RegionCode {
    code: string;
    representation: string;
}

export interface PhoneInfo {
    country: string;
    countryCode: string;
    phoneNumber: string;
}

export interface ContactSelectedValue {
    multiline: string;
    peer?: User;
    code?: string;
}

export const preserveAutocompleteClassName: string = 'preserveAutocomplete';

@Component({
    selector: 'movius-web-contact-selector',
    templateUrl: './contact-selector.component.html',
    styleUrls: ['./contact-selector.component.scss'],
})
export class ContactSelectorComponent
    implements OnInit, AfterViewInit, OnDestroy {
    @ViewChild('countrySelector')
    countryFlagSelector: CountrySelectorComponent;
    @ViewChild('inputPhoneNumber', { static: true })
    phoneNumberInput: ElementRef<HTMLInputElement>;

    @ViewChild(NzAutocompleteTriggerDirective) autoTriggerDir;

    @Input() contactInfo: PhoneInfo = {
        phoneNumber: '',
        countryCode: '',
        country: '',
    };
    @Output() changed = new EventEmitter<ContactSelectedValue | null>();

    @Input() contacts: UserContactGhost[];

    uiContactSelectorInput: string;
    uiContactSelectorCountryCode: string;
    filteredContacts: UserContactGhost[];

    private lastActive: Element | null;
    private originalClose: () => void;
    private doAllowUnrecognizedNumbers = true;
    private readonly deBouncer$: Subject<ContactSelectedValue | null> = new Subject<ContactSelectedValue | null>();
    private readonly destroy$ = new Subject();
    private lastCountryCode: string;

    constructor(
        private sipUserService: SipUserService,
        private phoneNumberService: PhoneNumberService,
    ) {
        this.deBouncer$
        .pipe(
            debounceTime(300),
            distinctUntilChanged(),
            takeUntil(this.destroy$)
        )
        .subscribe((value) => this.changed.emit(value));
    }

    cleanPhoneNumber = cleanPhoneNumber;

    ngOnInit(): void {
        const userInfo = this.sipUserService.user;

        this.uiContactSelectorInput = this.phoneNumberService.getUserCountryCode(userInfo);
        this.uiContactSelectorCountryCode = this.phoneNumberService.getUserCountryName(userInfo);
        this.filteredContacts = [];
    }

    ngAfterViewInit(): void {
        this.patchAutocompleteForExternalInput();
        this.phoneNumberInput.nativeElement.focus();
    }

    isDigitalInput = (input) => {
        return uiPhoneNumberFormatRegex.test(noSpace(input));
    };

    onKeyPress(event : any) {
        const isDigitalInput = this.isDigitalInput(event.target.value);
        if (isDigitalInput) {
            if(event.target.value.length > 15) {
                event.preventDefault();
            }
        }
    }

    onPasteNumber(event: ClipboardEvent) {
        let clipboardData = event.clipboardData;
        let pastedNumber = clipboardData.getData('text');
        const isDigitalInput = this.isDigitalInput(pastedNumber);
        if (isDigitalInput) {
            if(pastedNumber.length > 15) {
                event.preventDefault();
            }
        }
      }

    onPhoneInputChange(numberOrName: string): void {
        const isDigitalInput = this.isDigitalInput(numberOrName);
        if (isDigitalInput) {
            if( numberOrName.length > 15) {
                numberOrName = numberOrName.substring(0,14);
            }
            this.contactInfo.phoneNumber = numberOrName;

            this.countryFlagSelector
                .writeValueThenReportIfChanged({
                    number: this.contactInfo.phoneNumber,
                    countryCode: this.contactInfo.countryCode,
                })
                .then((country) => {
                    this.lastCountryCode = country?.dialCode;
                    const noPlusNumber = noPhonePlus(numberOrName);
                    const isCCfound = checkCCodeInNumber(noPlusNumber);
                    const isEnoughWRTCCode = isCCfound['isCCFound'] === true &&
                        (noPlusNumber.length > isCCfound['CountryCode'].length ?
                            noPlusNumber.length - isCCfound['CountryCode'].length : 0) > 2
                    const isEnoughWRTCCodeWContInfoCCode = !!this.contactInfo?.countryCode &&
                        !noPlusNumber.startsWith(this.contactInfo?.countryCode) &&
                        !isEnoughWRTCCode
                    const notEnoughInput =
                        noPlusNumber?.length == 0 ||
                        (this.doAllowUnrecognizedNumbers &&
                            !this.contactInfo?.countryCode &&
                            !isEnoughWRTCCode) || isEnoughWRTCCodeWContInfoCCode ||
                            this.prependPlusIfNeed(noPlusNumber)
                            .split(
                                this.prependPlusIfNeed(
                                    this.contactInfo.countryCode
                                )
                            )
                            .join('').length < 3;
                    if (notEnoughInput && numberOrName != '911') {
                        //TECH: CB:19Feb2021: Obsolete? Excessive double-call of writeValueThenReportIfChanged. Test and remove if no need.
                        //this.countryFlagSelector.writeValueThenReportIfChanged({ number: this.contactInfo.phoneNumber, countryCode: this.contactInfo.countryCode });
                        this.clearFilteredContactsReported();
                    } else {
                        this.processContacts(numberOrName);
                        this.emitContacts(numberOrName);
                    }
                });
            return;
        } else {
            if (numberOrName.length < 3) {
                this.clearFilteredContactsReported();
                return;
            }
        }

        this.processContacts(numberOrName);
        this.emitContacts(numberOrName);
    }

    processContacts(numberOrName: string) {
        const numberOrNameNonClean = numberOrName.toLowerCase()
        numberOrName = cleanPhoneNumber(numberOrName);
        const byPhone = this.contacts.filter((option) =>
            cleanPhoneNumber(option.multiLine)?.includes(numberOrName)
        );
        const byName = this.contacts.filter((option) => 
            cleanPhoneNumber(option.name || '')?.includes(numberOrName) 
            && option.name?.toLowerCase().includes(numberOrNameNonClean)
        );
        this.filteredContacts = sortBy(sortContact, uniq([...byPhone, ...byName]))
    }

    emitContacts(numberOrName: string) {
        if (!numberOrName) {
            this.deBouncer$.next(null);
            return;
        }
        const numberOrNameNonClean = numberOrName
        numberOrName = cleanPhoneNumber(numberOrName);
        const peer = this.contacts.find(
            (f) =>
                cleanPhoneNumber(f.multiLine) === numberOrName ||
                (cleanPhoneNumber(f.name) === numberOrName 
                    && f.name.toLowerCase() === numberOrNameNonClean.toLowerCase())
        );
        const existingOrEnteredNUmber = !!peer ? peer?.multiLine : numberOrName;
        this.deBouncer$.next({
            multiline: existingOrEnteredNUmber,
            peer: peer ?? null,
            code: this.lastCountryCode
        });
    }

    clearFilteredContactsReported() {
        //We should always emit 'empty' information on clear.
        this.filteredContacts = [];
        this.deBouncer$.next(null);
    }

    onCountryChange(code: any, region: string, skipFirstChange: boolean = true): void {
        let updatedPhoneNumber;
        if(!this.contactInfo?.phoneNumber?.startsWith("+"))
            updatedPhoneNumber = this.contactInfo.phoneNumber.replace(this.lastCountryCode, '');
        else
            updatedPhoneNumber = this.contactInfo.phoneNumber.replace('+' + this.lastCountryCode, '');
        //CB: 03Jun2021: TECH - We need to skip the first country.
        //CB: 03Jun2021: TECH - It is done because country-selectror is made static FOR NOW.
        //CB: 03Jun2021: TECH - It is made static to omit extracting country-recognition logic outside.
        //CB: 05Jul2021: TECH - Logic was extracted from country-selectror. Consider to remove debt if OK.
        // if(!!skipFirstChange && !this.isFirstCountrySkipped){
        //     this.isFirstCountrySkipped = true;
        //     return;
        // }
        this.lastCountryCode = code;
        const codeWithPlus = `+${code}`;
        if( updatedPhoneNumber.length > 15) {
            updatedPhoneNumber = updatedPhoneNumber.substring(0,14);
        }
        if (
            this.contactInfo?.phoneNumber?.startsWith(codeWithPlus) ||
            this.contactInfo?.phoneNumber?.startsWith(code)
        ) {
            //Case 1: the country is auto-detected after the input and related after-handler is invoked.
            //EmitContacts to filter contacts and trigger validation.
            if(sessionStorage.getItem("isCountrySelected") === "true"){
                this.contactInfo = {
                    phoneNumber: (this.contactInfo.phoneNumber.startsWith(codeWithPlus) ? 
                    this.contactInfo.countryCode.startsWith(code) ? codeWithPlus : '':codeWithPlus) + 
                    (updatedPhoneNumber.startsWith("+") ? updatedPhoneNumber.replace("+",'') : updatedPhoneNumber),
                    countryCode: code,
                    country: region,
                };
                this.uiContactSelectorInput = this.contactInfo.phoneNumber;
                sessionStorage.removeItem("isCountrySelected")
            }else{
                this.contactInfo = {
                    ...this.contactInfo,
                    countryCode: code,
                    country: region,
                };
            }
            const isCCodeFound = checkCCodeInNumber(cleanPhoneNumber(this.contactInfo?.phoneNumber))
            if(isCCodeFound['CountryCode'].length > 0 ? 
                this.contactInfo?.phoneNumber.replace(isCCodeFound['CountryCode'],"").length > 3 : false)
                this.processContacts(this.contactInfo?.phoneNumber)
            this.emitContacts(this.contactInfo?.phoneNumber);
        } else {
            //Case 2: the country is changed via selector - we need to clear data.
            //EmitContacts with null to trigger validation.
            this.contactInfo = {
                phoneNumber: codeWithPlus + updatedPhoneNumber,
                countryCode: code,
                country: region,
            };
            this.uiContactSelectorInput = this.contactInfo.phoneNumber;
            const isCCodeFound = checkCCodeInNumber(cleanPhoneNumber(this.contactInfo?.phoneNumber))
            if(isCCodeFound['CountryCode'].length > 0 ? 
                this.contactInfo?.phoneNumber.replace(isCCodeFound['CountryCode'],"").length > 3 : false)
                this.processContacts(this.contactInfo?.phoneNumber)
            if (this.contactInfo.phoneNumber.length > 5) {
                this.emitContacts(this.contactInfo?.phoneNumber);
            }
        }
    }

    onExternalInputTriggered(input: string) {
        this.processExternalInput(input);
    }

    clearAll() {
        this.uiContactSelectorInput = '';
        this.countryFlagSelector?.setEmptyCountry();

        this.contactInfo.phoneNumber = '';
        this.contactInfo.country = '';
        this.contactInfo.countryCode = '';

        this.clearFilteredContactsReported();
        this.deBouncer$.next(null);
    }

    toSpacedCamelCase = toSpacedCamelCase;

    getContactRealNumber = getContactRealNumber;

    capitalizeFirstLetter = capitalizeFirstLetter;

    ngOnDestroy() {
        this.destroyAutocompleteHandling();
        this.destroy$.next();
        this.destroy$.complete();
    }

    //#region Autocomplete external input handling
    //CB: 02Dec2020: TDEBT:Consider to extract autocomplete decorator as external comp with this logic.
    //CB: 02Dec2020: YAGNI: No duplicate! Extract in case of need to use in any other place.
    private patchAutocompleteForExternalInput() {
        this.originalClose = this.autoTriggerDir.closePanel.bind(
            this.autoTriggerDir
        );
        this.autoTriggerDir.closePanel = () => {
            let active = this.lastActive;
            while (active) {
                let amongPreserve =
                    active?.classList?.contains(
                        preserveAutocompleteClassName
                    ) ||
                    active?.parentElement?.classList.contains(
                        preserveAutocompleteClassName
                    );
                if (amongPreserve) {
                    this.lastActive = null;
                    return;
                }
                active = active?.parentElement;
            }
            this.originalClose();
        };
    }

    private processExternalInput(input) {
        this.lastActive = document.activeElement;
        this.contactInfo.phoneNumber += input;
        this.contactInfo.phoneNumber = this.prependPlusIfNeed(
            this.contactInfo.phoneNumber
        );
        this.phoneNumberInput.nativeElement.focus();
        this.phoneNumberInput.nativeElement.value = this.contactInfo.phoneNumber;
        this.phoneNumberInput.nativeElement.dispatchEvent(new Event('input'));
    }

    private destroyAutocompleteHandling() {
        this.autoTriggerDir.closePanel = null;
        this.autoTriggerDir = null;
        this.originalClose = null;
    }

    private prependPlusIfNeed(input: string) {
        if (this.isDigitalInput(input) && !input.startsWith('+')) {
            input = '+' + input;
        }
        return input;
    }
    //#endregion Autocomplete external input handling
}
