import { EncryptService } from '@movius/encrypt';
import { IDBPDatabase } from 'idb';
import { omit } from 'lodash/fp';
import {
    Media,
    Message,
    MessageEncrypted,
    MessageError,
    MessageThread,
    RetryQueue,
} from './models';
import { DbObjectStore } from './models/db-object-store';
import {
    MoviusDbSchema,
    UserOwned,
    UserOwnedEncrypted,
} from './models/db-schema';
import { covertToTimeZoneDate, getMsgChannelTypeFromParticipants, getValidParticipantsArray, sortParticipantsAsID } from 'apps/movius-web/src/libs/shared';
import { ParticipantThread } from './models/participants';
import { messageInfoType } from './models/messageInfo';
import { LoggerFactory } from '@movius/ts-logger';
const logger = LoggerFactory.getLogger("");

let MEDIA_COUNT_THRESHOLD = 3;
let MEDIA_STORAGE_THRESHOLD = 1024 * 1024 * 2;
// Aggregator
export class MessageRepository {
    constructor(
        private readonly db: IDBPDatabase<MoviusDbSchema>,
        private readonly encryptService: EncryptService
    ) {
        if (window['MEDIA_STORAGE_THRESHOLD'] !== undefined)
            MEDIA_STORAGE_THRESHOLD = 1024 * 1024 * window['MEDIA_STORAGE_THRESHOLD']
        if (window['MEDIA_COUNT_THRESHOLD'] !== undefined)
            MEDIA_COUNT_THRESHOLD = window['MEDIA_COUNT_THRESHOLD']
    }

    private readonly encrypt = (msg: Message & UserOwned) =>
        this.encryptService.encryptObj<MessageEncrypted & UserOwnedEncrypted>(
            msg,
            ['content', 'userId', 'peerId', 'owner']
        );

    private readonly decrypt = (msg: MessageEncrypted & UserOwnedEncrypted) =>
        this.encryptService.decryptObj<Message & UserOwned>(msg, [
            'content',
            'userId',
            'peerId',
            'owner',
        ]);

    private get ctx() {
        const transaction = this.db.transaction('messages', 'readwrite');
        const store = transaction.objectStore('messages');
        return { transaction, store };
    }

    private get ctxMedia() {
        const transaction = this.db.transaction('media', 'readwrite');
        const store = transaction.objectStore('media');
        return { transaction, store };
    }

    private get ctxRetryQueue() {
        const transaction = this.db.transaction('retryQueue', 'readwrite');
        const store = transaction.objectStore('retryQueue');
        return { transaction, store };
    }

    private get ctxParticipants() {
        const transaction = this.db.transaction('participants', 'readwrite');
        const store = transaction.objectStore('participants');
        return { transaction, store };
    }

    async getMessagesWithFilter(owner: string) {
        const ownerEncrypted = await this.encryptService.encrypt(owner);
        const { store } = this.ctx;
        const encrypted = await store.index('owner').getAll(ownerEncrypted);
        let decrypted = await Promise.all(encrypted.map(this.decrypt));
        decrypted= decrypted.filter((sts) => sts.state.kind != 'MessageStateSending')
        const resultPromise = decrypted.map(async e => {
            if (e.messageType !== "text") {
                e.messageInfo = await this.getMessageInfo(e.id);
            }
            return e
        })
        const result = Promise.all(resultPromise);
        return result;
    }
    // get messages
    async getMessages(owner: string) {
        const ownerEncrypted = await this.encryptService.encrypt(owner);
        const { store } = this.ctx;
        const encrypted = await store.index('owner').getAll(ownerEncrypted);
        const decrypted = await Promise.all(encrypted.map(this.decrypt));
        const resultPromise = decrypted.map(async e => {
            if (e.messageType !== "text") {
                e.messageInfo = await this.getMessageInfo(e.id);
            }
            return e
        })
        const result = Promise.all(resultPromise);
        return result;
    }

    // add messages
    private async addMessageEncrypted(
        message: MessageEncrypted & UserOwnedEncrypted,
        store: DbObjectStore<'messages'>
    ) {
        return store.add(message);
    }

    async addMessagesRange(owner: string, messages: Message[]) {
        const encrypted = await Promise.all(
            messages.map((x) => this.encrypt({ ...x, owner }))
        );
        const { store } = this.ctx;
        return Promise.all(
            encrypted.map((message) => this.addMessageEncrypted(message, store))
        );
    }

    async addMessage(owner: string, message: Message) {
        const encryptedMessage = await this.encrypt({ ...message, owner });
        const { store } = this.ctx;
        return this.addMessageEncrypted(encryptedMessage, store);
    }

