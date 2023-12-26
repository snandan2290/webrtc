import { COMMA, ENTER } from '@angular/cdk/keycodes';
import { ActivatedRoute, Router } from '@angular/router';
import { Component, ElementRef, EventEmitter, Input, OnInit, OnChanges, Output, ViewChild, } from '@angular/core';
import { FormControl } from '@angular/forms';
import { MatAutocompleteSelectedEvent, MatAutocomplete, MatAutocompleteTrigger } from '@angular/material/autocomplete';
import { MatChipInputEvent } from '@angular/material/chips';
import { Observable, of } from 'rxjs';
import { map, startWith } from 'rxjs/operators';
import { UserContactGhost } from '../../../feature-contacts';
import { sendCustomerOptInRequest, startCreateUserContact } from '../../../feature-contacts/ngrx/actions';
import {
  getPeerNumberWOSpecialChars,
  ContactSelectedValue,
  allowedSpecialCharacters,
  checkCCodeInNumber,
  mapFromMsGraphPerson,
  selectUserId,
  cleanPhoneNumber,
  getContactRealNumber,
  DbContext,
  AuthService,
  PhoneNumberService,
  SipUserService,
  getFeatureEnabled,
  addPulsToMultilineNumber,
  getChannelTypeForLineWechatDetails,
  getInternationalNumber,
  DataService,
} from '../../../shared';
import { Subject } from 'rxjs';
import {
  debounceTime, distinctUntilChanged, takeUntil,
} from 'rxjs/operators';
import { sortBy, uniqBy } from 'lodash/fp';
import { Contact, NewContact } from '@movius/domain';
import { MSGraphService } from '@movius/msgraph';
import { Store } from '@ngrx/store';
import { selectHash, selectPeersMessages } from '../../../feature-messaging/ngrx/selectors';
import { AuthDataAccessService } from '../../../shared/services/auth.data-access.service';
import * as lpn from 'google-libphonenumber';
import { Country } from '../../../shared/components/country-selector/model/country.model';
import { CountryCode } from '../../../shared/components/country-selector/model/country-code';
import { MessagingService } from '../../services';
import { SipService } from '@scalio/sip';
import { NzModalService } from 'ng-zorro-antd/modal';
import { OptInWhatsappTemplateComponent } from '../../../feature-messaging/components/optIn-whatsapp-template/optIn-whatsapp-template.component';
import { LoggerFactory } from '@movius/ts-logger';
import { location } from '@microsoft/teams-js';
const logger = LoggerFactory.getLogger("")
// import { selectHash } from '../../../feature-messaging/ngrx/selectors';

const sortContact = (contact: ContactIntf) => {
  const fullName = [contact.firstName !== null ? contact.firstName?.trim() : contact.firstName,
  contact.lastName !== null ? contact.lastName?.trim() : contact.lastName].join(' ');
  return fullName.toLowerCase().trim() || 'zzzzzzzzzzzzzzzzzzz';
};

const sortGalContact = (contact: Contact) => {
  const fullName = [contact.firstName !== null ? contact.firstName?.trim() : contact.firstName,
  contact.lastName !== null ? contact.lastName?.trim() : contact.lastName].join(' ');
  return fullName.toLowerCase().trim() || 'zzzzzzzzzzzzzzzzzzz';
};

const cleanPhone = (phone: string) => {
  return phone?.replace(/\D+/g, '');
}

interface ContactIntf {
  ContactName: string;
  ContactNumber: string;
  firstName: string;
  lastName: string;
  img:string;
}

interface locationInfo {
  latitude: number;
  longitude: number;
  accuracy: number;
}

/**
 * @title Chips Autocomplete
 */
@Component({
  selector: 'movius-web-message-contact-selector',
  templateUrl: './message-contact-selector.component.html',
  styleUrls: ['./message-contact-selector.component.scss'],
})
export class MessageContactSelectorComponent implements OnInit, OnChanges {
  @ViewChild('autocompleteTrigger', { read: MatAutocompleteTrigger })
  autoTrigger: MatAutocompleteTrigger;
  @Input() contacts: UserContactGhost[];
  galContatcs: ContactIntf[];
  galContatcsLocal: UserContactGhost[];
  visible = true;
  selectable = true;
  removable = true;
  separatorKeysCodes: number[] = [ENTER, COMMA];
  contactCtrl = new FormControl();
  filteredContacts: Observable<ContactIntf[]>;
  isTeamsMessageOnly: boolean;
  participantCount = 0;
  userContactsI: ContactIntf[] = [];
  contactarry: ContactIntf[] = [];
  // opened = false;
  @ViewChild('contactInput') contactInput: ElementRef<HTMLInputElement>;
  @ViewChild('auto') matAutocomplete: MatAutocomplete;
  @ViewChild('autocompleteTrigger') matACTrigger: MatAutocompleteTrigger;
  @Output() changed = new EventEmitter<ContactSelectedValue[] | null>();
  @Output() msgFormError = new EventEmitter();
  deBouncer$: Subject<ContactSelectedValue[] | null> = new Subject<ContactSelectedValue[] | null>();
  galContats$: Subject<ContactIntf[] | null> = new Subject<ContactIntf[] | null>();
  galContatsLocalCopy$: Subject<UserContactGhost[] | null> = new Subject<UserContactGhost[] | null>();
  lclContats$: Subject<ContactIntf[] | null> = new Subject<ContactIntf[] | null>();
  destroy$ = new Subject();
  selectedGroupContacts: ContactSelectedValue[] = [];
  urlList: any;
  participantsList: any;
  apiUserIdentity: any;
  routerString: string;
  participantLimit: any;
  isGroupMessageEnabled: any;
  isGalContactFlag : boolean = false;
  locationInfo: locationInfo;

