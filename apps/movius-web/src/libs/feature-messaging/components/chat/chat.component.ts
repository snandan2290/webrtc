import {
    ChangeDetectionStrategy,
    Component,
    ElementRef,
    EventEmitter,
    Input,
    OnChanges,
    OnDestroy,
    OnInit,
    Output,
    QueryList,
    ViewChild,
    ViewChildren,
} from '@angular/core';
import { Router } from '@angular/router';
import { LoggerFactory } from '@movius/ts-logger';
import { Store } from '@ngrx/store';
import { SipService } from '@scalio/sip';
import { getDate, parseISO } from 'date-fns';
import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { delay, filter, map, take, takeUntil } from 'rxjs/operators';
import { DateTimeService } from '../../../shared';
import { ChatSessionView, PeerChatMessage } from '../../models';
import { PeerChatMessageView, selectMessageSearchText, selectPeerMessagesByKey, selectPeersMessages } from '../../ngrx';
import { ChatWorkspaceService, ScrollToBottomFlag, MessagingService } from '../../services';
import { PeerChatMessageComponentView } from '../chat-item/chat-item.component';
import { ChatItemObserver } from './chat-item-observer';
const logger = LoggerFactory.getLogger("")

const checkIfDateBefore = (cur: PeerChatMessage, prev: PeerChatMessage) => {
    if (!cur && !prev) {
        return false;
    }
    if (!!cur && !prev) {
        return true;
    }
    return (
        getDate(parseISO(cur?.sentTime)) !== getDate(parseISO(prev?.sentTime))
    );
};

const formatDate = (dateTimeService: DateTimeService, msg: PeerChatMessage) => {
    if (!msg?.sentTime) return null;
    return dateTimeService.formatHistoryDate(msg?.sentTime);
};

const BATCH_SIZE = 20;
const BATCH_OFFSET = 5;

const getBatchIndex = (n: number) => Math.floor(n / BATCH_SIZE);

export interface FirstNotReadMemoized {
    msgId: string;
    totalCount: number;
}

const mapToComponentView = (
    firstNotRead: FirstNotReadMemoized | null,
    dateTimeService: DateTimeService,
    pervMsg: PeerChatMessageView,
    msg: PeerChatMessageView,
    i: number,
    totalUnreadCount: number
): PeerChatMessageComponentView => {
    const batchIndex1 = getBatchIndex(i + BATCH_OFFSET);
    const batchIndex2 = getBatchIndex(i + 1 + BATCH_OFFSET);
    const isFirstNotRead = (!pervMsg || pervMsg.isRead) && !msg.isRead;
    return {
        ...msg,
        isFirstNotRead:
            firstNotRead && totalUnreadCount > 0
                ? firstNotRead.msgId === msg.id
                    ? firstNotRead.totalCount
                    : false
                : isFirstNotRead && totalUnreadCount > 0
                ? totalUnreadCount
                : false,
        isDateBefore: checkIfDateBefore(msg, pervMsg),
        dateFormatted: formatDate(dateTimeService, msg),
        batchIndex: getBatchIndex(i),
        nextBatchSignal: batchIndex1 !== batchIndex2,
    };
};

const checkNotifyItemVisible = (session: ChatSessionView) => (
    msg: PeerChatMessageComponentView
) => {
    return !msg.isRead || msg.id === session.loadNextPageMessageId;
};

