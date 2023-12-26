import { BehaviorSubject, merge, Observable, Subject } from 'rxjs';
import { map, shareReplay, takeWhile } from 'rxjs/operators';
import {
    Invitation,
    Inviter,
    Messager,
    Registerer,
    RequestPendingError,
    Session,
    SessionInviteOptions,
    SessionState,
    TransportState,
    UserAgent,
    UserAgentOptions,
    UserAgentState,
} from 'sip.js';
import { ActivatedRoute, Router } from '@angular/router';
import {
    Contact,
    OutgoingInviteRequest,
    OutgoingRequestDelegate,
    OutgoingRequestMessage,
} from 'sip.js/lib/core';
import { holdModifier } from 'sip.js/lib/platform/web';
import {
    createOutgoingRequestDelegate,
    OutgoingRequestEvent,
} from './create-outgoing-request-observable-delegate';
import {
    createSessionObservableDelegate,
    SessionEvent,
} from './create-session-observable-delegate';
import {
    createUserAgentObservableDelegate,
    UserEvent,
} from './create-user-agent-observable-delegate';
import { generateToken } from './generte-token';
import { getUserOptions, getUserUri } from './get-user-options';
import { IceSipConfig } from './models';
import * as lpn from 'google-libphonenumber';
import { LoggerConfiguration, LoggerFactory } from '@movius/ts-logger';
import { getValidXCafeParticipants } from 'apps/movius-web/src/libs/shared';

const createStateChangeObservable = (userAgent: UserAgent) =>
    new Observable<UserAgentState>((sub) => {
        userAgent.stateChange.addListener((x) => {
            sub.next(x);
            if (x === UserAgentState.Stopped) {
                sub.complete();
            }
        });
    });

const logger = LoggerFactory.getLogger("")

export interface UserAgentRegisterEvent {
    kind: 'UserAgentRegisterEvent';
    event: OutgoingRequestEvent;
}

export interface UserAgentUnregisterEvent {
    kind: 'UserAgentUnregisterEvent';
    event: OutgoingRequestEvent;
}

export interface UserAgentStateChangedEvent {
    kind: 'UserAgentStateChangedEvent';
    state: UserAgentState;
}

export interface UserAgentCommonEvent {
    kind: 'UserAgentCommonEvent';
    event: UserEvent;
}

export interface UserAgentSendMessageEvent {
    kind: 'UserAgentSendMessageEvent';
    event: OutgoingRequestEvent;
    message: OutgoingRequestMessage;
}

export interface UserAgentOutgoingMessageAction {
    kind: 'UserAgentOutgoingMessageAction';
    message: OutgoingRequestMessage;
    valid?: boolean;
}

export interface UserAgentTransportStateChangedEvent {
    kind: 'UserAgentTransportStateChangedEvent';
    state: TransportState;
}
//

export interface OutgoingHangUpAction {
    kind: 'OutgoingHangUpAction';
    session: Session;
}

export interface OutgoingMuteAction {
    kind: 'OutgoingMuteAction';
    isMuted: boolean;
    session: Session;
}

export interface OutgoingHoldAction {
    kind: 'OutgoingHoldAction';
    isOnHold: boolean;
    session: Session;
    inviteRequest: OutgoingInviteRequest;
}

export type UserAgentOutgoingAction =
    | UserAgentOutgoingMessageAction
    | OutgoingHangUpAction
    | OutgoingHoldAction
    | OutgoingMuteAction;

export interface UserAgentOutgoingActionEvent {
    kind: 'UserAgentOutgoingActionEvent';
    action: UserAgentOutgoingAction;
}

//

export interface UserAgentOutgoingInviteEvent {
    kind: 'UserAgentOutgoingInviteEvent';
    inviter: Inviter;
    event: OutgoingRequestEvent;
}

export interface UserAgentOutgoingByeEvent {
    kind: 'UserAgentOutgoingByeEvent';
    session: Session;
    event: OutgoingRequestEvent;
}

export interface UserAgentOutgoingHoldEvent {
    kind: 'UserAgentOutgoingHoldEvent';
    session: Session;
    event: OutgoingRequestEvent;
}

export interface UserAgentInviterSessionEvent {
    kind: 'UserAgentInviterSessionEvent';
    inviter: Inviter;
    event: SessionEvent;
    error?: Error;
}

export interface UserAgentInvitationSessionEvent {
    kind: 'UserAgentInvitationSessionEvent';
    invitation: Invitation;
    event: SessionEvent;
    error?: any;
}

export type UserAgentEvent =
    | UserAgentTransportStateChangedEvent
    | UserAgentRegisterEvent
    | UserAgentUnregisterEvent
    | UserAgentCommonEvent
    | UserAgentStateChangedEvent
    | UserAgentSendMessageEvent
    | UserAgentOutgoingActionEvent
    | UserAgentOutgoingInviteEvent
    | UserAgentOutgoingByeEvent
    | UserAgentOutgoingHoldEvent
    | UserAgentInviterSessionEvent
    | UserAgentInvitationSessionEvent;

/*export type SecondaryUserAgentEvent =
    | UserAgentTransportStateChangedEvent
    | UserAgentRegisterEvent
    | UserAgentUnregisterEvent
    | UserAgentCommonEvent
    | UserAgentStateChangedEvent
    | UserAgentSendMessageEvent
    | UserAgentOutgoingActionEvent
    | UserAgentOutgoingInviteEvent
    | UserAgentOutgoingByeEvent
    | UserAgentOutgoingHoldEvent
    | UserAgentInviterSessionEvent
    | UserAgentInvitationSessionEvent;*/