    // replaceMessage
    async replaceMessage(removeMessageId: string, addMessage: Message) {
        const encryptedMessage = await this.encrypt({
            ...addMessage,
            owner: addMessage.userId,
        });
        const { store } = this.ctx;
        return Promise.all([
            store.delete([removeMessageId, encryptedMessage.owner]),
            store.add(encryptedMessage),
        ]);
    }

    // addOrIgnoreMessages
    async addOrIgnoreMessagesRange(owner: string, messages: Message[], messageType?) {
        const result = await this.getMessagesWithFilter(owner)
        if (messageType === "voicemail") {
            for (let i = 0; i < messages.length; i++) {
                const msg = result.filter(e =>
                    (e.peerId == messages[i].peerId) && (e.messageType !== "voicemail")
                )
                if (msg.length > 0) {
                    messages[i].threadId = msg[0].threadId
                }
            }
        }
        const encrypted = await Promise.all(
            messages.map((x) => this.encrypt({ ...x, owner }))
        );
        const { store } = this.ctx;
        return Promise.all(
            encrypted.map((message) =>
                this.addOrIgnoreMessageEncrypted(message, store)
            )
        );
    }

    async addOrIgnoreMessage(owner: string, message: Message, isGroup: boolean) {
        const parties = await this.getAllParticipantsList()
        const participants = sessionStorage.getItem('participants');
        let isThreadfoundforGroup = false
        if (parties.length > 0) {
            const threadFound = parties.filter((x) => x["threadId"] === message.threadId)
            isThreadfoundforGroup = threadFound.length > 0 ? true : false
        }
        const isCallIdFoundforGroup = sessionStorage.getItem(message.callId);
        let allNumbers = "";
        if ((participants !== null && participants !== "null") && (isThreadfoundforGroup !== true || isCallIdFoundforGroup != null)) {
            if (isGroup === true) {
                allNumbers = sortParticipantsAsID(participants.split('|'));
                message.peerId = allNumbers;
            }
        }
        if (sessionStorage.getItem('resend-' + message.callId) !== "null" && sessionStorage.getItem('resend-' + message.callId) !== null && sessionStorage.getItem('resend-' + message.callId) !== undefined) {
            message.peerId = sortParticipantsAsID(sessionStorage.getItem('resend-' + message.callId).split('|'));
        } else if (sessionStorage.getItem('resend_121-' + message.callId) !== "null" && sessionStorage.getItem('resend_121-' + message.callId) !== null) {
            message.peerId = sessionStorage.getItem('resend_121-' + message.callId);
        }

        const encrypted = await this.encrypt({ ...message, owner });
        const { store } = this.ctx;

        return this.addOrIgnoreMessageEncrypted(encrypted, store);
    }

    // async checkMsgIdExistsorNot(messageId){
    //     const transaction = this.db.transaction('messages', 'readwrite');
    //     const store = transaction.store
    //     const messagesDb = await store.getAll();
    //     let msgExists = messagesDb?.filter((e) => e.id == messageId)
    //     if(msgExists?.length == 1){
    //         return true;
    //     } else {
    //         return false;
    //     }
    // }

    async addOrUpdateRetryQ(message: RetryQueue) {
        const owner = sessionStorage.getItem('__api_identity__');
        const { store } = this.ctxRetryQueue;
        const record = await store.add(message);
    }

    async isRcrdFoundInRetryQ(owner: string, id: string) {
        // return true if id found in retryQueue
        owner = sessionStorage.getItem('__api_identity__');
        const { store } = this.ctxRetryQueue;
        const record = await store.count(id);
        return record > 0 ? true : false
    }

    async popMediaList(owner: string, mediaKeys: string[]) {
        /**
         * library method to delete the list of records with provided keys
         */
        const { store } = this.ctxMedia;
        Promise.all(mediaKeys.map((key) => store.delete(key)));
        mediaKeys.forEach( (key) => {
            console.log('Delete from session = ' + key)
            sessionStorage.removeItem('download-'+key);
        });   
        logger.debug(mediaKeys.length, " number of Media records are deleted");
    }

    async getMediaSortedByTimeStamp(owner: any) {
        /**
         * library method to fetch sorted Media records
         */
        const { store } = this.ctxMedia;
        let allMedia = await store.getAll();
        // sort the records based on the update time
        allMedia.sort(function (x, y) {
            const date1: any = new Date(x.update_r_download_time);
            const date2: any = new Date(y.update_r_download_time);
            return date1 - date2;
        });
        return allMedia
    }

