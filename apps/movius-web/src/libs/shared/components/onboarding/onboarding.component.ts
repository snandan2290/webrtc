import {
    ChangeDetectionStrategy,
    ChangeDetectorRef,
    Component,
    Input,
    OnInit,
    ViewContainerRef,
} from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Address } from '@movius/domain';
import { Actions, ofType } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import { findIndex } from 'lodash/fp';
import { NzModalRef, NzModalService } from 'ng-zorro-antd/modal';
import { BehaviorSubject, Observable, combineLatest } from 'rxjs';
import { take } from 'rxjs/operators';
import { map } from 'rxjs/operators';
import {
    importFromMsGraphFails,
    importFromMsGraphSuccess,
} from '../../../feature-contacts/ngrx/actions';
import { loginMsGraph, loginMsGraphFails, logout, setE911Address, setGDPRStatusAccepted } from '../../ngrx';
import {
    AuthService,
    CustomNzModalService,
    DataService,
    SipUserService,
    UserDataAccessService,
} from '../../services';
import { FormModel, getAddressString, getFeatureEnabled } from '../../utils';

import {
    selectGDPRIsAccepted,
    selectProfile
} from '../../../shared';

import { AuthDataAccessService } from '../../services/auth.data-access.service';
import { E911TermsConditionComponent } from '../../../feature-settings/components/e911-terms-condition/e911-terms-condition.component';
import { LoggerFactory } from '@movius/ts-logger';
const logger = LoggerFactory.getLogger("")

type OnboardingStates = 'GDPR' | 'addressPopup' | 'EmergencyData' | 'Address' | 'SyncExchange' | 'Final';

interface ExchangeSyncData {
    exchangeServerUrl: string;
}

export interface PrivacySettingsView {
    isAccepted: boolean;
    userEmail: string;
}

