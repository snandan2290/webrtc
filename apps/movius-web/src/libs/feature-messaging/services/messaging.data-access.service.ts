import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { EventEmitter, Injectable } from '@angular/core';
import { serverDateToISO } from '@movius/domain';
import { LoggerFactory } from '@movius/ts-logger';
import { Store } from '@ngrx/store';
import { BehaviorSubject, forkJoin, Observable, of, Subject, throwError } from 'rxjs';
import { catchError, defaultIfEmpty, delay, map, switchMap, tap } from 'rxjs/operators';
import { AuthService, DbContext, GeoHttpService } from '../../shared';
import { AuthDataAccessService } from '../../shared/services/auth.data-access.service';
import { Thread } from '../../shared/services/dto';
import { LoadedSeq } from '../models';
import { startCreateUserContact, updateParticipantList, updateVVMReadStatusInStore } from '../ngrx/actions';
import { GetAllMessagesDTO, GetAllThreadsDTO, Message } from './dto';


const logger = LoggerFactory.getLogger("")

const mapMessage = (msg: Message) => ({ ...msg, ts: serverDateToISO(msg.ts) });
const mapMessages = (msgs: Message[]) => (msgs || []).map(mapMessage);
const mapObjMessages = <T extends { messages: Message[] }>(obj: T): T => ({
    ...obj,
    messages: mapMessages(obj.messages),
});

const mapObjThread = <T extends Thread>(obj: T): T => ({
    ...obj,
    t_read: serverDateToISO(obj.t_read),
    t_created: serverDateToISO(obj.t_created),
    t_joined: serverDateToISO(obj.t_joined),
    t_last_msg: serverDateToISO(obj.t_last_msg),
});

const HISTORY_PAGE_SIZE = 30;
const PEER_HISTORY_PAGE_SIZE = 50;

// allow whatsapp thread to enter in indedxDb
const filterEmptyThreads = (thread: Thread) =>
    ((thread.messages && thread.messages.length) || thread.parties_list.includes('whatsapp'));



const filterWAThreads = (thread: Thread) =>
    thread.parties_list && !thread.parties_list.includes("whatsapp");


@Injectable({ providedIn: 'root' })
export class MessagingDataAccessService {
    constructor(
        private readonly http: HttpClient,
        private readonly authService: AuthService,
        private readonly dbContext: DbContext,
        private readonly geoHttpService: GeoHttpService,
        private authDataService: AuthDataAccessService,
        private store: Store
    ) { }

    public getPeerMessages = new Subject<any>();

    public stopVMSubject = new Subject();
    public checkVVMStatus = this.stopVMSubject.asObservable();

    public searchEvent = new EventEmitter<string>();
    public addSearchData = this.searchEvent.asObservable();
    public ThreadLazyLoaded = new BehaviorSubject<boolean>(true);


    setVMStatus(data: any) {
        this.stopVMSubject.next(data);
    }

    watchSearchData (string: string) {
        this.searchEvent.next(string);
    }

    getHistoryPageSize(){
        return HISTORY_PAGE_SIZE
    }

    loadThreadMessages(
        threadId: string,
        loadedSeq?: { seq: number; ts: string }
    ) {
        if (threadId.includes('unknown') || threadId.includes('undefined')) {
            return of(null)
        }
        const pageSize = PEER_HISTORY_PAGE_SIZE;
        const offsetStr = loadedSeq
            ? `&from_seq=${loadedSeq.seq}&from_ts=${loadedSeq.ts}`
            : '';
        const url = `mml/accounts/${this.authService.apiName}/${this.authService.apiIdentity}/get_all_messages?thread=${threadId}&api_token=${this.authService.apiToken}&ver=1${offsetStr}&count=${pageSize}`;
        // return this.http.get<GetAllMessagesDTO>(url)
        return this.geoHttpService.callADKRtnResp(url, "get", null, null)
            .pipe(
                switchMap((res) => {
                    if (!!res['error']) {
                        // API implementation is wrong fix here
                        return throwError(
                            new HttpErrorResponse({
                                error:
                                    res['error'].error_message ||
                                    'Fail to load thread data',
                            })
                        );
                    } else {
                        //logger.debug("get_all_messages loaded successfully")
                        return of(res);
                    }
                }),
                delay(0),
            );
    }