    async popMediaWRTRecrdCount(owner: string) {
        /**
         * method to 
         * 1) check the MediaCount threshold
         * 2) if threshold reached, get keys to be deleted
         * 3) pop the list of Media records with Keys.
         */
        const { store } = this.ctxMedia;
        const media = await store.count();
        const diff = media - MEDIA_COUNT_THRESHOLD
        if (diff >= 0) {
            const MediasSorted:Media[] = await this.getMediaSortedByTimeStamp(owner)
            const toBeDeletedMediaKeys = [];
            for (let i = 0, j = 0; i < MediasSorted.length, j < diff + 1; i++) {
                // loop over the sorted records and get the old keys which are not found in retryQueue
                if (await this.isRcrdFoundInRetryQ(owner, MediasSorted[i].id) === false && !MediasSorted[i].retryExceeded) {
                    toBeDeletedMediaKeys.push(MediasSorted[i].id);
                    j += 1;
                }
            }
            await this.popMediaList(owner, toBeDeletedMediaKeys);
        }
    }

    async popMediaWRTStorage(owner: string, message: any) {
        const MediasSorted:Media[] = await this.getMediaSortedByTimeStamp(owner)
        let totSize = 0;
        MediasSorted.forEach((record) => {
            totSize += record.data.size;
        })
        const toBeDeletedMediaKeys = [];
        let strSizeAfterPush = totSize + message.data.size;
        if (strSizeAfterPush >= MEDIA_STORAGE_THRESHOLD) {
            for (let i = 0, rcrdSizeTBRmvd = strSizeAfterPush;
                i < MediasSorted.length, rcrdSizeTBRmvd > MEDIA_STORAGE_THRESHOLD;
                i++) {
                if (i === MediasSorted.length && rcrdSizeTBRmvd > MEDIA_STORAGE_THRESHOLD)
                    break;
                if (await this.isRcrdFoundInRetryQ(owner, MediasSorted[i].id) === false && !MediasSorted[i].retryExceeded) {
                    rcrdSizeTBRmvd -= MediasSorted[i].data.size;
                    toBeDeletedMediaKeys.push(MediasSorted[i].id);
                }
            }
            await this.popMediaList(owner, toBeDeletedMediaKeys);
        }
    }

    async getAllParticipantsList() {
        const transaction = this.db.transaction('participants', 'readwrite');
        const store = transaction.store;
        const particapantsList = await store.getAll();
        return particapantsList;
    }

    private async addOrIgnoreMessageEncrypted(
        message: MessageEncrypted & UserOwnedEncrypted,
        messagesStore: DbObjectStore<'messages'>
    ) {
        const count = await messagesStore.count([message.id, message.owner]);
        try {
            if (count === 0) {
                return await messagesStore.put(message);
            } else {
                // TODO : Add threadId key to retrieve null thread messages
                const msg = await messagesStore.get([
                    message.id,
                    message.owner,
                ]);
                if (message.messageType !== "voicemail") {
                    if (msg.threadId !== message.threadId) {
                        return await messagesStore.put(message);
                    }
                } else {
                    if (msg.threadId !== message.threadId || msg.messageInfo.isVoiceMailRead !== message.messageInfo.isVoiceMailRead) {
                        msg.threadId = message.threadId;
                        msg.messageInfo.isVoiceMailRead = message.messageInfo.isVoiceMailRead
                        return await messagesStore.put(msg);
                    }
                }
            }
        } catch (e) {
            return null;
        }
    }

    // Add entry into retryQueue table
    async insertToRetryQueue(message: RetryQueue) {
        const transaction = this.db.transaction('retryQueue', 'readwrite');
        const store = transaction.store
        return await store.add(message);
    }

    // Update an entry retryQueue table
    async updateRetryQueueEntry(message: RetryQueue) {
        const transaction = this.db.transaction('retryQueue', 'readwrite');
        const store = transaction.store
        return await store.put(message);
    }

    async getAllRetryQueue() {
        const transaction = this.db.transaction('retryQueue', 'readwrite');
        const store = transaction.store;
        const queues = await store.getAll();
        return queues;
    }

    async deleteRetryQueue(id: string) {
        const owner = sessionStorage.getItem("__api_identity__")
        const transaction = this.db.transaction('retryQueue', 'readwrite');
        const store = transaction.store;
        const queue = await store.delete(id);
        return
    }

    async getMediaById(id: string) {
        const { store } = this.ctxMedia;
        const media = await store.get(id);
        return media;
    }

    async addOrUpdateMessageSentTime(owner: string, message: Message) {
        const encrypted = await this.encrypt({ ...message, owner });
        const { store } = this.ctx;
        return this.addOrUpdateMessageSentTimeEncrypted(encrypted, store);
    }

    private async addOrUpdateMessageSentTimeEncrypted(
        message: MessageEncrypted & UserOwnedEncrypted,
        messagesStore: DbObjectStore<'messages'>
    ) {
        const count = await messagesStore.count([message.id, message.owner]);
        if (count === 0) {
            return await messagesStore.add(message);
        } else {
            return await messagesStore.put(message);
            // TODO : Add threadId key to retrieve null thread messages
            /*
            const msg = await messagesStore.get([message.id, message.owner]);        
            if (msg.threadId !== message.threadId) {
                return await messagesStore.put(message);
            }
            */
        }
    }

