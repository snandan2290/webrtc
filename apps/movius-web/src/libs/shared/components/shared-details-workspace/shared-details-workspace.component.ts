import { Component, Input, OnInit, Output } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { SipService } from '@scalio/sip';
import { combineLatest, Observable, Subject } from 'rxjs';
import { map } from 'rxjs/operators';
import { allowedSpecialCharacters, CallingStatus, DbContext, getCallNowPayload, getContactFriendlyAddress, getContactGhostFriendlyName, getFeatureEnabled, getPeerNumberWOSpecialChars, MessagingStatus, toView, addPulsToMultilineNumber, getChannelTypeForLineWechatDetails } from '../..';
import { MessagingDataAccessService } from '../../../feature-messaging/services/messaging.data-access.service';
//import { selectContactGhosts, startAddToExistentContact, UserContactGhost } from '../../../feature-contacts';
import {
    selectCallingStatus,
    selectMessagingStatus,
} from '../../ngrx/user-ngrx';
// import {
//     CallingStatus,
//     getContactFriendlyAddress,
//     getContactGhostFriendlyName,
//     MessagingStatus,
//     selectCallingStatus,
//     selectMessagingStatus,
//     toView
// }

export interface DetailsWorkspaceView {
    ghost: any & { friendlyName: string; friendlyAddress: string };
    info: { [key: string]: string };
    callingStatus: CallingStatus;
    messagingStatus: MessagingStatus;
}

@Component({
    selector: 'movius-web-shared-details-workspace',
    templateUrl: './shared-details-workspace.component.html',
    styleUrls: ['./shared-details-workspace.component.scss'],
})
export class SharedDetailsWorkspaceComponent implements OnInit {
    @Input() userGhost: any;
    @Input() getActiveChatId: any;
    @Input() doShowAddToExisting: boolean = false;

    @Output() onCreateContactOccured = new Subject<string>();
    @Output() onAddToContactOccured = new Subject<string>();
    @Output() onDeleteContactOccured = new Subject<any>();
    @Output() onWhatsAppMessageOccured = new Subject<any>();
    @Output() onLineMessageOccured = new Subject<any>();
    @Output() onWeChatMessageOccured = new Subject<any>();

    public allParticipantsList:any;
    public contactName:any;
    public backToAllParticipants:any;
    // removed readonly as we need to access view$ variable in the file
    view$: Observable<DetailsWorkspaceView>;
    readonly id$: Observable<string>;
    appEmbededStatus: string;
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
    private allowedCharcs: string[] = [
        '-',
        '+',
        '(',
        ')',
        '0',
        '1',
        '2',
        '3',
        '4',
        '5',
        '6',
        '7',
        '8',
        '9',
        ',',
        ' ',
    ];
    apiUserIdentity: string;
    isMobileDevice: Boolean = false;
    //readonly peers$: Observable<any[]>;
    constructor(
        private readonly router: Router,
        private readonly activatedRoute: ActivatedRoute,
        private readonly store: Store,
        private sipService: SipService, // added private to access sip service        
        private dbContext: DbContext
    ) {
        this.isMobileDevice = ((sessionStorage.getItem('Contex_res')?.toLowerCase() === "ios") || (sessionStorage.getItem('Contex_res')?.toLowerCase() === "android"))
            ? true : false;
        // get paticipants data from indexedDb
        this.dbContext.message.getAllParticipantsList().then((res) => {
            this.allParticipantsList = res.find((res: any) => {
                return res.id === this.router.url.split('/')[3];
            });
            for (
                let i = 0;
                i < this.allParticipantsList?.participants.split('|').length;
                i++
            ) {
                if (
                    this.allParticipantsList.participants
                        .split('|')
                        [i].includes('whatsapp:')
                ) {
                    this.contactName = this.allParticipantsList.participants
                        .split('|')
                        [i].replace('whatsapp:', '');
                }
            }
        });
        //this.peers$ = store.select(selectContactGhosts(sipService.getUserUri));
        this.getStoreData(),
        this.disableBackToAllParticipants();
        const callingStatus$ = store.select(selectCallingStatus);
        const messagingStatus$ = store.select(selectMessagingStatus);
        this.view$ = combineLatest([callingStatus$, messagingStatus$]).pipe(
            map(([callingStatus, messagingStatus]) => {
                const info = toView(this.userGhost?.contact);
                return {
                    info,
                    ghost: {
                        ...this.userGhost,
                        friendlyName: getContactGhostFriendlyName(
                            this.userGhost
                        ),
                        friendlyAddress: getContactFriendlyAddress(
                            this.userGhost?.contact
                        ),
                    },
                    callingStatus,
                    messagingStatus,
                    whatsAppMessageEnabled:
                        sessionStorage.getItem(
                            '__enable_whatsapp_message__'
                        ) === 'true',
                    messsageChannelType: getChannelTypeForLineWechatDetails(this.userGhost.multiLine)
                };
            })
        );
        this.appEmbededStatus = getFeatureEnabled();
        this.apiUserIdentity = sessionStorage.getItem('__api_identity__');
    }

