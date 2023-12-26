import { ChangeDetectionStrategy, Component, OnInit, Output, Input,  OnChanges, SimpleChanges , EventEmitter } from '@angular/core';
import { Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { SipService } from '@scalio/sip';
import { uniqBy } from 'lodash/fp';
import { NzModalRef } from 'ng-zorro-antd/modal';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { selectContactGhosts, sendCustomerOptInRequest, UserContact, UserContactGhost } from '../../../feature-contacts';
import { addPulsToMultilineNumber, cleanPhoneNumber, getMsgChannelTypeForSingleParticipant } from '../../../shared';
import { selectPeersMessages } from '../../ngrx';


export interface MessageThreadInfo {
    contactName: string;
    contactNumber: string;
    lastMessageText: string;
    isWhatsAppThread:boolean;
  }

@Component({
    selector: 'movius-web-optIn-whatsapp-template',
    templateUrl: './optIn-whatsapp-template.component.html',
    styleUrls: ['./optIn-whatsapp-template.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OptInWhatsappTemplateComponent  {

    @Input() headerTitle: string;
    @Input() actionBtnTitle: string;
    peerMessages: any;
    @Input() waPeerId;
    @Input() showActionBtns:boolean;

    @Input()
    onCancelAction: () => any;

    // messagingThreadList:MessageThreadInfo[] = [];
    messagingThreadList = [];
    savedContact: any;
    readonly peers$: Observable<UserContact[]>;
    getWaPeerId: any;
    apiUserIdentity: string;
    isMobileDevice: boolean;

    constructor(
        private readonly _modal: NzModalRef,
        private readonly store: Store,
        sipService: SipService,
        private readonly router: Router,
    ) {
        this.isMobileDevice = ((sessionStorage.getItem('Contex_res')?.toLowerCase() === "ios") || (sessionStorage.getItem('Contex_res')?.toLowerCase() === "android"))
        ? true : false;
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
        this.peers$.subscribe(peers =>{
            this.savedContact = peers;
        });
        this.apiUserIdentity = sessionStorage.getItem('__api_identity__');

    }

    ngAfterViewInit () {
        this.getWaPeerId = this.waPeerId
        this.loadPeerMessagesList(this.waPeerId)
    }

    loadPeerMessagesList(peerId) {
        this.peerMessages?.filter((peers) => {
            if (peers.messageChannelType != 'normalMsg') {
                peers.participants.filter((peer) => {
                    if (peer == `whatsapp:${cleanPhoneNumber(peerId)}`) {
                        this.messagingThreadList.push(peers)
                    }
                })
            }
        })
    }

    onClose() {
        let cancel;
        if (!!this.onCancelAction) {
            cancel = this.onCancelAction();
        }
        this._modal.close(cancel);
    }

    onSelectedThread(threadId:string) {
        this.onClose();
        this.router.navigate(['/messaging', 'chat', threadId])
    }

    onOpenNewChat() {
        const peerIdVal = `whatsapp:${cleanPhoneNumber(this.getWaPeerId)}`;
        this.store.dispatch(sendCustomerOptInRequest({  peerId: peerIdVal }));
        this.onClose();
    }

    getPeerDataList(fromNum: any): UserContactGhost {
        if (!fromNum.isGroup) {
            const participant = fromNum.peerId?.includes('whatsapp') ? fromNum.peerId?.replace('whatsapp:', '') : fromNum.peerId;
            const peer = this.savedContact.filter((e) => e.multiLine === participant);
            if (peer.length > 0) {
                return peer[0];
            }
            return null;
        }
    }

    getParticipantImage(fromNum: any): UserContactGhost {
        const participant = fromNum.includes('whatsapp') ? fromNum.replace('whatsapp:', '') : fromNum;
        const peer = this.savedContact.filter((e) => e.multiLine === participant);
        if (peer.length > 0) {
            return peer[0];
        }
        return null;
    }

    getParticipantNameOrNumber(fromNum: any) {
        const participant = fromNum.includes('whatsapp') ? fromNum.replace('whatsapp:', '') : fromNum;
        if(participant == this.apiUserIdentity) {
            return 'You'
        } else {
        const peer = this.savedContact.filter((e) => e.multiLine === participant);
        if (peer.length > 0) {
            return peer[0].name;
        }
        return this.getMultlineNumber(fromNum);
        }
    }

    getMultlineNumber(fromNum) {
        const number = fromNum.includes('whatsapp') ? fromNum.replace('whatsapp:', '') : fromNum;
        return addPulsToMultilineNumber(number);
    }

    showContentMsg(message) {
        switch (message.messageType) {
            case 'text':
                return message.content;
            case 'picture':
                return 'Photo';
        }
    }

    getParticipantsList(participants) {
        const identityUser = participants.some((f) => f == this.apiUserIdentity)
        if (identityUser) {
            participants = participants.filter(item => item !== this.apiUserIdentity);
            participants.unshift(this.apiUserIdentity);
            return participants
        } else {
            return participants
        }
    }

    getChannelType(participant){
        return getMsgChannelTypeForSingleParticipant(participant)
    }

    GetTheme(){
        let theme = localStorage.getItem("Theme")
        return theme ? "Dark" : null
    }
}
