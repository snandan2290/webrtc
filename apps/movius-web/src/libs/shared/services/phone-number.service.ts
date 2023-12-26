import { Injectable } from '@angular/core';
import { CountryCode } from '../components/country-selector/model/country-code';
import { Country } from '../components/country-selector/model/country.model';
import * as lpn from 'google-libphonenumber';
import { Subject } from 'rxjs';

@Injectable({
    providedIn: 'root',
})
export class PhoneNumberService {

    allCountries: Array<Country> = [];
    phoneUtil: any = lpn.PhoneNumberUtil.getInstance();
    isContactCreated = new Subject<boolean>();

    constructor(private countryCodeData: CountryCode) {
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

            this.allCountries.push(country);
        });
    }

    getUserCountryCode(userInfo) {
        const number = this.getUserInternationalNumber(userInfo);

        return `+${number?.getCountryCode()}`;
    }

    getUserInternationalNumber(userInfo){
        const phoneUtil: any = lpn.PhoneNumberUtil.getInstance();
        let mlNumber = userInfo?.multiLine;

        if(!mlNumber.startsWith('+')){
            mlNumber = `+${mlNumber}`;
        }

        let number: lpn.PhoneNumber;
        try {
            number = phoneUtil.parse(mlNumber, "");
        } catch (e) { }

        return number;
    }

    getUserCountryName(userInfo) {
        const number = this.getUserInternationalNumber(userInfo);
        if (number) {
            const code = this.getUserCountryCode(userInfo);

            const countryName = this.getCountryIsoCode(+code, number);
            return countryName;
        }
    }

    public getCountryIsoCode(
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
}