export const DATE_TIME_HEADER = 'Date-Time';
export const MULTI_TARGET_TAG_ID_HEADER = 'X-CAFE-MESSAGE-THREAD';//'Multi-Target-Tag-ID';
export const RESEND_CALL_ID = 'Resend-Call-Id';

export type FixContactRegisterer = (
    options: UserAgentOptions,
    contact: Contact,
    registerer: Registerer
) => void;

export type SendMessage = (
    messager: Messager,
    delegate: OutgoingRequestDelegate
) => Promise<void>;

export interface SipUserStubs {
    sendMessage?: SendMessage;
}
export class SipUser extends UserAgent {
    private readonly registerer: Registerer;
    private readonly registerObservableDelegate = createOutgoingRequestDelegate();
    private readonly unregisterObservableDelegate = createOutgoingRequestDelegate();
    // private readonly sendMessageObservableDelegate = createOutgoingRequestDelegate();
    private readonly outgoingAction$ = new Subject<UserAgentOutgoingAction>();
    private readonly inviterSessionEvent$ = new Subject<{
        inviter: Inviter;
        sessionEvent: SessionEvent;
        error?: Error;
    }>();
    private readonly invitationSessionEvent$ = new Subject<{
        invitation: Invitation;
        sessionEvent: SessionEvent;
    }>();
    private readonly outgoingInviteEvent$ = new Subject<{
        inviter: Inviter;
        event: OutgoingRequestEvent;
    }>();
    private readonly outgoingByeEvent$ = new Subject<{
        session: Session;
        event: OutgoingRequestEvent;
    }>();
    private readonly outgoingHoldEvent$ = new Subject<{
        session: Session;
        event: OutgoingRequestEvent;
    }>();
    private readonly userEvents$: Observable<UserEvent>;
    private readonly registerEvents$ = this.registerObservableDelegate.stream;
    private readonly sendMessageEvents$ = new Subject<{
        event: OutgoingRequestEvent;
        message: OutgoingRequestMessage;
    }>();
    private readonly incomingHangUpFailure$ = new Subject<{
        invitation: Invitation;
        error: any;
    }>();
    private readonly unregisterEvents$ = this.unregisterObservableDelegate
        .stream;
    readonly userAgentEvents$: Observable<UserAgentEvent>;
    readonly secondaryUserAgentEvents$: Observable<UserAgentEvent>;
    private readonly stateChangeEvent$ = createStateChangeObservable(this);
    readonly transportStateChangeEvent$ = new BehaviorSubject<TransportState>(
        TransportState.Disconnected
    );
    readonly uri: string;
    phoneUtil: any = lpn.PhoneNumberUtil.getInstance();