  private _emergencyNumbers: string[] = [
    "119", "129", "17", "911", "112", "113", "102", "000", "999", "211",
    "117", "110", "122", "190", "993", "132", "133", "123", "111", "106",
    "11", "101", "991", "1730", "22", "191", "114", "199", "100", "130",
    "103", "193", "997", "18", "66", "902", "1011", "118", "0000", "15",
    "105", "995", "10111", "115", "197", "155", "903", "901", "192", "194", "108"
  ];
  private allowedCharcs: string[] = [
    '-', '+', '(', ')', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9', ',', ' '
  ];
  firstName: any;
  lastName: any;
  isPreviousNumberValid = 0;
  lastFilter: string = '';
  showMatOptions: boolean = false;
  lclContats: ContactIntf[] = [];
  prevFilter: string = "";
  userId$: Observable<string>;
  userId: string;
  galContactsCalledAfterRefreshingToken: boolean = false;
  composeMessageType: any;
  hashedRecords: any  = [];
  optInYesPeerIdValue: any;
  uiContactSelectorInput: string;
  uiContactSelectorCountryCode: string;
  allCountries: Array<Country> = [];
  phoneUtil: any = lpn.PhoneNumberUtil.getInstance();
  urlId: any;
  isMobileDevice: boolean;
  loadFirstThreadMsg: string;
  peerMessages: any;
  messagingThreadList:any = [];
  participantsTriggerdCount: number = 0;

  constructor(
    private readonly router: Router,
    private readonly authService: AuthService,
    private readonly msGraphService: MSGraphService,
    private readonly store: Store,
    private readonly dbContext: DbContext,
    private readonly authDataAccess: AuthDataAccessService,
    private countryCodeData: CountryCode,
    private sipUserService: SipUserService,
    private phoneNumberService: PhoneNumberService,
    private activatedRoute: ActivatedRoute,
    private messagingService: MessagingService,
    private readonly modalService: NzModalService,
    sipService: SipService,
    private dataService : DataService,
  ) {

    this.store.select(selectHash).subscribe((res => {
      this.hashedRecords = res;
    }))
    this.firstName = null;
    this.lastName = null;
    this.apiUserIdentity = sessionStorage.getItem('__api_identity__');
    localStorage.setItem('selectedGroup', '');

    const peerMessages$ = store
            .select(selectPeersMessages(sipService.getUserUri))
            .pipe(
                map((m) => m.filter((f) => f.messages.length > 0)),
                //map((m) => uniqBy((x) => x.peer.multiLine, m))
            );
        peerMessages$.subscribe((peers) => {
            if (peers.length > 0) {
              this.peerMessages = peers;
                if (peers[0].messageChannelType != 'normalMsg') {
                  this.loadFirstThreadMsg = peers[0].threadId;
                } else {
                  this.loadFirstThreadMsg = peers[0].peerId;
                }
            }
        });

    this.deBouncer$
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        takeUntil(this.destroy$)
      )
      .subscribe((value) => {
        this.changed.emit(value)
      });
    this.isTeamsMessageOnly = getFeatureEnabled() === 'messaging' && sessionStorage.getItem("isLogingViaTeams") === "true";
    //getFeatureEnabled() !== "messaging" ? this.getNavigatorPermission() : null;
    // this.isTeamsMessageOnly = true; Enable when testing SSO locally

    this.userId$ = this.store.select(selectUserId);
    this.userId$.subscribe(userid => {
      this.userId = userid;
    })
    this.authService.onComposeMessageTypeSelected.subscribe(type => {
      this.composeMessageType = type;
    })
    this.authService.onComposeMsgPeerIdValue.subscribe(id => {
      this.optInYesPeerIdValue = id;
    })

