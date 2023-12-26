import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { SipService } from '@scalio/sip';
import { BehaviorSubject, combineLatest, Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import {
    selectContactGhosts,
    updateUserContact,
    UserContactGhost,
} from '../../../feature-contacts';
import {
    cleanPhoneNumber,
    DbContext,
    getPeerNumberWOSpecialChars,
    isEmergencyNumber,
    PhoneNumberService,
    selectCallingStatus,
    SipUserService,
} from '../../../shared';
import { OutgoingCall } from '../../models';
import { selectPeersCallingStates } from '../../ngrx';
import { CallingService } from '../../services';
import { NewCallStatus } from '../new-call-inactive/new-call-inactive.component';
import * as lpn from 'google-libphonenumber';
import { Country } from '../../../shared/components/country-selector/model/country.model';
import { CountryCode } from '../../../shared/components/country-selector/model/country-code';

export interface NewCallWorkspaceView {
    peers: UserContactGhost[];
    call: OutgoingCall;
    callingStatus: NewCallStatus | 'empty_number';
}

const getNumberError = (n: string) => {
    if (!n) {
        return 'empty_number';
    }

    if(n.startsWith('101') || n.startsWith('100')){
        return 'invalid_number';
    }

    if ([',', ';', '#'].some((char) => n.includes(char))) {
        return 'conference_number';
    }

    if (/\D/.test(n)) {
        const clear = cleanPhoneNumber(n);
        return /\D/.test(clear) ? 'invalid_number' : null;
    }

    // CB:19May2021: E911 is disabled only for messages.
    // if(n === '911') {
    //     return 'destination-911';
    // }

    return null;
};

@Component({
    selector: 'movius-web-new-call-workspace',
    templateUrl: './new-call-workspace.component.html',
    styleUrls: ['./new-call-workspace.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NewCallWorkspaceComponent implements OnInit {
    private activeNumber$ = new BehaviorSubject<string>(null);

    callingId$ = new BehaviorSubject<string>(null);
    view$: Observable<NewCallWorkspaceView>;
    allCountries: Array<Country> = [];
    phoneUtil: any = lpn.PhoneNumberUtil.getInstance();
    uiContactSelectorInput: string;
    uiContactSelectorCountryCode: string;
    readonly peers$: Observable<UserContactGhost[]>;
    contacts: any;

    constructor(
        private readonly callingService: CallingService,
        private readonly router: Router,
        private readonly activatedRoute: ActivatedRoute,
        private readonly store: Store,
        private readonly sipService: SipService,
        private readonly userService: SipUserService,
        private countryCodeData: CountryCode,
        private phoneNumberService: PhoneNumberService,
        private readonly dbContext: DbContext
    ) {
        this.peers$ = store.select(selectContactGhosts(sipService.getUserUri));
        const callingStatus$ = store.select(selectCallingStatus);

        const numberError$ = this.activeNumber$.pipe(map(getNumberError));

        this.view$ = combineLatest([
            store.select(selectPeersCallingStates(sipService.getUserUri)),
            this.callingId$,
            store.select(selectContactGhosts(sipService.getUserUri)),
            callingStatus$,
            numberError$,
        ]).pipe(
            map(([state, id, peers, callingStatus, numberError]) => {
                const session = state.find((f) => f.peer?.multiLine === id);
                const call =
                    session && session.active
                        ? ((session.active.find(
                            (f) => f.direction === 'outgoing'
                        ) as unknown) as OutgoingCall)
                        : null;
                return {
                    call,
                    peers,
                    callingStatus:
                        callingStatus !== 'allowed'
                            ? callingStatus
                            : numberError || 'allowed',
                };
            })
        );
    }

    ngOnInit(): void {
        this.getContacts();
        this.getCountries();
        const userInfo = this.userService.user;
        this.uiContactSelectorInput = this.phoneNumberService.getUserCountryCode(userInfo);
        this.uiContactSelectorCountryCode = this.phoneNumberService.getUserCountryName(userInfo);
    }

    onCancel(callId: string) {
        this.callingService.hangUp(callId);
    }

    onMute(callId: string, isMute: boolean) {
        this.callingService.setMute(callId, isMute);
    }

    onHold(callId: string, isHold: boolean) {
        this.callingService.setHold(callId, isHold);
    }

    onCall(multilineNumber: string) {
        let internationalNumber = '';
        if (isEmergencyNumber(multilineNumber)) {
            internationalNumber = multilineNumber;
        } else {
            if (!multilineNumber.startsWith('+')) {
                //internationalNumber = this.getInternationalNumber('8054336693');
                internationalNumber = this.getInternationalNumber(multilineNumber);
                this.isNumberExists(multilineNumber, internationalNumber);
            } else {
                internationalNumber = multilineNumber;
            }
        }
        this.callingService.startUnknownMultilineSession(getPeerNumberWOSpecialChars(internationalNumber));
        this.router.navigate(['..', getPeerNumberWOSpecialChars(internationalNumber)], {
            relativeTo: this.activatedRoute,
        });
    }

    onVoiceMail() {
        this.callingService.voiceMail();
        this.router.navigate(['..', this.userService.user.multiLine], {
            relativeTo: this.activatedRoute,
        });
    }

    onNumberChanged(n: string) {
        this.activeNumber$.next(n);
    }
    getContacts(): void {
        this.contacts = [];
        this.peers$.subscribe(peers => {
            this.contacts.push(peers);
            if (this.contacts.length === 2) {
                this.contacts.shift();
            }
        });
    }

    isNumberExists(phone: any, internationalNumber: any) {
        const peer = this.contacts.filter(x => x.multiLine === phone).length;

        if (peer > 0) {
            this.updateContact(phone, internationalNumber);
        } else {
            if (this.contacts.length > 0) {
                for (let i = 0; i < this.contacts[0].length; i++) {
                    const peer = this.contacts[0][i];
                    let count = peer.contact.phones.filter(x => x.phone == phone);

                    if (count.length > 0) {
                        this.updateContact(phone, internationalNumber);
                    }
                }
            }
        }
    }

    async updateContact(phone: any, internationalNumber: any) {
        sessionStorage.setItem('operator', 'call');
        const contact = await this.dbContext.contact.updateContactForNumberFormat(phone, getPeerNumberWOSpecialChars(internationalNumber));
        if (contact !== null) {
            const id = contact.id;
            this.store.dispatch(
                updateUserContact({ contact: { ...contact, id } })
            );
        }
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

    public getInternationalNumber(phone: string): string {
        try {
            let number = this.phoneUtil.parse('+' + phone, "");
            const countryName = this.getCountryIsoCode(number.getCountryCode(), number);
            //let code = this.phoneUtil.parse('+' + phone, countryName);
            let internationalNumber = this.phoneUtil.format(number, lpn.PhoneNumberFormat.INTERNATIONAL);
            console.log('International Number : ', internationalNumber);
            console.log('isValidNumber', this.phoneUtil.isValidNumber(number));
            console.log('isPossibleNumber', this.phoneUtil.isPossibleNumber(number));



            if (!this.phoneUtil.isPossibleNumber(number)) {
                let validNumber = this.phoneUtil.parse(this.uiContactSelectorInput + phone, this.uiContactSelectorCountryCode);
                internationalNumber = this.phoneUtil.format(validNumber, lpn.PhoneNumberFormat.INTERNATIONAL);
                //this.dbContext.contact.updateContactForNumberFormat(phone, internationalNumber);                
            } else {
                if (!this.phoneUtil.isValidNumber(number)) {
                    let validNumber = this.phoneUtil.parse(this.uiContactSelectorInput + phone, this.uiContactSelectorCountryCode);
                    internationalNumber = this.phoneUtil.format(validNumber, lpn.PhoneNumberFormat.INTERNATIONAL);
                    //this.dbContext.contact.updateContactForNumberFormat(phone, internationalNumber);
                }
            }

            if (internationalNumber != null) {
                return internationalNumber;
            }
        } catch (ex) {
            let validNumber = this.phoneUtil.parse(this.uiContactSelectorInput + phone, this.uiContactSelectorCountryCode);
            let internationalNumber = this.phoneUtil.format(validNumber, lpn.PhoneNumberFormat.INTERNATIONAL);
            console.log('International Number2 : ', internationalNumber);
            return internationalNumber;
        }

        return phone;
    }
}

