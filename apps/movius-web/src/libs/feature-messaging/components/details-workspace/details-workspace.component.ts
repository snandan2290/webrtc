import { AfterViewChecked, AfterViewInit, Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { SipService } from '@scalio/sip';
import { uniqBy } from 'lodash/fp';
import { NzModalService } from 'ng-zorro-antd/modal';
import { combineLatest, Observable } from 'rxjs';
import { filter, map, switchMap } from 'rxjs/operators';
import {
    deleteContact,
    selectContactGhosts,
    sendCustomerOptInRequest,
    startAddToExistentContact,
    UserContactGhost
} from '../../../feature-contacts';
import { getFeatureEnabled, cleanPhoneNumber, getPeerNumberWOSpecialChars } from '../../../shared';
import { selectHash, selectMessagesContactGhosts, selectPeersMessages } from '../../ngrx';
import { OptInWhatsappTemplateComponent } from '../optIn-whatsapp-template/optIn-whatsapp-template.component';

export interface DetailsWorkspaceView {
    ghost: UserContactGhost;
}

@Component({
    selector: 'movius-web-details-workspace',
    templateUrl: './details-workspace.component.html',
    styleUrls: ['./details-workspace.component.scss'],
})
export class DetailsWorkspaceComponent implements OnInit, AfterViewChecked {

    view$: Observable<DetailsWorkspaceView>;
    peers$: Observable<UserContactGhost[]>;
    appEmbededStatus: string;
    hashedRecords: any  = [];
    getActiveChatId: any
    messagingThreadList:any = [];
    peerMessages: any;

    constructor(
        private readonly router: Router,
        private activatedRouter: ActivatedRoute,
        private readonly store: Store,
        private sipService: SipService,
        private readonly modalService: NzModalService,
    ) {
        this.appEmbededStatus = getFeatureEnabled();
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
        this.store.select(selectHash).subscribe((res => {
            this.hashedRecords = res;
            this.onContactInformation();
        }))
    }
    
    ngAfterViewChecked(): void {    
        this.appEmbededStatus = getFeatureEnabled();
        this.store.select(selectHash).subscribe((res => {
            this.hashedRecords = res;
            this.onContactInformation();
        }))
    }

    onContactInformation(){
        this.peers$ = this.store.select(selectContactGhosts(this.sipService.getUserUri));
        const id$ = this.activatedRouter.params.pipe(map(({ id }) => id));
        this.activatedRouter.params.subscribe((val) => this.getActiveChatId = val.id)
        let getCurrentChatId = this.getActiveChatId;
        let getCurrentChatIdWA = this.getActiveChatId;
        const peerMessagedObj = this.hashedRecords[this.getActiveChatId]
        if (peerMessagedObj?.messageChannelType != 'normalMsg') {
            if (peerMessagedObj?.participants) {
                getCurrentChatId = peerMessagedObj?.participants ? peerMessagedObj?.participants[0].includes('whatsapp:') ? peerMessagedObj?.participants[0].replace('whatsapp:', '') : peerMessagedObj?.participants[0] : peerMessagedObj?.peerId.includes('whatsapp:') ? peerMessagedObj?.peerId.replace('whatsapp:', '') : peerMessagedObj?.peerId;
                getCurrentChatIdWA = peerMessagedObj?.participants[0] ? peerMessagedObj?.participants[0] : peerMessagedObj?.peerId
            }
        } else {
            getCurrentChatIdWA = getCurrentChatId.includes('whatsapp:') ? getCurrentChatId.replace('whatsapp:', '') : getCurrentChatId;
        }

        const userContactGhosts$ = id$.pipe(
            switchMap((id) =>
                this.store
                    .select(selectMessagesContactGhosts(this.sipService.getUserUri))
                    .pipe(map((ghosts) => ghosts.find((f) => {
                        if (f.id === getCurrentChatId) {
                            return f.id === getCurrentChatId
                        } else {
                            return f.id === getCurrentChatIdWA
                        }
                    })))
            ),
            filter((f) => !!f)
        );
        this.view$ = combineLatest([
            userContactGhosts$,
        ]).pipe(
            map(([userContactGhost]) => {
                return {
                    ghost: userContactGhost,
                };
            })
        );
    }

    ngOnInit(): void {}

    onCreateContact(peerId: string) {
        if (this.appEmbededStatus === 'messaging') {
            this.router.navigate(['messaging/new', peerId], {
            });
        } else {
            this.router.navigate(['contacts', 'new', peerId]);
        }
    }

    onAddToContact(peerId: string) {
        this.store.dispatch(startAddToExistentContact({ mlNumber: peerId }));
    }

    onDeleteContact({id, peerId}) {
        this.store.dispatch(deleteContact({ id, peerId }));
    }

    onWhatsAppMessage(session) {
        this.getOptInParticipants(session.peerId);
    }

    loadPeerMessagesList(peerId) {
        this.peerMessages.filter((peers) => {
            if (peers.messageChannelType == 'whatsapp') {
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

    onWeChatMessage(session: any) {
        this.modalService.create({
            nzContent: OptInWhatsappTemplateComponent,
            nzComponentParams: {
                headerTitle: 'History',
                actionBtnTitle: 'New Chat',
                waPeerId: session.peerId,
                showActionBtns: false,
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
    }

    onLineMessage(session: any) {
        this.modalService.create({
            nzContent: OptInWhatsappTemplateComponent,
            nzComponentParams: {
                headerTitle: 'History',
                actionBtnTitle: 'New Chat',
                waPeerId: session.peerId,
                showActionBtns: false,
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
    }

}
