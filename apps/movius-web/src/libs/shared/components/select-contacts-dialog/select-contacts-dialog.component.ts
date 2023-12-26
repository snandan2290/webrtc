import {
    ChangeDetectionStrategy,
    Component,
    Input,
    OnInit,
} from '@angular/core';
import { Contact, NewContact } from '@movius/domain';
import { assoc, omit } from 'lodash/fp';
import { NzModalRef, NzModalService } from 'ng-zorro-antd/modal';
import { BehaviorSubject, combineLatest, Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { UserContactGhost } from '../../../feature-contacts';
import { format } from 'date-fns';
import { MessagingDataAccessService } from '../../../feature-messaging/services/messaging.data-access.service';
import {
    filterNameOrPhone,
    getContactFriendlyName,
    getContactGhostFriendlyName,
    addPulsToMultilineNumber
} from '../../utils';
import { ActivatedRoute, Router } from '@angular/router';
import { ConfirmDialogComponent } from '../confirm-dialog/confirm-dialog.component';

export type ContactOrGhost = UserContactGhost | Contact;

export type ContactView = ContactOrGhost & {
    isSelected: boolean;
    friendlyName: string;
};
export interface SelectContactsView {
    contacts: ContactView[];
    selectedContacts: ContactView[];
    limitReached: null | number;
}

export type HeightMode = 'Normal' | 'Limited';

@Component({
    selector: 'movius-web-select-contacts-dialog',
    templateUrl: './select-contacts-dialog.component.html',
    styleUrls: ['./select-contacts-dialog.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SelectContactsDialogComponent implements OnInit {
    readonly view$: Observable<SelectContactsView>;

    private readonly sourceContacts$ = new BehaviorSubject<ContactOrGhost[]>(
        []
    );
    private readonly searchTerm$ = new BehaviorSubject<string>(null);
    private readonly selected$ = new BehaviorSubject<{
        [key: string]: boolean;
    }>({});

    @Input() set sourceContacts(val: ContactOrGhost[]) {
        this.sourceContacts$.next(val);
    }
    get sourceContacts() {
        return this.sourceContacts$.value;
    }
    @Input() headerTitle: string;
    @Input() cancelBtnTitle: string;
    @Input() okBtnTitle: string;

    @Input() mode: 'single' | 'multiple' | number = 'multiple';
    @Input() actionTriggeredFrom: 'forward' | 'addMoreParticipants' | 'removeParticipants';
    @Input() heightMode: HeightMode = 'Normal';
    isMessageForwarded = 'false';
    public listOfWhatsappUsers:any;
    public loogedUserNumber:string;
    public selectedData:any = [];
    public searchInputForContact:any;
    public maxLimitReached: boolean = false;
    public isShareHistoryShown: boolean = false;
    public displayShareChatHistory: boolean;
    public lastIncommingMessage: any;
    private searchText:string;
    private usersList:any='';
    private threadId: any;
    private getObjforPeerMessages: any;
    private participationArray:any;


    
    constructor(
        private readonly _modal: NzModalRef,
        private readonly modalService: NzModalService, 
        private messagingDataAccessService:MessagingDataAccessService, 
        private router:Router,
    ) {
        this.view$ = combineLatest([
            this.sourceContacts$,
            this.searchTerm$,
            this.selected$,
        ]).pipe(
            map(([sourceContacts, searchTerm, selected]) => {
                if(this.actionTriggeredFrom == 'removeParticipants'){
                    this.listOfWhatsappUsers = sourceContacts;
                }
                sourceContacts = sourceContacts.filter((c) => c['contact']?.type == 'personal' || c['contact']?.type == 'organization' || (c['contact']?.phones[0]?.type == 'BusinessPhone' && c['contact']?.type != 'Line') || c.type == 'personal' || c.type == 'organization')
                const allContacts = sourceContacts.map(
                    (contact: ContactOrGhost) => ({
                        ...contact,
                        isSelected: !!selected[contact.id],
                        friendlyName:
                            'multiLine' in contact
                                ? getContactGhostFriendlyName(contact)
                                : getContactFriendlyName(contact),
                    })
                );

                const contacts = allContacts.filter(
                    (f: ContactOrGhost) =>
                    !searchTerm || filterNameOrPhone(f, searchTerm)
                    );
                    
                const selectedContacts = allContacts.filter(
                    (f) => f.isSelected
                );
                let limitReached = null;
                if (typeof this.mode === 'number') {
                    const selectedCount = Object.keys(selected).length;
                    limitReached = this.mode <= selectedCount
                        ? this.mode
                        : null;
                }
                return { contacts, selectedContacts, limitReached };
            })
        );
        this.threadId = this.router.url.split('/')[3];

        this.messagingDataAccessService.getPeerMessages.subscribe(
            (res) => {
                this.participationArray = res;
                let getParticipantsArray;
                res?.filter((e) => {
                    if(e.includes('whatsapp:')) {
                        getParticipantsArray = e;
                    }
                })
                this.getObjforPeerMessages = getParticipantsArray
            }
        );

    }
    ngOnInit(): void {
        this.loogedUserNumber = sessionStorage.getItem('__api_identity__');
        if (this.actionTriggeredFrom === 'addMoreParticipants') {
            if ((sessionStorage.getItem('lastIncommingMessageAt') === 'undefined') || (sessionStorage.getItem('lastIncommingMessageAt') === 'null')) {
                this.displayShareChatHistory = JSON.parse(sessionStorage.getItem(
                    '__whatsapp_share_chat_history__'
                ));
            }  else {
                this.displayShareChatHistory = JSON.parse(sessionStorage.getItem(
                    '__whatsapp_share_chat_history__'
                ));
                this.lastIncommingMessage = format(new Date(sessionStorage.getItem('lastIncommingMessageAt')?.replace('Z', '')), 'yyyy-MM-dd HH:mm:ss') + ' UTC'
            }
        }
    }

    onClose() {
        this._modal.close();
    }

    onToggle(contact: ContactView) {
        if (this.mode !== 'single') {
            const selected = this.selected$.value;
            const updated = contact.isSelected
                ? omit(contact.id, selected)
                : assoc(contact.id, true, selected);
            this.selected$.next(updated);
        } else {
            this.selected$.next({ [contact.id]: true });
        }
    }


    toggleSelectedUser(data: any) {
        let findSelectedUser = this.selectedData.find((res: any) => {
            return res.mml_number === data.mml_number
        });
        if (findSelectedUser) {
            if (findSelectedUser.participationOfGroup === true) {
                findSelectedUser['isSelected'] = true
            } else {
                findSelectedUser['isSelected'] = !findSelectedUser['isSelected']
                this.maxLimitReached = false;
                if (!findSelectedUser['isSelected']) {
                    const index = this.selectedData.findIndex((res) => {
                        return res.mml_number === data.mml_number
                    })
                    this.selectedData.splice(index, 1)
                }
            }
        } else {
            if (data.participationOfGroup === true) {
                data['isSelected'] = true;
            } else {
                if (this.selectedData.length >= 9 && this.actionTriggeredFrom != 'removeParticipants') {
                    this.maxLimitReached = true;
                } else {
                    if (this.router.url.split('/')[4] === 'participants') {
                        if (this.selectedData.length + this.participationArray.length === 10  && this.actionTriggeredFrom != 'removeParticipants') {
                            this.maxLimitReached = true;
                        } else if (this.selectedData.length + this.participationArray.length === 9 && this.actionTriggeredFrom != 'removeParticipants') {
                            this.maxLimitReached = true;
                            data['isSelected'] = true;
                            this.selectedData.push(data);
                        }
                        else {
                            data['isSelected'] = true;
                            this.selectedData.push(data);
                        }
                    } else {
                        if(this.selectedData.length === 8 && this.actionTriggeredFrom != 'removeParticipants'){
                            this.maxLimitReached = true;
                            data['isSelected'] = true;
                            this.selectedData.push(data);
                        }else{
                            data['isSelected'] = true;
                            this.selectedData.push(data);
                        }
                    }
                }
            }
        }
    }

    removeSelectedUser(data:any){
        let removeSelectedUser = this.selectedData.find((res: any) => {
            return res.mml_number === data.mml_number
        });
        let index = this.selectedData.findIndex((res: any) => {
            return res.mml_number === data.mml_number
        });
        removeSelectedUser['isSelected'] = false;
        this.maxLimitReached = false;
        this.selectedData.splice(index, 1);
    }

    toggleShareHistory() {
        this.isShareHistoryShown = !this.isShareHistoryShown
    }

    actionBasedOnTriggerType(actionTriggeredFrom){
        if(actionTriggeredFrom == 'addMoreParticipants'){
           this.addSelectedContacts();
        } else if(actionTriggeredFrom == 'removeParticipants'){
            let selectedParticipantNames = [];
            this.selectedData?.forEach((res: any) => {
            selectedParticipantNames.push(res?.first_name + ' ' + res?.last_name)
            });
            this.modalService.create({
                nzContent: ConfirmDialogComponent,
                nzComponentParams: {
                    titleTxt: 'Remove Participant(s)',
                    subTitleTxt:
                        'Are you sure you want to remove ' +  selectedParticipantNames.join(', '),
                    cancelBtnTxt: 'No',
                    applyBtnTxt: 'Yes',
                    onOkAction: () => {
                        this.removeSelectedContacts();
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
    }
    //remove selected contacts from group with whatsapp user
    removeSelectedContacts(){
        let selectedParticipants = [];
        this.selectedData?.forEach((res: any) => {
            selectedParticipants.push(res?.mml_number.replace('+', ''))
        });
        const data = {
            thread: this.threadId,
            receiver: this.getObjforPeerMessages,
            user: selectedParticipants.join(','),
            format: 'json',
            ver: '1',
        };
        console.log('data value', data);
        this.messagingDataAccessService
            .deleteUserfromGrpConversation(data)
            .subscribe(
            (res) => {
                if (res.desc === 'Success!') {
                    this.onClose();
                }
            },
            (err) => {
                this.handelErrorForParticipants();
            }
        );
    }

    // add selected contacts to group for group with whatsapp user
    addSelectedContacts() {
        let selectedParticipants = [];
        this.selectedData?.forEach((res: any) => {
            selectedParticipants.push(res?.mml_number)
        });
        let addParticipantsPayload = {
            receiver: this.getObjforPeerMessages,
            thread: this.threadId,
            new_participants: selectedParticipants.join('|'),
            share_chat_history: this.isShareHistoryShown,
            ver: "1",
            last_message: this.lastIncommingMessage
        }
        this.messagingDataAccessService.addWhatsAppParticipants(addParticipantsPayload).subscribe(
            (res) => {
                if (res.desc === 'Success' || res.return === 29004) {
                    this.onClose();
                }
            },
            (err) => {
                this.handelErrorForParticipants();
            }
        );
        this.addSelectedUsersToContacts();
    }

    // Error handeling method for exception while adding participants to group 
    handelErrorForParticipants() {
        this.modalService.create({
            nzContent: ConfirmDialogComponent,
            nzComponentParams: {
                titleTxt: 'Error while adding participants ',
                subTitleTxt: 'Something went wrong. Please contact your administrator.',
                applyBtnTxt: 'Ok',
                onOkAction: () => {
                    this.onClose();
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

    addSelectedUsersToContacts() {
        this.selectedData?.forEach((user: any) => {
            const contactNumber = {
                orgPhone: user.mml_number,
                phone: addPulsToMultilineNumber(user.mml_number),
                type: "BusinessPhone"
            }
            const emailAddresses = {
                type: "unknown",
                email: user?.email_address,
            }
            const contact: NewContact = {
                type: 'personal',
                firstName: user.first_name.trim(),
                lastName: user.last_name.trim(),
                phones: [contactNumber],
                emails: [emailAddresses],
            };
            const contactCreatedFrom = 'AddedGroupParticipants'
            this.messagingDataAccessService.createContactForAddedUsers(contact, contactCreatedFrom)
        });
    }

    onDeselect(contact: ContactView) {
        const selected = this.selected$.value;
        const updated = omit(contact.id, selected);
        this.selected$.next(updated);
    }

    onSearchTermChanged(term: string) {
        this.searchTerm$.next(term);
    }

    // get user input when they search for participants for whatsapp user
    onSearchKey(event: string) {
        this.searchText = event;
            if (this.searchText.length >= 2) {
                this.getListOfWhatsappUsers();
            } else if (this.searchText.length < 2) {
                this.usersList = ''
                this.listOfWhatsappUsers = [];
            }
    }
    
    clearInputField(){
       this.searchInputForContact='';
       this.searchText='';
       this.onSearchKey(this.searchText)
    }

    // get api for list of users available to add to the group
    getListOfWhatsappUsers(): void {
        if (this.actionTriggeredFrom.includes('addMoreParticipants')) {
            this.messagingDataAccessService.getListOfWhatsappUsers(this.searchText).subscribe(
                (res: any) => {
                    if (res.root.accounts.account?.length >= 1) {
                        this.usersList = res.root.accounts.account;
                    } else {
                        let whatsAppArrayList = [];
                        whatsAppArrayList.push(res.root.accounts.account);
                        this.usersList = whatsAppArrayList
                    }
                    this.getExistingUserDetails ()
                    this.searchTerm$.next('');
                }
            );
        }
    }

     // search in the list of participants to add in group from whatsapp user
    getExistingUserDetails() {
        if (this.router.url.split('/')[4] === 'participants') {
            if (this.selectedData?.length >= 1) {
                let commonData = []
                let unique = [];
                for (let i = 0; i < this.usersList?.length; i++) {
                    let isUserSelected = false;
                    if (this.participationArray?.indexOf(this.usersList[i]?.mml_number) != -1) {
                        this.usersList[i]['isSelected'] = true;
                        this.usersList[i]['participationOfGroup'] = true
                    }
                    for (let j = 0; j < this.selectedData?.length; j++) {
                        if (this.usersList[i]?.mml_number == this.selectedData[j]?.mml_number) {
                            isUserSelected = true;
                            commonData.push(this.selectedData[j])
                            break;
                        }
                    }
                    if (isUserSelected == false) {
                        unique.push(this.usersList[i]);
                    }
                }
                this.listOfWhatsappUsers = [...commonData, ...unique];
            } else {
                this.listOfWhatsappUsers = this.usersList;
                for (let i = 0; i < this.listOfWhatsappUsers?.length; i++) {
                    if (this.participationArray?.indexOf(this.listOfWhatsappUsers[i]?.mml_number) != -1) {
                        this.listOfWhatsappUsers[i]['isSelected'] = true;
                        this.listOfWhatsappUsers[i]['participationOfGroup'] = true
                    }
                }
            }
        } else {
            if (this.selectedData.length >= 1) {
                let commonData = []
                let unique = [];
                for (let i = 0; i < this.usersList?.length; i++) {
                    let isUserSelected = false;
                    for (let j = 0; j < this.selectedData?.length; j++) {
                        if (this.usersList[i]?.mml_number == this.selectedData[j]?.mml_number) {
                            isUserSelected = true;
                            commonData.push(this.selectedData[j])
                            break;
                        }
                    }
                    if (isUserSelected == false) {
                        unique.push(this.usersList[i]);
                    }
                }
                this.listOfWhatsappUsers = [...commonData, ...unique];
            } else {
                this.listOfWhatsappUsers = this.usersList
            }
        }
    }

    trackByContact(_, contact: ContactView) {
        return contact.id;
    }

    onCancel() {
        this._modal.close([]);
    }

    onOk(contacts: ContactView[]) {
        if(this.okBtnTitle === "Forward"){
            this.isMessageForwarded = 'true';
        }
        let contactArr = [];
        for (let i = 0; i < contacts.length; i++) {
           contactArr.push(contacts[i].id)
        }
        sessionStorage.setItem('isMessageForwarded', this.isMessageForwarded);
        sessionStorage.setItem('forwardingContacts', JSON.stringify(contactArr));
        this._modal.close(contacts);
    }

    updatedWhatappUser(whatsappusers){
        let updateduser = {
            firstName: whatsappusers?.first_name,
            lastName: whatsappusers?.last_name
        }
        return updateduser;
    }

    addPulsToMultilineNumber = addPulsToMultilineNumber

}
