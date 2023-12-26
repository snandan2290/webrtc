import { Injectable } from '@angular/core';
import { Store } from '@ngrx/store';
//import { setupMediaElementStream, SipService } from '@scalio/sip';
import { assoc, omit } from 'lodash/fp';
import { Observable } from 'rxjs';
//import { Session, SessionState } from 'sip.js';
import { setupMediaElementStream, setupSessionRemoteMedia, SipService, cleanupMedia } from '@scalio/sip';
import {
    filter,
    map,
    switchMap,
    take,
    takeUntil,
    withLatestFrom,
} from 'rxjs/operators';
import { Invitation, Session } from 'sip.js';
import { SessionState, SipUserService } from '../../shared';
import {
    callAccepted,
    callAcceptStart,
    callFails,
    callHangUp,
    callHoldChanged,
    callMuteChanged,
    callProgress,
    callSetOnlyActive,
    callStarted,
    clearCallingHistory,
    deleteHistoryItem,
    loadInitialHistory,
    selectActiveCalls,
} from '../ngrx';

const getCallId = (rawCallId: string) =>
    // Incoming calls has value like 'guid@ip.1.1.2' which is not suitable for hash keys
    rawCallId.split('@')[0];

const removePlusPrefix = (phoneNumber: string) =>
    phoneNumber.replace(/(\+)(\d+)/, '$2');

const getPeerId = (invitation: Invitation) => {
    const user = invitation.request.from.uri.user;
    const isAnonymous = user === 'anonymous';
    const peerId = isAnonymous ? 'unknown' : user;
    return removePlusPrefix(peerId);
};

const call_fail = {
    count: 0,
    callId: '',
};

/**
 * This is facade service which join sip streams and application state in order
 * to provide components with calling data to display.
 * Component should reference only this service for all their needs.
 * Ngxs and sip services should not be used inside components.
 */
@Injectable({ providedIn: 'root' })
export class CallingService {
    private callSessions: { [key: string]: Session };

