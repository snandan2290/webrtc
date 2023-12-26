import { Injectable } from '@angular/core';
import { values } from 'lodash/fp';
import { BehaviorSubject, Subject } from 'rxjs';
import { elKEmitterSubject } from '../utils/work-service'
import { Country } from '../components/country-selector/model/country.model';
import { CountryCode } from '../components/country-selector/model/country-code';

const usaStates = {
    "AL": "Alabama",
    "AK": "Alaska",
    "AS": "American Samoa",
    "AZ": "Arizona",
    "AR": "Arkansas",
    "CA": "California",
    "CO": "Colorado",
    "CT": "Connecticut",
    "DE": "Delaware",
    "DC": "District Of Columbia",
    "FM": "Federated States Of Micronesia",
    "FL": "Florida",
    "GA": "Georgia",
    "GU": "Guam",
    "HI": "Hawaii",
    "ID": "Idaho",
    "IL": "Illinois",
    "IN": "Indiana",
    "IA": "Iowa",
    "KS": "Kansas",
    "KY": "Kentucky",
    "LA": "Louisiana",
    "ME": "Maine",
    "MH": "Marshall Islands",
    "MD": "Maryland",
    "MA": "Massachusetts",
    "MI": "Michigan",
    "MN": "Minnesota",
    "MS": "Mississippi",
    "MO": "Missouri",
    "MT": "Montana",
    "NE": "Nebraska",
    "NV": "Nevada",
    "NH": "New Hampshire",
    "NJ": "New Jersey",
    "NM": "New Mexico",
    "NY": "New York",
    "NC": "North Carolina",
    "ND": "North Dakota",
    "MP": "Northern Mariana Islands",
    "OH": "Ohio",
    "OK": "Oklahoma",
    "OR": "Oregon",
    "PW": "Palau",
    "PA": "Pennsylvania",
    "PR": "Puerto Rico",
    "RI": "Rhode Island",
    "SC": "South Carolina",
    "SD": "South Dakota",
    "TN": "Tennessee",
    "TX": "Texas",
    "UT": "Utah",
    "VT": "Vermont",
    "VI": "Virgin Islands",
    "VA": "Virginia",
    "WA": "Washington",
    "WV": "West Virginia",
    "WI": "Wisconsin",
    "WY": "Wyoming"
}

@Injectable({
    providedIn: 'root'
})
export class DataService {
    allCountries: Array<Country> = [];
    constructor(
        private countryCodeData: CountryCode,
    ) { }

    public connectionStatusSubject = new Subject();
    public checkConnectionStatus = this.connectionStatusSubject.asObservable();

    setConnectionStatus(data:any){
        this.connectionStatusSubject.next(data);
    }

    setELKStatus(data:boolean){
        elKEmitterSubject.next({addLog: data});
    }

    getUsaStateCodes() {
        return Object.keys(usaStates);
    }

    getUsaStateNames() {
        return Object.keys(usaStates).map((k) => usaStates[k]);
    }

    getUsaStateNamesAndCodes() {
        let countryCodes = [];
        this.getUsaStateNames().forEach((e,i) => {
            countryCodes.push( e + " (" + this.getUsaStateCodes()[i] + ")");
        });
        return countryCodes;
    }

    getUsaStates() {
        return usaStates;
    }

    getOnlyCodeFromName (data:string) {
        const indexOfOpen = data.indexOf("(")
        const indexOfClose = data.indexOf(")")
        return data.substring(indexOfOpen + 1, indexOfClose);
    }

    getCountryNameWCode(codeName:string){
        let country = codeName
        Object.keys(usaStates).filter(
            (k) => {
                if(k === codeName){
                    country = usaStates[k] + " (" + k + ")"
                }
            });
        return  country
    }

    public getCountries() {
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
}