    private loadGroupPartiesToSession(thread) {
         //for each thread get the att_status and store it in sessionvariable and compare during get_all_messages_api_call
         let getWhatsOptInReqStatus;
         if (thread &&  thread.att_status) {
            if (thread.t_left == '') {
                getWhatsOptInReqStatus = thread.att_status;
            } else {
                getWhatsOptInReqStatus = '5';
            }
        }
        sessionStorage.setItem('opt-in-status-for-thread-id-' + thread.id, getWhatsOptInReqStatus);
        //if(!filterWAThreads(thread)) return // remove this line when whatsapp is supported in MLDT
        if (thread.parties_list.split(',').length > 2) {
            const participants = thread.parties_list.split(',');
            const sortParticipants = participants.sort((a, b) => 0 - (a > b ? -1 : 1));
            let allNumbers = "";
            let groupParticipants = '';

            for (let i = 0; i < participants.length; i++) {
                if (i === 0) {
                    groupParticipants = participants[i];
                } else {
                    groupParticipants = groupParticipants + '|' + participants[i];
                }
            }

            for (let i = 0; i < sortParticipants.length; i++) {
                if (i === 0) {
                    allNumbers = sortParticipants[i];
                } else {
                    allNumbers = allNumbers + sortParticipants[i];
                }
            }
            this.dbContext.message.addParticipants(allNumbers, groupParticipants, thread.id);
            sessionStorage.setItem(allNumbers, JSON.stringify(groupParticipants));
            // sessionStorage.setItem(allNumbers, JSON.stringify(groupParticipants));
            // sessionStorage.setItem('partiesThreadId-' + thread.id, JSON.stringify(thread.parties_list));
            sessionStorage.setItem(thread.id, JSON.stringify(thread.parties_list));
        } else if (thread.parties_list.length >= 1) {
            const userIdentity = sessionStorage.getItem('__api_identity__');
            thread.parties_list = (thread.parties_list.split(',').filter((e) => e != userIdentity)).toString();
            this.dbContext.message.addParticipants(userIdentity, thread.parties_list, thread.id);
        }
    }

    private loadThreadHistoryIfHasUnreadMessages(
        thread: Thread
    ): Observable<Thread> {
        if (!thread.messages || !thread.messages.length) {
            console.warn('thread with no messages!', thread);
            thread.messages = [];
            return of(thread);
        } else {
            const latestMessage = thread.messages[thread.messages.length - 1];

            if(latestMessage && latestMessage.stype == '30' && thread.t_left == ""){
                sessionStorage.setItem('opt-in-status-for-thread-id-' + thread.id, '3');
                if(latestMessage.body.includes('and shared chat history')){
                    if(latestMessage.body.split('message:')[1]){
                        let dateTime = latestMessage.body.split('message:')[1];
                        const threadData: any = {
                            id: thread.id,
                            lastIncommingMessageAt: dateTime,
                            whatsOptInReqStatus: '3',
                            isWhatsAppThread: true,
                            messageChannelType: 'whatsapp',
                            parties_list: thread.parties_list
                        }
                        this.dbContext.message.addOrUpdateMessageThread(threadData,
                            sessionStorage.getItem('__api_identity__'),
                        )
                    }
                }
            }




            if (
                serverDateToISO(latestMessage.ts) <=
                serverDateToISO(thread.t_read)
            ) {
                // all messages already read
                return of(thread);
            } else {
                // have some number of unread messages
                return this.loadThreadMessages(thread.id, {
                    seq: latestMessage.seq,
                    ts: latestMessage.ts,
                }).pipe(
                    map((result) => ({
                        ...thread,
                        messages: [
                            ...result.messages.filter(
                                (f) =>
                                    !thread.messages.some((s) => f.id === s.id)
                            ),
                            ...thread.messages,
                        ],
                    }))
                );
            }
        }
    }