    constructor(
        server: string,
        domain: string,
        readonly userId: string,
        readonly userName: string,
        userPassword: string = null,
        readonly token = generateToken(),
        private readonly extraHeaders: string[] = [],

        userAgentString?: string,
        onFixContactRegisterer?: FixContactRegisterer,
        iceConfig?: IceSipConfig,
        iceGatheringTimeout?: number,
        registererExpiresTimeout?: number,
        private readonly stubs?: SipUserStubs,
        observableDelegate = createUserAgentObservableDelegate(),
        options = getUserOptions(
            server,
            userId,
            userId,
            userPassword,
            token,
            domain,
            observableDelegate.delegate,
            userAgentString,
            iceConfig,
            iceGatheringTimeout
        ),
        private activatedRoute?: ActivatedRoute,
    ) {
        super(options);
        logger.debug(
            '*** General:: Registerer Expires Timeout (in milliseconds)',
            registererExpiresTimeout
        );


        this.registerer = new Registerer(this, {
            expires: registererExpiresTimeout
                ? ((registererExpiresTimeout / 2) + 100) * 60
                : 600,
        });

        // transport
        // TODO : Take till disposed
        this.transport.stateChange.addListener((state) => {
            logger.debug(
                '*** General::WebsocketConnection:: Transport State::',
                this.transport.isConnected()
            );
            this.transportStateChangeEvent$.next(state);
        });

        this.uri = getUserUri(userId, domain, token);
        this.userEvents$ = observableDelegate.stream;

        /**
         * Transport layer interface expected by the `UserAgent`.
         *
         * @remarks
         * The transport behaves in a deterministic manner according to the
         * the state defined in {@link TransportState}.
         *
         * The "Connecting" state is ONLY entered in response to the user calling `connect()`.
         * The "Disconnecting" state is ONLY entered in response to the user calling `disconnect()`.
         * The `onConnect` callback is ALWAYS called upon transitioning to the "Connected" state.
         * The `onDisconnect` callback is ALWAYS called upon transitioning from the "Connected" state.
         *
         * Adherence to the state machine by the transport implementation is critical as the
         * UserAgent depends on this behavior. Furthermore it is critical that the transport
         * transition to the "Disconnected" state in all instances where network connectivity
         * is lost as the UserAgent, API, and application layer more generally depend on knowing
         * network was lost. For example, from a practical standpoint registrations and subscriptions are invalidated
         * when network is lost - particularly in the case of connection oriented transport
         * protocols such as a secure WebSocket transport.
         *
         * Proper handling the application level protocol recovery must be left to the application layer,
         * thus the transport MUST NOT attempt to "auto-recover" from or otherwise hide loss of network.
         * Note that callbacks and emitters such as `onConnect`  and `onDisconnect` MUST NOT call methods
         * `connect()` and `direct()` synchronously (state change handlers must not loop back). They may
         * however do so asynchronously using a Promise resolution, `setTimeout`, or some other method.
         * For example...
         * ```ts
         * transport.onDisconnect = () => {
         *   Promise.resolve().then(() => transport.connect());
         * }
         * ```
         * @public
         */
        this.transport.onDisconnect = () => {
            logger.debug('*** Transport disconnected !!!');
            this.retryConnect();
            // if(sessionStorage.getItem("teams_unhold") == null){
            //     this.retryConnect();
            // } else{
            //     logger.debug("Teams unload is called, don't open websocket again")
            //     sessionStorage.removeItem("teams_unhold");
            // }
        };

        this.userAgentEvents$ = merge(
            this.transportStateChangeEvent$.pipe(
                map((state) => ({
                    kind: 'UserAgentTransportStateChangedEvent' as 'UserAgentTransportStateChangedEvent',
                    state,
                }))
            ),
            this.registerEvents$.pipe(
                map((event) => ({
                    kind: 'UserAgentRegisterEvent' as 'UserAgentRegisterEvent',
                    event,
                }))
            ),
            this.unregisterEvents$.pipe(
                map((event) => ({
                    kind: 'UserAgentUnregisterEvent' as 'UserAgentUnregisterEvent',
                    event,
                }))
            ),
            this.userEvents$.pipe(
                map((event) => ({
                    kind: 'UserAgentCommonEvent' as 'UserAgentCommonEvent',
                    event,
                }))
            ),
            this.stateChangeEvent$.pipe(
                map((state) => ({
                    kind: 'UserAgentStateChangedEvent' as 'UserAgentStateChangedEvent',
                    state,
                }))
            ),
            this.sendMessageEvents$.pipe(
                map(({ event, message }) => ({
                    kind: 'UserAgentSendMessageEvent' as 'UserAgentSendMessageEvent',
                    event,
                    message,
                }))
            ),
            this.outgoingAction$.pipe(
                map((action) => ({
                    kind: 'UserAgentOutgoingActionEvent' as 'UserAgentOutgoingActionEvent',
                    action,
                }))
            ),
            this.outgoingInviteEvent$.pipe(
                map(
                    ({ inviter, event }) =>
                    ({
                        kind: 'UserAgentOutgoingInviteEvent' as 'UserAgentOutgoingInviteEvent',
                        event,
                        inviter,
                    } as UserAgentOutgoingInviteEvent)
                )
            ),
            this.outgoingByeEvent$.pipe(
                map(({ event, session }) => ({
                    kind: 'UserAgentOutgoingByeEvent' as 'UserAgentOutgoingByeEvent',
                    event,
                    session,
                }))
            ),
            this.outgoingHoldEvent$.pipe(
                map(
                    ({ event, session }) =>
                    ({
                        kind: 'UserAgentOutgoingHoldEvent' as 'UserAgentOutgoingHoldEvent',
                        event,
                        session,
                    } as UserAgentOutgoingHoldEvent)
                )
            ),
            this.inviterSessionEvent$.pipe(
                map(
                    ({ sessionEvent, inviter, error }) =>
                    ({
                        kind: 'UserAgentInviterSessionEvent' as 'UserAgentInviterSessionEvent',
                        event: sessionEvent,
                        inviter,
                        error,
                    } as UserAgentInviterSessionEvent)
                )
            ),
            this.invitationSessionEvent$.pipe(
                map(
                    ({ sessionEvent, invitation }) =>
                    ({
                        kind: 'UserAgentInvitationSessionEvent' as 'UserAgentInvitationSessionEvent',
                        event: sessionEvent,
                        invitation,
                    } as UserAgentInvitationSessionEvent)
                )
            ),
            this.incomingHangUpFailure$.pipe(
                map(({ invitation, error }) => ({
                    kind: 'UserAgentInvitationSessionEvent' as 'UserAgentInvitationSessionEvent',
                    invitation,
                    event: null,
                    error,
                }))
            )
        ).pipe(shareReplay());





        //adding secondary server userevents data

        this.secondaryUserAgentEvents$ = merge(
            this.transportStateChangeEvent$.pipe(
                map((state) => ({
                    kind: 'UserAgentTransportStateChangedEvent' as 'UserAgentTransportStateChangedEvent',
                    state,
                }))
            ),
            this.registerEvents$.pipe(
                map((event) => ({
                    kind: 'UserAgentRegisterEvent' as 'UserAgentRegisterEvent',
                    event,
                }))
            ),
            this.unregisterEvents$.pipe(
                map((event) => ({
                    kind: 'UserAgentUnregisterEvent' as 'UserAgentUnregisterEvent',
                    event,
                }))
            ),
            this.userEvents$.pipe(
                map((event) => ({
                    kind: 'UserAgentCommonEvent' as 'UserAgentCommonEvent',
                    event,
                }))
            ),
            this.stateChangeEvent$.pipe(
                map((state) => ({
                    kind: 'UserAgentStateChangedEvent' as 'UserAgentStateChangedEvent',
                    state,
                }))
            ),
            this.sendMessageEvents$.pipe(
                map(({ event, message }) => ({
                    kind: 'UserAgentSendMessageEvent' as 'UserAgentSendMessageEvent',
                    event,
                    message,
                }))
            ),
            this.outgoingAction$.pipe(
                map((action) => ({
                    kind: 'UserAgentOutgoingActionEvent' as 'UserAgentOutgoingActionEvent',
                    action,
                }))
            ),
            this.outgoingInviteEvent$.pipe(
                map(
                    ({ inviter, event }) =>
                    ({
                        kind: 'UserAgentOutgoingInviteEvent' as 'UserAgentOutgoingInviteEvent',
                        event,
                        inviter,
                    } as UserAgentOutgoingInviteEvent)
                )
            ),
            this.outgoingByeEvent$.pipe(
                map(({ event, session }) => ({
                    kind: 'UserAgentOutgoingByeEvent' as 'UserAgentOutgoingByeEvent',
                    event,
                    session,
                }))
            ),
            this.outgoingHoldEvent$.pipe(
                map(
                    ({ event, session }) =>
                    ({
                        kind: 'UserAgentOutgoingHoldEvent' as 'UserAgentOutgoingHoldEvent',
                        event,
                        session,
                    } as UserAgentOutgoingHoldEvent)
                )
            ),
            this.inviterSessionEvent$.pipe(
                map(
                    ({ sessionEvent, inviter, error }) =>
                    ({
                        kind: 'UserAgentInviterSessionEvent' as 'UserAgentInviterSessionEvent',
                        event: sessionEvent,
                        inviter,
                        error,
                    } as UserAgentInviterSessionEvent)
                )
            ),
            this.invitationSessionEvent$.pipe(
                map(
                    ({ sessionEvent, invitation }) =>
                    ({
                        kind: 'UserAgentInvitationSessionEvent' as 'UserAgentInvitationSessionEvent',
                        event: sessionEvent,
                        invitation,
                    } as UserAgentInvitationSessionEvent)
                )
            ),
            this.incomingHangUpFailure$.pipe(
                map(({ invitation, error }) => ({
                    kind: 'UserAgentInvitationSessionEvent' as 'UserAgentInvitationSessionEvent',
                    invitation,
                    event: null,
                    error,
                }))
            )
        ).pipe(shareReplay());




        if (onFixContactRegisterer) {
            onFixContactRegisterer(options, this.contact, this.registerer);
        }
    }

