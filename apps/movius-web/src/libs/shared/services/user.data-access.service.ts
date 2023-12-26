import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Store } from '@ngrx/store';
import { format } from 'date-fns';
import { Observable, of, throwError } from 'rxjs';
import { map, mapTo, retryWhen, switchMap } from 'rxjs/operators';
import { Address, Profile } from '../models';
import { AuthService } from './auth.service';
import { GetStatusE911DTO } from './dto';
import { SipUserService } from './sip-user.service';
import { GeoHttpService, selectAddress } from '../../shared';
import { I, L } from '@angular/cdk/keycodes';

export type E911Status = 'not_init' | 'accepted' | 'declined' | 'unknown';

const cleanAddrString = (str: string | null) =>
    !str || str === 'null' ? null : str;

@Injectable({ providedIn: 'root' })
export class UserDataAccessService {
    constructor(
        private readonly authService: AuthService,
        private http: HttpClient,
        private readonly sipUserService: SipUserService,
        private readonly geohttpService: GeoHttpService,
        private readonly store: Store
    ) {
    }

    loadProfile(): Observable<Profile> {
        // TODO:
        return of(JSON.parse(localStorage.getItem('__user_profile__')));
    }

    saveProfile(profile: Profile): Observable<Profile> {
        // TODO:
        localStorage.setItem('__user_profile__', JSON.stringify(profile));
        return of(profile);
    }

    private getSubscriberId() {
        //return this.sipUserService.sipUser.uri;
        const mlNumber = this.sipUserService.user.multiLine;
        // TODO : This should be fixed on backend
        return `sip:${mlNumber}@moviuscorp.net`; // Hardcoding the default E911 domain for MOVIUS
    }

    e911LookupSubscriber(): Observable<Address> {
        const fname = 'e911LookupSubscriber';
        const apiName = this.authService.apiName;
        const apiIdentity = this.authService.apiIdentity;
        const apiToken = this.authService.apiToken;

        const content = encodeURIComponent(
            `<QrySubscrRqst xmlns="http://lis.telecomsys.com/prov"><RqstId>6</RqstId><SubscriberID>${this.getSubscriberId()}</SubscriberID></QrySubscrRqst>`
        );
        const body = `user_info=${content}`;
        const url = `mml/accounts/${apiName}/${apiIdentity}/lookup_e911_subscriber?api_token=${apiToken}`;
        // return this.http
        //     .post<any>(url, body, {
        //         headers: { 'Content-Type': 'text/plain' },
        //     })
        return this.geohttpService.callADKRtnResp(url, "post", body, null)
            .pipe(
                switchMap((res) => {
                    const notFound =
                        res.root.desc['prov:QrySubscrResp']['prov:NotFound'];
                    if (notFound === '') {
                        console.warn(
                            'Address lookup is not found, this is unexpected, reject e911 for current user now'
                        );
                        return throwError({ message: 'Address Not Found' }); //this.e911Reject().pipe(mapTo(null));
                        // return of(null);
                    }
                    const subscriber =
                        res.root.desc['prov:QrySubscrResp']['prov:Subscriber'];
                    if (!subscriber) {
                        return throwError({ message: 'Subscriber not found' }); //this.e911Reject().pipe(mapTo(null));
                    }
                    const invalidAddress = subscriber['prov:LocStatus']['prov:VDBinvalid']
                    if (invalidAddress) {
                        let errorMessage = invalidAddress['prov:Message']
                        const addrAlt = invalidAddress['prov:VDBalternative'];
                        if (addrAlt) {
                            console.log(fname, ":::", "Show the suggested alternative address")
                            const addr = addrAlt['urn:civicAddress'];
                            const subscrName = subscriber['prov:SubscrName'];
                            const flName = subscrName ? subscrName.split(' ') : [];
                            console.log(fname, ":: Returning the alternative address suggested");
                            console.log(fname, ":: address::", addr);
                            return of({
                                firstName: flName[0],
                                lastName: flName[1],
                                street: cleanAddrString(addr['urn:RD']),
                                street2: cleanAddrString(addr['urn:LOC']),
                                city: cleanAddrString(addr['urn:PCN']),
                                postal: cleanAddrString(addr['urn:PC']),
                                state: cleanAddrString(addr['urn:A1']),
                                country: cleanAddrString(addr['urn:country']),
                                houseNumber: cleanAddrString(addr['urn:HNO']),
                                houseNumberSuffix: cleanAddrString(addr['urn:HNS']),
                            } as Address);
                        } else {
                            let addr;
                            const address$ = this.store.select(selectAddress).pipe(map((address) => address))
                            address$.subscribe(address => {
                                addr = address;
                            })
                            console.log(fname, '::: Address::', addr);
                            if (!addr) {
                                console.log(fname, ":: Reuturning the address available in App");
                                return of({
                                    firstName: addr.firstName,
                                    lastName: addr.lastName,
                                    street: cleanAddrString(addr.street),
                                    street2: cleanAddrString(addr.street2),
                                    city: cleanAddrString(addr.city),
                                    postal: cleanAddrString(addr.postal),
                                    state: cleanAddrString(addr.state),
                                    country: cleanAddrString(addr.country),
                                    houseNumber: cleanAddrString(addr.houseNumber),
                                    houseNumberSuffix: cleanAddrString(addr.houseNumberSuffix),
                                } as Address);
                            } else {
                                console.log(fname, ":: Neither got alternate address suggestion nor found the address in APP")
                                return throwError({ message: errorMessage });
                            }
                        }
                    }
                    console.log(fname, ":::", "Returning the address got from API");
                    const addr = subscriber.Location.civicAddress;
                    console.log(fname, "::address::", addr);
                    const subscrName = subscriber['prov:SubscrName'];
                    const flName = subscrName ? subscrName.split(' ') : [];
                    return of({
                        firstName: flName[0],
                        lastName: flName[1],
                        street: cleanAddrString(addr.RD),
                        street2: cleanAddrString(addr.LOC),
                        city: cleanAddrString(addr.PCN),
                        postal: cleanAddrString(addr.PC),
                        state: cleanAddrString(addr.A1),
                        country: cleanAddrString(addr.country),
                        houseNumber: cleanAddrString(addr.HNO),
                        houseNumberSuffix: cleanAddrString(addr.HNS),
                    } as Address);
                })
            );
    }