    private loadHistoryPage(from?: string): Observable<any> {
        const url = `mml/accounts/${this.authService.apiName}/${this.authService.apiIdentity
            }/get_all_threads?count=${HISTORY_PAGE_SIZE}${from ? `&from_timestamp=${from}` : ''
            }&ver=1&api_token=${this.authService.apiToken}`;
        // return this.http.get<GetAllThreadsDTO>(url)
        return this.geoHttpService.callADKRtnResp(url, 'get', null, null)
            .pipe(
                tap((result) =>
                    result.threads.forEach((thread) =>
                        this.loadGroupPartiesToSession(thread)
                    )
                ),
                tap((result) => {
                    if (result.threads.length == 0) {
                        this.authDataService.loaderSpinnerEvent(false);
                    }
                }),
                map((result) => result.threads.filter(filterEmptyThreads)),
                switchMap((threads) =>
                    forkJoin(
                        threads.map((thread: Thread) =>
                            this.loadThreadHistoryIfHasUnreadMessages(
                                thread
                            )
                        )
                    ).pipe(
                        defaultIfEmpty([]),
                    )
                ),
                tap(threads =>{
                    //logger.debug("get_all_threads loaded successfully")
                    threads.forEach(t => {
                        let uread = t.t_read < t.t_last_msg
                        let last_message = t.messages[0]?.ts
                        let last_message_from = t.messages[0]?.from
                        //if(last_message_from != sessionStorage.getItem('__api_identity__') &&  uread)
                        let haveUnreadMsgs = new Date(t.t_read) >= new Date(t.t_last_msg);
                        if(!haveUnreadMsgs){
                            logger.debug("General:: Thread Having Unread Msgs::, thread id " + t.id + ", last message from = " + last_message_from + ", last message = "  + t.t_last_msg + ", last read = " + t.t_read)
                        }
                    });
                    setTimeout(() => {
                        this.authDataService.loaderSpinnerEvent(false);
                    }, 3000);
                    this.loadMessageThreads(threads, sessionStorage.getItem('__api_identity__') )
                }),
                switchMap((threads: Thread[]) =>{
                    try{
                        sessionStorage.setItem("lastThreadTime",threads[threads.length - 1].t_last_msg)
                    }catch(e){
                        sessionStorage.removeItem("lastThreadTime")
                    }
                    return of(threads)
                }

                ),
                delay(0)
            );
    }

    private loadMessageThreads(threads: any, userId: string){
        threads.map(obj =>{
            let load = true
            const latestMessage = obj.messages.sort((a, b) => new Date(a.ts).getTime() < new Date(b.ts).getTime() ? 1 : -1);
            // console.log('Latest Message ==== ',JSON.stringify(obj), obj.id , latestMessage)
            if(obj.t_left === ""){
                let threadpeerId = obj.parties_list.split(",")
                if (threadpeerId.length == 2 && obj.parties_list.includes('whatsapp')) {
                   threadpeerId = threadpeerId[0].includes('whatsapp') ? threadpeerId[0] : threadpeerId[1]
                   sessionStorage.setItem('thread-'+threadpeerId, obj.id)
                }
            }
            // if((obj.messages && obj.messages[0] && obj.messages[0].stype === 33) || (obj.t_left !="")){
            //     obj.att_status = "5";
            //     // on re-enabling whatsapp stype set to 33 so have to send resent opt-in request, so setting optInRequestCount to 0
            //     obj.optInRequestCount = 0;
            // }
            // if(obj.t_left != ""){ // Blocking code when user is removing from the group
            //     console.log('Thread ' + obj.id + ' left is not null')
            //     if(!obj.parties.some(e => e.includes("whatsapp")))
            //       load=false
            // }
                this.dbContext.message.addOrUpdateMessageThread(obj, userId);
        })
    }

    loadHistory(date=null) {
        return this.loadHistoryPage(date)
            .pipe(
                map((threads) =>
                    threads
                        .filter(filterEmptyThreads)
                        //.filter(filterWAThreads)
                        .map(mapObjMessages)
                        .map(mapObjThread)
                )
            )
    }

    loadPeerHistory(
        historyId: string,
        loadedSeq?: { seq: number; ts: string }
    ) {
        return this.loadThreadMessages(historyId, loadedSeq).pipe(
            map(mapObjMessages)
        );
    }

    setMessageRead(from: string, messageId: string, isSysrtem: boolean, isVoiceMail: boolean) {
        if (from.includes("unknown")) {
            return
        }
        if (isSysrtem) {
            // Do nothing for System messages.
            return of(null);
        } else {
            if (!isVoiceMail && messageId != null) {
                const url = `mml/accounts/${this.authService.apiName}/${this.authService.apiIdentity}/set_read_status_message?api_token=${this.authService.apiToken}&cp=${from}&message=${messageId}`;
                // return this.http.get(url).pipe(catchError(() => of(null)));
                return this.geoHttpService.callADK(url, "get", null, null);
            } else {
                return of(null)
            }

        }

    }