    this.isMobileDevice = ((sessionStorage.getItem('Contex_res')?.toLowerCase() === "ios") || (sessionStorage.getItem('Contex_res')?.toLowerCase() === "android"))
    ? true : false;
  }

  ngOnInit(): void {
    this.isGroupMessageEnabled = JSON.parse(this.authService.checkGroupMsgEnable);
    this.participantLimit = JSON.parse(this.authService.maxGroupParticpants);
    this.editGroupParticipants();
    this.getOptInPeerIdRequest();
    //this.getContacts();
    //getCountries();
    const userInfo = this.sipUserService.user;
    this.uiContactSelectorInput = this.phoneNumberService.getUserCountryCode(userInfo);
    this.uiContactSelectorCountryCode = this.phoneNumberService.getUserCountryName(userInfo);
  }

  ngOnChanges() {
    this.urlId = this.activatedRoute.params['_value']['id']
    this.authService.onComposeRedirectData.subscribe(data => {
      if (!this.isTeamsMessageOnly) {
        this.userContactsI.splice(0, this.userContactsI.length)
        if (data == true) {
          this.contactCtrl.reset();
          this.participantCount = 0;
        }
      }
    });
  }

  ngDoCheck() {
    this.onClickFilterContacts();
  }

  ngAfterViewInit(): void {

    this.authService.onComposeRedirectData.subscribe(data => {
      if(this.userContactsI.length <= 1) {
        this.contactInput.nativeElement.value = '';
        this.contactCtrl.reset();
        this.userContactsI = [];
      }
    });

    this.closeAutocompleteOn();
    let event: any = {
      value : '',
      contactName: '',
      firstName: '',
      lastName: '',

    }
    this.messagingService.isGalContact.subscribe((res: any) => {
      if (res) {
        let id = this.activatedRoute?.snapshot?.queryParamMap?.get('id');
        this.participantCount = 0;
        if (id) {
          this.isGalContactFlag = true;
          // this.contactInput.nativeElement.value = id;
          event = {
            value : id,
            contactName: this.activatedRoute?.snapshot?.queryParamMap?.get('name'),
            firstName: this.activatedRoute?.snapshot?.queryParamMap?.get('firstName'),
            lastName: this.activatedRoute?.snapshot?.queryParamMap?.get('lastName'),

          }
          this.userContactsI.splice(0, this.userContactsI.length);
          this.composeMessageType = 'message'
          // this.addContact(event);
          this.onSelectedContact(null, event);
        }
      }
    });
    this.contactInput.nativeElement.focus();
    // this.onClickFilterContacts();
  }

  editGroupParticipants() {
    this.urlList = this.router.url.split('/')
    const isEditParticipants = this.urlList[this.urlList.length - 2];
    this.routerString = '/messaging/chat/';

    if (isEditParticipants === "edit") {
      this.userContactsI = [];
      this.participantsList = this.hashedRecords[this.urlId].participants
      if (this.participantsList != null && this.participantsList.length > 0) {
        for (let i = 0; i < this.participantsList.length; i++) {
          if (this.participantsList[i] !== this.apiUserIdentity) {
            this.participantCount += 1;
            const temp = this.getAllContactNames(this.participantsList[i]);
            this.userContactsI.push(temp);
          }
        }
      }
    }
  }

  backToList() {
    if (this.loadFirstThreadMsg) {
      this.router.navigate([`/messaging/chat/${this.loadFirstThreadMsg}`], {
        queryParams: { isFromBackBtn: 't' },
      });
    } else {
      this.router.navigate([`/messaging/chat/new`], {
        queryParams: { isFromBackBtn: 't' },
      });
    }
  }

  onClickFilterContacts() {
    if (this.contacts != null && this.contacts.length > 0) {
      if (this.contactarry.length === 0 || (this.contacts.length > this.contactarry.length)) {
        this.contactarry = [];
        for (let i = 0; i < this.contacts.length; i++) {
          this.contactarry.push({
            ContactName: this.contacts[i].name === null ? this.contacts[i].multiLine : this.contacts[i].name + '_' + this.contactarry.length,
            ContactNumber: getContactRealNumber(this.contacts[i]),
            firstName: this.contacts[i].firstName === null ? '' : this.contacts[i].firstName,
            lastName: this.contacts[i].lastName === null ? '' : this.contacts[i].lastName,
            img: this.contacts[i].img === null ? '' : this.contacts[i].img,
          })
        }
      }
    }

    this.filteredContacts = this.contactCtrl.valueChanges.pipe(
      startWith<string | ContactIntf[]>(''),
      map(value => typeof value === 'string' ? value : this.lastFilter),
      map(filter => this.filter(filter))
    );

    this.galContats$.subscribe((res) => {
      this.galContatcs = [];
      res?.forEach((cntct) => {
        var isInlclContats = this.lclContats.find(function (lclcntct) { return lclcntct.ContactNumber === cntct.ContactNumber }) !== undefined;
        // console.log(isInlclContats);
        if (!isInlclContats)
          this.galContatcs.push(cntct)
      })
      this.filteredContacts = of(sortBy(sortContact, [...this.galContatcs, ...this.lclContats]))
    });

    this.galContatsLocalCopy$.subscribe((res) => {
      this.galContatcsLocal = res
    })

    this.lclContats$.subscribe((res) => {
      res = res.filter((c) => {
        if (getChannelTypeForLineWechatDetails(c.ContactNumber) == 'Line') {
          return getChannelTypeForLineWechatDetails(c.ContactNumber) !== 'Line'
        } else if (getChannelTypeForLineWechatDetails(c.ContactNumber) == 'WeChat') {
          return getChannelTypeForLineWechatDetails(c.ContactNumber) !== 'WeChat'
        } else {
          return c;
        }
      })
      this.lclContats = res;
      this.filteredContacts = of(sortBy(sortContact, [...res, ...this.galContatcs || []]))
    })

  }

  getAllContactNames(fromNum: string): ContactIntf {
    let temp = {
      ContactName: '',
      ContactNumber: '',
      firstName: '',
      lastName: '',
      img: ''
    }
    const peer = this.contacts.filter((e) => e.multiLine === fromNum);
    if (peer.length > 0) {
      return temp = {
        ContactName: peer[0].firstName !== null || peer[0].lastName !== null ? fromNum : peer[0].firstName + " " + peer[0].lastName,
        ContactNumber: fromNum,
        firstName: peer[0].firstName === null ? '' : peer[0].firstName,
        lastName: peer[0].lastName === null ? '' : peer[0].lastName,
        img: peer[0].img === null ? '' : peer[0].img,
      }
    } else {
      let val = this.contacts.filter((element) => {
        return element.contact.phones.filter(function (item) {
          return item.phone === fromNum
        }).length != 0
      }).length != 0
      if (val === true) {
        for (let k = 0; k < this.contacts.length; k++) {
          if (this.contacts[k].contact.phones.filter((a) => a.phone === fromNum).length > 0) {
            return temp = {
              ContactName: this.contacts[k].firstName !== null || this.contacts[k].lastName !== null ? fromNum : this.contacts[k].firstName + " " + this.contacts[k].lastName,
              ContactNumber: fromNum,
              firstName: this.contacts[k].firstName === null ? '' : this.contacts[k].firstName,
              lastName: this.contacts[k].lastName === null ? '' : this.contacts[k].lastName,
              img: this.contacts[k].img === null ? '' : this.contacts[k].img
            }
          }
        }
      }
    }
    return temp = {
      ContactName: '',
      ContactNumber: fromNum,
      firstName: '',
      lastName: '',
      img: '',
    }
  }

  getPeerByName(fromName: string, contacts?: UserContactGhost[]): UserContactGhost {
    const peer = contacts.filter((e) => e.name.toLowerCase === fromName.toLowerCase);
    if (peer.length > 0) {
      return peer[0];
    } else {
      return null;
    }
  }

  getPeer(fromNum: string, contacts?: UserContactGhost[]): UserContactGhost {

    const onlyNumber = fromNum?.replace(/\D/g, '');

    //console.log('testtttt',contacts)
    this.filteredContacts.subscribe(e => {
      //console.log('testttttt', e)
    })
    if (contacts !== undefined) {
    }
    if (contacts === undefined) {
      contacts = [...this.contacts, ...this.galContatcsLocal || []]
    }
    const peer = contacts.filter((e) => e.multiLine === onlyNumber);
    if (peer.length > 0) {
      return peer[0];
    } else {
      let val = contacts.filter((element) => {
        return element.contact.phones.filter(function (item) {
          return item.phone === onlyNumber
        }).length != 0
      }).length != 0
      if (val === true) {
        for (let k = 0; k < this.contacts.length; k++) {
          if (contacts[k].contact.phones.filter((a) => a.phone === onlyNumber).length > 0) {
            return this.contacts[k]
          }
        }
      }
    }
    return null;
  }


  checkIsNumberValid(value: string): boolean {
    if (this._emergencyNumbers.indexOf(value) !== -1) {
      if(value === '911' && this.userContactsI.length == 0) {
        sessionStorage.setItem('is911Message', 'true');
        this.messagingService.is911Message.next(true);
        if(sessionStorage.getItem("_USER_E911_STATUS_") == 'enabled_accepted' && this.messagingService.locationDetails == undefined) {
          this.getUserLocation();
        }
      }
      else if(value != '911' && this.userContactsI.length == 0) {
        this.messagingService.setLocation(null);
      }
      return false;
    } else if ([',', ';', '#'].some((char) => value.includes(char))) {
      return false;
    } else if (this.apiUserIdentity === getPeerNumberWOSpecialChars(value)) {
      return false;
    } else if (allowedSpecialCharacters(value, this.allowedCharcs)) {
      return false;
    } else if (getChannelTypeForLineWechatDetails(value) == 'Line' || getChannelTypeForLineWechatDetails(value) == 'WeChat') {
      return false;
    } else if (value === null) {
      return false;
    }
    return true;
  }

  getSelectedContact(value: string, contacts: ContactIntf[]) {

    return contacts.filter(
      (contact) => {
        const underScoreIndex = contact.ContactName?.lastIndexOf("_");
        if (contact?.ContactName?.substring(0, underScoreIndex)?.toUpperCase() === value?.toUpperCase())
          return contact
      }
    )
  }

  async addContact(event: MatChipInputEvent): Promise<void> {
    const input = event.input;
    let value = getPeerNumberWOSpecialChars(event.value);
    if(event.value.startsWith('+')){
      value = '+' + value; 
    }
    this.selectedGroupContacts = [];
    const onlyNumbersRegex = /^[0-9]+$/;
    // Add our contact
    if (this.isGroupMessageEnabled === true && this.composeMessageType !== 'whatsapp') {
      if ((value || '').trim() && this.userContactsI.length < this.participantLimit - 1) {
        let existsInUserContacts = this.getSelectedContact(value, this.contactarry)
        if (existsInUserContacts.length === 0) {
          existsInUserContacts = this.getSelectedContact(value, (this.galContatcs || []))
          const peer = this.getPeerByName(value, (this.galContatcsLocal || []))
          if (peer !== null) {
            sessionStorage.setItem("addGalCnctViaMsging", "true");
            this.store.dispatch(startCreateUserContact({ contact: peer.contact }));
          }
        }
        if (existsInUserContacts.length === 1) {
          if (this.isPreviousNumberValid === 0) {
            const peerNumber = value;
            const existsinContacts = this.getSelectedContact(peerNumber, this.userContactsI)
            if (existsinContacts.length == 0) {
              if (existsInUserContacts.length === 1) {
                this.participantCount += 1;
                this.userContactsI.push({
                  ContactName: existsInUserContacts[0].ContactName,
                  ContactNumber: existsInUserContacts[0].ContactNumber,
                  firstName: existsInUserContacts[0].firstName,
                  lastName: existsInUserContacts[0].lastName,
                  img: existsInUserContacts[0].img,
                });
              } else {
                this.participantCount += 1;
                this.userContactsI.push({
                  ContactName: '',
                  ContactNumber: peerNumber.trim(),
                  firstName: '',
                  lastName: '',
                  img: '',
                })
              }
            }
          }
        } else if (this.checkIsNumberValid(value)) {
          if (this.isPreviousNumberValid === 0) {
            const peerNumber = value;
            if(peerNumber === '911' && this.userContactsI.length == 0) {
              sessionStorage.setItem('is911Message', 'true');
              this.messagingService.is911Message.next(true);
              /* if(sessionStorage.getItem("_USER_E911_STATUS_") == 'enabled_accepted') {
                this.getUserLocation();
              } */
            }
            else if(peerNumber != '911') {
              this.messagingService.setLocation(null);
            }
            if (peerNumber.match(onlyNumbersRegex)) {
              const existsinContacts = this.userContactsI.filter(
                (x) => {
                  if (x.ContactNumber === peerNumber)
                    return x
                })
              if (existsinContacts.length == 0) {
                const existsInUserContacts = this.contactarry.filter(
                  (x) => {
                    if (x.ContactNumber === peerNumber)
                      return x
                  }
                )
                if (existsInUserContacts.length === 1) {
                  this.participantCount += 1;
                  this.userContactsI.push({
                    ContactName: existsInUserContacts[0].ContactName,
                    ContactNumber: existsInUserContacts[0].ContactNumber,
                    firstName: existsInUserContacts[0].firstName,
                    lastName: existsInUserContacts[0].lastName,
                    img: existsInUserContacts[0].img
                  });
                } else {
                  if((!this.checkIsNumberValid(peerNumber) && this.userContactsI.length == 0)) {
                    this.participantCount += 1;
                    this.userContactsI.push({
                      ContactName: '',
                      ContactNumber: peerNumber.trim(),
                      firstName: '',
                      lastName: '',
                      img: '',
                    });
                    this.isPreviousNumberValid++;
                  }
                  else if (this.checkIsNumberValid(peerNumber) && this.isPreviousNumberValid === 0) {
                    this.participantCount += 1;
                    this.userContactsI.push({
                      ContactName: '',
                      ContactNumber: this.prefixCountryCodeToContactNumber(peerNumber.trim()),
                      //ContactNumber: peerNumber.trim(),
                      firstName: '',
                      lastName: '',
                      img: '',
                    });
                  }
                }
              }
            } else if (this.contacts.filter(contact => contact?.name?.indexOf(value) >= 0).length === 0) {
              this.participantCount += 1;
              this.userContactsI.push({
                ContactName: '',
                ContactNumber: value.trim(),
                firstName: '',
                lastName: '',
                img: '',
              })
              this.isPreviousNumberValid++;
            }
          }
        } else {
          if (this.isPreviousNumberValid === 0 && this.userContactsI.length == 0) {
            this.participantCount += 1;
            this.userContactsI.push({
              ContactName: '',
              ContactNumber: value.trim(),
              firstName: '',
              lastName: '',
              img: '',
            })
            // handeded use case for invalid number in gal contact
            this.isGalContactFlag === true ? this.isPreviousNumberValid = 0 : this.isPreviousNumberValid++;
          }
        }
      }
    } else {
      if ((value || '').trim() && this.userContactsI.length < 1) {
        let existsInUserContacts = this.getSelectedContact(value, this.contactarry)
        if (existsInUserContacts.length === 0) {
          existsInUserContacts = this.getSelectedContact(value, (this.galContatcs || []))
          const peer = this.getPeerByName(value, (this.galContatcsLocal || []))
          if (peer !== null) {
            sessionStorage.setItem("addGalCnctViaMsging", "true");
            this.store.dispatch(startCreateUserContact({ contact: peer.contact }));
          }
        }
        if (existsInUserContacts.length >= 1) {
          if (this.isPreviousNumberValid === 0) {
            const peerNumber = value;
            const existsinContacts = this.getSelectedContact(peerNumber, this.userContactsI)
            if (existsinContacts.length == 0) {
              if (existsInUserContacts.length >= 1) {
                this.participantCount += 1;
                this.userContactsI.push({
                  ContactName: existsInUserContacts[0].ContactName,
                  ContactNumber: existsInUserContacts[0].ContactNumber,
                  firstName: existsInUserContacts[0].firstName,
                  lastName: existsInUserContacts[0].lastName,
                  img: existsInUserContacts[0].img,
                });
              } else {
                this.participantCount += 1;
                this.userContactsI.push({
                  ContactName: '',
                  ContactNumber: peerNumber.trim(),
                  firstName: '',
                  lastName: '',
                  img: '',
                })
              }
            }
          }
        } else if (this.checkIsNumberValid(value)) {
          const peerNumber = value;
          const existsInUserContacts = this.contactarry.filter(
            (x) => {
              if (x.ContactNumber === peerNumber)
                return x
            }
          )
          if (existsInUserContacts.length >= 1) {
            this.participantCount += 1;
            this.userContactsI.push({
              ContactName: existsInUserContacts[0].ContactName,
              ContactNumber: existsInUserContacts[0].ContactNumber,
              firstName: existsInUserContacts[0].firstName,
              lastName: existsInUserContacts[0].lastName,
              img: existsInUserContacts[0].img,
            });
          } else {
            this.participantCount += 1;
            this.userContactsI.push({
              ContactName: '',
              ContactNumber: this.prefixCountryCodeToContactNumber(peerNumber.trim()),
              firstName: '',
              lastName: '',
              img: '',
            })
          }
        } else {
          if (this.isPreviousNumberValid === 0) {
            this.participantCount += 1;
            this.userContactsI.push({
              ContactName: '',
              ContactNumber: value.trim(),
              firstName: '',
              lastName: '',
              img: '',
            })
            this.isPreviousNumberValid++;
          }
        }
      }
    }

    // Reset the input value
    if (input) {
      input.value = '';
    }

    this.contactCtrl.setValue(null);

    if (this.userContactsI.length > 0) {
      for (let i = 0; i < this.userContactsI.length; i++) {
        const foundContact = this.contactarry.filter(contact => {
          if (contact.ContactName === this.userContactsI[i].ContactName &&
            contact.ContactNumber === this.userContactsI[i].ContactNumber)
            return contact
        });
        if (foundContact.length > 0) {
          const user: ContactSelectedValue = {   // OK
            code: null,
            multiline: foundContact[0].ContactNumber,
            peer: null
          }
          this.selectedGroupContacts.push(user);
        } else {
          const user: ContactSelectedValue = {   // OK
            code: null,
            multiline: this.userContactsI[i].ContactNumber,
            peer: null
          }
          if (this.composeMessageType == 'whatsapp') {
            if (this.checkIsNumberValid(this.userContactsI[i].ContactNumber)) {
              if (this.participantsTriggerdCount == 0) {
                this.participantsTriggerdCount += 1;
                this.getOptInParticipants(this.userContactsI[i].ContactNumber);
              }
            } else {
              this.selectedGroupContacts.push(user);
            }
          } else {
            this.selectedGroupContacts.push(user);
          }
        }
      }
    }
    this.deBouncer$.next(
      this.selectedGroupContacts
    );
  }

  removeContact($event, index: number): void {
    this.isPreviousNumberValid = 0;
    if (index >= 0) {
      this.participantCount -= 1;
      /* let contactNumber = this.userContactsI[index].ContactNumber;
      if(contactNumber == '911') {
        this.messagingService.is911Message.next(false);
      } */
      this.userContactsI.splice(index, 1);
    }

    this.selectedGroupContacts = [];

    if (this.userContactsI.length > 0) {
      for (let i = 0; i < this.userContactsI.length; i++) {
        const foundContact = this.contactarry.filter(contact => {
          if (contact.ContactName === this.userContactsI[i].ContactName &&
            contact.ContactNumber === this.userContactsI[i].ContactNumber)
            return contact
        });
        if (foundContact.length == 1) {
          const user: ContactSelectedValue = {   // OK
            code: null,
            multiline: foundContact[0].ContactNumber,
            peer: null
          }

          this.selectedGroupContacts.push(user);
        } else {
          const user: ContactSelectedValue = {   // OK
            code: null,
            multiline: this.userContactsI[i].ContactNumber,
            peer: null
          }
          this.selectedGroupContacts.push(user);
        }
      }
    }
    this.deBouncer$.next(
      this.selectedGroupContacts
    );
    this.optInYesPeerIdValue = null
  }

  closeAutocompleteOn() {
    this.autoTrigger.closePanel();
  }
  closeAutocompleteOnKeyUp() {
    if (this.contactCtrl.value === null) {
      this.autoTrigger.closePanel();
      this.showMatOptions = false;
    } else if (this.contactCtrl.value.length < 3) {
      this.autoTrigger.closePanel();
      this.showMatOptions = false;
    } else if (this.contactCtrl.value.length >= 3) {
      /** condition to validate gvn no. wrt countrycode */
      if (!allowedSpecialCharacters(this.contactCtrl.value, this.allowedCharcs)) {
        const value = getPeerNumberWOSpecialChars(this.contactCtrl.value)
        const isFoundAndCC = checkCCodeInNumber(value)
        if (isFoundAndCC['isCCFound'] === true && value.replace(isFoundAndCC['CountryCode'], "").length < 3) {
          this.autoTrigger.closePanel();
          this.showMatOptions = false;
          return
        }
      }
      this.showMatOptions = true;
      this.autoTrigger.openPanel();
    }
  }

  removeList($event, index: number) {
    if ($event.key === "Backspace" || $event.key === "Delete") {
      this.removeContact($event, index);
      setTimeout(() => {
        this.contactInput.nativeElement.focus();
      }, 100);
    }
  }

  getContactTitle(contact: any): string {
    if ((contact.firstName === null && contact.lastName === null) || (contact.firstName === "" && contact.lastName === "")) {
      return addPulsToMultilineNumber(contact.ContactNumber)
    } else if (contact.firstName !== null && contact.lastName !== null) {
      return contact.firstName + " " + contact.lastName
    } else if ((contact.firstName !== null && contact.lastName === null) || (contact.firstName !== "" && contact.lastName === "")) {
      return contact.firstName
    } else if ((contact.firstName === null && contact.lastName !== null) || (contact.firstName === "" && contact.lastName !== "")) {
      return contact.lastName
    }
  }


  // async saveGalSelectedContact(selectedContactName, galContacts): Promise<UserContactGhost> {
  //   let peer = this.getPeer(selectedContactNumber, this.galContatcsLocal)
  //   let contact: NewContact;
  //   contact = ({
  //     type: 'organization',
  //     firstName: peer.firstName,
  //     lastName: peer.lastName,
  //     phones: [{
  //       type: peer.multiLineType,
  //       phone: peer.multiLine
  //     }],
  //     addresses: null,
  //     emails: null
  //   })
  //   const ids = await this.dbContext.contact.addContact(
  //     this.userId,
  //     contact
  //   );
  //   return peer;
  // }

  async selectedContact(event: MatAutocompleteSelectedEvent): Promise<void> {
    this.onSelectedContact(event, null);
  }

  onSelectedContact (event: MatAutocompleteSelectedEvent, getContact) {
    let selectedContactNumber;
    let underScoreIndex;
    let selectedContactName;
    if (event == null) {
      selectedContactNumber = getContact.value;
      selectedContactName = getContact.contactName;
    } else {
      selectedContactNumber = cleanPhoneNumber(event.option?.value?.ContactNumber);
      underScoreIndex = event?.option?.value?.ContactName?.lastIndexOf("_");
      selectedContactName = event?.option?.value?.ContactName?.substring(0, underScoreIndex);
    }
    let peer = this.getPeer(selectedContactNumber, this.contacts)
    if (peer === null) {
      // To do... we need a promise and an observable to remove the code duplicate and some code refactor to achove this...
      // am leaving a rough code fr this here.. when we take up the GAL serach code refactort we should do this as well
      // peer = await this.saveGalSelectedContact(selectedContactNumber, selectedContactName, this.galContatcsLocal);

      //NOTE: the above comments have been taken care with already existing methods and new actions
      peer = this.getPeer(selectedContactNumber, (this.galContatcsLocal || []))
      if (peer !== null) {
        sessionStorage.setItem("addGalCnctViaMsging", "true");
        this.store.dispatch(startCreateUserContact({ contact: peer.contact }));
      }
    }
    let firstName = peer?.firstName != null ? peer?.firstName: getContact.firstName;
    let lastName = peer?.lastName != null ? peer?.lastName: getContact.lastName;
    const obtainedContact = this.userContactsI.filter((option) => {
      if (option.ContactName === selectedContactName || option.ContactNumber === selectedContactNumber) {
        return option
      }
    })
    if (this.isGroupMessageEnabled === true && this.composeMessageType !== 'whatsapp') {
      if (this.userContactsI.length < this.participantLimit - 1) {
        if (obtainedContact.length === 1) {
          const oneContDiffNumber = this.selectedGroupContacts
            .filter((e) => { if (e.multiline === selectedContactNumber) { return e } })
          if (oneContDiffNumber.length == 0) {
            this.participantCount += 1;
            this.userContactsI.push(
              {
                ContactName: selectedContactName,
                ContactNumber: selectedContactNumber,
                firstName: firstName,
                lastName: lastName,
                img: peer?.img,
              }
            )
            const user: ContactSelectedValue = {   // OK
              code: null,
              multiline: selectedContactNumber,
              peer: null
            }
            this.selectedGroupContacts.push(user);
          }
          // this.participantCount -= 1;
          // this.userContacts = [...this.userContacts.filter(contact => contact !== newValue)];
        } else {
          if (this.isPreviousNumberValid === 0) {
            // const names = event.option.viewValue.split(" ");
            if (!this.checkIsNumberValid(selectedContactNumber)) {
              this.isPreviousNumberValid++;
              this.participantCount += 1;
              this.userContactsI.push(
                {
                  ContactName: selectedContactName,
                  ContactNumber: selectedContactNumber,
                  firstName: firstName,
                  lastName: lastName,
                  img: peer?.img,
                }
              )
            } else {
              this.participantCount += 1;
              this.userContactsI.push(
                {
                  ContactName: selectedContactName,
                  ContactNumber: this.prefixCountryCodeToContactNumber(selectedContactNumber),
                  //ContactNumber: selectedContactNumber,
                  firstName: firstName,
                  lastName: lastName,
                  img: peer?.img,
                }
              )
            }
          }
        }
      }
    } else {
      if (this.userContactsI.length < 1) {
        this.participantCount += 1;
        this.userContactsI.push({
          ContactName: selectedContactName,
          ContactNumber: this.prefixCountryCodeToContactNumber(selectedContactNumber),
          firstName: firstName,
          lastName: lastName,
          img: peer?.img,
        })
      }
    }
    this.contactInput.nativeElement.value = '';
    this.contactCtrl.setValue(null);
    this.selectedGroupContacts = [];

    if (this.userContactsI.length > 0) {
      for (let i = 0; i < this.userContactsI.length; i++) {
        const foundContact = this.contactarry
          .filter(contact => {
            const underScoreIndex = contact.ContactName?.lastIndexOf("_");
            if (contact?.ContactName?.substring(0, underScoreIndex) === this.userContactsI[i]?.ContactName &&
              contact?.ContactNumber === this.userContactsI[i]?.ContactNumber)
              return contact
          });
        if (foundContact.length > 0) {
          const user: ContactSelectedValue = {   // OK
            code: null,
            multiline: foundContact[0].ContactNumber,
            peer: null
          }
          if (this.composeMessageType == 'whatsapp') {
            if (this.checkIsNumberValid(foundContact[0].ContactNumber)) {
              if (this.participantsTriggerdCount == 0) {
                this.participantsTriggerdCount += 1;
                this.getOptInParticipants(foundContact[0].ContactNumber);
              }
            } else {
              this.selectedGroupContacts.push(user);
            }
          } else {
            this.selectedGroupContacts.push(user);
          }
        } else {
          const user: ContactSelectedValue = {   // OK
            code: null,
            multiline: this.userContactsI[i].ContactNumber,
            peer: null
          }
          if (this.composeMessageType == 'whatsapp') {
            if (this.checkIsNumberValid(this.userContactsI[i].ContactNumber)) {
              //this.onWhatsAppMessage(this.userContactsI[i].ContactNumber);
              if (this.participantsTriggerdCount == 0) {
                this.participantsTriggerdCount += 1;
                this.getOptInParticipants(this.userContactsI[i].ContactNumber);
              }
            } else {
              this.selectedGroupContacts.push(user);
            }
          } else {
            this.selectedGroupContacts.push(user);
          }
        }
      }
    }
    this.contactInput.nativeElement.value = '';
    this.contactCtrl.setValue(null);
    this.deBouncer$.next(
      this.selectedGroupContacts
    );

    // keep the autocomplete opened after each item is picked.
    requestAnimationFrame(() => {
      // this.openAuto(this.matACTrigger);
    })

  }

  loadPeerMessagesList(peerId) {
    this.peerMessages.filter((peers) => {
        if (peers.messageChannelType != 'normalMsg') {
            peers.participants.filter((peer) => {
                if (peer == `whatsapp:${cleanPhoneNumber(peerId)}`) {
                    this.messagingThreadList.push(peers);
                }
            })
        }
    })
}


  getOptInParticipants(peerId: string) {
    this.participantCount = 0;
    this.loadPeerMessagesList(peerId)
    if (this.messagingThreadList.length > 0) {
      this.messagingThreadList = [];
      this.modalService.create({
        nzContent: OptInWhatsappTemplateComponent,
        nzComponentParams: {
          headerTitle: 'History',
          actionBtnTitle: 'New Chat',
          waPeerId: peerId,
          showActionBtns: true,
          onCancelAction: () => {
            this.userContactsI = [];
            this.participantsTriggerdCount = 0;
        },
        },
        nzStyle: {
          margin: '20px auto',
        },
        nzMask: true,
        nzFooter: null,
        nzClosable: false,
        nzKeyboard: false,
        nzMaskClosable: false,
        nzCentered: true,
      })
        .afterClose.pipe(
      );
    } else {
      const peerIdVal = `whatsapp:${cleanPhoneNumber(peerId)}`;
      this.store.dispatch(sendCustomerOptInRequest({ peerId: peerIdVal }));
      this.messagingThreadList = [];
    }
  }

  filterContactsSingleWord = (contacts: Contact[], search: string) => {
    if (search) {
      const search1 = search.toLowerCase();
      const search2 = search1?.replace(/^\+/, '');
      return contacts.filter(
        (f) =>
          f.firstName?.trim().toLowerCase().startsWith(search1) ||
          f.lastName?.trim().toLowerCase().startsWith(search1) ||
          (f.firstName?.trim() + ' ' + f.lastName?.trim())?.trim().toLowerCase().includes(search1) ||
          f.phones.some((m) => {
            const phone = m.phone?.trim().toLowerCase();
            return phone?.replace(/^\+/, '').includes(search2);
          })
      );
    } else {
      return contacts;
    }
  };

  filterContacts = (contacts: Contact[], search: string) => {
    if (!search) {
      return contacts;
    } else {
      const terms = (search || '').split(' ').filter((f) => !!f);
      if (terms.length > 1) {
        // return filterContactsDoubleWord(contacts, terms[0], terms[1]);
        return this.filterContactsSingleWord(contacts, search);
      } else {
        return this.filterContactsSingleWord(contacts, search);
      }
    }
  };


  getFilteredGalContatcts(filter: string) {
    let galContatcs: UserContactGhost[] = [];
    let filteredContacs: ContactIntf[] = [];
    const galRes = this.getGalContacts(filter)
    let index: number = 0;
    return galRes.then(res => {
      res.forEach((contact) => {
        [...(contact.phones) || []].map((m) => {
          filteredContacs.push({
            ContactName: [contact.firstName, contact.lastName]
              .join(' ')
              .trim().concat("_" + index++) || null,
            ContactNumber: cleanPhone(m.phone),
            firstName: contact.firstName,
            lastName: contact.lastName,
            img: contact.img,
          })
          galContatcs.push({
            id: (m.phone ? cleanPhone(m.phone) : m.phone),
            uri: "sip:" + cleanPhone(m.phone) + "@undefined",
            multiLineUri: "sip:" + cleanPhone(m.phone) + "@undefined",
            name: [contact.firstName, contact.lastName]
              .join(' ')
              .trim() || null,
            firstName: contact.firstName,
            lastName: contact.lastName,
            multiLine: cleanPhone(m.phone),
            contact,
            multiLineType: m.type,
            img: contact.img
          } as UserContactGhost)
        })
      });
      sortBy(sortContact, filteredContacs)
      this.galContats$.next(filteredContacs);
      this.galContatsLocalCopy$.next(galContatcs);
      return filteredContacs;
    })
  }

  getGalContacts = (term: string) => {
    if (term && term.length > 2) {
      return this.msGraphService.getPeople(term).then((res) => {
        const sorted = sortBy(
          sortGalContact,
          res.map(mapFromMsGraphPerson)
        );
        const sortedAndLocalFiltered = this.filterContacts(sorted, term);
        if (this.galContactsCalledAfterRefreshingToken === true) this.galContactsCalledAfterRefreshingToken = false;
        return sortedAndLocalFiltered;
      }, async (err) => {
        if (this.galContactsCalledAfterRefreshingToken === true) {
          return Promise.resolve([]);
        }
        if (JSON.parse(err.body).code === "InvalidAuthenticationToken") {
          // TO DO:
          // 1) when user enters three char and execution comes to this portion..
          //    then the refresh token has to be done, before getting the galcontacts again..
          //    currently the contacts cannot be fetched in this same time even when calling getGalContacts in a recursive way..
          // 2) should check the recursive call is not going in loop.
          this.messagingService.get_updated_token();
          this.galContactsCalledAfterRefreshingToken = true;
          // this.getGalContacts(term)
        }
        return Promise.resolve([]);
      });
    } else {
      return Promise.resolve([]);
    }
  };

  filter(filter: string): ContactIntf[] {
    let filteredConts
    let galFilteredConts
    if (filter === "") {
      filter = this.contactCtrl.value !== null ? this.contactCtrl.value : "";
    }
    if(typeof filter === 'string'){
      this.lastFilter = filter?.trim().toLowerCase();
    }
    if (filter.length > 2) {
      if (this.prevFilter !== filter) {
        this.prevFilter = filter
        filteredConts = this.contactarry.filter(option => {
          const contactName = option?.ContactName?.substring(0, option?.ContactName?.lastIndexOf("_"));
          const cleaningFilterValue = cleanPhoneNumber(filter);
          const contactNumb = cleanPhoneNumber(option.ContactNumber);
          if (contactName?.toLowerCase()?.indexOf(filter.toLowerCase()) >= 0 || contactNumb?.indexOf(cleaningFilterValue) >= 0)
            return option
        })
        galFilteredConts = (this.galContatcs || []).filter(option => {
          const contactName = option?.ContactName?.substring(0, option?.ContactName?.lastIndexOf("_"));
          if (contactName?.toLowerCase()?.indexOf(filter.toLowerCase()) >= 0 || option.ContactNumber?.indexOf(filter) >= 0)
            return option
        })
        this.galContatcs = galFilteredConts
        if (this.isTeamsMessageOnly && this.galContatcs.length === 0) {
          //this.getFilteredGalContatcts(filter);
        }
        this.lclContats$.next(filteredConts)
        filteredConts = [...filteredConts, ...galFilteredConts || []]
      }
      return sortBy(sortContact, [...this.lclContats || [], ...(galFilteredConts !== undefined ? galFilteredConts : this.galContatcs || [])])
    }
  }

  getContactRealNumber = getContactRealNumber

  openAuto(trigger: MatAutocompleteTrigger) {
    // trigger.openPanel();
    console.log('tringger', trigger);
  }

  placeHolderMessageText() {
    if(!this.isGalContactFlag){
      return 'Enter Name/Number (include country code)'
    }
  }

  getOptInPeerIdRequest () {
    const optInPeerId = cleanPhoneNumber(this.optInYesPeerIdValue)
    if (this.optInYesPeerIdValue) {
      if (this.optInYesPeerIdValue !== this.apiUserIdentity) {
        this.participantCount += 1;
        const getContact = this.getAllContactNames(optInPeerId);
        this.userContactsI.push(getContact);
        const user: ContactSelectedValue = {   // OK
          code: null,
          multiline: optInPeerId.trim(),
          peer: null
        }
        this.selectedGroupContacts.push(user);
      }
    }
    this.deBouncer$.next(
      this.selectedGroupContacts
    );
    this.authService.onOptInMsgPeerId(null);
  }

  getUserLocation() {
    if (getFeatureEnabled() !== "messaging") {
      this.getNavigatorPermission();
      let locationPermission = sessionStorage.getItem('location_permission');
      if(locationPermission == 'granted') {
        this.getGeoLocation();
      }
      else if (locationPermission == 'prompt') {
        logger.debug('To enable message functionality, please permit to access the location in the prompt popup');
        navigator.geolocation.getCurrentPosition((position) => { });
      }
      else if (locationPermission == 'denied') {
       logger.debug('To enable message functionality, please permit to access the location');
     }
    } else {
      if(this.composeMessageType !== 'whatsapp') {
        location.getLocation({ allowChooseLocation: true, showMap: true }, 
          (error, location) => {
            if(location!= null) {
              this.messagingService.isTeamsLocationEnabled.next(true);
              this.locationInfo = {
                latitude: location.latitude,
                longitude: location.longitude,
                accuracy: location.accuracy
              }
              this.messagingService.setLocation(this.locationInfo);
          }
          else {
            this.messagingService.isTeamsLocationEnabled.next(false);
          }
          })
      }
    }
 }

 getNavigatorPermission(): any {
  try {
    const that = this;
      navigator.permissions.query({
          name: 'geolocation'
      }).then(function (permissionStatus) {
          logger.debug('geolocation permission state', permissionStatus.state); // granted, denied, prompt
          permissionStatus.onchange = function () {
            sessionStorage.setItem('location_permission', permissionStatus.state);
            that.messagingService.isLocationEnabled.next(permissionStatus.state);
            permissionStatus.state == 'granted' ? that.getGeoLocation() : null;
        }
        sessionStorage.setItem('location_permission', permissionStatus.state);
        that.messagingService.isLocationEnabled.next(permissionStatus.state);
      })
  } catch (e) {
      logger.debug("Error in permissions");
  }
 }

getGeoLocation() {
  if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((position) => {
          if (position) {
            this.locationInfo = {
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              accuracy: position.coords.accuracy
            }
            this.messagingService.setLocation(this.locationInfo);
          }
      });
  }
  else {
      console.log("Geolocation is not supported by this browser");
  }
}


prefixCountryCodeToContactNumber(cntNumber){
  if(cntNumber){
    const valnum = getPeerNumberWOSpecialChars(getInternationalNumber(cntNumber, true))
    console.log('valnum val is', valnum);
    return valnum;
  }
}

GetTheme(){
  let theme = localStorage.getItem("Theme")
  return theme ? "Dark" : null
}

}


/**  Copyright 2020 Google LLC. All Rights Reserved.
    Use of this source code is governed by an MIT-style license that
    can be found in the LICENSE file at http://angular.io/license */