    async updateMessageReadSentRequestCount(
        owner: string,
        threadId: string,
    ) {
        if (!threadId) {
            console.error(
                'updateMessageReadTime threadId is incorrect !',
                threadId
            );
        }
        const ownerEncrypted = await this.encryptService.encrypt(owner);
        const transaction = this.db.transaction('messageThreads', 'readwrite');
        const store = transaction.store;
        const thread = await store.get([threadId, ownerEncrypted]);
        if (thread) {
            if (thread.optInRequestCount) {
                thread.optInRequestCount = thread.optInRequestCount+1;
                await store.put(thread);
            }
        }
    }

    async updateMessageReadTime(
        owner: string,
        threadId: string,
        dateTime: string
    ) {
        if (!threadId) {
            console.error(
                'updateMessageReadTime threadId is incorrect !',
                threadId
            );
        }
        const ownerEncrypted = await this.encryptService.encrypt(owner);
        const transaction = this.db.transaction('messageThreads', 'readwrite');
        const store = transaction.store;
        const thread = await store.get([threadId, ownerEncrypted]);
        if (thread) {
            //if (new Date(thread.readTime) < new Date(dateTime)) {
                thread.readTime = dateTime;
                await store.put(thread);
            //}
        } else {
            const thread: MessageThread & UserOwnedEncrypted = {
                id: threadId,
                readTime: dateTime,
                owner: ownerEncrypted,
                isMuted: false,
            };
            await store.add(thread);
        }
    }

    async updateLastIncommingMessageTime(
        owner: string,
        threadId: string,
        dateTime: string
    ) {
        if (!threadId) {
            console.error(
                'updateMessageReadTime threadId is incorrect !',
                threadId
            );
        }
        const ownerEncrypted = await this.encryptService.encrypt(owner);
        const transaction = this.db.transaction('messageThreads', 'readwrite');
        const store = transaction.store;
        const thread = await store.get([threadId, ownerEncrypted]);
        if (thread) {
            if (new Date(thread.lastIncommingMessageAt) < new Date(dateTime)) {
                thread.lastIncommingMessageAt = dateTime;
                await store.put(thread);
            }
        } else {
            const thread: MessageThread & UserOwnedEncrypted = {
                id: threadId,
                readTime: dateTime,
                lastIncommingMessageAt: dateTime,
                owner: ownerEncrypted,
                isMuted: false,
            };
            await store.add(thread);
        }
    }
    async updateThreadMute(owner: string, threadId: string, isMuted: boolean) {
        if (!threadId) {
            console.error(
                'updateMessageReadTime threadId is incorrect !',
                threadId
            );
        }
        const ownerEncrypted = await this.encryptService.encrypt(owner);
        const transaction = this.db.transaction('messageThreads', 'readwrite');
        const store = transaction.store;
        const thread = await store.get([threadId, ownerEncrypted]);
        if (thread) {
            thread.isMuted = isMuted;
            await store.put(thread);
        } else {
            console.warn('Update message mute, thread not found', threadId);
            const thread: MessageThread & UserOwnedEncrypted = {
                id: threadId,
                readTime: null,
                isMuted,
                owner: ownerEncrypted,
            };
            await store.add(thread);
        }
    }

    async hideMessageThread(owner: string, threadId: string, hideThread: boolean) {
        if (!threadId) {
            console.error(
                'hideMessageThread threadId is incorrect !',
                threadId
            );
        }
        const ownerEncrypted = await this.encryptService.encrypt(owner);
        const transaction = this.db.transaction('messageThreads', 'readwrite');
        const store = transaction.store;
        const thread = await store.get([threadId, ownerEncrypted]);
        if (thread) {
            thread.hideThread = hideThread;
            await store.put(thread);
        }
    }

    async threadIdExistsorNot(owner: string, threadId: any) {
        const ownerEncrypted = await this.encryptService.encrypt(owner);
        const transaction = this.db.transaction('messageThreads', 'readwrite');
        const store = transaction.store;
        const thread = await store.get([threadId, ownerEncrypted]);
        return thread;
    }

    async getThreads(owner: string) {
        const ownerEncrypted = await this.encryptService.encrypt(owner);
        const transaction = this.db.transaction('messageThreads', 'readwrite');
        const store = transaction.store;
        const threads = await store.index('owner').getAll(ownerEncrypted);
        //const filteredThreads =  threads.length ? threads.filter(e => e.whatsOptInReqStatus != 5) : []
        return threads.map(omit('owner'));
    }
    
