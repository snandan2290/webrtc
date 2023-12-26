import {
    ChangeDetectionStrategy,
    Component,
    EventEmitter,
    Input,
    OnDestroy,
    Output,
} from '@angular/core';
import { UserContact } from '../../../feature-contacts/models';
import { DbContext, SipUserService, getContactCallSubTitle, getContactCallTitle, getContactRealNumber } from '../../../shared';
import { SuspendedActiveCall } from '../../models';
import { CallControlButtonTypes } from '../common';
import {map} from "rxjs/operators";
import {combineLatest} from "rxjs";
import {createUserContact} from "../../../feature-contacts";
import {Store} from "@ngrx/store";
import {
    ContactAddressBase,
    ContactOther,
    ContactWork,
    NameExtras, NewContact
} from "@movius/domain";

@Component({
    selector: 'movius-web-active-outgoing-call',
    templateUrl: './active-outgoing-call.component.html',
    styleUrls: ['./active-outgoing-call.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ActiveOutgoingCallComponent implements OnDestroy {
    regStatusTest: string;
    @Input() peer: UserContact;
    @Input() call: SuspendedActiveCall;
    @Output() cancel = new EventEmitter();

    constructor(
        private readonly dbContext: DbContext, 
        private readonly store: Store, 
        private sipUserService: SipUserService
    ) {}

    callControlTypes = CallControlButtonTypes;

    ngOnInit() {

        const regstatustestt = combineLatest([
            this.sipUserService.registeredSipUser$,
        ]).pipe(
            map(([transportStatus]) => {
                return {
                    transportStatus,
                };
            })
        );

        regstatustestt.subscribe(sipuserregistrationstatus => {
            if(sipuserregistrationstatus.transportStatus.transport.state == 'Disconnected') {
                this.regStatusTest = 'Connecting...'
                this.do_reregistration();
            } else {
                this.regStatusTest = 'Calling...'
            }
        })
    }

    async do_reregistration(){
        const userRegisterStatus = await this.sipUserService.reRegister();
        if (userRegisterStatus.transport.state == 'Connected') {
            this.getContactData()
        } else {
            this.do_reregistration()
        }
    }

    async getContactData(){
        const contact_detail = await this.dbContext.contact.updateContactForNumberFormat(this.peer.id, this.peer.id)
        if (contact_detail !== undefined && contact_detail !== null) {
            const contact: NewContact = {
                type: contact_detail.type,
                img: contact_detail.img,
                firstName: contact_detail.firstName,
                lastName: contact_detail.lastName,
                nameExtras: contact_detail.nameExtras,
                work: contact_detail.work,
                other: contact_detail.other,
                phones:  contact_detail.phones,
                emails: contact_detail.emails,
                addresses: contact_detail.addresses,
                msGraphId: contact_detail.msGraphId,
                chat: contact_detail.chat,
                note: contact_detail.note,
            }
            this.store.dispatch(
                createUserContact({ contact, isImplicit: true })
            );
        }
    }

    ngOnDestroy() {}

    getContactCallTitle = getContactCallTitle;

    getContactCallSubTitle = getContactCallSubTitle;

    getContactRealNumber = getContactRealNumber;
}