    getMultiMediaData(fromNumber: string, toNumber: string, mmsId: string, threadId?: string, wa_from?: string, is_wa_pic?: boolean) {
        let message_channel_type=null;
        let url;
        sessionStorage.setItem('download-'+mmsId,'yes')
        if (is_wa_pic)
        {
            toNumber=JSON.parse(sessionStorage.getItem('__whatsapp_business_number__'))[0]
            url = `/mml/accounts/${this.authService.apiName}/${this.authService.apiIdentity}/download_mms?api_token=${this.authService.apiToken}&&sent_by=${fromNumber}&mms_id=${mmsId}&message_channel_type=whatsapp&thread=${threadId}`;
        }else {
            url = `/mml/accounts/${this.authService.apiName}/${this.authService.apiIdentity}/download_mms?api_token=${this.authService.apiToken}&&sent_by=${fromNumber}&sent_to=${toNumber}&mms_id=${mmsId}`;
        }
        return this.geoHttpService.callADKRtnResp(url, "get", null, null)
            .pipe(
                switchMap((res) => {
                    if (!!res['error']) {
                        // API implementation is wrong fix here
                        return throwError(
                            new HttpErrorResponse({
                                error:{
                                    desc: res['error'].message ||
                                    'Fail to download Image',
                                    error_code: res['error'].apiReturnCode
                                }
                            })
                        );
                    } else {
                        sessionStorage.setItem('download-'+mmsId,'yes')
                        return of(res);
                    }
                })
            );

    }

    //voicemail changes
    getVoiceMailData(sessionId) {
        const url = `/mml/accounts/${this.authService.apiName}/${this.authService.apiIdentity}/get_vvm_data?ver=0&api_token=${this.authService.apiToken}&&vm_messageuId=${sessionId}`;
        return this.geoHttpService.callADKRtnResp(url, "get", null, { "Accept": "audio/mp3" })
            .pipe(
                switchMap((res) => {
                    if (!!res['error']) {
                        // API implementation is wrong fix here
                        return throwError(
                            new HttpErrorResponse({
                                error:
                                    res['error'].error_message ||
                                    'Fail to load thread data',
                            })
                        );
                    } else {
                        return of(res);
                    }
                })
            );

    }
    updateVoicMailMessageReadStatus(msg) {
        this.dbContext.message.updateVVMReadStatus(msg)
    }

    updateVoicemailReadStatusInStore(msg) {
        logger.debug("updateVoicemailReadStatusInStore:::msg::", msg)
        let parties_listArr = msg.parties_list.split("|");
        let peerId = parties_listArr[0]
        let messageId = msg.id;
        const req = {
            peerId: peerId,
            messageId: messageId
        }
        logger.debug("updateVoicemailReadStatusInStore:::req::", req)
        this.store.dispatch(updateVVMReadStatusInStore(req))
    }

    getVVMMsgById(msg) {
        return this.dbContext.message.getVVMMsgById(msg);
    }

    setReadStatusApi(sessionId) {
        const url = `/mml/accounts/${this.authService.apiName}/${this.authService.apiIdentity}/set_vvm_read_status?ver=0&api_token=${this.authService.apiToken}&&vm_messageuId=${sessionId}`
        return this.geoHttpService.callADKRtnResp(url, "get", null, null)
            .pipe(
                switchMap((res) => {
                    if (!!res['error']) {
                        // API implementation is wrong fix here
                        return throwError(
                            new HttpErrorResponse({
                                error:
                                    res['error'].error_message ||
                                    'Fail to load thread data',
                            })
                        );
                    } else {
                        return of(res);
                    }
                })
            );
    }

    loadVoiceMails() {
        const pageSize = PEER_HISTORY_PAGE_SIZE;
        const url = `/mml/accounts/${this.authService.apiName}/${this.authService.apiIdentity}/get_vvm_inbox?ver=1&api_token=${this.authService.apiToken}`;
        return this.geoHttpService.callADKRtnResp(url, "get", null, null)
            .pipe(
                switchMap((res) => {
                    if (!!res['error']) {
                        // API implementation is wrong fix here
                        return throwError(
                            new HttpErrorResponse({
                                error:
                                    res['error'].error_message ||
                                    'Fail to load thread data',
                            })
                        );
                    } else {
                        return of(res);
                    }
                })
            );
    }