    e911GetAddressesList(address: Address): Observable<Address[] | 'found'> {
        const apiName = this.authService.apiName;
        const apiIdentity = this.authService.apiIdentity;
        const apiToken = this.authService.apiToken;
        const fullName = [address.firstName, address.lastName].join(' ');
        const cbn = this.sipUserService.user.multiLine.replace(/^1/, '');
        // const streetParts = this.splitStreetAddress(address.street);
        const content = encodeURIComponent(
            `<AddSubscrRqst xmlns='http://lis.telecomsys.com/prov'><RqstId>7</RqstId><SubscriberID>${this.getSubscriberId()}</SubscriberID><SubscrName>${fullName}</SubscrName><CBN>${cbn}</CBN><Location><civicAddress xmlns='urn:ietf:params:xml:ns:pidf:geopriv10:civicAddr'><country>${address.country
            }</country><A1>${address.state}</A1><RD>${address.street
            }</RD><HNO>${address.houseNumber || ''}</HNO><HNS>${address.houseNumberSuffix || ''
            }</HNS><LOC>${address.street2}</LOC><PC>${address.postal
            }</PC><PCN>${address.city
            }</PCN></civicAddress></Location></AddSubscrRqst>`
        );
        const body = `user_info=${content}`;
        const url = `mml/accounts/${apiName}/${apiIdentity}/add_e911_subscriber?api_token=${apiToken}`;
        // return this.http
        //     .post<any>(url, body, {
        //         headers: { 'Content-Type': 'text/plain' },
        //     })
        const headers = { 'Content-Type': 'text/plain' }
        return this.geohttpService.callADKRtnResp(url, 'post', body, headers)
            .pipe(
                switchMap((res) => {
                    const resp = res.root.desc['prov:AddSubscrResp'];
                    const locStatus = resp && resp['prov:LocStatus'];
                    const vbValid = locStatus && locStatus['prov:VDBvalid'];
                    const vbInvalid = locStatus && locStatus['prov:VDBinvalid'];
                    if (vbValid) {
                        return of('found' as 'found');
                    } else if (resp && resp['prov:Error']) {
                        return throwError({
                            error: resp['prov:Error']['_'],
                        });
                    } else if (locStatus && locStatus['prov:VDBerror']) {
                        return throwError({
                            error: locStatus['prov:VDBerror'],
                        });
                    } else if (vbInvalid && vbInvalid['prov:VDBalternative']) {
                        const alt = vbInvalid['prov:VDBalternative'];
                        const err = (Array.isArray(alt) ? alt : [alt]).map(
                            (m) => {
                                const addr = m['urn:civicAddress'];
                                return {
                                    firstName: address.firstName,
                                    lastName: address.lastName,
                                    street: cleanAddrString(addr['urn:RD']),
                                    street2: cleanAddrString(addr['urn:LOC']),
                                    city: cleanAddrString(addr['urn:PCN']),
                                    postal: cleanAddrString(addr['urn:PC']),
                                    state: cleanAddrString(addr['urn:A1']),
                                    country: cleanAddrString(
                                        addr['urn:country']
                                    ),
                                    houseNumber: cleanAddrString(
                                        addr['urn:HNO']
                                    ),
                                    houseNumberSuffix: cleanAddrString(
                                        addr['urn:HNS']
                                    ),
                                } as Address;
                            }
                        );
                        return of(err);
                    } else if (vbInvalid && vbInvalid['prov:Message']) {
                        const msg = vbInvalid['prov:Message'];
                        return throwError({ error: msg });
                    } else {
                        return throwError({ error: 'Unknown error' });
                    }
                })
            );
    }