    async addOrUpdateMessageThread(threadObj, userId){
        
        const ownerEncrypted = await this.encryptService.encrypt(userId);
        const transaction = this.db.transaction('messageThreads', 'readwrite');
        const store = transaction.store;
        const thread = await store.get([threadObj.id, ownerEncrypted]);
        let isWhatsAppThread = threadObj.isWhatsAppThread ? threadObj.isWhatsAppThread : thread?.isWhatsAppThread;
        if(threadObj.parties_list){
            isWhatsAppThread = getValidParticipantsArray(threadObj.parties_list).length ? getValidParticipantsArray(threadObj.parties_list).some(obj=> obj.includes('whatsapp')): false;
        } else if(thread?.parties_list){
            isWhatsAppThread = getValidParticipantsArray(thread?.parties_list).length ? getValidParticipantsArray(thread?.parties_list).some(obj=> obj.includes('whatsapp')): false;
        }
        const messageChannelType = threadObj?.parties_list ?  getMsgChannelTypeFromParticipants(getValidParticipantsArray(threadObj?.parties_list)) : thread?.messageChannelType;
        const createdAt = threadObj.t_created ? threadObj.t_created : thread?.createdAt;
        let whatsOptInStatus = this.getOptinStatusFromApiattstatusandtleft(threadObj.t_left, threadObj.att_status);
        let lastIncommingMessageAt = null;
        if(isWhatsAppThread && ((thread && !thread.lastIncommingMessageAt) || !thread) ){
            if(threadObj.messages && threadObj.messages.length && threadObj.messages[0].from !== userId){
                lastIncommingMessageAt = covertToTimeZoneDate(threadObj.messages[0].ts) //new Date(threadObj.messages[0].ts).toISOString();
            } else{
                lastIncommingMessageAt = covertToTimeZoneDate(threadObj.t_read);
            }
        }
        if(!thread){
            const messageThread: MessageThread & UserOwnedEncrypted = {
                id: threadObj.id,
                readTime: threadObj.t_read ? threadObj.t_read : null,
                isMuted: false,
                owner: ownerEncrypted,
                lastIncommingMessageAt: lastIncommingMessageAt,
                isWhatsAppThread: isWhatsAppThread,
                createdAt:createdAt,
                whatsOptInReqStatus: whatsOptInStatus,
                optInRequestCount: isWhatsAppThread ? 1 : 0,
                seq: threadObj.seq ? threadObj.seq: null,
                parties_list: threadObj.parties_list,
                messageChannelType: messageChannelType
            };
            // if(isWhatsAppThread){
            //     if (messageChannelType == 'Line' || messageChannelType == 'WeChat') {
            //         messageThread.whatsOptInReqStatus = 3
            //     } else {
            //         messageThread.whatsOptInReqStatus = whatsOptInStatus
            //     }
            // }
            await store.add(messageThread);
        } else {



            if (thread.isWhatsAppThread) {
                //logger.debug('MessageRepo::thread data', thread);
                //logger.debug('MessageRepo::thread object data', threadObj);
                if (threadObj.t_left != undefined) {
                    thread.whatsOptInReqStatus = this.getOptinStatusFromApiattstatusandtleft(threadObj.t_left, threadObj.att_status)
                    // if (threadObj.t_left == '') {
                    //     thread.whatsOptInReqStatus = threadObj.att_status
                    // } else {
                    //     thread.whatsOptInReqStatus = 5;              // user 1 left the conversation & user 2 is still in conversation
                    // }
                } else if (threadObj.whatsOptInReqStatus) {
                    thread.whatsOptInReqStatus = threadObj.whatsOptInReqStatus;
                }
                if (threadObj.seq) {
                    thread.seq = threadObj.seq
                }
                if (threadObj.parties_list) {
                    thread.parties_list = threadObj?.parties_list
                    thread.messageChannelType = getMsgChannelTypeFromParticipants(getValidParticipantsArray(thread?.parties_list))
                }
                if (threadObj.t_read) {
                    thread.readTime = threadObj.t_read;
                }
                if(threadObj.lastIncommingMessageAt){
                    thread.lastIncommingMessageAt = covertToTimeZoneDate(threadObj.lastIncommingMessageAt);
                }
                // if this field values comes from api in future
                // if(threadObj.lastIncommingMessageAt){
                //     thread.lastIncommingMessageAt = threadObj.lastIncommingMessageAt;
                // }
                // if(!thread.isWhatsAppThread){
                //     thread.isWhatsAppThread = isWhatsAppThread;
                // }
                // if(!thread.lastIncommingMessageAt){
                //     thread.lastIncommingMessageAt = lastIncommingMessageAt;
                // }
                // if(!thread.createdAt){
                //     thread.createdAt = covertToTimeZoneDate(threadObj.t_created);
                // }
                // if(threadObj.optInRequestCount != undefined && thread.optInRequestCount == undefined){
                // if(threadObj.optInRequestCount != undefined){
                //     thread.optInRequestCount = threadObj.optInRequestCount
                // }
            } else if(thread.id == threadObj.id && threadObj.whatsOptInReqStatus != undefined){
                logger.debug('updating optinstatus from the messagerep', thread);
                thread.whatsOptInReqStatus = threadObj.whatsOptInReqStatus;
                if(threadObj.lastIncommingMessageAt){
                    thread.lastIncommingMessageAt = covertToTimeZoneDate(threadObj.lastIncommingMessageAt);
                }
                if(threadObj.isWhatsAppThread){
                    thread.isWhatsAppThread = threadObj.isWhatsAppThread;
                }
            } else {
                thread.messageChannelType = getMsgChannelTypeFromParticipants(thread?.parties_list && thread?.parties_list.includes(',') ? thread?.parties_list?.split(',') : thread?.parties_list, messageChannelType)
                if (threadObj.t_read) {
                    thread.readTime = threadObj.t_read;
                }
            }
            await store.put(thread);
        }
    }


