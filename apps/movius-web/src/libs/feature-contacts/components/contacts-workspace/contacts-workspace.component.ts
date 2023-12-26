import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { ActivatedRoute, NavigationEnd, Router } from '@angular/router';
import { Contact } from '@movius/domain';
import { MSGraphService } from '@movius/msgraph';
import { Store } from '@ngrx/store';
import { equals, isEmpty, sortBy, uniqWith } from 'lodash/fp';
import { BehaviorSubject, combineLatest, Observable, of } from 'rxjs';
import {
    debounceTime,
    distinctUntilChanged,
    filter,
    map,
    skipWhile,
    startWith,
    switchMap,
    take,
    tap,
    withLatestFrom
} from 'rxjs/operators';
import { selectCallingHistoryHash } from '../../../feature-calling';
import {
    GeneralFailureType,
    mapFromMsGraphPerson,
    selectIsMsGraphSyncEnabled,
    getContactFriendlyName,
    selectIsMsGraphSyncOff,
    selectTransportStatus,
    SipUserService,
    AuthService,
    cleanPhoneNumber,
} from '../../../shared';
import { selectContactGhosts, selectContacts } from '../../../feature-contacts';
import { SipService } from '@scalio/sip';
import { UserContact } from '../../models';
import { selectContactsState } from '../../ngrx';
import { frequentlyUsedFilter as getFrequentlyUsedContacts } from './get-frequently-used-contacts';

import { PeerCallingState } from '../../../feature-calling/models';


import {
    selectPeersCallingStates,
} from '../../../feature-calling/ngrx';

//TODO: CB30Jul2021: TECH-DEBT: Refactor to use shared search funtion filterNameOrPhone in shared/filter-utils
const filterContactsSingleWord = (contacts: Contact[], search: string) => {
    if (search) {
        const search1 = search.toLowerCase();
        const search2 = search1.replace(/^\+/, '');
        console.log('contacts length during filter', contacts?.length);
        return contacts.filter(
            (f) =>
                f.firstName?.trim().toLowerCase().startsWith(search1) ||
                f.lastName?.trim().toLowerCase().startsWith(search1) ||
                (f.firstName?.trim() + ' ' + f.lastName?.trim())?.trim()?.toLowerCase()?.includes(search1) ||
                f.phones.some((m) => {
                    const phone = cleanPhoneNumber(m?.phone);
                    const filtSearch = cleanPhoneNumber(search2);
                    return phone?.includes(filtSearch);
                })
        );
    } else {
        return contacts;
    }
};


const filterContacts = (contacts: Contact[], search: string) => {
    if (!search) {
        return contacts;
    } else {
        const terms = (search || '').split(' ').filter((f) => !!f);
        if (terms.length > 1) {
            // return filterContactsDoubleWord(contacts, terms[0], terms[1]);
            return filterContactsSingleWord(contacts, search);
        } else {
            return filterContactsSingleWord(contacts, search);
        }
    }
};

export interface ContactsWorkspaceView {
    privateContacts: Contact[];
    frequentlyUsedContacts: Contact[];
    galContacts: Contact[];
    isContactsEmpty: boolean;
    isSearchBarActivated: boolean;
    showSyncContactsPlaceholder: boolean;
    generalFailure?: string;
    generalFailureType?: GeneralFailureType;
    viewPortHeights: {
        privateContacts: number;
        frequentlyUsedContacts: number;
        galContacts: number;
    };
}

const sortContact = (contact: Contact) => {
    const fullName = [contact.firstName !== null ? contact.firstName?.trim() : contact.firstName,
    contact.lastName !== null ? contact.lastName?.trim() : contact.lastName].join(' ');
    return fullName.toLowerCase().trim() || 'zzzzzzzzzzzzzzzzzzz';
};

const calcScreenHeight = () => {
    return ("innerHeight" in window
        ? window.innerHeight
        : document.documentElement.offsetHeight);
}

const calcSectionHeight = (elementsCount: number) => {
    return elementsCount * 64;
}

const calcMultiSectionHeight = (screen: number, totalLength: number, sectionCount: number) => {
    const elemsHeight = calcSectionHeight(totalLength);
    return elemsHeight > screen ? screen / sectionCount : elemsHeight;
}

const calcViewportHeight = (privLength: number, galLength: number, freqLength: number) => {
    const screenHeight = calcScreenHeight();
    if (privLength > 0 && galLength > 0 && freqLength > 0) {
        return calcMultiSectionHeight(screenHeight, privLength + galLength + freqLength, 3);
    } else if (privLength > 0 && galLength > 0 && freqLength === 0) {
        return calcMultiSectionHeight(screenHeight, privLength + galLength, 2);
    } else if (privLength > 0 && galLength === 0 && freqLength > 0) {
        return calcMultiSectionHeight(screenHeight, privLength + freqLength, 2);
    } else if (privLength > 0 && galLength === 0 && freqLength === 0) {
        return calcMultiSectionHeight(screenHeight, privLength, 1);
    } else if (privLength === 0 && galLength > 0 && freqLength > 0) {
        return calcMultiSectionHeight(screenHeight, galLength + freqLength, 2);
    } else if (privLength === 0 && galLength > 0 && freqLength === 0) {
        return calcMultiSectionHeight(screenHeight, galLength, 1);
    } else if (privLength === 0 && galLength === 0 && freqLength > 0) {
        return calcMultiSectionHeight(screenHeight, freqLength, 1);
    } else {
        return calcMultiSectionHeight(screenHeight, screenHeight, 1);
    }
}