    async retryConnect() {
        logger.debug('*** retryConnect', this.registerer.state);
        /*
        if (this.registerer.state === RegistererState.Registered) {
            console.log('*** registerer connected, exit');
            return;
        }
        */
        await Promise.resolve();
        if (!(await this.register(true))) {
            logger.debug('*** retryConnect fails try again');
            // document.getElementById('registred_icon').style.display = 'none';
            // document.getElementById('unregistred_icon').style.display = 'block';
            setTimeout(() => this.retryConnect(), 2500);
        } else {
            logger.debug('*** retryConnect success');
            // document.getElementById('registred_icon').style.display = 'block';
            // document.getElementById('unregistred_icon').style.display = 'none';
        }
    }

    async register(connectTransport = false) {
        const registererWaiting = this.registerer['waiting'];
        logger.debug(
            '*** RegisterState::' + this.registerer.state + 
            ' TransportState::' + this.transport.state + 
            ' WaitingStatus::' + registererWaiting
        );

        try {
            if (
                this.transport.state === TransportState.Disconnected ||
                this.transport.state === TransportState.Disconnecting
            ) {
                logger.debug('*** Retrying websocket Connection(Transport)...');
                await this.transport.connect();
            }

            if (registererWaiting) {
                logger.debug('*** registerer in waiting state, exit with false');
                return false;
            }

            await this.registerer.register({
                requestOptions: this.extraHeaders.length
                    ? {
                        extraHeaders: this.extraHeaders,
                    }
                    : undefined,
                requestDelegate: this.registerObservableDelegate.delegate,
            });
            logger.debug('*** register: success');

            const tranport_status: any = this.transport;
            //console.log('test_transport data', tranport_status);

            if (tranport_status.configuration.server.includes(sessionStorage.getItem('pri_server_name'))) {
                sessionStorage.setItem(sessionStorage.getItem('pri_server_name'), 'true');
            } else if (tranport_status.configuration.server.includes(sessionStorage.getItem('sec_server_name'))) {
                sessionStorage.setItem(sessionStorage.getItem('sec_server_name'), 'true');
            }

            /*if (registerResult.delegate) {
                registerResult.delegate.onAccept = (x) =>
                    this.registerStatus('*** register: accept', x, serverName);
                registerResult.delegate.onReject = (x) =>
                    this.registerStatus('*** register: reject', x, serverName);
            }*/

            return true;
        } catch (err) {
            logger.debug('*** register failure', err);
            const tranport_error: any = this.transport;
            //console.log('test_tranport_error data', tranport_error);
            if (tranport_error.configuration.server.includes(sessionStorage.getItem('pri_server_name'))) {
                sessionStorage.setItem(sessionStorage.getItem('pri_server_name'), 'false');
            } else if (tranport_error.configuration.server.includes(sessionStorage.getItem('sec_server_name'))) {
                sessionStorage.setItem(sessionStorage.getItem('sec_server_name'), 'false');
            }
            // document.getElementById('registred_icon').style.display = 'none';
            // document.getElementById('unregistred_icon').style.display = 'block';
            return false;
        }
    }