    getOptinStatusFromApiattstatusandtleft(t_left, att_status) {
        if (t_left != undefined) {
            if (t_left == '') {
                return att_status
            } else {
                return  5;
            }
        }
    }

    async acceptMessage(
        owner: string,
        callId: string,
        messageId: string,
        dateTime: string
    ) {
        //console.log("MessagingRepository : acceptMessage()");
        const ownerEncrypted = await this.encryptService.encrypt(owner);
        const { store } = this.ctx;
        const message = await store.get([callId, ownerEncrypted]);
        if(!message)
            console.log("messageRepo: message not available for id",callId);
        if (message && message.state.kind !== 'MessageStateSent') {
            const newMessage = {
                ...message,
                id: messageId,
                state: {
                    kind: 'MessageStateSent',
                    dateTime,
                },
            } as MessageEncrypted & UserOwnedEncrypted;
            // console.log("newMessage",newMessage," old message",message);
            await Promise.all([
                store.add(newMessage),
                store.delete([callId, ownerEncrypted]),
            ]);

            const messageInfo = await this.getMessageInfo(callId)
            if(messageInfo){
                const newMsgInfoObj = JSON.parse(JSON.stringify(messageInfo));
                newMsgInfoObj.id = messageId;
                this.replaceMessageInfo(messageInfo, newMsgInfoObj)
            }
        }
        //console.log("MessagingRepository : ending acceptMessage()");
    }

    async rejectMessage(owner: string, callId: string, error: MessageError) {
        const ownerEncrypted = await this.encryptService.encrypt(owner);
        const { store } = this.ctx;
        const message = await store.get([callId, ownerEncrypted]);
        if (message) {
            const updMessage = {
                ...message,
                state: {
                    kind: 'MessageStateError',
                    error,
                },
            } as MessageEncrypted & UserOwnedEncrypted;
            return store.put(updMessage);
        }
    }

    async addOrUpdateMessagesRange(owner: string, messages: Message[]) {
        const encrypted = await Promise.all(
            messages.map((x) => this.encrypt({ ...x, owner }))
        );
        const { store } = this.ctx;
        return Promise.all(
            encrypted.map((message) =>
                this.addOrUpdateMessageEncrypted(store, message)
            )
        );
    }

    private async addOrUpdateMessageEncrypted(
        messagesStore: DbObjectStore<'messages'>,
        message: MessageEncrypted & UserOwnedEncrypted
    ) {
        const count = await messagesStore.count([message.id, message.owner]);
        if (count > 0) {
            return await messagesStore.put(message);
        } else {
            return await messagesStore.add(message);
        }
    }

    async removePeerMessages(owner: string, peerId: string) {
        const ownerEncrypted = await this.encryptService.encrypt(owner);
        const peerIdEncrypted = await this.encryptService.encrypt(peerId);
        const { store } = this.ctx;
        const keys = await store
            .index('ownerAndPeer')
            .getAllKeys([peerIdEncrypted, peerIdEncrypted]);
        return Promise.all(keys.map((key) => store.delete(key)));
    }

    async removePeerMessage(owner: string, messageId: string) {
        const ownerEncrypted = await this.encryptService.encrypt(owner);
        const { store } = this.ctx;
        return store.delete([messageId, ownerEncrypted]);
    }