    constructor(
        private readonly sipService: SipService,
        private readonly userService: SipUserService,
        private readonly store: Store
    ) {
        const activeCallsCount$ = store
            .select(selectActiveCalls)
            .pipe(map((activeCalls) => Object.keys(activeCalls).length));
        //


        userService.registeredSecondarySipUser$
            .pipe(
                filter((sipUser) => !!sipUser),
                switchMap((sipUser) => sipUser.userAgentEvents$),
                withLatestFrom(activeCallsCount$)
            )
            .subscribe(([event, activeCallsCount]) => {
                console.log('event:', event);
                console.log('from secondary events');
                switch (event.kind) {
                    case 'UserAgentOutgoingByeEvent':
                      console.log('came to secondary bye event');
                      //get call id from event
                      const callId = event.session.id.substring(0, event.session.id.indexOf('@'));
                      this.removeSession(callId);
                                                store.dispatch(
                                                    callHangUp({
                                                        callId,
                                                    })
                                                );

                    break;
                    case 'UserAgentInviterSessionEvent':
                        if (event.error) {
                            this.removeSession(event.inviter.id);
                            store.dispatch(
                                callFails({
                                    callId: event.inviter.id,
                                })
                            );
                        } else {
                            switch (event.event.kind) {
                                case 'SessionDescriptionHandlerEvent':
                                    // outgoing call started
                                    console.log('Event Status : Outgoing Call Started from Secondary Server');
                                    this.addSession(
                                        event.inviter.id,
                                        event.inviter
                                    );
                                    const peerId = this.removePlusPrefix(
                                        event.inviter.request.to.uri.user
                                    );
                                    store.dispatch(
                                        callStarted({
                                            peerId,
                                            callId: event.inviter.id,
                                            dateTime: new Date().toISOString(),
                                            direction: 'outgoing',
                                        })
                                    );
                                    break;
                                case 'ByeSessionEvent':
                                    this.removeSession(event.inviter.id);
                                    // outgoing received bye from (established) remote
                                    store.dispatch(
                                        callHangUp({
                                            callId: event.inviter.id,
                                        })
                                    );
                                    sessionStorage.setItem('call_is_active', 'false');
                                    break;
                            }
                        }
                        break;
                    case 'UserAgentInvitationSessionEvent': {
                        if (!!event.error) {
                            // invitation session error hangup!
                            const callId = getCallId(event.invitation.id);
                            this.removeSession(callId);
                            store.dispatch(
                                callHangUp({
                                    callId,
                                })
                            );
                        }
                        break;
                    }
                    case 'UserAgentCommonEvent':
                        switch (event.event.kind) {
                            case 'IncomingInviteSessionUserEvent':
                                switch (event.event.event.kind) {
                                    case 'UserSessionStateEvent':
                                        switch (event.event.event.state) {
                                            case SessionState.Establishing: {
                                                // incomings session call progress finished !
                                                console.log(
                                                    'Session progress finished !!!',
                                                    event
                                                );

                                                break;
                                            }
                                            case SessionState.Established: {
                                                const callId = getCallId(
                                                    event.event.invitation.id
                                                );
                                                const session = this.getSession(callId);
                                                this.callingCreateAudio(session);
                                                // incomings session call progress accepted !
                                                sessionStorage.setItem('active-' + sessionStorage.getItem('sec_server_name'), 'active');
                                                store.dispatch(
                                                    callAccepted({
                                                        callId,
                                                        dateTime: new Date().toISOString(),
                                                    })
                                                );
                                                this.swap(callId, true);
                                                break;
                                            }
                                            case SessionState.Terminated: {
                                                // incomings session call hangup !
                                                const callId = getCallId(
                                                    event.event.invitation.id
                                                );
                                                sessionStorage.removeItem('active-' + sessionStorage.getItem('sec_server_name'));
                                                this.removeSession(callId);
                                                store.dispatch(
                                                    callHangUp({
                                                        callId,
                                                    })
                                                );
                                            }
                                        }
                                }
                                break;
                            case 'MessageUserEvent':
                                {
                                    // Iteratig again and again please identify the SIP message based on SIP heders NOT BASED ON BODY!!
                                    const message = event.event.message;
                                    const request = message.request;
                                    if ('Calllog' === request.getHeader('X-CAFE-NOTIFICATION')) {
                                        console.log("Loading call log!!");
                                        const messageId = request.getHeader('X-Cafe-Message-Id');
                                        sessionStorage.setItem(messageId, 'true');
                                        this.store.dispatch(
                                            loadInitialHistory()
                                        );
                                    }
                                }
                                break;
                            case 'InviteUserEvent':
                                switch (event.event.invitation.state) {
                                    case SessionState.Initial: {
                                        if (activeCallsCount < 2) {
                                            const invitation =
                                                event.event.invitation;
                                            // incoming received
                                            const callId = getCallId(
                                                invitation.id
                                            );
                                            this.addSession(callId, invitation);
                                            const peerId = getPeerId(
                                                invitation
                                            );
                                            store.dispatch(
                                                callStarted({
                                                    callId,
                                                    peerId,
                                                    dateTime: new Date().toISOString(),
                                                    direction: 'incoming',
                                                    isAnonymous:
                                                        peerId === 'unknown',
                                                })
                                            );

                                            //sessionStorage.setItem('sec_callid', callId);
                                            console.log(
                                                'Event Status : Incoming Call from secondary'
                                            );

                                            console.log(
                                                '+++ sending progress, start gathering ice'
                                            );

                                            invitation
                                                .progress({
                                                    rel100: false,
                                                    statusCode: 183,
                                                })
                                                .then(
                                                    () => {
                                                        console.log(
                                                            '+++ then incoming progress send!'
                                                        );



                                                        this.store.dispatch(
                                                            callProgress({
                                                                dateTime: new Date().toISOString(),
                                                                callId,
                                                                statusCode: 183,
                                                            })
                                                        );
                                                    },
                                                    (err) => {
                                                        console.log(
                                                            '+++ progress exception !',
                                                            err
                                                        );
                                                    }
                                                );

                                            // ice gathering timeout 5 seconds
                                            // if ice gathering not completed then send without rely
                                            // if send without rele send unhold (reenvite) with longer ice gathering timeout

                                            // when get exception set global variable
                                            // rollbackOffer / catch / set global variable
                                            // when user press 200 OK and I cought this exception
                                            // if there is pending 200 OK send 200 OK again since previous fails
                                        }

                                        break;
                                    }
                                }
                                break;
                            case 'IncomingInviteSessionUserEvent':
                                switch (event.event.event.kind) {
                                    case 'UserSessionStateEvent':
                                        switch (event.event.invitation.state) {
                                            case SessionState.Establishing: {
                                                //incoming accepted
                                                const callId = getCallId(
                                                    event.event.invitation.id
                                                );
                                                store.dispatch(
                                                    callAccepted({
                                                        callId,
                                                        dateTime: new Date().toISOString(),
                                                    })
                                                );
                                                this.swap(callId, true);
                                                break;
                                            }
                                            case SessionState.Terminated: {
                                                //incoming reject
                                                const callId = getCallId(
                                                    event.event.invitation.id
                                                );
                                                this.removeSession(callId);
                                                store.dispatch(
                                                    callHangUp({
                                                        callId,
                                                    })
                                                );
                                                break;
                                            }
                                        }
                                        break;
                                }
                                break;
                        }
                        break;
                    case 'UserAgentOutgoingInviteEvent':
                        switch (event.event.kind) {
                            case 'AcceptOutgoingRequestEvent':
                                // outgoing accepted
                               console.log('Event Status : Outgoing Call Accept Event from Secondary Server');
                                store.dispatch(
                                    callAccepted({
                                        callId: event.inviter.id,
                                        dateTime: new Date().toISOString(),
                                    })
                                );
                                call_fail.count = 0;
                                break;
                            case 'RejectOutgoingRequestEvent':
                                /*call_fail.count = ++call_fail.count;
                                console.log('Call FAILURE count sec :' + call_fail.count);
                                let only_event: any = event;
                                const numbermlm = only_event.event.response.message.to.uri.normal.user;
                                console.log('Geo number test', numbermlm);
                                //const num = event.event.response.message.to.uri.raw.user;
                                //const serverStatus = this.userService.getServerStatus();
                                if ( call_fail.count === 1 && this.userService.sipUser.transport.state == 'Connected') {
                                   console.log('try calling from primary server:');
                                   const targetUri = this.sipService.getUserUri(numbermlm);
                                   this.sipService.inviteUser(this.userService.sipUser, targetUri);
                                } else {
                                  console.log('Call was not connected through secondary, no retry from primary');
                                  call_fail.count = 0;
                                  call_fail.callId = '';
                                  this.removeSession(event.inviter.id);
                                  store.dispatch(
                                    callHangUp({
                                        callId: event.inviter.id,
                                    })
                                );

                                }*/

                                this.removingAudioElement(event.inviter.id);
                                this.removeSession(event.inviter.id);
                                  store.dispatch(
                                    callHangUp({
                                        callId: event.inviter.id,
                                    })
                                );
                                // outgoing rejected (not established) by remote
                                console.log('Event Status : Outgoing Call Reject Event from Secondary Server');
                                if (
                                    event.event.response.message.statusCode === 
                                    408 || event.event.response.message.statusCode === 503
                                ) {
                                    console.warn(
                                        '$$$ 408 for invite, try to reregister'
                                    );
                                    this.userService.register_secondary_site();
                                }
                                break;
                            case 'ProgressOutgoingRequestEvent':
                                // outgoing accepted
                                console.log('Event Status : Outgoing Call Progress Event from Secondary Server');
                                this.callingCreateAudio(event.inviter);
                                store.dispatch(
                                    callProgress({
                                        callId: event.inviter.id,
                                        dateTime: new Date().toISOString(),
                                        statusCode:
                                            event.event.response.message
                                                .statusCode,
                                    })
                                );
                                break;
                        }
                        break;
                    case 'UserAgentOutgoingActionEvent':
                        switch (event.action.kind) {
                            case 'OutgoingHangUpAction':
                                // outgoing call hangup
                                console.log('Event Status : Outgoing Call Hangup Event from Secondary Server');
                                this.removeSession(event.action.session.id);
                                store.dispatch(
                                    callHangUp({
                                        callId: event.action.session.id,
                                    })
                                );
                                break;
                        }
                        break;
                }
            });


        userService.registeredSipUser$
            .pipe(
                filter((sipUser) => !!sipUser),
                switchMap((sipUser) => sipUser.userAgentEvents$),
                withLatestFrom(activeCallsCount$)
            )
            .subscribe(([event, activeCallsCount]) => {
                //console.log('event:', event);
                //console.log('from primary events');
                switch (event.kind) {
                    case 'UserAgentOutgoingByeEvent':
                      console.log('came to bye event');

                       const callId = event.session.id.substring(0, event.session.id.indexOf('@'));
                      this.removeSession(callId);
                                                store.dispatch(
                                                    callHangUp({
                                                        callId,
                                                    })
                                                );
                    break;
                    case 'UserAgentInviterSessionEvent':
                        if (event.error) {
                            this.removeSession(event.inviter.id);
                            store.dispatch(
                                callFails({
                                    callId: event.inviter.id,
                                })
                            );
                        } else {
                            switch (event.event.kind) {
                                case 'SessionDescriptionHandlerEvent':
                                    // outgoing call started
                                    console.log('Event Status : Outgoing Call Started from Primary Server');
                                    this.addSession(
                                        event.inviter.id,
                                        event.inviter
                                    );
                                    const peerId = this.removePlusPrefix(
                                        event.inviter.request.to.uri.user
                                    );
                                    store.dispatch(
                                        callStarted({
                                            peerId,
                                            callId: event.inviter.id,
                                            dateTime: new Date().toISOString(),
                                            direction: 'outgoing',
                                        })
                                    );
                                    break;
                                case 'ByeSessionEvent':
                                    this.removeSession(event.inviter.id);
                                    // outgoing received bye from (established) remote
                                    store.dispatch(
                                        callHangUp({
                                            callId: event.inviter.id,
                                        })
                                    );
                                    sessionStorage.setItem('call_is_active', 'false');
                                    break;
                            }
                        }
                        break;
                    case 'UserAgentInvitationSessionEvent': {
                        if (!!event.error) {
                            // invitation session error hangup!
                            const callId = getCallId(event.invitation.id);
                            this.removeSession(callId);
                            store.dispatch(
                                callHangUp({
                                    callId,
                                })
                            );
                        }
                        break;
                    }
                    case 'UserAgentCommonEvent':
                        switch (event.event.kind) {
                            case 'IncomingInviteSessionUserEvent':
                                switch (event.event.event.kind) {
                                    case 'UserSessionStateEvent':
                                        switch (event.event.event.state) {
                                            case SessionState.Establishing: {
                                                // incomings session call progress finished !
                                                console.log(
                                                    'Session progress finished !!!',
                                                    event
                                                );

                                                break;
                                            }
                                            case SessionState.Established: {
                                                const callId = getCallId(
                                                    event.event.invitation.id
                                                );
                                                // incomings session call progress accepted !
                                                const session = this.getSession(callId);
                                                this.callingCreateAudio(session);
                                                sessionStorage.setItem('active-' + sessionStorage.getItem('pri_server_name'), 'active');
                                                store.dispatch(
                                                    callAccepted({
                                                        callId,
                                                        dateTime: new Date().toISOString(),
                                                    })
                                                );
                                                this.swap(callId, true);
                                                break;
                                            }
                                            case SessionState.Terminated: {
                                                // incomings session call hangup !
                                                sessionStorage.removeItem('active-' + sessionStorage.getItem('pri_server_name'));
                                                const callId = getCallId(
                                                    event.event.invitation.id
                                                );
                                                this.removeSession(callId);
                                                store.dispatch(
                                                    callHangUp({
                                                        callId,
                                                    })
                                                );
                                            }
                                        }
                                }
                                break;
                            case 'MessageUserEvent':
                                {
                                    // Iteratig again and again please identify the SIP message based on SIP heders NOT BASED ON BODY!!
                                    const message = event.event.message;
                                    const request = message.request;
                                    if ('Calllog' === request.getHeader('X-CAFE-NOTIFICATION')) {
                                        console.log("Loading call log!!");
                                        const messageId = request.getHeader('X-Cafe-Message-Id');
                                        sessionStorage.setItem(messageId, 'true');
                                        this.store.dispatch(
                                            loadInitialHistory()
                                        );
                                    }
                                }
                                break;
                            case 'InviteUserEvent':
                                switch (event.event.invitation.state) {
                                    case SessionState.Initial: {
                                        if (activeCallsCount < 2) {
                                            const invitation =
                                                event.event.invitation;
                                            // incoming received
                                            const callId = getCallId(
                                                invitation.id
                                            );
                                            this.addSession(callId, invitation);
                                            const peerId = getPeerId(
                                                invitation
                                            );
                                            store.dispatch(
                                                callStarted({
                                                    callId,
                                                    peerId,
                                                    dateTime: new Date().toISOString(),
                                                    direction: 'incoming',
                                                    isAnonymous:
                                                        peerId === 'unknown',
                                                })
                                            );

                                            //sessionStorage.setItem('callid', callId);
                                            console.log(
                                                'Event Status : Incoming Call from primary server'
                                            );


                                            console.log(
                                                '+++ sending progress, start gathering ice'
                                            );

                                            invitation
                                                .progress({
                                                    rel100: false,
                                                    statusCode: 183,
                                                })
                                                .then(
                                                    () => {
                                                        console.log(
                                                            '+++ then incoming progress send!'
                                                        );

                                                        this.store.dispatch(
                                                            callProgress({
                                                                dateTime: new Date().toISOString(),
                                                                callId,
                                                                statusCode: 183,
                                                            })
                                                        );
                                                    },
                                                    (err) => {
                                                        console.log(
                                                            '+++ progress exception !',
                                                            err
                                                        );
                                                    }
                                                );

                                            // ice gathering timeout 5 seconds
                                            // if ice gathering not completed then send without rely
                                            // if send without rele send unhold (reenvite) with longer ice gathering timeout

                                            // when get exception set global variable
                                            // rollbackOffer / catch / set global variable
                                            // when user press 200 OK and I cought this exception
                                            // if there is pending 200 OK send 200 OK again since previous fails
                                        }

                                        break;
                                    }
                                }
                                break;
                            case 'IncomingInviteSessionUserEvent':
                                switch (event.event.event.kind) {
                                    case 'UserSessionStateEvent':
                                        switch (event.event.invitation.state) {
                                            case SessionState.Establishing: {
                                                //incoming accepted
                                                const callId = getCallId(
                                                    event.event.invitation.id
                                                );
                                                store.dispatch(
                                                    callAccepted({
                                                        callId,
                                                        dateTime: new Date().toISOString(),
                                                    })
                                                );
                                                this.swap(callId, true);
                                                break;
                                            }
                                            case SessionState.Terminated: {
                                                //incoming reject
                                                const callId = getCallId(
                                                    event.event.invitation.id
                                                );
                                                this.removeSession(callId);
                                                store.dispatch(
                                                    callHangUp({
                                                        callId,
                                                    })
                                                );
                                                break;
                                            }
                                        }
                                        break;
                                }
                                break;
                        }
                        break;
                    case 'UserAgentOutgoingInviteEvent':
                        switch (event.event.kind) {
                            case 'AcceptOutgoingRequestEvent':
                                // outgoing accepted
                                console.log('Event Status : Outgoing Call Accept Event from Primary Server');
                                store.dispatch(
                                    callAccepted({
                                        callId: event.inviter.id,
                                        dateTime: new Date().toISOString(),
                                    })
                                );
                                call_fail.count = 0;
                                break;
                            case 'RejectOutgoingRequestEvent':
                                /*call_fail.count = ++call_fail.count;
                                console.log('Call FAILURE count primary :' + call_fail.count);
                                let only_event: any = event;
                                const numbermlm = only_event.event.response.message.to.uri.normal.user;
                                console.log('Geo number test', numbermlm);
                                //const serverStatus = this.userService.getServerStatus();
                                if ( call_fail.count === 1 && this.userService.secondarysipUser.transport.state == 'Connected') {
                                   console.log('try calling from secondary server:');
                                   const targetUri = this.sipService.getUserUri(numbermlm);
                                   this.sipService.inviteUser(this.userService.secondarysipUser, targetUri);
                                } else {
                                  console.log('Call was not connected through primary, no retry from secondary');
                                  call_fail.count = 0;
                                  call_fail.callId = '';
                                    this.removeSession(event.inviter.id);
                                store.dispatch(
                                    callHangUp({
                                        callId: event.inviter.id,
                                    })
                                );


                                }*/

                                this.removingAudioElement(event.inviter.id);

                                this.removeSession(event.inviter.id);
                                store.dispatch(
                                    callHangUp({
                                        callId: event.inviter.id,
                                    })
                                );

                                
                                // outgoing rejected (not established) by remote
                               console.log('Event Status : Outgoing Call Reject Event from Primary Server');
                                if (
                                    event.event.response.message.statusCode ===
                                    408 || event.event.response.message.statusCode === 503
                                ) {
                                    console.warn(
                                        '$$$ 408 for invite, try to reregister'
                                    );
                                    this.userService.registeredSipUser$.next(null);
                                    this.userService.reRegister();
                                }
                                break;
                            case 'ProgressOutgoingRequestEvent':
                                // outgoing accepted
                                console.log('Event Status : Outgoing Call Progress Event from Primary Server');
                                this.callingCreateAudio(event.inviter);
                                store.dispatch(
                                    callProgress({
                                        callId: event.inviter.id,
                                        dateTime: new Date().toISOString(),
                                        statusCode:
                                            event.event.response.message
                                                .statusCode,
                                    })
                                );
                                break;
                        }
                        break;
                    case 'UserAgentOutgoingActionEvent':
                        switch (event.action.kind) {
                            case 'OutgoingHangUpAction':
                                // outgoing call hangup
                                console.log('Event Status : Outgoing Call Hangup Event from Primary Server');
                                this.removeSession(event.action.session.id);
                                store.dispatch(
                                    callHangUp({
                                        callId: event.action.session.id,
                                    })
                                );
                                break;
                        }
                        break;
                }
            });
    }