@Component({
    selector: 'movius-web-chat',
    templateUrl: './chat.component.html',
    styleUrls: ['./chat.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChatComponent implements OnDestroy, OnInit, OnChanges {
    private firstNotReadMemoized: FirstNotReadMemoized = null;
    _session: ChatSessionView;
    emitMessageDisplayed = false;
    contentIdValue: any;
    matchedMsgCount: number = 0;
    matchedMsgElements:any = [] ;
    public mmelemtnstest:any = [];
    loadedChat:boolean=false;
    msgHavingInbtwText: any = [];
    msgSearchContent:string='';
    private readonly activeBatchIndex$ = new BehaviorSubject(0);
    private readonly allMessages$ = new BehaviorSubject<
        PeerChatMessageComponentView[]
    >([]);
    readonly renderedMessages$: Observable<PeerChatMessageComponentView[]>;
    private readonly destroy$ = new Subject();
    private chatItemObserver = new ChatItemObserver((msg) =>
        this.onMessageItemDisplayed(msg)
    );
    @ViewChild('messagesContainer') private messagesContainer: ElementRef<
        HTMLElement
    >;

    @ViewChildren('item', { read: ElementRef }) private itemElements: QueryList<
        ElementRef<HTMLElement>
    >;

    ngOnChanges(){
        this.chatItemObserver = new ChatItemObserver((msg) =>{
            this.onMessageItemDisplayed(msg)
        });
    }

    @Input() set session(val: ChatSessionView) {
        // subscribing data from selector when the messages array is shown empty in @Input when optin request is sent 
        if (val.messages.length === 0) {
            const peerMessages$ = this.store
                .select(selectPeersMessages(this.sipService.getUserUri))
                .pipe(
                    map((m) => m.filter((f) => f.messages.length > 0)),
                );
            peerMessages$.subscribe(peers => {
                let filterPeerIdData: any = peers.filter((res) => {
                    return res.threadId === this.router.url.split('/')[3]
                });
                if(filterPeerIdData.length > 0) { 
                    val.messages = filterPeerIdData[0].messages;
                }
                val.threadId = this.router.url.split('/')[3]
            });
        }
        if (this._session !== val) {
            if (this._session?.threadId !== val.threadId) {
                this.firstNotReadMemoized = null;
                this.emitMessageDisplayed = false;
            }
            this._session = val;
            const reversed = (val?.messages
                ? (val.messages as PeerChatMessageView[])
                : []
            )
                .slice()
                .reverse(); //

            const totalUnreadCount = reversed.filter((f) => !f.isRead).length;

            const allMessages = reversed.map((item, i) =>
                mapToComponentView(
                    this.firstNotReadMemoized,
                    this.dateTimeService,
                    reversed[i - 1],
                    item,
                    i,
                    totalUnreadCount
                )
            );
            const firstNotRead = allMessages.find(
                (f) => f.isFirstNotRead !== false
            );
            if (firstNotRead) {
                this.firstNotReadMemoized = {
                    msgId: firstNotRead.id,
                    totalCount: firstNotRead.isFirstNotRead as number,
                };
            }
            logger.debug('General:: Total No of Messages for Thread::' + this._session?.threadId + ':', allMessages.length)
            this.allMessages$.next(allMessages);
        }
    }
    @Output() messageDisplayed = new EventEmitter<PeerChatMessage>();
    @Output() removeMessage = new EventEmitter<PeerChatMessage>();
    @Output() forwardMessage = new EventEmitter<PeerChatMessage>();
    @Output() copyMessage = new EventEmitter<PeerChatMessage>();
    @Input() loadedPictureMessage_chat_workspace:string[];
    @Input() cnt_id : Observable<number>;
    @Output() loadedImages_chat_workspace = new EventEmitter();
    get session() {
        return this._session;
    }

    constructor(
        private readonly dateTimeService: DateTimeService,
        chatWorkspaceService: ChatWorkspaceService,
        private readonly messagingService: MessagingService,
        private readonly store: Store,
        private router: Router,
        private sipService: SipService,
    ) {
        store.select(selectMessageSearchText).subscribe(searchText =>{
            this.msgSearchContent = searchText
        })
        this.allMessages$
            .pipe(
                takeUntil(this.destroy$),
                delay(0),
                filter(() => this._session.status?.kind === 'StateStatusLoaded' || this._session.status?.kind === 'StateStatusInitial')
            )
            .subscribe((items) => {
                const checkNotify = checkNotifyItemVisible(this._session);
                if (!this.emitMessageDisplayed) {
                    setTimeout(() => {
                        this.emitMessageDisplayed = true;
                        const hashUnreadMessages = items.some((f) => !f.isRead);
                        if (hashUnreadMessages) {
                            this.scrollToUnread();
                        } else {
                            this.scrollToBottom('none');
                        }
                        this.chatItemObserver.update(
                            items,
                            this.itemElements.toArray(),
                            checkNotify
                        );
                    }, 0);
                } else {
                    this.chatItemObserver.update(
                        items,
                        this.itemElements.toArray(),
                        checkNotify
                    );
                }
            });

        chatWorkspaceService.scrollToBottom
            .pipe(takeUntil(this.destroy$))
            .subscribe((flag) => {
                logger.debug('movius-web-chat:scrollToBottom', flag);
                this.scrollToBottom(flag);
            });
    }

    ngOnInit() {
        this.allMessages$
        .pipe(
            takeUntil(this.destroy$),
            delay(0),
        )
        .subscribe((items) => {
            setTimeout(() => {
        this.messagingService.changeName(0);
        this.messagingService.MessageLazyLoaded.subscribe((res)=>{
            this.loadedChat = res
        })
        this.messagingService.name.subscribe(data=>{
            this.matchedMsgCount = data;
          });
        if (this.msgSearchContent != null && this.msgSearchContent.length >= 2) {       
            this.msgHavingInbtwText = [];
            this.mmelemtnstest = [];
            const hashUnreadMessages = items.some((f) => f.content.includes(this.msgSearchContent));
            items.forEach((ext) => {
                if(ext.content.includes(this.msgSearchContent)) {
                    this.contentIdValue = ext.content;
                    this.msgHavingInbtwText.push(this.contentIdValue);
                }
            });

            if (hashUnreadMessages) {
                let unreadMessagesElement = document.querySelectorAll(`[id^=`+ "\'" + this.msgSearchContent + "\'" + `]`);

                if(unreadMessagesElement.length > 0){
                    this.mmelemtnstest.push(unreadMessagesElement);
                }

                if(this.msgHavingInbtwText != null){
                    this.msgHavingInbtwText.forEach((btwtxt) => {
                        unreadMessagesElement = document.querySelectorAll(`[id^=`+ "\'" + btwtxt + "\'" + `]`);
                        this.mmelemtnstest.push(unreadMessagesElement);
                    });
                }

                if(this.mmelemtnstest.length == 1) {
                    this.matchedMsgCount = this.mmelemtnstest[0].length;
                } else {
                    this.matchedMsgCount = this.mmelemtnstest.length;
                }

                this.messagingService.changeName(this.matchedMsgCount);
                sessionStorage.setItem('matchedMsgCounttest', this.matchedMsgCount.toString());
                this.mmelemtnstest.push(unreadMessagesElement);

                this.mmelemtnstest?.forEach((elmt) => {
                    elmt[0]?.scrollIntoView();
                });
            }
        }
        }, 0);
        });
    }

    ngOnDestroy(): void {
        this.chatItemObserver.dispose();
        this.destroy$.next();
    }

    private checkOffset(nativeElement: HTMLElement) {
        return true;
    }

    scrollToBottom(flag: ScrollToBottomFlag) {
        const nativeElement = this.messagesContainer?.nativeElement;
        
        if (nativeElement) {
            if (
                flag === 'ignoreWhenOffset' &&
                !this.checkOffset(nativeElement)
            ) {
                return;
            }
            if(flag === "ignoreWhenOffset"){
                this.onMessageItemDisplayed(this.session.messages[0]['id']);
            }
            nativeElement.scrollIntoView({
                block: 'end',
            });
        }
    }

    private scrollToUnread() {
        const unreadMessagesElement = document.getElementById(
            'unread_messages_element'
        );
            unreadMessagesElement?.scrollIntoView();
    }

    trackByFun(_, item: PeerChatMessageView) {
        return item.id;
    }

    onBecomeVisible(msg: PeerChatMessage) {
        if(msg && msg.id !== null){
            this.messageDisplayed.emit(msg);
        }
    }

    private onMessageItemDisplayed = (msgId) => {
        //logger.debug('onMessageItemDisplayed', msgId);
        
        const msg = this.allMessages$.value.find((f) => f.id === msgId);
        if (msg.nextBatchSignal) {
            this.activeBatchIndex$.next(this.activeBatchIndex$.value + 1);
        }
        if(msg && msg.id !== null){
            this.messageDisplayed.emit(msg);
        }
    };

    loadedImages_chat(event) {
        this.loadedImages_chat_workspace.emit(event)
    }

    goToPrev(){
        let curVal = this.matchedMsgCount - 1;
    }

    goToNext(){
        let curVal = this.matchedMsgCount + 1;
    }

    loadPreviousMessages(){
        this.messagingService.MessageLazyLoaded.next(true);
        try {
            //let threadid = null;
            const threadid = this.session.peer.id?.includes('whatsapp:') ? this.session.threadId : this.session.peer.id;
            // if (this.session['isGroup'])
            //     if (this.session['isWhatsAppThread'])
            //         threadid = this.session.threadId;
            //     else threadid = this.session.peer.id;
            // else if (
            //     this.session['isWhatsAppThread'] &&
            //     this.session.peer.id.includes('whatsapp:')
            // ) {
            //     threadid = this.session.peer.id.replace('whatsapp:', '');
            // } else {
            //     threadid = this.session.peer.id;
            // }
            let seq = null;
            if (this.session.messages.length > 0) {
                let length = this.session.messages.length;
                if (this.session.messages[length - 1].state['seq']) {
                    seq = this.session.messages[length - 1].state['seq'];
                } else {
                    this.store
                        .select(selectPeerMessagesByKey(threadid))
                        .pipe(take(1))
                        .subscribe((res) => {
                            if (res.status.latestLoadedSeq) {
                                seq = res.status.latestLoadedSeq.seq;
                            } else {
                                seq = res.seq;
                            }
                            this.messagingService.loadPreviousPeerHistory(
                                threadid,
                                seq,
                                ''
                            );
                        });
                }
            } else {
                seq = this.session.status.latestLoadedSeq?.seq;
            }
            if (seq)
                this.messagingService.loadPreviousPeerHistory(
                    threadid,
                    seq,
                    ''
                );
            else this.messagingService.MessageLazyLoaded.next(false);
        } catch (e) {
            logger.debug('error in load new messages. '+e);
            this.messagingService.MessageLazyLoaded.next(false);
        }
    }

}