    async addParticipants(userId: string, participants: string, threadId: string) {
        const transaction = this.db.transaction('participants', 'readwrite');
        const store = transaction.store;

        let peerId = '';
        let isGroup;

        if (participants != null && participants !== 'undefined') {
            const numbers = participants.split('|');
            let sortParticipants = numbers.sort((a, b) => 0 - (a > b ? -1 : 1));

            for (let i = 0; i < sortParticipants.length; i++) {
                if (i == 0) {
                    peerId = sortParticipants[i];
                } else {
                    peerId = peerId + sortParticipants[i];
                }
            }

            if (peerId == null || peerId == "") {
                peerId = sortParticipants[0];
                isGroup = false;
            }
        }

        const thread = await store.get([threadId]);

        if (thread) {
            thread.threadId = threadId;
            thread.participants = participants;
            thread.isGroup = getValidParticipantsArray(thread.participants).length > 1 ? true : false,
            await store.put(thread);
        } else {
            // add
            const thread: ParticipantThread = {
                id: threadId,
                threadId: threadId ? threadId : '',
                participants: participants,
                isServer: false,
                isLocal: true,
                isGroup: getValidParticipantsArray(participants).length > 1 ? true : false,
            };
            await store.add(thread);
        }
    }

    async updateParticipants(peerId: string, modifyUser:string[], threadId:string, actionType: string) {
        const transaction = this.db.transaction('participants', 'readwrite');
        const store = transaction.store;
        const thread_data = await store.get([peerId]);
        if (thread_data) {
            const thread: ParticipantThread = {
                id: peerId,
                threadId: thread_data.threadId,
                participants: modifyUser,
                isServer: false,
                isLocal: true,
                isGroup: thread_data.isGroup
            };
            await store.put(thread);
        }
    }

    async getParticipants(peerId: string) {
        const transaction = this.db.transaction('participants', 'readwrite');
        const store = transaction.store;
        const thread = await store.get([peerId]);

        if (thread) {
            return thread.participants;
        }
        return '';
    }

    async getAllParticipants() {
        const transaction = this.db.transaction('participants', 'readwrite');
        const store = transaction.store;
        const particapantsList = await store.getAll();
        for (let i = 0; i < particapantsList.length - 1; i++) {
            sessionStorage.setItem(particapantsList[i].id, JSON.stringify(particapantsList[i].participants))
        }
        return particapantsList;
    }

    /** need:: take this to a common place. */
    async truncateObjectStore(ObjStoreName) {
        const transaction = this.db.transaction(ObjStoreName, 'readwrite');
        const store = transaction.objectStore(ObjStoreName);
        await store.clear()
    }

    //voicemails

    async updateVVMReadStatus(id) {
        console.log("updateVVMReadStatus:::id:::", id)
        let owner = sessionStorage.getItem('__api_identity__');
        // let id = message.id;
        // const ownerEncrypted = await this.encryptService.encrypt(owner);

        // const { store } = this.ctx;

        const transaction = this.db.transaction('messageInfo', 'readwrite');
        const store = transaction.store;

        const result = await store.get(id)
        console.log("updateVVMReadStatus::::result::", result)
        const updMessage = {
            ...result,
            isVoiceMailRead: true
        }
        console.log("updMessage:::", updMessage)
        return store.put(updMessage)
    }

    async getVVMMsgById(message) {
        let owner = sessionStorage.getItem('__api_identity__');
        const result = await this.getMessages(owner)
        const vvm = result.filter(e => e.messageType === "voicemail" && e.id === message)
        console.log("getVVMMsgById::vvm::", vvm);
        return vvm

    }

    async getVoiceMails(owner: string) {
        const result = await this.getMessages(owner)
        const voiceMails = result.filter(e => e.messageType == "voicemail")
        return voiceMails
    }

    async addOrUpdateAllMessageInfo(messages: messageInfoType[]) {
        return Promise.all(
            messages.map((message) =>
                this.addOrUpdateMessageInfo(message)
            )
        );
    }
    async addOrUpdateMessageInfo(message: messageInfoType) {

        const transaction = this.db.transaction('messageInfo', 'readwrite');
        const store = transaction.store

        const count = await store.count(message.id);
        if (count > 0) {
            if (message.messageType == 'voicemail') {
                return await store.put(message);
            }

            return true
        } else {
            return await store.add(message);
        }

    }

    async replaceMessageInfo(oldMessages, newMessage) {
        const transaction = this.db.transaction('messageInfo', 'readwrite');
        const store = transaction.store;
        store.delete(oldMessages.id);
        store.add(newMessage)
    }

    async getMessageInfo(messageId: string) {
        const transaction = this.db.transaction('messageInfo', 'readwrite');
        const store = transaction.store;
        const result = await store.index('id').get(messageId)
        return result;
    }