    /**
     *
     * @param audioElement Setup audio media element which will output audio stream
     */
    setUpAudioMedia(destroy$: Observable<any>) {
        const setupStream = setupMediaElementStream();
        return this.userService.sipUser.userAgentEvents$
            .pipe(takeUntil(destroy$), setupStream)
            .subscribe(
                (result) => {
                    console.log('Setup media OK', result);
                },
                (err) => {
                    console.error(
                        'Setup media error. This is fatal for app',
                        err
                    );
                },
                () => {
                    console.log('Setup media complete, app must be finished');
                }
            );
    }

    getUri(id: string) {
        return this.sipService.getUserUri(id);
    }

    call(toUri: string) {
        const targetUri = this.updateTargetUriWithPlusPrefix(toUri);
        return this.sipService.inviteUser(this.userService.getActiveSipUser, targetUri);
    }

    voiceMail() {
        const uri = this.getUri(this.userService.user.multiLine);
        const targetUri = this.updateTargetUriWithPlusPrefix(uri);
        return this.sipService.inviteUser(this.userService.sipUser, uri);
    }

    async accept(callId: string) {
        console.log('+++ accept');

        this.store.dispatch(
            callAcceptStart({
                callId,
            })
        );

        const callSession = this.getSession(callId);
        const invitation = callSession as Invitation;
        const callEstablished$ = this.store.select(selectActiveCalls).pipe(
            map((calls) => {
                const call = calls[callId];

                if (call.kind === 'SuspendedActiveCall') {
                    return call.isEstablishing;
                } else {
                    return false;
                }
            }),
            filter((isEstablishing) => isEstablishing !== true),
            take(1)
        );
        console.log('+++ wait call progress false till accept the call');
        await callEstablished$.toPromise();
        console.log('+++ call progress false, do accept the call');
        let acceptCallSession:any = callSession
        const sipUserUri = acceptCallSession._userAgent.uri;

                    setTimeout(
            () =>
                this.sipService.acceptInvitation(
                    this.userService.getActiveCallSipUser(sipUserUri),
                    invitation
                ),
            500
        );

    }