    e911UpdateSubscriber(address: Address): Observable<void> {
        const apiName = this.authService.apiName;
        const apiIdentity = this.authService.apiIdentity;
        const apiToken = this.authService.apiToken;
        const fullName = [address.firstName, address.lastName].join(' ');
        const cbn = this.sipUserService.user.multiLine.replace(/^1/, '');
        const content = encodeURIComponent(
            `<AddSubscrRqst xmlns='http://lis.telecomsys.com/prov'><RqstId>7</RqstId><SubscriberID>${this.getSubscriberId()}</SubscriberID><SubscrName>${fullName}</SubscrName><CBN>${cbn}</CBN><Location><civicAddress xmlns='urn:ietf:params:xml:ns:pidf:geopriv10:civicAddr'><country>${address.country
            }</country><A1>${address.state}</A1><RD>${address.street
            }</RD><HNO>${address.houseNumber || ''}</HNO><HNS>${address.houseNumberSuffix || ''
            }</HNS><LOC>${address.street2}</LOC><PC>${address.postal
            }</PC><PCN>${address.city
            }</PCN></civicAddress></Location></AddSubscrRqst>`
        );
        const body = `user_info=${content}`;
        const url = `mml/accounts/${apiName}/${apiIdentity}/add_e911_subscriber?api_token=${apiToken}`;
        // return this.http.post<any>(url, body, {
        //     headers: { 'Content-Type': 'text/plain' },
        // });
        const headers = { 'Content-Type': 'text/plain' }
        return this.geohttpService.callADKRtnResp(url, "post", body, headers);
    }

    private e911SetStatus(status: 'accepted' | 'rejected') {
        const apiName = this.authService.apiName;
        const apiIdentity = this.authService.apiIdentity;
        const apiToken = this.authService.apiToken;
        const date = format(new Date(), 'yyyy-mm-dd hh:mm:ss');
        const flag = status === 'accepted' ? 1 : 2;
        const url = `mml/accounts/${apiName}/${apiIdentity}/set_status_e911?api_token=${apiToken}&e911_status=${flag}&e911_status_updated_at=${date}`;
        // return this.http.get(
        //     url
        // );
        return this.geohttpService.callADK(url, "get", null, null);
    }

    e911Accept() {
        return this.e911SetStatus('accepted');
    }

    e911Reject() {
        return this.e911SetStatus('rejected');
    }

    e911GetStatus(): Observable<E911Status> {
        const apiName = this.authService.apiName;
        const apiIdentity = this.authService.apiIdentity;
        const apiToken = this.authService.apiToken;
        const url = `mml/accounts/${apiName}/${apiIdentity}/get_status_e911?api_token=${apiToken}`
        // return this.http
        //     .get<GetStatusE911DTO>(
        //         url
        //     )
        return this.geohttpService.callADKRtnResp(url, "get", null, null)
            .pipe(
                map((res) => {
                    switch (res.root.e911_status) {
                        case '0':
                            return 'not_init';
                        case '1':
                            return 'accepted';
                        case '2':
                            return 'declined';
                        case '3':
                            return 'unknown';
                    }
                })
            );
    }

    gdprUpdate(isEnabled: boolean) {
        const apiName = this.authService.apiName;
        const apiIdentity = this.authService.apiIdentity;
        const apiToken = this.authService.apiToken;
        const date = format(new Date(), 'yyyy-MM-dd hh:mm:ss');
        // return this.http.post(
        //     `mml/accounts/${apiName}/${apiIdentity}/gdpr_update?api_token=${apiToken}&gdpr_suspended=${!isEnabled}&gdpr_suspended_timestamp=${date}`,
        //     {}
        // );
        sessionStorage.setItem('gdprstatus', isEnabled.toString());
        const url = `mml/accounts/${apiName}/${apiIdentity}/gdpr_update?api_token=${apiToken}&gdpr_suspended=${!isEnabled}&gdpr_suspended_timestamp=${date}`
        return this.geohttpService.callADKRtnResp(url, "post", {}, {});
    }

    getE911Terms() {
        const apiName = this.authService.apiName;
        const apiIdentity = this.authService.apiIdentity;
        const apiToken = this.authService.apiToken;
        const url = `mml/accounts/${apiName}/${apiIdentity}/e911_terms?api_token=${apiToken}&ver=1`
        // return this.http.get(
        //     url,
        //     {responseType: 'text'}
        // );
        return this.geohttpService.callADK(url, "get", null, null)

    }

    getGDPRTerms(apiName?: string) {
        apiName = apiName || this.authService.apiName;
        const url = `mml/accounts/${apiName}/login/tandc?ver=1`;
        // return this.http.get(url, {responseType: 'text'});
        return this.geohttpService.callADK(url, "get", null, null);
    }
}