    async migratePrePicToPic(owner: string) {
        /**
         * migration script for clients from pre picture message to picture message version
         * process performed:
         * 1) when isVoiceMail is true in message
         * 1.1) remove it & add messageType as voicemail
         * 1.2) use the value when adding record to media_info table
         * 2) when isVoiceMail is undefined in message
         * 2.1) remove it & add messageType as text 
         * Note: in pre pic version only VM and text messages are supported
         * 3) when duration is found,
         * 3.1) remove it and use the value when adding record to media_info table
         * 4) find the parties_list of each message with threadID
         * 4.1) add parties_list into the message object
         */
        const messages = await this.getMessages(owner);
        const participants = await this.getAllParticipants();
        const thread2PartiesList = {} // hold thread:partiesList mapping
        participants.forEach((participant) => {
            thread2PartiesList[participant.threadId] = participant.participants;
        })
        const indivRcrdsFrParticipants = {};
        const rcrdForNTable = [];
        for (let i = 0; i < messages.length; i++) {
            let element: Message & UserOwned | any = messages[i];
            if (element.isVoiceMail) {
                if (element.isVoiceMail === true) {
                    element.messageType = 'voicemail';
                }
                delete element.isVoiceMail;
            } else {
                element.messageType = 'text';
            }
            let durationVM: any = 0;
            if (element.duration) {
                durationVM = element.duration;
                delete element.duration;
            }
            if (!element.parties_list) {
                if (thread2PartiesList[element.threadId]) {
                    // check whether the threadID belongs to group
                    element.parties_list = thread2PartiesList[element.threadId];
                } else {
                    if (sessionStorage.getItem(element.threadId) !== null) {
                        // this check is for some duplicate threadID created for same parties_list
                        element.parties_list = JSON.parse(sessionStorage.getItem(element.threadId))?.replaceAll(",", "|");
                    } else {
                        const foundParty = participants.filter((ele) => {
                            return ele.id === element.peerId
                        })
                        // if foundParty > 0, means 
                        // the peerID of the message is similar to a group 
                        // but this message is a one to one message
                        if (foundParty.length === 0) {
                            const parties_list = `${element.peerId}|${owner}`;
                            element.parties_list = parties_list;
                            if (indivRcrdsFrParticipants[element.peerId] == undefined
                                || indivRcrdsFrParticipants[element.peerId] !== true) {
                                // this adds the individual parties details into participants table
                                // NOTE: in pre version, participants table only had group thread details.
                                indivRcrdsFrParticipants[element.peerId] = true;
                                const { store } = this.ctxParticipants;
                                const thread = {
                                    id: element.peerId,
                                    threadId: element.threadId,
                                    participants: parties_list,
                                    isServer: false,
                                    isLocal: true,
                                    isGroup: false
                                }
                                try {
                                    await store.add(thread);
                                } catch (err) {
                                    console.log(err, thread);
                                }
                            }
                        }
                    }
                }
            }
            if (element.messageType === 'voicemail') {
                // add entries in new table for message_info
                await this.addOrUpdateMessageInfo({
                    id: element.id,
                    session_id: "",
                    multimediaStatus: "not-initiated",
                    messageType: "voicemail",
                    duration: durationVM,
                    parties_list: element.parties_list,
                    multimediaContentType: ""
                })
            }
            try {
                const encrypted = await this.encrypt({ ...element, owner });
                const { store } = this.ctx; // message store
                await this.addOrUpdateMessageEncrypted(store, encrypted);
            } catch (err) {
                console.log(err, element);
            }
        }
    }

    async addOrUpdateMedia(owner, message: Media) {
        await this.popMediaWRTRecrdCount(owner);
        await this.popMediaWRTStorage(owner, message);
        owner = sessionStorage.getItem('__api_identity__');
        const transaction = this.db.transaction('media', 'readwrite');
        const store = transaction.store
        await store.put(message);
    }


   async getMessage(messageId: string) {
        const ownerEncrypted = await this.encryptService.encrypt(sessionStorage.getItem('__api_identity__'));
        const { store } = this.ctx;
        const message = await store.get([messageId, ownerEncrypted]);
        return message;
    }


    async updateRtryRchdInMediaRtnMedia(session_id: string){
        const { store } = this.ctxMedia;
        let media:Media = await store.get(session_id);
        media.retryExceeded = true;
        await store.put(media);
        return media
    }

    // get peer id from thread id from indexedDb 
    async getPeerIdFromThreadId(currentChatId:string) {
        const transaction = this.db.transaction('messages', 'readwrite');
        const store = transaction.store;
        const messagesDb = await store.getAll();
        const decrypted = await Promise.all(messagesDb.map(this.decrypt));
        
        let peerIdFromThreadId = decrypted.find((val: any)=>{
            switch(currentChatId !== undefined) {
                case (val.threadId === currentChatId):
                    return val.peerId
                case (val.peerId === currentChatId):
                    return val.peerId
            }            
            // if(threadId !== undefined){
            // return val.threadId === threadId
            // }
        })
        console.log("The Final Peer Id",peerIdFromThreadId.peerId);    
        return peerIdFromThreadId.peerId
    }
}