    /*registerStatus(msg: string, status: any, serverName: string) {
        console.log(msg, status);

        if (status.message.statusCode === 200) {
            sessionStorage.setItem(serverName, 'true');
        } else {
            sessionStorage.setItem(serverName, 'false');
        }
    }*/

    async unregister(disconnectTransport = true) {
        logger.debug('*** unregister');
        this.hangupSessions();
        if (disconnectTransport) {
            logger.debug(
                '*** unregister disconnect transport',
                this.transport['ws']
            );
            await this.transport.disconnect();
            await this.transport.dispose();
            // await this.transport.dispose();
        } else {
            logger.debug('*** unregister disconnect registerer');
            await this.registerer.unregister({
                requestDelegate: this.unregisterObservableDelegate.delegate,
            });
        }
    }

    hangupSessions() {
        Promise.all(
            Object.values(this._sessions).map((session) => this.hangUp(session))
        );
    }

    sendMessage(
        user: SipUser,
        target: SipUser | string,
        content: string,
        participants: any,
        sendToWhatsApp?: boolean,
        sendToLineorWechat?: boolean,
        locationInfo?: {
            latitude: number,
            longitude: number,
            accuracy: number
        },
        mmsDetails?: {
            mms_id: string
            mms_type: string
        },
        tagId?: string,
        resendCallId?: string,
        groupPeer?: string,
        groupOrNot?: boolean, // added for resending group messages correctly,
        forward?: boolean,
        waDetails?: {
            iswhatsapp: boolean,
            participants: string,
            threadid: string
        }
    ) {
        // if (groupOrNot !== false && groupOrNot !== undefined && null !== groupOrNot) {
        //     target = this.getURINumber(target.toString());
        // }

        if(participants?.length > 1){
            let wauser = participants?.filter((e)=> e.includes('whatsapp'));
            if(wauser[0]){
                target = 'sip:' + wauser[0].replace("whatsapp:", "") + '@undefined';
            } else {
                //Get 1 number from the participant list which is not logged in user number
                let participantsWithoutLoggedinuser = participants?.filter((e)=> !e.includes(sessionStorage.getItem('__api_identity__')));
                target = 'sip:+' + participantsWithoutLoggedinuser[0] + '@undefined';
                //target = this.getURINumber(target.toString())
            }
        } else if(participants?.length == 1) {
            target = participants[0].includes('whatsapp:') ? 'sip:' + participants[0].replace("whatsapp:", "") + '@undefined' : this.getURINumber(target.toString())
        }

        // if (sessionStorage.getItem('participants') !== "null" && groupOrNot === undefined) {
        //     if (sessionStorage.getItem('isMessageForwarded') !== 'true') {
        //         if (sessionStorage.getItem('participants').includes('whatsapp')) {
        //             //let peerId = sessionStorage.getItem('participants').replace(/\|/g, '').replace('whatsapp:', '');
        //             //let pArray = sessionStorage.getItem('participants').split("|")

        //             let pArray = sessionStorage.getItem('participants').includes('|') ? sessionStorage.getItem('participants').replace('"', '').split("|") : sessionStorage.getItem('participants').replace('"', '').split(",")

        //             const index = pArray.findIndex(element => {
        //                 if (element.includes("whatsapp")) {
        //                     return true;
        //                 }
        //             });
        //             target = 'sip:' + pArray[index].replace("whatsapp:", "").replace('"', '') + '@undefined';
        //         } else {
        //             target = this.getURINumber(target.toString())
        //         }
        //     }
        // }

        const targetUserUri = typeof target === 'string' ? target : target.uri;

        const targetUri = UserAgent.makeURI(targetUserUri.replace(':+"',':+'));
        console.log("targetUri--", targetUri);

        const extraHeaders = [
            `${DATE_TIME_HEADER}: ${new Date().toUTCString()}`,
        ];
        if (!!tagId) {
            extraHeaders.push(`${MULTI_TARGET_TAG_ID_HEADER}: ${tagId}`);
        }
        if (!!resendCallId) {
            extraHeaders.push(`${RESEND_CALL_ID}: ${resendCallId}`);
        }

        if (this.extraHeaders) {
            extraHeaders.push(...this.extraHeaders);
        }

        if(participants?.length > 1) {
             extraHeaders.push('X-CAFE-PARTICIPANTS: ' + participants.join('|'));
        }
        //const groupParticipants = sessionStorage.getItem(targetUri.user);

        // if (groupParticipants != 'undefined' && groupParticipants != null && groupParticipants != "\"\"") {
        //     extraHeaders.push('X-CAFE-PARTICIPANTS: ' + JSON.parse(groupParticipants));
        // } else {
        // if (sessionStorage.getItem('participants') !== null && sessionStorage.getItem('participants') !== "null" && groupOrNot === undefined && null !== groupOrNot) {
        //     if (sessionStorage.getItem('isMessageForwarded') !== 'true' && forward !== true &&
        //           sessionStorage.getItem('participants').split("|").length > 1) {
        //         extraHeaders.push('X-CAFE-PARTICIPANTS: ' + getValidXCafeParticipants(sessionStorage.getItem('participants')));
        //     }
        // } else if (groupOrNot !== false && groupOrNot !== undefined && null !== groupOrNot) {
        //     if (null !== groupPeer && groupPeer.split("|").length > 1 ) {
        //         extraHeaders.push('X-CAFE-PARTICIPANTS: ' + getValidXCafeParticipants(groupPeer));
        //     }
        // } else {
        //     const index = extraHeaders.indexOf('X-CAFE-PARTICIPANTS: ');
        //     if (index >= 0) {
        //         extraHeaders.splice(index, 1);
        //     }
        // }
        if (mmsDetails) {
            extraHeaders.push('X-CAFE-MULTIMEDIA-ID: ' + mmsDetails.mms_id);
            extraHeaders.push('X-CAFE-MULTIMEDIA-CONTENT-TYPE: ' + mmsDetails.mms_type);
            if (forward !== true && "undefined" !== sessionStorage.getItem("__API_RETRY_MMS_PARTICIPANTS__") &&
                null !== sessionStorage.getItem("__API_RETRY_MMS_PARTICIPANTS__") && groupOrNot  &&
                sessionStorage.getItem("__API_RETRY_MMS_PARTICIPANTS__").split("|").length > 1 ) {
                extraHeaders.push('X-CAFE-PARTICIPANTS: ' + getValidXCafeParticipants(sessionStorage.getItem("__API_RETRY_MMS_PARTICIPANTS__")));
            }
        }

        if(locationInfo && targetUri.user == "+911") {
            //console.log(locationInfo);
            //alert("Location: " + locationInfo.latitude + ', ' + locationInfo.longitude + ', ' + locationInfo.accuracy);
            let radius = locationInfo?.accuracy?.toFixed(6) ? locationInfo?.accuracy?.toFixed(6)  : "0"
            let param_val = "<sip:" + sessionStorage.getItem('__api_identity__') + "@" + sessionStorage.getItem('__primary_adk_url__') + ">;lat=" + locationInfo.latitude.toFixed(6)
             + ";lon=" + locationInfo.longitude.toFixed(6) + ";radius=" + radius + ";timestamp=" + new Date().toISOString();
            extraHeaders.push('GEOLOCATION: ' + param_val);
        }

        if (sendToWhatsApp || waDetails?.iswhatsapp) {
            extraHeaders.push('X-CAFE-MSG-CALLED-TYPE: ' + 'whatsapp');
            //console.log('targetUri = ' + targetUri?.user?.replace('+', ''))
            //extraHeaders.push('X-CAFE-MESSAGE-THREAD: ' + sessionStorage.getItem('CurrentThread'));
            if(sendToWhatsApp && waDetails == undefined){
                extraHeaders.push('X-CAFE-MESSAGE-THREAD: ' + sessionStorage.getItem('CurrentThread'));
            } else if(waDetails?.iswhatsapp){
                logger.debug('Update the Thread Id to ' +  waDetails?.threadid);
                delete extraHeaders['X-CAFE-MESSAGE-THREAD: '];
                extraHeaders.push('X-CAFE-MESSAGE-THREAD: ' + waDetails?.threadid);                
            }
            if(waDetails?.participants){
                logger.debug('Update the participants details with ' + waDetails?.participants);
                delete extraHeaders['X-CAFE-PARTICIPANTS: '];
                extraHeaders.push('X-CAFE-PARTICIPANTS: ' + getValidXCafeParticipants(waDetails?.participants));
            }
            //extraHeaders.push('X-CAFE-MESSAGE-THREAD: ' + waDetails?.threadid ? waDetails?.threadid : sessionStorage.getItem('CurrentThread'));
            //extraHeaders.push('X-CAFE-MESSAGE-THREAD: ' + this.activatedRoute.params['_value']['id']);
        }
        
        const messager = new Messager(user, targetUri, content, 'text/plain', {
            extraHeaders,
        });

        //console.log('Messager Details::', messager);
        const request = messager['request'] as OutgoingRequestMessage;
        //logger.debug('Request Data for a SIP Msg', request);

        //Validating numbers from the request and if not valid updating state to 'MessageStateInvalid'
        logger.debug("extraHeaders::::Sip-user.ts::sendMessage", extraHeaders);
        logger.debug("targetUserUri::::Sip-user.ts::sendMessage", targetUserUri);
        //console.log("targetUserUri--", targetUserUri);
        //InvalidNum as orginator is for supporting Social Messaging Usecases
        const invalidNum = (sessionStorage.getItem('invalidNum') == null || sessionStorage.getItem('invalidNum') == undefined) ? false : true;
        if (!sendToLineorWechat && !locationInfo && invalidNum == false) {
            let checkingNumber = this.updateStateToInvalidIfNumberNotValid(request);
            if (checkingNumber == false) {
                logger.debug('Numbers are Invalid, Updating Msg state to Invalid and Skipping Sip Msg');
                this.outgoingAction$.next({
                    kind: 'UserAgentOutgoingMessageAction',
                    message: request,
                    valid: false
                });
                return;
            }
        }

        this.outgoingAction$.next({
            kind: 'UserAgentOutgoingMessageAction',
            message: request,
            valid: true
        });
        const sendMessageObservableDelegate = createOutgoingRequestDelegate();
        const stream$ = sendMessageObservableDelegate.stream;
        stream$
            .pipe(
                takeWhile(
                    (event) =>
                        event.kind === 'AcceptOutgoingRequestEvent' ||
                        event.kind === 'RejectOutgoingRequestEvent'
                )
            )
            .subscribe((event) =>
                this.sendMessageEvents$.next({ event, message: request })
            );
        if (this.stubs && this.stubs.sendMessage) {
            return this.stubs.sendMessage(
                messager,
                sendMessageObservableDelegate.delegate
            );
        } else {
            return messager.message({
                requestDelegate: sendMessageObservableDelegate.delegate,
            });
        }
    }