@Component({
    selector: 'movius-web-contacts-workspace',
    templateUrl: './contacts-workspace.component.html',
    styleUrls: ['./contacts-workspace.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ContactsWorkspaceComponent implements OnInit {
    private readonly isSearchBarActivated$ = new BehaviorSubject(false);
    private readonly search$ = new BehaviorSubject<string>(null);
    readonly view$: Observable<ContactsWorkspaceView>;
    readonly peers$: Observable<UserContact[]>;
    isContactSync: boolean;

    isSearchMode = false;
    isOnlyExchangeContacts = true;
    exchangeContactsCount = 0;
    allContactsCount = 0;
    getConnectionErrorValue: any;
    cachedGalContacts = {};
    freqindex: any = null;
    galCntIndex: any = null;

    constructor(
        private readonly activatedRoute: ActivatedRoute,
        private readonly router: Router,
        store: Store,
        private readonly msGraphService: MSGraphService,
        sipService: SipService
    ) {
        this.peers$ = store.select(selectContactGhosts(sipService.getUserUri));
        const callingHistory$ = store.select(selectCallingHistoryHash);

        const state$ = store.select(selectContactsState);

        const contacts$ = state$.pipe(
            map(({ contacts }) => sortBy(sortContact, Object.values(contacts)))
        );

        const frequentlyUsedContacts$ = combineLatest([
            callingHistory$,
            contacts$,
        ]).pipe(
            map(([callingHistory, contacts]) =>
                getFrequentlyUsedContacts(callingHistory, contacts)
            )
        );

        // const isMsGraphSyncEnabled$ = store.select(selectIsMsGraphSyncEnabled);
        const isMsGraphSyncEnabled$ = of(true);
        const galSearch$ = new BehaviorSubject([]);
        // const galSearch$ = combineLatest([
        //     this.search$.pipe(debounceTime(500)),
        //     isMsGraphSyncEnabled$,
        // ]).pipe(
        //     switchMap(([term, isMsGraphSyncEnabled]) =>
        //         term && isMsGraphSyncEnabled
        //             ? this.getGalContacts(term).catch(() => [])
        //             : of([])
        //     )
        // );
        this.search$.pipe(
            debounceTime(400),
            distinctUntilChanged()
        ).subscribe(term =>{
            let regExp = /^\D+$/g; // allow non digit searh only
            let canSearch = regExp.test(term);
            if(canSearch && term && term.length > 1){
                const cachedTerm = term.slice(0, 2);
                if(!this.cachedGalContacts[cachedTerm]){
                    this.getGalContacts(cachedTerm).then(val =>{
                        this.cachedGalContacts[cachedTerm] = val;
                        galSearch$.next(val);
                    }).catch(() => galSearch$.next([]))
                }else{
                    galSearch$.next(this.cachedGalContacts[cachedTerm]);
                }
                
            } else{
                galSearch$.next([])
            }
        })

        const isNewContactRouter$ = router.events.pipe(
            filter((f) => f instanceof NavigationEnd),
            map((m: NavigationEnd) => {
                return ['/add', '/new'].some((e) => m.url.includes(e));
            }),
            startWith(['/add', '/new'].some((e) => router.url.includes(e)))
        );

        const showSyncContactsPlaceholder$ = combineLatest([
            contacts$,
            isNewContactRouter$,
            store.select(selectIsMsGraphSyncOff),
        ]).pipe(
            map(
                ([contacts, isNewContactRouter, isMsGraphSyncOff]) =>
                    !isMsGraphSyncOff &&
                    !isNewContactRouter &&
                    contacts.length === 0
            ),
            distinctUntilChanged()
        );

        const transportStatus$ = store.select(selectTransportStatus);

        // TODO : wtf with types ?
        this.view$ = (combineLatest as any)([
            contacts$,
            frequentlyUsedContacts$,
            this.search$,
            galSearch$,
            this.isSearchBarActivated$,
            showSyncContactsPlaceholder$,
            transportStatus$,
        ]).pipe(
            distinctUntilChanged(equals),
            map(
                ([
                    privateContacts,
                    frequentlyUsedContacts,
                    search,
                    galContacts,
                    isSearchBarActivated,
                    showSyncContactsPlaceholder,
                    transportStatus,
                ]) => {
                    //TODO: CB:09Mar2021 - TECH: Refactor - use unified filter-utils.
                    const filteredPrivateContacts = filterContacts(
                        privateContacts,
                        search
                    );
                    const filteredFrequentlyUsedContacts = filterContacts(
                        frequentlyUsedContacts,
                        search
                    );
                    const isContactsEmpty =
                        filteredPrivateContacts.length === 0 &&
                        filteredFrequentlyUsedContacts.length === 0 &&
                        galContacts.length === 0;
                    const filteredGalContacts = galContacts.length ? filterContacts(
                        galContacts,
                        search
                    ) : [];

                    privateContacts = [...filteredFrequentlyUsedContacts, ...filteredGalContacts, ...filteredPrivateContacts]
                    if(filteredFrequentlyUsedContacts.length >= 1){
                        this.freqindex = 0
                    }

                    if(this.freqindex == null){
                        this.galCntIndex = 0
                    } else {
                        this.galCntIndex = filteredFrequentlyUsedContacts.length;
                    }
    
                    const res = {
                        privateContacts: privateContacts,
                        freqindex: this.freqindex,
                        galCntIndex: this.galCntIndex,
                        freqContactsLength: filteredFrequentlyUsedContacts.length,
                        galContactsLength: filteredGalContacts.length,
                        frequentlyUsedContacts: filteredFrequentlyUsedContacts,
                        galContacts: filteredGalContacts,
                        isContactsEmpty,
                        isSearchBarActivated,
                        showSyncContactsPlaceholder,
                        generalFailure:
                            this.getTransportStatus(transportStatus),
                        generalFailureType: (transportStatus == 'disconnected'
                            ? 'NoConnection'
                            : 'Common') as GeneralFailureType,
                        viewPortHeights: (() => {
                            const privateLength = filteredPrivateContacts.length;
                            const galLength = galContacts.length;
                            const freqLength = filteredFrequentlyUsedContacts.length;
                            const maxHeight = calcViewportHeight(
                                privateLength,
                                freqLength,
                                galLength
                            );
                            const privateHeight = calcSectionHeight(privateLength);
                            const galHeight = calcSectionHeight(galLength);
                            const freqHeight = calcSectionHeight(freqLength);
                            return {
                                privateContacts: privateHeight >= maxHeight ? maxHeight : privateHeight,
                                frequentlyUsedContacts: freqHeight >= maxHeight ? maxHeight : freqHeight,
                                galContacts: galHeight >= maxHeight ? maxHeight : galHeight,

                            }
                        })(),
                    } as ContactsWorkspaceView;
                    return res;
                }
            )
        );

        if (!activatedRoute.snapshot.firstChild) {
            // open first contact automatically
            state$
                .pipe(
                    skipWhile(
                        (state) =>
                            !(
                                state.status.kind === 'StateStatusLoaded' ||
                                (state.status.kind === 'StateStatusInitial' &&
                                    !isEmpty(state.contacts))
                            )
                    ),
                    take(1),
                    withLatestFrom(contacts$)
                )
                .subscribe(([_, contacts]) => {
                    if (contacts.length > 0) {
                        router.navigate(['.', contacts[0].id], {
                            relativeTo: activatedRoute,
                        });
                    } else {
                        router.navigate(['.', 'sync'], {
                            relativeTo: activatedRoute,
                        });
                    }
                });
        }




        const ongoingSessions$ = store
            .select(selectPeersCallingStates(sipService.getUserUri))
            .pipe(
                map((sessions) =>
                    sessions.filter(
                        (f) =>
                            (f.active || []).length > 0 &&
                            (f.active[0].kind === 'OngoingActiveCall' ||
                                f.active[0].kind === 'SuspendedActiveCall')
                    )
                ),
                tap(console.log)
            ) as Observable<PeerCallingState[]>;


        ongoingSessions$.subscribe(ongoingSessions => {
            if (ongoingSessions.length != 0) {
                sessionStorage.setItem('call_is_active', 'true');
            } else {
                sessionStorage.setItem('call_is_active', 'false');
            }
        });

    }

    async ngOnInit() {
        this.isContactSync = false;
        this.peers$.subscribe(peers => {
            if (peers.length > 0) {
                this.isContactSync = true;
            }
        });
    }

    getTransportStatus(transportStatus: string) {
        let status = ''
        return status;
    }

    public getConnectionError(event: any) {
        this.getConnectionErrorValue = event;
    }

    updateSearch(searchTerm: string) {
        this.search$.next(searchTerm);
    }

    trackByContact(_, contact: UserContact) {
        return contact.multiLine;
    }

    private getGalContacts = (term: string) => {
        if (term && term.length >= 2) {
            return this.msGraphService.getPeople(term).then((res) => {
                const sorted = sortBy(
                    sortContact,
                    res.map(mapFromMsGraphPerson)
                );
                console.log('sorted gal contacts', res.length);
                const sortedAndLocalFiltered = filterContacts(sorted, term);
                return sortedAndLocalFiltered;
            });
        } else {
            return Promise.resolve([]);
        }
    };

    onSearchBarIsActivatedChanged(isActivated: boolean) {
        this.isSearchBarActivated$.next(isActivated);
    }

    onContactClicked(contact: Contact) {
        this.router.navigate(['.', contact.id || contact.msGraphId], {
            relativeTo: this.activatedRoute,
            state: { contact },
        });
    }

    getContactFriendlyName = getContactFriendlyName;
}
