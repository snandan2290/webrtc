//DSCLR: CB:29Jan2021: Based on https://github.com/webcat12345/ngx-intl-tel-input
import {
    Component,
    ElementRef,
    EventEmitter,
    forwardRef,
    Input,
    OnChanges,
    OnInit,
    Output,
    SimpleChanges,
    ViewChild,
} from '@angular/core';
import { NG_VALUE_ACCESSOR } from '@angular/forms';
import * as lpn from 'google-libphonenumber';

import { CountryCode } from './model/country-code';
import { CountryISO } from './model/country-iso.enum';
import { SearchCountryField } from './model/search-country-field.enum';
import { ChangeData } from './model/change-data';
import { Country } from './model/country.model';
import { checkCCodeInNumber, cleanPhoneNumber } from '../../utils';

export type LibphonenumberInput = {
    number: string,
    countryCode: string
}

@Component({
    selector: 'movius-web-country-selector',
    templateUrl: './country-selector.component.html',
    styleUrls: ['./country-selector.component.scss'],
    providers: [
        //CountryCode,
        {
            provide: NG_VALUE_ACCESSOR,
            // tslint:disable-next-line:no-forward-ref
            useExisting: forwardRef(() => CountrySelectorComponent),
            multi: true,
        },
        /*{
            provide: NG_VALIDATORS,
            useValue: phoneNumberValidator,
            multi: true,
        },*/
    ],
})
export class CountrySelectorComponent implements OnInit, OnChanges {

    @Input() value = '';
    @Input() phoneNumber = '';
    @Input() preferredCountries: Array<string> = [];
    @Input() enablePlaceholder = true;
    @Input() cssClass = 'form-control';
    @Input() onlyCountries: Array<string> = [];
    @Input() enableAutoCountrySelect = true;
    @Input() searchCountryFlag = false;
    @Input() searchCountryField: SearchCountryField[] = [SearchCountryField.All];
    @Input() searchCountryPlaceholder = 'Search Country';
    @Input() maxLength = '';
    //@Input() tooltipField: TooltipLabel;
    @Input() selectFirstCountry = true;
    @Input() selectedCountryISO: CountryISO;
    @Input() actualPhoneValue :string;
    @Input() phoneValidation = true;
    @Input() inputId = 'phone';
    @Input() separateDialCode = false;
    @Input() skipInitialEvent = false;
    separateDialCodeClass: string;

    @Output() readonly countryChange = new EventEmitter<Country>();

    selectedCountry: Country = {
        areaCodes: undefined,
        dialCode: '',
        htmlId: '',
        flagClass: '',
        iso2: '',
        name: '',
        placeHolder: '',
        priority: 0,
    };

    allCountries: Array<Country> = [];
    filteredCountries: Array<Country> = [];
    preferredCountriesInDropDown: Array<Country> = [];
    // Has to be 'any' to prevent a need to install @types/google-libphonenumber by the package user...
    phoneUtil: any = lpn.PhoneNumberUtil.getInstance();
    disabled = false;
    errors: Array<any> = ['Phone number is required.'];
    countrySearchText = '';

    @ViewChild('countryList') countryList: ElementRef;

    onTouched = () => { };
    propagateChange = (_: ChangeData) => { };

    constructor(private countryCodeData: CountryCode) { }

    ngOnInit() {
        this.init();
        this.filteredCountries = this.allCountries;
    }

    ngOnChanges(changes: SimpleChanges) {
        const selectedISO = changes['selectedCountryISO'];
        if (
            this.allCountries &&
            selectedISO &&
            selectedISO.currentValue !== selectedISO.previousValue
        ) {
            this.getSelectedCountry();
        }
        if (changes.preferredCountries) {
            this.getPreferredCountries();
        }
        this.checkSeparateDialCodeStyle();
    }

    /*
        This is a wrapper method to avoid calling this.ngOnInit() in writeValue().
        Ref: http://codelyzer.com/rules/no-life-cycle-call/
    */
    init() {
        this.fetchCountryData();
        if (this.preferredCountries.length) {
            this.getPreferredCountries();
        }
        if (this.onlyCountries.length) {
            this.allCountries = this.allCountries.filter((c) =>
                this.onlyCountries.includes(c.iso2)
            );
        }
        if (this.selectFirstCountry) {
            if (this.preferredCountriesInDropDown.length) {
                this.setSelectedCountry(this.preferredCountriesInDropDown[0], this.skipInitialEvent);
            } else {
                this.setSelectedCountry(this.allCountries[0], this.skipInitialEvent);
            }
        }else{
            if(this.actualPhoneValue && this.actualPhoneValue !== null){
                let number
                const phoneUtil = lpn.PhoneNumberUtil.getInstance();
                try {
                    number = phoneUtil.parse("+"+cleanPhoneNumber(this.actualPhoneValue), "");
                } catch (e) { }
                if(number){
                    const sample = this.getCountryIsoCode(number.getCountryCode(), number)
                    this.setSelectedCountry(this.fetchCountryDataWNumber(sample), this.skipInitialEvent);
                }
            }
        }
        this.getSelectedCountry();
        this.checkSeparateDialCodeStyle();
    }