    uploadMMS(file: File, info) {
        let url;
        if (info.isWhatsAppThreadId === undefined) {
            url = `/mml/accounts/${this.authService.apiName}/${this.authService.apiIdentity}/upload_mms?sent_by=${info.sentBy}&sent_to=${info.sentTo}&api_token=${this.authService.apiToken}&mms_id=${info.mmsId}`;
        } else {
            url = `/mml/accounts/${this.authService.apiName}/${this.authService.apiIdentity}/upload_mms?sent_by=${info.sentBy}&api_token=${this.authService.apiToken}&mms_id=${info.mmsId}&message_channel_type=whatsapp&thread=${info.isWhatsAppThreadId}`;
        }
        const formdata = new FormData();
        formdata.append("fileUpload", file, file.name)
        return this.geoHttpService.callADKRtnResp(url, 'post', formdata, null)
            .pipe(
                switchMap((res) => {
                    return of(res);
                })
            );

    }

    getListOfWhatsappUsers(searchText: string) {
        const url = `/mml/accounts/${this.authService.apiName}/${this.authService.apiIdentity}/list_whatsapp_users?&api_token=${this.authService.apiToken}&search=${searchText}&count=100&offset=0`;
        return  this.http.get(url);
    }

    addWhatsAppParticipants(data: any) {
        const url = `/mml/accounts/${this.authService.apiName}/${this.authService.apiIdentity}/add_whatsapp_participants?&api_token=${this.authService.apiToken}&receiver=${data.receiver}&thread=${data.thread}&new_participants=${data.new_participants}&share_chat_history=${data.share_chat_history}&ver=${data.ver}&last_message=${data.last_message}`;
        return this.geoHttpService.callADKRtnResp(url, 'post', data, null)
            .pipe(
                switchMap((res) => {
                    if ((res.desc == 'Success' || res.return == 29004) && res.added_participants) {
                        this.store.dispatch(updateParticipantList({
                            modifyUser: res.thread_parties,
                            threadId: res['thread']['id'],
                            actionType:'Add Participants'
                        }));
                        this.dbContext.message.updateParticipants(res['thread']['id'], res.thread_parties.join("|"), res['thread']['id'], 'Add Participants');
                    }
                    return of(res);
                })
            );
    }

    leaveWhatsAppGroup(data: any) {
        const url = `/mml/accounts/${this.authService.apiName}/${this.authService.apiIdentity}/delete_whatsapp_participant?&api_token=${this.authService.apiToken}&receiver=${data.receiver}&format=${data.format}&thread=${data.thread}&ver=${data.ver}&identity=${this.authService.apiIdentity}`;
        const participantArray:string[] = [];
        participantArray.push(this.authService.apiIdentity)
        return this.geoHttpService.callADKRtnResp(url, 'post', data, null)
            .pipe(
                switchMap((res) => {
                    if (res.desc == 'Success') {
                        this.store.dispatch(updateParticipantList({
                            modifyUser: res.thread_parties,
                            threadId: res['thread']['id'],
                            actionType:'Leave Participants'
                        }));
                        this.dbContext.message.updateParticipants(res['thread']['id'], res.thread_parties.join("|"), res['thread']['id'], 'Add Participants');
                    }
                    return of(res);
                })
            );
    }

    deleteUserfromGrpConversation(data: any) {
        const url = `/mml/accounts/${this.authService.apiName}/${this.authService.apiIdentity}/remove_whatsapp_participants?&api_token=${this.authService.apiToken}&receiver=${data.receiver}&remove_participants=${data.user}&format=${data.format}&thread=${data.thread}&ver=${data.ver}&identity=${this.authService.apiIdentity}`;
        const participantArray:string[] = [];
        participantArray.push(this.authService.apiIdentity)
        return this.geoHttpService.callADKRtnResp(url, 'post', data, null)
            .pipe(
                switchMap((res) => {
                    if (res.desc == 'Success') {
                        this.store.dispatch(updateParticipantList({
                            modifyUser: res.thread_parties,
                            threadId: res['thread']['id'],
                            actionType:'Leave Participants'
                        }));
                        this.dbContext.message.updateParticipants(res['thread']['id'], res.thread_parties.join("|"), res['thread']['id'], 'Add Participants');
                    }
                    return of(res);
                })
            );
    }

    createContactForAddedUsers (contact:any, contactCreatedFrom:string) {
        this.store.dispatch(startCreateUserContact({ contact , contactCreatedFrom}));
    }
}