    getURINumber(peer: string): string {
        if (!peer) return '';
        const groupParticipants = sessionStorage.getItem(peer.replace(/\D/g, ""));
        if (groupParticipants !== 'undefined' && groupParticipants != null && groupParticipants !== "\"\"") {
            const participants = groupParticipants.split('|');
            if (participants.length > 1) {
                const webclientUser = sessionStorage.getItem('__api_identity__');
                if (webclientUser === participants[0]) {
                    return 'sip:+' + participants[1] + '@undefined';
                }
                return 'sip:+' + participants[0] + '@undefined';
            }
        }
        return peer;
    }

    updateStateToInvalidIfNumberNotValid(request){
        const participantdata = request.extraHeaders.filter((e) => e.includes('X-CAFE-PARTICIPANTS'));
        logger.debug('General:: Participant Data In Request:', participantdata);
        if(participantdata.length > 0){
            let fetchonlynumbs = participantdata[0].replace('X-CAFE-PARTICIPANTS: ', '');
            if(fetchonlynumbs.includes('whatsapp:')){
                fetchonlynumbs = fetchonlynumbs?.replace('whatsapp:', '');
            }
            const splitIntoNums = fetchonlynumbs?.split('|');
            for (let i = 0; i < splitIntoNums.length; i++) {
                //console.log(splitIntoNums[i]);
                let validNumber = this.validateNumberInSipRequest(splitIntoNums[i])
                if (validNumber == false) {
                    logger.debug('General:: Request Participants is having invalid number please check:', splitIntoNums[i]);
                    return validNumber;
                }
            }
        } else if(request.to.uri.user && participantdata.length == 0){
            let validNumber = this.validateNumberInSipRequest(request.to.uri.user);
            return validNumber;
        }
    }