    hangUp(callId: string) {
        const session = this.getSession(callId);
        let acceptCallSession:any = session
        const sipUserUri = acceptCallSession._userAgent.uri;
        //const serverStatus = this.userService.getServerStatus();
        //sessionStorage.removeItem('active-' + sessionStorage.getItem('pri_server_name'));
        //sessionStorage.removeItem('active-' + sessionStorage.getItem('sec_server_name'));
        return this.sipService.hangUpSession(this.userService.getActiveCallSipUser(sipUserUri), session);
    }

    swap(callId: string, incoming = false) {
        Object.keys(this.callSessions).forEach((sid) => {
            if (this.callSessions[sid].state !== SessionState.Established) {
                return;
            }
            if (sid === callId) {
                if (!incoming) {
                    this.setHold(sid, false);
                }
            } else {
                this.setHold(sid, true);
            }
        });
        this.store.dispatch(callSetOnlyActive({ callId }));
    }

    setMute(callId: string, isMute: boolean) {
        const session = this.getSession(callId);
        let acceptCallSession:any = session
        const sipUserUri = acceptCallSession._userAgent.uri;
        
        this.sipService.setSessionMute(
            this.userService.getActiveCallSipUser(sipUserUri),
            session,
            isMute
        );

        this.store.dispatch(callMuteChanged({ callId, isMuted: isMute }));
    }

