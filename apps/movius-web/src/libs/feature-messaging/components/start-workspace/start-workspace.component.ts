import {
    ChangeDetectionStrategy,
    ChangeDetectorRef,
    Component,
    OnInit,
    ViewChild,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { SipService } from '@scalio/sip';
import { Observable } from 'rxjs';
import {
    selectContactGhosts,
    updateUserContact,
} from '../../../feature-contacts';
import { UserContactGhost } from '../../../feature-contacts/models';
import {
    AuthService,
    DbContext,
    sortParticipantsAsID,
    ContactSelectedValue,
    getPeerNumberWOSpecialChars,
    isEmergencyNumber,
    PhoneNumberService,
    SipUserService,
} from '../../../shared';
import { MessagingService } from '../../services';
import { MessageFormComponent } from '../message-form/message-form.component';
import * as lpn from 'google-libphonenumber';
import { Country } from '../../../shared/components/country-selector/model/country.model';
import { CountryCode } from '../../../shared/components/country-selector/model/country-code';
import { PeerChatSession } from '../../models';
import { MMSService } from '../../services/mms.service';
import { LoggerFactory } from '@movius/ts-logger';
const logger = LoggerFactory.getLogger('');

@Component({
    selector: 'movius-web-start-workspace',
    templateUrl: './start-workspace.component.html',
    styleUrls: ['./start-workspace.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StartWorkspaceComponent implements OnInit {
    @ViewChild(MessageFormComponent) messageForm: MessageFormComponent;
    selectedContact: ContactSelectedValue;
    readonly peers$: Observable<UserContactGhost[]>;
    allCountries: Array<Country> = [];
    phoneUtil: any = lpn.PhoneNumberUtil.getInstance();
    uiContactSelectorInput: string;
    uiContactSelectorCountryCode: string;
    routerString: string;
    public validatioSpecialCharcs: any;
    selectedGroupContacts: ContactSelectedValue[];
    isGroupMessageCreated: boolean;
    multiline: string;
    user: any;
    urlList: any;
    isEditParticipants: string;
    emergencyNumber: string;
    conferenceNumberErrorMsg: string;
    isGroupMessageEnabled: any;
    isMobileDevice: Boolean = false;
    picMsgeventCancelled: boolean;
    private _emergencyNumbers: string[] = [
        '119',
        '129',
        '17',
        '911',
        '112',
        '113',
        '102',
        '000',
        '999',
        '211',
        '117',
        '110',
        '122',
        '190',
        '993',
        '132',
        '133',
        '123',
        '111',
        '106',
        '11',
        '101',
        '991',
        '1730',
        '22',
        '191',
        '114',
        '199',
        '100',
        '130',
        '103',
        '193',
        '997',
        '18',
        '66',
        '902',
        '1011',
        '118',
        '0000',
        '15',
        '105',
        '995',
        '10111',
        '115',
        '197',
        '155',
        '903',
        '901',
        '192',
        '194',
        '108',
    ];
    showErrorMsg: boolean;
    selfDestinationError: string;
    invalidDataError: string;
    contacts: any;
    imageBlobData: any;
    getDisplayImagesSelectedValue: boolean;
    chatWorkspaceService: any;
    messageError: any;
    msgFrmErr: any;
    composeMessageType: any;
    teamsLocationEnabled: boolean;

    constructor(
        private readonly router: Router,
        private readonly messagingService: MessagingService,
        private readonly activatedRoute: ActivatedRoute,
        private readonly cdr: ChangeDetectorRef,
        private readonly store: Store,
        private readonly sipService: SipService,
        private sipUserService: SipUserService,
        private countryCodeData: CountryCode,
        private phoneNumberService: PhoneNumberService,
        private readonly dbContext: DbContext,
        private readonly authService: AuthService,
        private mmsService: MMSService
    ) {
        this.isMobileDevice = ((sessionStorage.getItem('Contex_res')?.toLowerCase() === "ios") || (sessionStorage.getItem('Contex_res')?.toLowerCase() === "android"))
            ? true : false;
        this.peers$ = store.select(selectContactGhosts(sipService.getUserUri));
        this.urlList = this.router.url.split('/');
        this.isEditParticipants = this.urlList[this.urlList.length - 2];
        this.routerString = '/messaging/chat/';
        this.getDisplayImagesSelectedValue = false;
        this.authService.onComposeMessageTypeSelected.subscribe((type) => {
            this.composeMessageType = type;
        });
        this.messagingService.isTeamsLocationEnabled.subscribe((res: any) => {
            this.teamsLocationEnabled = res;
        });
    }

    ngOnInit(): void {
        this.getContacts();
        this.getCountries();
        const userInfo = this.sipUserService.user;
        this.uiContactSelectorInput = this.phoneNumberService.getUserCountryCode(
            userInfo
        );
        this.uiContactSelectorCountryCode = this.phoneNumberService.getUserCountryName(
            userInfo
        );
        this.isGroupMessageEnabled = JSON.parse(
            this.authService.checkGroupMsgEnable
        );
        this.mmsService.updatePreviewImageCancelStatus(true);
    }

    checkIsNumberValid(): string {
        for (let i = 0; i < this.selectedGroupContacts.length; i++) {
            if (
                this._emergencyNumbers.indexOf(
                    this.selectedGroupContacts[i].multiline
                ) !== -1
            ) {
                return this.selectedGroupContacts[i].multiline;
            }
        }
        return null;
    }

    setMsgFormError(event) {
        this.msgFrmErr = event;
    }

    processContactChanged(value) {
        sessionStorage.setItem('participants', null);
        if (value.length > 1) {
            this.selectedGroupContacts = value;
            this.multiline = this.selectedGroupContacts[
                this.selectedGroupContacts.length - 1
            ].multiline;
            this.isGroupMessageCreated = true;
        } else if (value.length == 1) {
            this.selectedGroupContacts = value;
            this.multiline = this.selectedGroupContacts[0].multiline;
            // this.selectedContact = value;
            this.isGroupMessageCreated = false;
        }
        this.selectedContact = value;
        if (this.multiline === '911') {
            (sessionStorage.getItem("_USER_E911_STATUS_").includes('disabled') || 
            sessionStorage.getItem("location_permission") != 'granted' || 
            this.teamsLocationEnabled === false || 
            this.composeMessageType == 'whatsapp') ? 
            this.emergencyNumber =
                value.length === 0
                    ? null
                    : 'Your text session with 911 could not be connected. Please call 911 for assistance.' : null;
        } else {
            this.emergencyNumber =
                value.length === 0
                    ? null
                    : "'" +
                      this.checkIsNumberValid() +
                      "' is invalid. Please enter the phone number with a valid country code.";
        }
        this.validatioSpecialCharcs =
            value.length === 0
                ? null
                : "'" +
                  value[value.length - 1].multiline +
                  "' " +
                  'is invalid. Please enter the phone number with a valid country code (e.g. For U.S: 1xxxxxxxxxx).';

        if (value.length === 0) {
            this.conferenceNumberErrorMsg = null;
            this.selfDestinationError = null;
            this.validatioSpecialCharcs = null;
            this.invalidDataError = null;
            this.multiline = value;
        } else {
            this.invalidDataError = 'Contact does not exist.';
            this.selfDestinationError =
                'You cannot send message to your number.';
            this.conferenceNumberErrorMsg =
                'You cannot send message to a conference number.';
            if (
                this.isGroupMessageEnabled === true &&
                this.isGroupMessageCreated === true
            ) {
                this.conferenceNumberErrorMsg =
                    'You cannot add Conference Number to group.';
            }
        }
        setTimeout(() => {
            this.cdr.detectChanges();
        }, 0);
    }

    async onSendMessage(message: string, file?: File) {
        sessionStorage.setItem('participants', null);
        this.user = sessionStorage.getItem('__api_identity__');

        if (this.isGroupMessageCreated === true) {
            let numbers = '';
            const participantsList = [];

            for (let i = 0; i < this.selectedGroupContacts.length; i++) {
                participantsList.push(
                    getPeerNumberWOSpecialChars(
                        this.selectedGroupContacts[i].multiline
                    )
                );
            }
            participantsList.push(this.user);
            const participantListRemovingDup = [...new Set(participantsList)];
            let sortParticipants = [];
            sortParticipants = participantListRemovingDup.sort(
                (a, b) => 0 - (a > b ? -1 : 1)
            );
            for (let i = 0; i < sortParticipants.length; i++) {
                if (i === 0) {
                    numbers = sortParticipants[i];
                } else {
                    numbers = numbers + '|' + sortParticipants[i];
                }
            }

            sessionStorage.setItem('participants', numbers);
            const groupParticipants = numbers;
            const participants = groupParticipants.split('|');
            const allNumbers = sortParticipantsAsID(participants);

            this.dbContext.message.addParticipants(
                allNumbers,
                groupParticipants,
                ''
            );
            sessionStorage.setItem(
                allNumbers,
                JSON.stringify(groupParticipants)
            );

            if (this.selectedGroupContacts[0].peer) {

                let session = {
                    peer: {},
                };
                session.peer['id'] = allNumbers;
                session['participants'] =  participantsList;
                session.peer['multiLineUri'] = this.sipService.getUserUri(
                    this.selectedGroupContacts[0].peer.uri
                );

                if (file) {
                    this.messagingService.sendMultimediaMessage(session, file);
                } else {
                    this.messagingService.sendMessage(
                        this.selectedGroupContacts[0].peer.uri,
                        message,
                        session
                    );
                }
                this.router.navigate([this.routerString, allNumbers], {
                    relativeTo: this.activatedRoute,
                });
            } else {
                let session = {
                    peer: {},
                };
                session.peer['id'] = allNumbers;
                session['participants'] =  participantsList;
                session.peer['multiLineUri'] = this.sipService.getUserUri(
                    this.selectedGroupContacts[0].multiline
                );
                if (file) {
                    this.picMsgeventCancelled = true;
                    this.messagingService.sendMultimediaMessage(session, file);
                    this.getDisplayImagesSelectedValue = false;
                } else {
                    this.messagingService.startUnknownMultilineSession(
                        this.selectedGroupContacts[0].multiline,
                        message,
                        session
                    );
                }
                this.router.navigate([this.routerString, allNumbers], {
                    relativeTo: this.activatedRoute,
                });
            }
        } else {
            let internationalNumber = '';
            if (isEmergencyNumber(this.selectedGroupContacts[0].multiline)) {
                internationalNumber = this.selectedGroupContacts[0].multiline;
            } else {
                if (!this.selectedGroupContacts[0].multiline.startsWith('+')) {
                    //internationalNumber = this.getInternationalNumber('8054336693');
                    internationalNumber = getPeerNumberWOSpecialChars(
                        this.getInternationalNumber(
                            this.selectedGroupContacts[0].multiline
                        )
                    );
                } else {
                    internationalNumber = this.selectedGroupContacts[0]
                        .multiline;
                }
                //this.isNumberExists(this.selectedGroupContacts[0].multiline, internationalNumber);
            }
            if (internationalNumber) {
                if (this.selectedGroupContacts[0].peer) {
                    if (file) {
                        let session = {
                            peer: {},
                        };
                        session.peer['id'] = internationalNumber;
                        session.peer[
                            'multiLineUri'
                        ] = this.sipService.getUserUri(
                            this.selectedGroupContacts[0].peer.uri
                        );
                        this.messagingService.sendMultimediaMessage(
                            session,
                            file
                        );
                    } else {
                        this.messagingService.sendMessage(
                            this.selectedGroupContacts[0].peer.uri,
                            message
                        );
                    }
                    this.router.navigate(
                        [this.routerString, getPeerNumberWOSpecialChars(internationalNumber)],
                        {
                            relativeTo: this.activatedRoute,
                        }
                    );
                } else {
                    let session = {
                        peer: {},
                    };
                    session.peer['id'] = internationalNumber;
                    session.peer[
                        'multiLineUri'
                    ] = this.sipService.getUserUri(internationalNumber);

                    if (file) {

                        this.messagingService.sendMultimediaMessage(
                            session,
                            file
                        );
                    } else {
                        this.messagingService.startUnknownMultilineSession(
                            internationalNumber,
                            message,
                            session
                        );
                    }
                    this.router.navigate(
                        [this.routerString, getPeerNumberWOSpecialChars(internationalNumber)],
                        {
                            relativeTo: this.activatedRoute,
                        }
                    );
                }
            }
        }
    }

    getContacts(): void {
        this.contacts = [];
        this.peers$.subscribe((peers) => {
            this.contacts.push(peers);
            if (this.contacts.length === 2) {
                this.contacts.shift();
            }
        });
    }

    isNumberExists(phone: any, internationalNumber: any) {
        const peer = this.contacts.filter((x) => x.multiLine === phone).length;

        if (peer > 0) {
            this.updateContact(phone, internationalNumber);
        } else {
            if (this.contacts.length > 0) {
                for (let i = 0; i < this.contacts[0].length; i++) {
                    const peer = this.contacts[0][i];
                    let count = peer.contact.phones.filter(
                        (x) => x.phone == phone
                    );

                    if (count.length > 0) {
                        this.updateContact(phone, internationalNumber);
                    }
                }
            }
        }
    }

    async updateContact(phone: any, internationalNumber: any) {
        sessionStorage.setItem('operator', 'call');
        const contact = await this.dbContext.contact.updateContactForNumberFormat(
            phone,
            getPeerNumberWOSpecialChars(internationalNumber)
        );
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
            let number = this.phoneUtil.parse('+' + phone, '');
            const countryName = this.getCountryIsoCode(
                number.getCountryCode(),
                number
            );
            //let code = this.phoneUtil.parse('+' + phone, countryName);
            let internationalNumber = this.phoneUtil.format(
                number,
                lpn.PhoneNumberFormat.INTERNATIONAL
            );
            console.log('International Number : ', internationalNumber);
            console.log('isValidNumber', this.phoneUtil.isValidNumber(number));
            console.log(
                'isPossibleNumber',
                this.phoneUtil.isPossibleNumber(number)
            );

            if (!this.phoneUtil.isPossibleNumber(number)) {
                let validNumber = this.phoneUtil.parse(
                    this.uiContactSelectorInput + phone,
                    this.uiContactSelectorCountryCode
                );
                internationalNumber = this.phoneUtil.format(
                    validNumber,
                    lpn.PhoneNumberFormat.INTERNATIONAL
                );
                //this.dbContext.contact.updateContactForNumberFormat(phone, internationalNumber);
            } else {
                if (!this.phoneUtil.isValidNumber(number)) {
                    let validNumber = this.phoneUtil.parse(
                        this.uiContactSelectorInput + phone,
                        this.uiContactSelectorCountryCode
                    );
                    internationalNumber = this.phoneUtil.format(
                        validNumber,
                        lpn.PhoneNumberFormat.INTERNATIONAL
                    );
                    //this.dbContext.contact.updateContactForNumberFormat(phone, internationalNumber);
                }
            }

            if (internationalNumber != null) {
                return internationalNumber;
            }
        } catch (ex) {
            let validNumber = this.phoneUtil.parse(
                this.uiContactSelectorInput + phone,
                this.uiContactSelectorCountryCode
            );
            let internationalNumber = this.phoneUtil.format(
                validNumber,
                lpn.PhoneNumberFormat.INTERNATIONAL
            );
            console.log('International Number2 : ', internationalNumber);
            return internationalNumber;
        }

        return phone;
    }

    public fetchBlobURL({ blobUrl, file }) {
        this.getDisplayImagesSelectedValue = true;
        this.imageBlobData = {
            blobUrl,
            file,
        };
    }

    onSendMedia(media: File) {
        this.picMsgeventCancelled = true;
        this.onSendMessage('Image', media);
    }

    public getDisplayImagesSelectedStatus(event: any) {
        this.getDisplayImagesSelectedValue = event;
    }

    public imagePreviewCancelStatus() {
        this.mmsService.previewImageCancelStatus.subscribe((status) => {
            this.getDisplayImagesSelectedValue = status;
            this.picMsgeventCancelled = this.getDisplayImagesSelectedValue;
        });
    }

    showHelpText() {
        return `Press 'Enter' after entering each phone number`;
    }
}
