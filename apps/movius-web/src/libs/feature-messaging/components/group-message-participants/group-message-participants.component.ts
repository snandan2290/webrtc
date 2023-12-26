import {
    Component,
    OnInit
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { NzModalService } from 'ng-zorro-antd/modal';
import { AuthService, ConfirmDialogComponent, getMsgChannelTypeForSingleParticipant, getMsgChannelTypeFromParticipants, isHighZoomedScreen, SelectContactsDialogComponent, sortParticipantsAsID } from '../../../shared';
import { selectContactGhosts, UserContact, UserContactGhost } from '../../../feature-contacts';
import { Store } from '@ngrx/store';
import { SipService } from '@scalio/sip';
import { Observable } from 'rxjs';
import { MessagingService } from '../../services/messaging.service';
import { selectHash } from '../../ngrx';
import { MessagingDataAccessService } from '../../services/messaging.data-access.service';
import { NewContact } from '@movius/domain';
import { addPulsToMultilineNumber } from '../../../shared';

@Component({
    selector: 'movius-web-group-message-participants',
    templateUrl: './group-message-participants.component.html',
    styleUrls: ['./group-message-participants.component.scss'],
})
export class GroupMessageParticipantsComponent
    implements OnInit {
    participantsList: any;
    participantsId: any;
    hasSaveContact: boolean;
    isGroupMessageEnabled: any;
    contacts: any;
    readonly peers$: Observable<UserContact[]>;
    apiUserIdentity: any;
    routerString: string;
    allNumbers: string;
    hashRecored: any;
    getWAUser: string;
    urlId: any;
    isMobileDevice:boolean = false;
    saveUnknownParticipants: any;
    isWhatsAppGroupEnabled: any;

    constructor(
        private readonly modalService: NzModalService,
        private readonly router: Router,
        private readonly authService: AuthService,
        private store: Store,
        sipService: SipService,
        private readonly messagingService: MessagingService,
        private activatedRoute: ActivatedRoute,
        private messageDataAccessService: MessagingDataAccessService
    ) {
        this.isMobileDevice = ((sessionStorage.getItem('Contex_res')?.toLowerCase() === "ios") || (sessionStorage.getItem('Contex_res')?.toLowerCase() === "android"))
            ? true : false;
        this.urlId = this.activatedRoute.params['_value']['id'];
        this.peers$ = store.select(selectContactGhosts(sipService.getUserUri));
        this.apiUserIdentity = sessionStorage.getItem('__api_identity__');
        this.routerString = '/messaging/chat/';
        this.store.select(selectHash).subscribe((res) => {
            this.hashRecored = res;
            let getHashRecoredObjKey = Object.keys(this.hashRecored);
            if (
                getHashRecoredObjKey.length > 0 &&
                this.hashRecored[this.urlId] !== undefined
            ) {
                this.getPartipantsList();
            }
        })
        this.saveParticipantsName();
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

    ngOnInit(): void {
        this.isGroupMessageEnabled = JSON.parse(this.authService.checkGroupMsgEnable);
        this.isWhatsAppGroupEnabled = this.authService.isWhatsappGroupEnabled;
        this.getContacts();
    }

    getPartipantsList() {
        let getAllData = this.hashRecored[this.urlId]
        this.participantsList = getAllData?.participants.includes('|') ? getAllData?.participants.split('|') : getAllData?.participants;
        let peerId = "";
        for (let i = 0; i < this.participantsList.length; i++) {
            peerId += this.participantsList[i];
        }
        const wadata = this.participantsList.filter((e) => e.includes('whatsapp'))
        this.getWAUser = wadata[0];
        if (peerId.includes(this.apiUserIdentity) === true) {
            this.getNameOnTop();
        }
    }

    isUserPresentInGroup() {
        if (this.participantsList?.includes(this.apiUserIdentity)) {
            return true;
        } else {
            return false;
        }
    }

    getNameOnTop() {
        const index = this.participantsList.indexOf(this.apiUserIdentity);
        let array = [];
        for (let i = 0; i < this.participantsList.length; i++) {
            if (this.participantsList[i] !== this.apiUserIdentity) {
                array.push(this.participantsList[i]);
            }
        }
        array.unshift(this.apiUserIdentity);
        this.participantsList = array;
    }

    // save participant info for WA group members
    saveParticipantsName() {
        let unsavedParticipants = [];
        for (let i = 0; i < this.participantsList?.length; i++) {
            let isParticipantSaved = false;
            for (let j = 0; j < this.messagingService.savedContact?.length; j++) {
                // check if the participant details is saved in local contacts
                if (this.participantsList[i] == this.messagingService.savedContact[j]?.id) {
                    isParticipantSaved = true;
                    break;
                }
            }
            if (isParticipantSaved == false) {
                unsavedParticipants.push(this.participantsList[i]);
            }
        }
        // remove logged in user details from the array
        if (unsavedParticipants[0] === this.apiUserIdentity) {
            unsavedParticipants.shift()
        }
        let unSavedContacts: any = []
        for (let i = 0; i < unsavedParticipants?.length; i++) {
            // don't save guest user (whatsapp user) details
            if (this.hashRecored[this.urlId].messageChannelType != 'normalMsg' && unsavedParticipants[i]?.includes('whatsapp:') === false) {
                this.messageDataAccessService.getListOfWhatsappUsers(unsavedParticipants[i]).subscribe(
                    (res: any) => {
                        unSavedContacts.push(res.root.accounts?.account)
                    }
                )
            }
        }
        setTimeout(() => {
            this.saveUnknownParticipants = unSavedContacts
            this.saveUnsavedParticipants();
        }, 2000);
    }

    saveUnsavedParticipants() {
        this.saveUnknownParticipants?.forEach((user: any) => {
            const contactNumber = {
                orgPhone: user?.mml_number,
                phone: user?.mml_number,
                type: "BusinessPhone"
            }
            const emailAddresses = {
                type: "unknown",
                email: user?.email_address,
            }
            const contact: NewContact = {
                type: 'personal',
                firstName: user?.first_name.trim(),
                lastName: user?.last_name.trim(),
                phones: [contactNumber],
                emails: [emailAddresses],
            };
            const contactCreatedFrom = 'AddedGroupParticipants'
            this.messageDataAccessService.createContactForAddedUsers(contact, contactCreatedFrom)
        });
    }

    getImg(phone: string) {
        for (let k = 0; k < this.contacts.length; k++) {
            const contact = this.contacts[k];
            for (let j = 0; j < contact.length; j++) {
                const isContactExists = contact[j].contact.phones.filter(
                    (e) => e.phone === phone
                );
                if (isContactExists.length > 0) {
                    if (
                        contact[j].contact.img !== null &&
                        typeof contact[j].contact.img !== undefined
                    ) {
                        return contact[j].contact.img;
                    }
                }
            }
        }
        return 'assets/icons/dark_theme_icons/avatar.svg';
    }

    getParticipantData(participantsList){
        let participantdata = [];
        let wauser = '';
        for (let i = 0; i < this.participantsList?.length; i++) {
                wauser = this.participantsList.filter((user) => user.includes('whatsapp:'));
                let cnt = {
                    first_name: this.getContactName(this.participantsList[i])?.split(' ')[0],
                    last_name: this.getContactName(this.participantsList[i])?.split(' ')[1],
                    mml_number: this.getContactRealNumber(this.participantsList[i]),
                }
                if(cnt.mml_number != undefined && cnt.first_name != 'You' && !cnt.mml_number.includes(wauser[0].replace('whatsapp:', ''))){
                    participantdata.push(cnt)
                }
        }
        return participantdata;
    }

    getContactName(multiLine: string): string {
        const participant = multiLine?.includes('whatsapp') ? multiLine?.replace('whatsapp:', '') : multiLine;
        const getName = this.messagingService.getAllContactName(participant);
        if (addPulsToMultilineNumber(this.apiUserIdentity) === addPulsToMultilineNumber(participant)) {
            return 'You';
        }
        if (getName.match(/[a-z]/i)) {
            this.hasSaveContact = true;
            this.getImg(participant);
            return getName;
        } else {
            this.hasSaveContact = false;
            this.getImg(participant);
            return addPulsToMultilineNumber(getName);
        }
    }

    getContactRealNumber(multiLine: string) {
        const participant = multiLine.includes('whatsapp')
            ? multiLine?.replace('whatsapp:', '')
            : multiLine;
        const getRealNumber = this.messagingService.getContactRealNumber(
            participant
        );
        return getRealNumber ? addPulsToMultilineNumber(getRealNumber) : getRealNumber;
    }

    participantsDetails(multiLine: any) {
        const participant = multiLine.includes('whatsapp')
            ? multiLine?.replace('whatsapp:', '')
            : multiLine;
        this.router.navigate(['/messaging/chat/' + participant + '/details'], {
            queryParams: { group: this.urlId },
        });
    }

    GetTheme(){
        let theme = localStorage.getItem("Theme")
        return theme ? "Dark" : null
    }

    managePartcipants() {
        this.modalService.create({
            nzContent: ConfirmDialogComponent,
            nzComponentParams: {
                titleTxt: 'Manage Participants',
                subTitleTxt:
                    'Adding or deleting the participants will create a separate conversation thread.',
                cancelBtnTxt: 'Cancel',
                applyBtnTxt: 'Continue',
                onOkAction: () => {
                    this.router.navigate([
                        '/messaging/chat/edit/' + this.urlId,
                    ]);
                },
            },
            nzBodyStyle: {
                width: '26rem',
            },
            nzWidth: '26rem',
            nzFooter: null,
            nzKeyboard: false,
        });
    }

    PreviousPage() {
        this.router.navigate([this.routerString, this.urlId], {
            relativeTo: this.activatedRoute,
        });
    }

    isContactSaved(multiLine: string): 0 | 1 {
        const participant = multiLine?.includes('whatsapp') ? multiLine?.replace('whatsapp:', '') : multiLine;
        const getName = this.messagingService.getAllContactName(participant);
        if (getName.match(/[a-z]/i) || this.apiUserIdentity === participant) {
            return 0;
        } else {
            return 1;
        }
    }

    getPeer(fromNum: string): UserContactGhost {
        const participant = fromNum?.includes('whatsapp') ? fromNum?.replace('whatsapp:', '') : fromNum;
        const peer = this.contacts[0].filter((e) => e.multiLine === participant);
        if (peer.length > 0) {
            return peer[0];
        }
        return null;
    }

    leaveConversation() {
        this.modalService.create({
            nzContent: ConfirmDialogComponent,
            nzComponentParams: {
                titleTxt: 'Leave Conversation',
                subTitleTxt:
                    'Are you sure you want to leave this conversation.',
                cancelBtnTxt: 'No',
                applyBtnTxt: 'Yes',
                onOkAction: () => {
                    // leave group with whatsapp user
                    const data = {
                        thread: this.urlId,
                        receiver: this.getWAUser,
                        format: 'json',
                        ver: '1',
                    };
                    this.messageDataAccessService
                        .leaveWhatsAppGroup(data)
                        .subscribe();
                },
            },
            nzBodyStyle: {
                width: '26rem',
            },
            nzWidth: '26rem',
            nzFooter: null,
            nzKeyboard: false,
        });
    }

    isWhatsAppenabled(threadId: string){
       return sessionStorage.getItem('opt-in-status-for-thread-id-' + threadId) === '3' ? true : false
    }

    getChannelType(participant){
        return getMsgChannelTypeForSingleParticipant(participant)
    }
    
    addMoreParticipants(participantsList: any) {
        const mode = 11;
        this.modalService.create({
            nzContent: SelectContactsDialogComponent,
            nzComponentParams: {
                headerTitle: 'Add User',
                okBtnTitle: 'Add',
                mode: mode,
                actionTriggeredFrom: 'addMoreParticipants',
                heightMode: isHighZoomedScreen() ? 'Limited' : 'Normal',
            },
            nzStyle: {
                margin: '20px auto',
            },
            nzMask: true,
            nzFooter: null,
            nzMaskClosable: false,
            nzClosable: false,
            nzCentered: true,
        })
        .afterClose.pipe(

            );
            // get participants array in select-contacts-dialog component
            this.messageDataAccessService.getPeerMessages.next(participantsList);
    }

    removeParticipants(participantsList: any) {
        const mode = 11;
        this.modalService.create({
            nzContent: SelectContactsDialogComponent,
            nzComponentParams: {
                headerTitle: 'Remove Participant(s)',
                okBtnTitle: 'Done',
                sourceContacts: this.getParticipantData(participantsList),
                mode: mode,
                actionTriggeredFrom: 'removeParticipants',
                heightMode: isHighZoomedScreen() ? 'Limited' : 'Normal',
            },
            nzStyle: {
                margin: '20px auto',
            },
            nzMask: true,
            nzFooter: null,
            nzMaskClosable: false,
            nzClosable: false,
            nzCentered: true,
        })
        .afterClose.pipe(
            );
            // get participants array in select-contacts-dialog component
            this.messageDataAccessService.getPeerMessages.next(participantsList);
    }
}
    //#region Autocomplete external input handling
    //CB: 02Dec2020: TDEBT:Consider to extract autocomplete decorator as external comp with this logic.
    //CB: 02Dec2020: YAGNI: No duplicate! Extract in case of need to use in any other place.