    setHold(callId: string, isHold: boolean) {
        const session = this.getSession(callId);
        let acceptCallSession:any = session
        const sipUserUri = acceptCallSession._userAgent.uri;
        this.sipService.setSessionHold(
            this.userService.getActiveCallSipUser(sipUserUri),
            session,
            isHold
        );
        this.store.dispatch(callHoldChanged({ callId, isHold }));
    }

    private addSession(sessionId: string, session: Session) {
        this.callSessions = assoc([sessionId], session, this.callSessions);
    }

    private removeSession(sessionId: string) {
        this.callSessions = omit([sessionId], this.callSessions);
    }

    private getSession(id: string): Session {
        const callSession = this.callSessions[id];
        if (!callSession) {
            throw new Error(`Call session [${id}] is not found`);
        }
        return callSession;
    }

    clearHistory(peerId: string) {
        this.store.dispatch(clearCallingHistory({ peerId: peerId }));
    }

    startUnknownMultilineSession(multiline: string) {
        const uri = this.sipService.getUserUri(multiline);
        this.call(uri);
    }

    loadInitialHistory() {
        this.store.dispatch(loadInitialHistory());
    }

    deleteHistoryItem(peerId: string, itemId: string) {
        this.store.dispatch(deleteHistoryItem({ peerId, itemId }));
    }