    validateNumberInSipRequest(num){
        try{
            let number = this.phoneUtil.parse('+' + num, "");
            const valnum = this.phoneUtil.isValidNumber(number);
            const possnum = this.phoneUtil.isPossibleNumber(number);
            //console.log('isValidNumber', valnum);
            //console.log('isPossibleNumber', possnum);
            if(valnum != true || possnum != true){
                logger.debug('Given Phone Number Is Invalid:', number);
                return false;
            } else {
                return true;
            }
        }catch(err){
            logger.debug('Given Phone Number Is Invalid:', err.error);
            return false;
        }
    }

    sendMultiTargetMessage(
        user: SipUser,
        targets: SipUser[] | string[],
        content: string,
        gentToken = true
    ) {
        const tagId = gentToken && generateToken();
        targets.forEach((target) =>
            this.sendMessage(user, target, content, null, null, null, null, null, tagId)
        );
    }

    invite(target: SipUser | string) {
        const targetUserUri = typeof target === 'string' ? target : target.uri;

        const targetUri = UserAgent.makeURI(targetUserUri);
        const inviter = new Inviter(this, targetUri, {
            extraHeaders: this.extraHeaders,
            earlyMedia: true,
        });
        const {
            delegate: sessionDelegate,
            stream: sessionStream,
        } = createSessionObservableDelegate();
        inviter.delegate = sessionDelegate;
        const sessionSub = sessionStream.subscribe((evt) => {
            this.inviterSessionEvent$.next({ inviter, sessionEvent: evt });
            if (evt.kind === 'ByeSessionEvent') {
                evt.bye.accept();
                sessionSub.unsubscribe();
            }
        });

        const {
            delegate: outgoingDelegate,
            stream: outgoingStream,
        } = createOutgoingRequestDelegate();
        const outgoingSub = outgoingStream.subscribe((event) => {
            this.outgoingInviteEvent$.next({ inviter, event });
            if (
                event.kind === 'AcceptOutgoingRequestEvent' ||
                event.kind === 'RejectOutgoingRequestEvent'
            ) {
                outgoingSub.unsubscribe();
            }
        });
        return inviter
            .invite({
                requestDelegate: outgoingDelegate,
                requestOptions: this.extraHeaders
                    ? {
                        extraHeaders: this.extraHeaders,
                    }
                    : undefined,
            })
            .catch((error: any) => {
                this.inviterSessionEvent$.next({
                    inviter,
                    sessionEvent: null,
                    error,
                });
            });
    }

    acceptInvitation(invitation: Invitation) {
        const {
            delegate: sessionDelegate,
            stream: sessionStream,
        } = createSessionObservableDelegate();
        invitation.delegate = sessionDelegate;
        const sessionSub = sessionStream.subscribe((evt) => {
            if (evt.kind === 'ByeSessionEvent') {
                evt.bye.accept();
                sessionSub.unsubscribe();
            }
            this.invitationSessionEvent$.next({
                invitation,
                sessionEvent: evt,
            });
        });
        invitation.accept();
    }