    getPreferredCountries() {
        if (this.preferredCountries.length) {
            this.preferredCountriesInDropDown = [];
            this.preferredCountries.forEach((iso2) => {
                const preferredCountry = this.allCountries.filter((c) => {
                    return c.iso2 === iso2;
                });

                this.preferredCountriesInDropDown.push(preferredCountry[0]);
            });
        }
    }

    getSelectedCountry() {
        if (this.selectedCountryISO) {
            this.selectedCountry = this.allCountries.find((c) => {
                return c.iso2.toLowerCase() === this.selectedCountryISO.toLowerCase();
            });
            if (this.selectedCountry) {
                if (this.phoneNumber) {
                    this.onPhoneNumberChange();
                } else {
                    // Reason: avoid https://stackoverflow.com/a/54358133/1617590
                    // tslint:disable-next-line: no-null-keyword
                    this.propagateChange(null);
                }
            }
        }
    }

    setSelectedCountry(country: Country, doSkipReport = false) {
        this.selectedCountry = country;
        if(doSkipReport){
            return;
        }
        this.countryChange.emit(country);
    }

    /**
     * Search country based on country name, iso2, dialCode or all of them.
     */
    searchCountry() {
        const countrySearchTextLower = this.countrySearchText.toLowerCase();
        const filtered = this.allCountries.filter((c) => {
            if (this.searchCountryField.indexOf(SearchCountryField.All) > -1) {
                if (c.iso2.toLowerCase().includes(countrySearchTextLower)) {
                    return c;
                }
                if (c.name.toLowerCase().includes(countrySearchTextLower)) {
                    return c;
                }
                if (c.dialCode.startsWith(this.countrySearchText)) {
                    return c;
                }
            } else {
                // Or search by specific SearchCountryField(s)
                if (this.searchCountryField.indexOf(SearchCountryField.Iso2) > -1) {
                    if (c.iso2.toLowerCase().startsWith(countrySearchTextLower)) {
                        return c;
                    }
                }
                if (this.searchCountryField.indexOf(SearchCountryField.Name) > -1) {
                    if (c.name.toLowerCase().startsWith(countrySearchTextLower)) {
                        return c;
                    }
                }
                if (this.searchCountryField.indexOf(SearchCountryField.DialCode) > -1) {
                    if (c.dialCode.startsWith(this.countrySearchText)) {
                        return c;
                    }
                }
            }
        });

        if (filtered.length > 0) {
            const el = this.countryList.nativeElement.querySelector(
                '#' + filtered[0].htmlId
            );
            if (el) {
                el.focus();
                /*el.scrollIntoView({
                    behavior: 'smooth',
                    block: 'nearest',
                    inline: 'nearest',
                });*/
            }
            this.filteredCountries = filtered;
        }

        this.checkSeparateDialCodeStyle();
    }

    public onPhoneNumberChange(skipAutoSelect: boolean = false): void {
        let countryCode: string | undefined;
        // Handle the case where the user sets the value programatically based on a persisted ChangeData obj.
        if (this.phoneNumber && typeof this.phoneNumber === 'object') {
            const numberObj: ChangeData = this.phoneNumber;
            this.phoneNumber = numberObj.number;
            countryCode = numberObj.countryCode;
        }

        this.value = this.phoneNumber;
        countryCode = countryCode || this.selectedCountry.iso2.toUpperCase();
        let number: lpn.PhoneNumber;
        try {
            number = this.phoneUtil.parse(this.phoneNumber, countryCode);
        } catch (e) { }

        // auto select country based on the extension (and areaCode if needed) (e.g select Canada if number starts with +1 416)
        if (this.enableAutoCountrySelect) {
            if (!skipAutoSelect) {
                countryCode =
                    number && number.getCountryCode()
                        ? this.getCountryIsoCode(number.getCountryCode(), number)
                        : this.selectedCountry.iso2;
            }
            if (countryCode && countryCode !== this.selectedCountry.iso2) {
                const newCountry = this.allCountries.sort((a, b) => {
                    return a.priority - b.priority;
                }).find(
                    (c) => c.iso2 === countryCode
                );
                if (newCountry) {
                    this.selectedCountry = newCountry;
                }
            }
        }
        countryCode = countryCode ? countryCode : this.selectedCountry.iso2;

        this.checkSeparateDialCodeStyle();

        if (!this.value) {
            // Reason: avoid https://stackoverflow.com/a/54358133/1617590
            // tslint:disable-next-line: no-null-keyword
            this.propagateChange(null);
        } else {
            const intlNo = number
                ? this.phoneUtil.format(number, lpn.PhoneNumberFormat.INTERNATIONAL)
                : '';

            // parse phoneNumber if separate dial code is needed
            if (this.separateDialCode && intlNo) {
                this.value = this.removeDialCode(intlNo);
            }

            this.propagateChange({
                number: this.value,
                internationalNumber: intlNo,
                nationalNumber: number
                    ? this.phoneUtil.format(number, lpn.PhoneNumberFormat.NATIONAL)
                    : '',
                e164Number: number
                    ? this.phoneUtil.format(number, lpn.PhoneNumberFormat.E164)
                    : '',
                countryCode: countryCode.toUpperCase(),
                dialCode: '+' + this.selectedCountry.dialCode,
            });
        }
    }

