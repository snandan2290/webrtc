import { DatePipe } from '@angular/common';
import {
    ChangeDetectionStrategy,
    Component,
    EventEmitter,
    Input,
    OnInit,
    Output,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { SipService } from '@scalio/sip';
import {
    differenceInHours,
    differenceInMinutes,
    differenceInSeconds,
} from 'date-fns';
import { uniqBy } from 'lodash/fp';
import { NzModalService } from 'ng-zorro-antd/modal';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { selectContactGhosts } from '../../../feature-contacts';
import { UserContactGhost } from '../../../feature-contacts/models';
import { OptInWhatsappTemplateComponent } from '../../../feature-messaging/components';
import {
    CallingStatus,
    CallNowPayload,
    DateTimeService,
    getContactCallSubTitle,
    getContactRealNumber,
    getContactCallTitle,
    MessagingStatus,
    SipUserService,
    DbContext,
    cleanPhoneNumber,
    selectCallingStatus
} from '../../../shared';
import { AddToExistingContactComponent } from '../../../shared/components/add-to-existing-contact/add-to-existing-contact.component';
import { HistorySession } from '../../models';
import { HistorySessionView } from '../../ngrx';
import { sendCustomerOptInRequest } from './../../../feature-contacts/ngrx/actions';
import { selectHash, selectPeersMessages } from './../../../feature-messaging/ngrx/selectors';
@Component({
    selector: 'movius-web-inactive-call',
    templateUrl: './inactive-call.component.html',
    styleUrls: ['./inactive-call.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    providers: [DatePipe],
})
export class InactiveCallComponent implements OnInit {
    @Input() history: HistorySessionView[];
    @Input() callingStatus: CallingStatus = 'allowed';
    @Input() messagingStatus: MessagingStatus = 'allowed';
    @Input() peer: UserContactGhost;
    @Input() isAnonymous = false;

    @Output() call = new EventEmitter();
    @Output() clearHistory = new EventEmitter();
    @Output() deleteHistoryItem = new EventEmitter<string>();
    @Output() addToExistentContact = new EventEmitter();
    getConnectionErrorValue: any;

    activeHistoryItem: HistorySession;

    readonly peers$: Observable<UserContactGhost[]>;

    static processedNavigations: Set<string>;
    hashedRecords: any  = [];
    whatsAppMessageEnabled = sessionStorage.getItem('__enable_whatsapp_message__') ==="true";
    callingStatus_temp: string;
    messagingThreadList:any = [];
    peerMessages: any;
    
    constructor(
        private readonly dateTimeService: DateTimeService,
        private readonly modalService: NzModalService,
        private readonly router: Router,
        private readonly activatedRoute: ActivatedRoute,
        readonly store: Store,
        readonly sipService: SipService,
        readonly sipUserService: SipUserService,
        private readonly dbContext: DbContext

    ) {
        const peerMessages$ = store
            .select(selectPeersMessages(sipService.getUserUri))
            .pipe(
                map((m) => m.filter((f) => f.messages.length > 0))
            );
        peerMessages$.subscribe(peers => {
            if (peers.length > 0) {
                this.peerMessages = peers;
            }
        });
        this.peers$ = store.select(selectContactGhosts(sipService.getUserUri));
        const callingStatus$ = store.select(selectCallingStatus);
        callingStatus$.subscribe(res => {
            this.callingStatus = res;
        });

        this.store.select(selectHash).subscribe((res=>{
            this.hashedRecords  = res;
        }))
    }

    ngOnInit() {
        this.processExternalImmediateCall();
    }

    processExternalImmediateCall() {
        const data: CallNowPayload = history?.state?.data;
        const isNow = data?.callNow;
        if (isNow) {
            this.sipUserService.userNumberStatus = true;
            if (!InactiveCallComponent.processedNavigations) {
                InactiveCallComponent.processedNavigations = new Set();
            }
            if(!!data?.hash && InactiveCallComponent.processedNavigations.has(data?.hash)){
                return;
            }
            data.callNow = null;
            setTimeout(() => {
                this.call.emit();
                if (!!data?.hash) {
                    InactiveCallComponent.processedNavigations.add(
                        data?.hash
                    );
                }
            }, 0);
        } else {
            this.sipUserService.userNumberStatus = false;
        }
    }

    processContactDelete() {
        throw new Error('Not implemented');
    }

    formatDate(date: string) {
        if (!date) {
            return date;
        }
        return this.dateTimeService.formatHistoryTime(date);
    }

    formatDuration(history: HistorySession) {
        const start = new Date(history.startTime);
        const end =
            history.kind === 'HistorySessionCompleted'
                ? new Date(history.endTime)
                : new Date();
        const hourDiff = differenceInHours(end, start);
        const minDiff = differenceInMinutes(end, start);
        const secDiff = differenceInSeconds(end, start);

        const hours = hourDiff;
        const mins = minDiff - hourDiff * 60;
        const secs = secDiff - minDiff * 60;
        const hoursStr = hours ? `${hours} hour` : null;
        const minsStr = mins ? `${mins} min` : null;
        const secsStr = secs ? `${secs} sec` : null;

        return [hoursStr, minsStr, secsStr].filter((f) => !!f).join(', ');
    }

    onClearHistory() {
        this.clearHistory.emit();
    }

    trackByHistory(_, session: HistorySessionView) {
        return session.id;
    }

    activateHistoryItem(item) {
        this.activeHistoryItem = item;
    }

    onDeleteHistoryItem(itemId: string) {
        this.deleteHistoryItem.emit(itemId);
    }

    getContactCallTitle = getContactCallTitle;

    getContactCallSubTitle = getContactCallSubTitle;

    getContactRealNumber = getContactRealNumber;

    showAddToExistingModal = () =>
        this.modalService.create({
            nzContent: AddToExistingContactComponent,
            nzStyle: {
                position: 'relative',
                width: '29.375rem',
            },
            nzMask: true,
            nzClosable: false,
            nzFooter: null,
        });

    onMessageClicked(id: string) {
        const peerIdVal = `${cleanPhoneNumber(id)}`;
        let peerId = "";
        for (let x in this.hashedRecords) {
            if(this.hashedRecords[x].peerId === peerIdVal === true){
                peerId = this.hashedRecords[x].peerId
            }else{
                peerId = `${cleanPhoneNumber(id)}`
            }
        }
        this.router.navigate(['/messaging/chat', peerId]);
    }

    async onWhatsAppMessage(contact, peerId: string) {
        this.getOptInParticipants(peerId);
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
        }
    }

    navigateToDetails(contactId: string) {
        this.router.navigate([
            '/contacts',
            contactId,
        ]);
    }

    public getConnectionError(event :any){
        this.getConnectionErrorValue = event;
        if(event == true){
          this.callingStatus_temp = 'network-error'
        } else {
            this.callingStatus_temp = null;
            return this.callingStatus;
        }
    }
}