    async hangUp(session: Session) {
        // https://sipjs.com/guides/end-call/
        switch (session.state) {
            case SessionState.Initial:
            case SessionState.Establishing:
                if (session instanceof Inviter) {
                    // An unestablished outgoing session
                    this.outgoingAction$.next({
                        kind: 'OutgoingHangUpAction',
                        session,
                    });

                    session.cancel();
                } else {
                    // An unestablished incoming session
                    // https://github.com/onsip/SIP.js/pull/305
                    try {
                        (<Invitation>session).reject();
                    } catch (err) {
                        // this.userAgentEvents$.
                        this.incomingHangUpFailure$.next({
                            invitation: session as Invitation,
                            error: err,
                        });
                    }
                }
                break;
            case SessionState.Established:
                // An established session
                const bye = await session.bye();
                const { delegate, stream } = createOutgoingRequestDelegate();

                const sub = stream.subscribe((evt) => {
                    this.outgoingByeEvent$.next({ event: evt, session });
                    if (
                        evt.kind === 'AcceptOutgoingRequestEvent' ||
                        evt.kind === 'RejectOutgoingRequestEvent'
                    ) {
                        sub.unsubscribe();
                    }
                });
                bye.delegate = delegate;
                if (session instanceof Inviter) {
                    this.outgoingAction$.next({
                        kind: 'OutgoingHangUpAction',
                        session,
                    });
                }
                break;
            case SessionState.Terminating:
            case SessionState.Terminated:
                // Cannot terminate a session that is already terminated
                break;
        }
    }

    //

    setSessionMute(session: Session, isMute: boolean) {
        this.enableSenderTracks(session, !isMute);
        this.outgoingAction$.next({
            kind: 'OutgoingMuteAction',
            isMuted: isMute,
            session,
        });
    }

    private enableSenderTracks(session: Session, enable: boolean) {
        if (!session) {
            throw new Error('Session does not exist.');
        }
        const sessionDescriptionHandler = session.sessionDescriptionHandler;
        const peerConnection: RTCPeerConnection =
            sessionDescriptionHandler['peerConnection'];
        if (!peerConnection) {
            throw new Error('Peer connection closed.');
        }
        peerConnection.getSenders().forEach((sender) => {
            if (sender.track) {
                sender.track.enabled = enable;
            }
        });
    }

    //
    /**
     * Hold call
     * @remarks
     * Send a re-INVITE with new offer indicating "hold".
     * Resolves when the re-INVITE request is sent, otherwise rejects.
     * Use `onCallHold` delegate method to determine if request is accepted or rejected.
     * See: https://tools.ietf.org/html/rfc6337
     */
    /**
     * Unhold call.
     * @remarks
     * Send a re-INVITE with new offer indicating "unhold".
     * Resolves when the re-INVITE request is sent, otherwise rejects.
     * Use `onCallHold` delegate method to determine if request is accepted or rejected.
     * See: https://tools.ietf.org/html/rfc6337
     */
    async setSessionHold(session: Session, isOnHold: boolean) {
        const inviteRequest = await this.setHold(session, isOnHold);
        this.outgoingAction$.next({
            kind: 'OutgoingHoldAction',
            isOnHold,
            session,
            inviteRequest,
        });
        return inviteRequest;
    }

    async setSilent(session: Session, isOnHold: boolean) {
        if (!session) {
            return Promise.reject(new Error('Session does not exist.'));
        }

        if (!session) {
            throw new Error('Session does not exist.');
        }
        const sessionDescriptionHandler = session.sessionDescriptionHandler;
        const peerConnection: RTCPeerConnection =
            sessionDescriptionHandler['peerConnection'];
        if (!peerConnection) {
            throw new Error('Peer connection closed.');
        }
        peerConnection.getSenders().forEach((sender) => {
            if (sender.track) {
                sender.track.enabled = !isOnHold;
            }
        });
        peerConnection.getReceivers().forEach((receiver) => {
            if (receiver.track) {
                receiver.track.enabled = !isOnHold;
            }
        });
    }

    async setHold(session: Session, isOnHold: boolean) {
        if (!session) {
            return Promise.reject(new Error('Session does not exist.'));
        }

        if (!session) {
            throw new Error('Session does not exist.');
        }

        const sessionDescriptionHandler = session.sessionDescriptionHandler;
        const peerConnection: RTCPeerConnection =
            sessionDescriptionHandler['peerConnection'];
        if (!peerConnection) {
            throw new Error('Peer connection closed.');
        }
        const { delegate, stream } = createOutgoingRequestDelegate();

        const sub = stream.subscribe((event) => {
            this.outgoingHoldEvent$.next({ session, event });
            if (
                event.kind === 'AcceptOutgoingRequestEvent' ||
                event.kind === 'RejectOutgoingRequestEvent'
            ) {
                sub.unsubscribe();
            }
        });

        // On hold delegate !
        // Use hold modifier to produce the appropriate SDP offer to place call on hold
        const options: SessionInviteOptions = {
            requestDelegate: delegate,
            sessionDescriptionHandlerModifiers: isOnHold ? [holdModifier] : [],
        };

        try {
            // Send re-INVITE
            const inviteRequest = await session.invite(options);
            //this.enableSenderTracks(session, !isOnHold); // mute/unmute
            return inviteRequest;
        } catch (error) {
            if (error instanceof RequestPendingError) {
                console.error(
                    `[${this.userId}] A hold request is already in progress.`
                );
            }
            throw error;
        }
    }
}