    // get data of the contact from the store
    getStoreData(){
        const callingStatus$ = this.store.select(selectCallingStatus);
        const messagingStatus$ = this.store.select(selectMessagingStatus);
        this.view$ = combineLatest([
                callingStatus$,
                messagingStatus$,
            ]).pipe(
                map(([callingStatus, messagingStatus]) => {
                    const info = toView(this.userGhost?.contact);
                    return {
                        info,
                        ghost: {
                            ...this.userGhost,
                            friendlyName: getContactGhostFriendlyName(this.userGhost),
                            friendlyAddress: getContactFriendlyAddress(this.userGhost?.contact)
                        },
                        callingStatus,
                        messagingStatus,
                        whatsAppMessageEnabled:sessionStorage.getItem('__enable_whatsapp_message__') ==="true",
                        messsageChannelType: getChannelTypeForLineWechatDetails(this.userGhost.multiLine)
                    };
                })
            );
    }

    ngOnInit(): void {
        this.activatedRoute.queryParams.subscribe((params) => {
            this.backToAllParticipants = params.group;
        });
    }

    onCall(peerId: string) {
        let peerIdValue = peerId.includes('whatsapp:') ? peerId.replace('whatsapp:','') : peerId
        this.router.navigate(['calling', 'call', peerIdValue], {
            state: { data: getCallNowPayload() },
        });
    }

    onMessage(peerId: string) {
        sessionStorage.setItem('participants', null);
        let peerIdValue = peerId.includes('whatsapp:')
            ? peerId.replace('whatsapp:', '')
            : peerId;
        this.router.navigate(['messaging', 'chat', peerIdValue]);
    }

    onCreateContact(peerId: string) {
        //this.router.navigate(['contacts', 'new', peerId]);
        let peerIdValue = peerId.includes('whatsapp:')
            ? peerId.replace('whatsapp:', '')
            : peerId;
        this.onCreateContactOccured.next(peerIdValue);
    }

    onAddToContact(peerId: string) {
        let peerIdValue = peerId.includes('whatsapp:')
            ? peerId.replace('whatsapp:', '')
            : peerId;
        this.onAddToContactOccured.next(peerIdValue);
        //this.store.dispatch(startAddToExistentContact({ mlNumber: peerId }));
    }

    onDeleteContact(id: number, peerId: string) {
        this.onDeleteContactOccured.next({ id, peerId });
    }

    onEditContact(id: string) {
        this.router.navigate(['/messaging', id, 'edit']);
    }

    async onWhatsAppMessage(id: number, peerId: string, messsageChannelType: string) {
        if (messsageChannelType == 'Line') {
            this.onLineMessageOccured.next({ id, peerId })
        } else if (messsageChannelType == 'WeChat') {
            this.onWeChatMessageOccured.next({ id, peerId })
        } else {
            this.onWhatsAppMessageOccured.next({ id, peerId });
        }
    }

    participantsBackPage() {
        this.router.navigate([
            '/messaging/chat/' + this.backToAllParticipants + '/participants',
        ]);
    }

    disableBackToAllParticipants() {
        const groupId = localStorage.getItem('selectedGroup');
        if (groupId === '' || groupId === null || groupId === undefined) {
            return false;
        } else {
            return true;
        }
    }

    onBack() {
        this.router.navigate(['..'], { relativeTo: this.activatedRoute });
    }

    onMsgDropDownClick(srcPhone) {
        this.router.navigate(['/messaging/chat', srcPhone]);
    }

    checkIsNumberValid(value: any): boolean {
        let orgPhone = this.userGhost?.contact?.phones[0].orgPhone;
        if (orgPhone) {
            if (this._emergencyNumbers?.indexOf(orgPhone) !== -1) {
                return false;
            } else if ([',', ';', '#'].some((char) => orgPhone?.includes(char))) {
                return false;
            } else if (this.apiUserIdentity === getPeerNumberWOSpecialChars(orgPhone)) {
                return false;
            } else if (allowedSpecialCharacters(orgPhone, this.allowedCharcs)) {
                return false;
            } else if (value === null) {
                return false;
            }
            return true;
        }
    }

    disableIfNotValidNum(phn) {
        let orgphone = '';
        this.userGhost?.contact?.phones?.forEach((phone) => {
            if (phone.phone == phn) {
                orgphone = phone.orgPhone;
            }
        });
        let isnumt = /^[\d\(\)\-\+]+$/.test(orgphone);
        if (isnumt) {
            return '';
        } else {
            return 'details__invalidNumber-disabled';
        }
    }

    getImageLineWechatWhatsapp(messsageChannelType) {
        if (messsageChannelType == 'Line') {
            return 'assets/icons/movius/contacts/icons-line-white.svg'
        } else if (messsageChannelType == 'WeChat') {
            return 'assets/icons/movius/contacts/icons-wechat-white.svg'
        } else {
            return 'assets/icons/movius/contacts/ic_baseline-whatsapp.svg'
        }
    }

    GetTheme(){
        let theme = localStorage.getItem("Theme")
        return theme ? "Dark" : null
    }

    addPulsToMultilineNumber = addPulsToMultilineNumber
}