@Component({
    selector: 'movius-web-onboarding',
    templateUrl: './onboarding.component.html',
    styleUrls: ['./onboarding.component.scss', '../confirm-dialog/confirm-dialog.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OnboardingComponent implements OnInit {
    // Just ask confirm e911 address
    @Input() isStandalone = false;
    @Input() askE911Address = false;
    @Input() exchangeSyncDisabled = false;
    getConnectionErrorValue: any;

    readonly view$: Observable<PrivacySettingsView>;
    supportedStates: { [is911: string]: OnboardingStates[] } = {
        true: ['addressPopup', 'Address', 'SyncExchange', 'Final'],
        false: ['GDPR', 'addressPopup', 'SyncExchange', 'Final'],
    };

    currentOnboardingStep: OnboardingStates;
    //CB 10Dec2020: YAGNI: Infer count from OnboardingStates type in case of need.
    currentOnboardingStepNumber: number;
    totalOnboardingSteps: number;

    emergencyForm: FormGroup;
    exchangeSyncForm: FormGroup;
    public firstTimeLogin: boolean = false;
    public formLoadFlag: boolean = false;
    nextDisabled$ = new BehaviorSubject(false);
    availableAddresses: Address[] = [];
    selectedAddress: Address;
    isAcceptedE911 = false;
    syncMsGraphInProgress = false;
    errorMessage: string = null;

    submitted = false;
    appEmbededStatus: string;

    constructor(
        private readonly _formBuilder: FormBuilder,
        private readonly _modal: NzModalRef,
        private readonly store: Store,
        private readonly userService: UserDataAccessService,
        private readonly sipUser: SipUserService,
        private readonly cdr: ChangeDetectorRef,
        private readonly actions: Actions,
        public readonly dataService: DataService,
        private readonly nzModalService: CustomNzModalService,
        private readonly authDataService: AuthDataAccessService,
        private readonly authService: AuthService,
        private viewContainerRef: ViewContainerRef,
        private readonly modalService: NzModalService,
    ) {
        const emergencyModel: FormModel<Address> = {
            firstName: ['', [Validators.required, Validators.maxLength(53)]],
            lastName: ['', [Validators.required, Validators.maxLength(52)]],
            houseNumber: ['', [Validators.required, Validators.maxLength(10)]],
            street: ['', [Validators.required, Validators.maxLength(95)]],
            street2: ['', [, Validators.maxLength(95)]],
            city: ['', [Validators.required, Validators.maxLength(35)]],
            postal: ['', [Validators.required, Validators.maxLength(5)]],
            state: ['', [Validators.required, Validators.maxLength(2)]],
            country: ['US', [Validators.required]],
        };

        const exchangeSyncModel: FormModel<ExchangeSyncData> = {
            exchangeServerUrl: ['', [Validators.required, Validators.email]],
        };

        this.emergencyForm = this._formBuilder.group(emergencyModel);
        this.exchangeSyncForm = this._formBuilder.group(exchangeSyncModel);

        this.view$ = combineLatest([
            store.select(selectGDPRIsAccepted),
            store.select(selectProfile),
        ]).pipe(
            map(([isAccepted, profile]) => ({
                isAccepted,
                userEmail: profile.email,
            }))
        );

        this.appEmbededStatus = getFeatureEnabled();
    }

    ngOnInit(): void {
        this.authDataService.freshOnboardUserDataPass.subscribe((data) => {
            if (data === true) {
                this.setStep('GDPR');
            } else if(sessionStorage.getItem('ssoToken') == null ) {
                logger.debug('came to onboarding sync exchange after onboarding process done');
                this.setStep('SyncExchange');
            } else if (localStorage.getItem('contactSync') != 'true' && sessionStorage.getItem('ssoToken') != null ) {
                logger.debug('Sync not done and sso token is present');
                this.onSyncExchange();
                this.setStep('SyncExchange');
            }
        });

        if (this.askE911Address) {
            this.setStep('addressPopup');
        } else if(sessionStorage.getItem('ssoToken') == null) {
            this.setStep('SyncExchange');
        }

        //wtf ?
        this.totalOnboardingSteps = this.supportedStates[
            this.askE911Address.toString()
        ].length;

        this.authDataService.themeupdate.subscribe(res=>{
            this.cdr.markForCheck();
            this.cdr.detectChanges();
        })
    }

    get emergencyFormControl() {
        return this.emergencyForm.controls;
    }

    ngAfterViewInit(): void {
        if (document.querySelector('nz-select input[autocomplete]')) {
            document.querySelector('nz-select input[autocomplete]').setAttribute('autocomplete', 'disabled');
        }
    }

    destroyModal(isPositive: boolean = true) {
        this._modal.close(isPositive);
    }

    async onNext() {
        this.errorMessage = null;
        switch (this.currentOnboardingStep) {
            case 'GDPR': {
                this.firstTimeLogin = false;
                this.setStep('addressPopup');
            }
            case 'addressPopup': {
                if (this.emergencyForm.valid) {
                    this.nextDisabled$.next(true);
                    const val: Address = this.emergencyForm.value;
                    try {
                        const address = val;
                        const addresses = await this.userService
                            .e911GetAddressesList(address)
                            .toPromise();

                        if (addresses === 'found') {
                            this.store.dispatch(
                                setE911Address({
                                    address,
                                    requireUpdate: false,
                                })
                            );
                            if (this.isStandalone) {
                                this.destroyModal();
                            } else {
                                if(sessionStorage.getItem('ssoToken') != null){
                                    logger.debug('Auto sync');
                                    this.onSyncExchange();
                                    this.setStep('SyncExchange');
                                } else {
                                    this.setStep('SyncExchange');
                                }
                            }
                        } else {
                            this.availableAddresses = addresses;
                            this.selectedAddress = this.availableAddresses[0];
                            this.setStep('Address');
                        }
                    } catch (err) {
                        this.errorMessage = err.error;

                        if (err.status === 500 || this.getConnectionErrorValue == true) {
                            this.errorMessage = 'Internet connection error';
                        } else {
                            this.errorMessage = 'Unit/Apt Number/Street Number not recognized (Do not include street name).';
                        }


                    } finally {
                        this.nextDisabled$.next(false);
                        this.cdr.markForCheck();
                    }
                    break;
                } else {
                    if (this.formLoadFlag) {
                        this.submitted = true;
                    }
                }
                this.formLoadFlag = true;
            }
            case 'EmergencyData': {
                if (this.emergencyForm.invalid) {
                    Object.keys(this.emergencyForm.controls).forEach((key) =>
                        this.emergencyForm.controls[key].markAsDirty()
                    );
                    return;
                }
                this.nextDisabled$.next(true);
                const val: Address = this.emergencyForm.value;
                try {
                    const address = val;
                    const addresses = await this.userService
                        .e911GetAddressesList(address)
                        .toPromise();
                    if (addresses === 'found') {
                        this.store.dispatch(
                            setE911Address({
                                address,
                                requireUpdate: false,
                            })
                        );
                        if (this.isStandalone) {
                            this.destroyModal();
                        } else {
                            this.setStep('SyncExchange');
                           }
                    } else {
                        this.availableAddresses = addresses;
                        this.selectedAddress = this.availableAddresses[0];
                        this.setStep('Address');
                    }
                } catch (err) {
                    this.errorMessage = err.error;
                } finally {
                    this.nextDisabled$.next(false);
                    this.cdr.markForCheck();
                }
                break;
            }
            case 'Address': {
                this.store.dispatch(
                    setE911Address({
                        address: this.selectedAddress,
                        requireUpdate: true,
                    })
                );
                if (this.isStandalone) {
                    this.destroyModal();
                } else {
                    if (this.exchangeSyncDisabled) {
                        this.destroyModal();
                    } else {
                        this.firstTimeLogin = true;
                        logger.debug('came to first time login condition');
                        if(sessionStorage.getItem('ssoToken') == null){
                            this.setStep('SyncExchange');
                        } else if(sessionStorage.getItem('ssoToken') != null){
                            logger.debug('came to first time login sso not null condition');
                            this.onSyncExchange();
                            this.setStep('SyncExchange');
                        }

                    }
                }
                break;
            }
            default: {
                this.destroyModal();
            }
        }
    }

    onSelectAddress(item: Address) {
        this.selectedAddress = item;
    }

    onE911TermsClicked() {
        if ( this.appEmbededStatus === 'messaging') {
            this.modalService.create({
                nzContent: E911TermsConditionComponent,
                nzWidth: '46rem',
                nzFooter: null,
                nzKeyboard: false,
                nzViewContainerRef: this.viewContainerRef,
                nzMaskClosable: false,
                nzStyle: {
                    top: '40px',
                    height: '350px',
                },
            });
        } else {
            const win = window.open(
                window.location.origin + '/login/e911_tandc',
                '_blank'
            );
            win.focus();
        }
    }

    async onSyncExchange() {
        this.syncMsGraphInProgress = true;
        // TODO : handle error
        const waiter$ = this.actions.pipe(
            ofType(
                importFromMsGraphSuccess,
                importFromMsGraphFails,
                loginMsGraphFails
            ),
            take(1)
        );
        this.store.dispatch(loginMsGraph());
        const result = await waiter$.toPromise();
        if (result.type !== '[Contacts] Import From MsGraph Success') {
            this.errorMessage = 'Exchange Contacts Sync Failed';
            logger.debug('sync contacts error', result);
            this.syncMsGraphInProgress = false;
            this.cdr.markForCheck();
        } else {
            this.syncMsGraphInProgress = false;
            localStorage.setItem('contactSync','true');
            this.onNext();
            this.cdr.markForCheck();
        }
    }

    private setStep(step: OnboardingStates) {
        this.currentOnboardingStep = step;
        this.setStepNumber(step);
    }

    private setStepNumber(step: OnboardingStates) {
        const states = this.supportedStates[this.askE911Address.toString()];
        const stepNumber = findIndex((o) => o === step, states);
        this.currentOnboardingStepNumber = stepNumber + 1;
    }

    public onApply(isAccepted = true) {
        if (!this.askE911Address) {
            if (this.exchangeSyncDisabled) {
                this.setStep('Final');
            } else {
                this.setStep('SyncExchange');
               }
        } else {
            this.setStep('addressPopup');
            this.userService.gdprUpdate(true).subscribe((data) => {
                this.store.dispatch(setGDPRStatusAccepted({ isAccepted }));
            });
            this.onNext();
        }
    }

    public onCancel(){
        sessionStorage.clear();
        this.store.dispatch(logout());
    }

    public getConnectionError(event: any) {
        this.getConnectionErrorValue = event;
    }

    isTeamsSSO (): boolean {
        if (sessionStorage.getItem("isLogingViaTeams") === "true") {
            return true;
        } else {
            return false
        }
    }

    GetTheme(){
        let theme = localStorage.getItem("Theme")
        return theme ? "Dark" : null
    }

    getAddressString = getAddressString;
}