    sendDTFM(sessionId: string, signal: string) {
        const callSession = this.callSessions[sessionId];
        if (!callSession) {
            throw new Error(`Call session [${sessionId}] is not found`);
        }
        const options = {
            requestOptions: {
                body: {
                    contentDisposition: 'render',
                    contentType: 'application/dtmf-relay',
                    content: `Signal=${signal}\r\nDuration=1000`,
                },
            },
        };
        callSession.info(options);
    }

    private removePlusPrefix(phoneNumber: string) {
        return phoneNumber.replace(/(\+)(\d+)/, '$2');
    }

    private updateTargetUriWithPlusPrefix(targetUri: string) {
        return targetUri.replace(/\:(\d+)\@/, ':+$1@');
    }

    callingCreateAudio(session){
        console.log('calling createaudio  from calling service');
        const mediaElementsHash: { [key: string]: HTMLAudioElement } = {};
        const audioElement = mediaElementsHash[session];
                               if (!audioElement) {
                                   const audioElement = document.createElement('audio');
                                    mediaElementsHash[session.id] = audioElement;
                                    setupSessionRemoteMedia(session, audioElement);
                                     return audioElement;
                               } else {
                                 console.log('audio element already exists');
                                 return audioElement;
                                }
    }



    removingAudioElement(sessionId){
        const mediaElementsHash: { [key: string]: HTMLAudioElement } = {};
        const audioElement = mediaElementsHash[sessionId];
        if (!audioElement) {
            console.warn('Audio element for session is not found !', sessionId);
            return;
        }
        cleanupMedia(audioElement);
        audioElement.remove();
        delete mediaElementsHash[sessionId];
    }

}