    public onCountrySelect(country: Country, el): void {
        sessionStorage.setItem("isCountrySelected","true");
        this.setSelectedCountry(country, this.skipInitialEvent);

        this.checkSeparateDialCodeStyle();

        if (this.phoneNumber && this.phoneNumber.length > 0) {
            this.value = this.phoneNumber;

            let number: lpn.PhoneNumber;
            try {
                number = this.phoneUtil.parse(
                    this.phoneNumber,
                    this.selectedCountry.iso2.toUpperCase()
                );
            } catch (e) { }

            const intlNo = number
                ? this.phoneUtil.format(number, lpn.PhoneNumberFormat.INTERNATIONAL)
                : '';

            // parse phoneNumber if separate dial code is needed
            if (this.separateDialCode && intlNo) {
                this.value = this.removeDialCode(intlNo);
            }

            this.propagateChange({
                number: this.value,
                internationalNumber: intlNo,
                nationalNumber: number
                    ? this.phoneUtil.format(number, lpn.PhoneNumberFormat.NATIONAL)
                    : '',
                e164Number: number
                    ? this.phoneUtil.format(number, lpn.PhoneNumberFormat.E164)
                    : '',
                countryCode: this.selectedCountry.iso2.toUpperCase(),
                dialCode: '+' + this.selectedCountry.dialCode,
            });
        } else {
            // Reason: avoid https://stackoverflow.com/a/54358133/1617590
            // tslint:disable-next-line: no-null-keyword
            this.propagateChange(null);
        }

        //el.focus();
    }

    public onInputKeyPress(event: KeyboardEvent): void {
        const allowedChars = /[0-9\+\-\ ]/;
        const allowedCtrlChars = /[axcv]/; // Allows copy-pasting
        const allowedOtherKeys = [
            'ArrowLeft',
            'ArrowUp',
            'ArrowRight',
            'ArrowDown',
            'Home',
            'End',
            'Insert',
            'Delete',
            'Backspace',
        ];

        if (
            !allowedChars.test(event.key) &&
            !(event.ctrlKey && allowedCtrlChars.test(event.key)) &&
            !allowedOtherKeys.includes(event.key)
        ) {
            event.preventDefault();
        }
    }

    protected fetchCountryDataWNumber(countryISOCode:string): Country {
        /* Clearing the list to avoid duplicates (https://github.com/webcat12345/ngx-intl-tel-input/issues/248) */
        this.allCountries = [];
        let country
        this.countryCodeData.allCountries.forEach((c) => {
            const AllCountry:Country = {
                name: c[0].toString(),
                iso2: c[1].toString(),
                dialCode: c[2].toString(),
                priority: +c[3] || 0,
                areaCodes: (c[4] as string[]) || undefined,
                htmlId: `iti-0__item-${c[1].toString()}`,
                flagClass: `iti__${c[1].toString().toLocaleLowerCase()}`,
                placeHolder: '',
            };
            if (this.enablePlaceholder) {
                AllCountry.placeHolder = this.getPhoneNumberPlaceHolder(
                    AllCountry.iso2.toUpperCase()
                );
            }

            this.allCountries.push(AllCountry);
            if(c[1]===countryISOCode){
                country = {
                    name: c[0].toString(),
                    iso2: c[1].toString(),
                    dialCode: c[2].toString(),
                    priority: +c[3] || 0,
                    areaCodes: (c[4] as string[]) || undefined,
                    htmlId: `iti-0__item-${c[1].toString()}`,
                    flagClass: `iti__${c[1].toString().toLocaleLowerCase()}`,
                    placeHolder: '',
                };
            }
        });
        return country;
    }

