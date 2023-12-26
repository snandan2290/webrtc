import {
    ChangeDetectionStrategy,
    Component,
    OnDestroy,
    OnInit,
} from '@angular/core';
import { FormGroup } from '@angular/forms';
import { Store } from '@ngrx/store';
import { BehaviorSubject, combineLatest, Observable, of, Subject } from 'rxjs';
import { map, switchMap, tap, withLatestFrom } from 'rxjs/operators';
import {
    Address,
    selectAddress,
    selectFeatures,
    setE911AddressAccepted,
    UserDataAccessService,
} from '../../../../shared';

export interface E911SettingsView {
    isEdit: boolean;
    address: Address;
    isE911Available: boolean;
}

@Component({
    selector: 'movius-web-e911-settings-workspace',
    templateUrl: './e911-settings-workspace.component.html',
    styleUrls: ['./e911-settings-workspace.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class E911SettingsWorkspaceComponent implements OnInit, OnDestroy {
    private readonly destroy$ = new Subject();
    private readonly isEdit$ = new BehaviorSubject(false);
    readonly view$: Observable<E911SettingsView>;

    addressForm: FormGroup;

    constructor(
        private readonly store: Store,
        userDataAccess: UserDataAccessService
    ) {
        const e911Status$ = store
            .select(selectFeatures)
            .pipe(map((features) => features.e911Status));
        const address$ = store.select(selectAddress).pipe(
            withLatestFrom(e911Status$),
            switchMap(([address, e911Status]) =>
                address
                    ? of(address)
                    : e911Status === 'enabled_accepted'
                    ? userDataAccess
                          .e911LookupSubscriber()
                          .pipe(
                              tap((address) =>
                                  store.dispatch(
                                      setE911AddressAccepted({ address })
                                  )
                              )
                          )
                    : of(null)
            )
        );
        this.view$ = combineLatest([
            this.isEdit$,
            address$,
            store.select(selectFeatures),
        ]).pipe(
            map(([isEdit, address, features]) => ({
                address,
                isEdit,
                isE911Available:
                    features.e911Status === 'enabled_accepted' ||
                    features.e911Status === 'enabled_declined',
            }))
        );
    }

    ngOnInit(): void {}

    ngOnDestroy() {
        this.destroy$.next();
    }

    onCancel() {
        this.isEdit$.next(false);
    }

    onEdit() {
        this.isEdit$.next(true);
    }

    onUpdated(address: Address) {
        this.store.dispatch(setE911AddressAccepted({ address }));
        this.isEdit$.next(false);
    }
}