    protected fetchCountryData(): void {
        /* Clearing the list to avoid duplicates (https://github.com/webcat12345/ngx-intl-tel-input/issues/248) */
        this.allCountries = [];

        this.countryCodeData.allCountries.forEach((c) => {
            const country: Country = {
                name: c[0].toString(),
                iso2: c[1].toString(),
                dialCode: c[2].toString(),
                priority: +c[3] || 0,
                areaCodes: (c[4] as string[]) || undefined,
                htmlId: `iti-0__item-${c[1].toString()}`,
                flagClass: `iti__${c[1].toString().toLocaleLowerCase()}`,
                placeHolder: '',
            };

            if (this.enablePlaceholder) {
                country.placeHolder = this.getPhoneNumberPlaceHolder(
                    country.iso2.toUpperCase()
                );
            }

            this.allCountries.push(country);
        });
    }

    protected getPhoneNumberPlaceHolder(countryCode: string): string {
        try {
            return this.phoneUtil.format(
                this.phoneUtil.getExampleNumber(countryCode),
                lpn.PhoneNumberFormat.INTERNATIONAL
            );
        } catch (e) {
            return e;
        }
    }

    registerOnChange(fn: any): void {
        this.propagateChange = fn;
    }

    registerOnTouched(fn: any) {
        this.onTouched = fn;
    }

    setDisabledState(isDisabled: boolean): void {
        this.disabled = isDisabled;
    }

    writeValue(obj: any): Promise<unknown> {
        if (obj === undefined) {
            this.init();
        }
        this.phoneNumber = obj;
        const promise = new Promise((res, rej) => {
            setTimeout(() => {
                this.onPhoneNumberChange();
                res(undefined);
            }, 1);
        })
        return promise;
    }

    private getCountryIsoCode(
        countryCode: number,
        number: lpn.PhoneNumber
    ): string | undefined {
        // Will use this to match area code from the first numbers
        const rawNumber = number['values_']['2'].toString();
        // List of all countries with countryCode (can be more than one. e.x. US, CA, DO, PR all have +1 countryCode)
        const countries = this.allCountries.filter(
            (c) => c.dialCode === countryCode.toString()
        );
        // Main country is the country, which has no areaCodes specified in country-code.ts file.
        const mainCountry = countries.find((c) => c.areaCodes === undefined);
        // Secondary countries are all countries, which have areaCodes specified in country-code.ts file.
        const secondaryCountries = countries.filter(
            (c) => c.areaCodes !== undefined
        );
        let matchedCountry = mainCountry ? mainCountry.iso2 : undefined;

        /*
            Iterate over each secondary country and check if nationalNumber starts with any of areaCodes available.
            If no matches found, fallback to the main country.
        */
        secondaryCountries.forEach((country) => {
            country.areaCodes.forEach((areaCode) => {
                if (rawNumber.startsWith(areaCode)) {
                    matchedCountry = country.iso2;
                }
            });
        });

        return matchedCountry;
    }

    separateDialCodePlaceHolder(placeholder: string): string {
        return this.removeDialCode(placeholder);
    }

    private removeDialCode(phoneNumber: string): string {
        if (this.separateDialCode && phoneNumber) {
            phoneNumber = phoneNumber.substr(phoneNumber.indexOf(' ') + 1);
        }
        return phoneNumber;
    }

    // adjust input alignment
    private checkSeparateDialCodeStyle() {
        if (this.separateDialCode && this.selectedCountry) {
            const cntryCd = this.selectedCountry.dialCode;
            this.separateDialCodeClass =
                'separate-dial-code iti-sdc-' + (cntryCd.length + 1);
        } else {
            this.separateDialCodeClass = '';
        }
    }

    setEmptyCountry() {
        this.selectedCountry = {
            areaCodes: undefined,
            dialCode: '',
            htmlId: '',
            flagClass: '',
            iso2: '',
            name: '',
            placeHolder: '',
            priority: 0,
        };
    }

    writeValueThenReportIfChanged(obj: LibphonenumberInput): Promise<Country> {
        if (sessionStorage.getItem('invalidNum') == null || sessionStorage.getItem('invalidNum') == undefined) {
            if (!obj.number.startsWith('+')) {
                obj.number = '+' + obj.number;
            }
            const prev = this.selectedCountry;
            return this.writeValue(obj).then(() => {
                if (prev !== this.selectedCountry) {
                    this.countryChange.emit(this.selectedCountry);
                }
                return this.selectedCountry;
            });
        }
    }
}
