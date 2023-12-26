import { Injectable } from '@angular/core';
import { BehaviorSubject, Subject } from 'rxjs';
import { expand } from 'rxjs/operators';
import {
    Invitation,
    Inviter,
    Session,
    SessionState,
    TransportState,
    UserAgent,
} from 'sip.js';
import {
    IncomingRequestMessage,
    IncomingResponseMessage,
    OutgoingRequestMessage,
    URI,
} from 'sip.js/lib/core';
import { UserEvent } from './create-user-agent-observable-delegate';
import { getUserUri } from './get-user-options';
import { ISipService, SipConfig } from './models';
import { SipUser, UserAgentEvent } from './sip-user';

export interface SendMessageMockEvent {
    kind: 'SendMessageMockEvent';
    user: SipUser;
    target: SipUser | string;
    content: string;
}

export type MockEvent = SendMessageMockEvent;

export class MockSipUser {
    readonly userEvents$ = new Subject<UserEvent>();
    readonly userAgentEvents$ = new Subject<UserAgentEvent>();
    readonly transportStateChangeEvent$ = new BehaviorSubject<TransportState>(
        TransportState.Disconnected
    );
    constructor(
        public readonly id: string,
        public readonly uri: string,
        public readonly userName: string
    ) { }

    mockIncomingCall(mlNumber: string) {
        const request = new IncomingRequestMessage();
        request.addHeader('X-Cafe-Dn', mlNumber);
        this.userAgentEvents$.next({
            kind: 'UserAgentCommonEvent',
            event: {
                kind: 'InviteUserEvent',
                invitation: {
                    state: SessionState.Initial,
                    id: new Date().getTime().toString(),
                    request,
                } as any,
            },
        });
    }

    mockRejectMessage(msg: OutgoingRequestMessage) {
        const responseMessage = new IncomingResponseMessage();
        responseMessage.reasonPhrase = 'error';
        responseMessage.statusCode = 500;
        this.userAgentEvents$.next({
            kind: 'UserAgentSendMessageEvent',
            message: msg,
            event: {
                kind: 'RejectOutgoingRequestEvent',
                response: {
                    message: responseMessage,
                },
            },
        });
    }

    mockAcceptMessage(msg: OutgoingRequestMessage, resendCallId: string) {
        const responseMessage = new IncomingResponseMessage();
        responseMessage.statusCode = 200;
        responseMessage.addHeader(
            'X-Cafe-Message-Id',
            new Date().toISOString()
        );
        responseMessage.to = msg.to;
        responseMessage.callId = msg.callId;
        msg.headers['Resend-Call-Id'] = [resendCallId];
        this.userAgentEvents$.next({
            kind: 'UserAgentSendMessageEvent',
            message: msg,
            event: {
                kind: 'AcceptOutgoingRequestEvent',
                response: {
                    message: responseMessage,
                },
            },
        });
    }
}

const createUri = (user: string) => {
    return new URI(null, user, 'test');
};

@Injectable()
export class MockSipService implements ISipService {
    user: MockSipUser;

    constructor() { }

    createUser(
        id: string,
        name: string,
        password: string = null,
        generateNameToken = true,
        extraHeaders: string[] = [],
        config?: SipConfig
    ) {
        this.user = new MockSipUser(
            '111111',
            this.getUserUri('111111'),
            '111111'
        );

        return (this.user as unknown) as SipUser;
    }

    getUserUri = (userId: string) => {
        return getUserUri(userId, 'test');
    };

    startUser(user: SipUser) {
        return Promise.resolve();
    }

    registerUser(user: SipUser) {
        this.user.transportStateChangeEvent$.next(TransportState.Connected);
        return Promise.resolve();
    }

    stopUser(user: SipUser) {
        return Promise.resolve();
    }

    unregisterUser(user: SipUser) {
        this.user.transportStateChangeEvent$.next(TransportState.Disconnected);
        return Promise.resolve(null);
    }

    inviteUser(user: SipUser, target: SipUser | string) {
        const targetNumber = /:(\d+)@/.exec(target as string)[1];
        this.user.userAgentEvents$.next({
            kind: 'UserAgentInviterSessionEvent',
            inviter: {
                id: new Date().getDate().toString(),
                request: new OutgoingRequestMessage(
                    'POST',
                    createUri(user.userName),
                    createUri(user.userName),
                    createUri(targetNumber)
                ),
            } as any,
            event: {
                kind: 'SessionDescriptionHandlerEvent',
            } as any,
        });

        return Promise.resolve(null);
    }

    acceptInvitation(user: SipUser, invitation: Invitation) {
        this.user.userAgentEvents$.next({
            kind: 'UserAgentCommonEvent',
            event: {
                invitation: { ...invitation, state: SessionState.Establishing },
                kind: 'IncomingInviteSessionUserEvent',
                event: {
                    kind: 'UserSessionStateEvent',
                },
            },
        } as any);

        return Promise.resolve(null);
    }

    rejectInvitation(invitation: Invitation) {
        return Promise.resolve(null);
    }

    hangUpSession(user: SipUser, session: Session) {
        // const targetNumber = /:(\d+)@/.exec(target as string)[1];
        this.user.userAgentEvents$.next({
            kind: 'UserAgentOutgoingActionEvent',
            action: {
                kind: 'OutgoingHangUpAction',
                session,
            },
        });

        return Promise.resolve(null);
    }

    async sendMessage(
        user: SipUser,
        target: SipUser | string,
        content: string,
        callId?: string
    ) {
        const targetNumber = /:(\d+)@/.exec(target as string)[1];
        this.user.userAgentEvents$.next({
            kind: 'UserAgentOutgoingActionEvent',
            action: {
                kind: 'UserAgentOutgoingMessageAction',
                message: new OutgoingRequestMessage(
                    'POST',
                    createUri(user.userName),
                    createUri(user.userName),
                    createUri(targetNumber),
                    null,
                    callId ? [`RESEND_CALL_ID:${callId}`] : null,
                    { content } as any
                ),
            },
        });

        return Promise.resolve(null);
    }

    async reSendMessage(
        user: SipUser,
        target: SipUser | string,
        content: string,
        callId: string,
        isWhatsApp: boolean
    ) {
        return this.sendMessage(user, target, content, callId);
    }

    async sendMultiTargetMessage(
        user: SipUser,
        targets: SipUser[] | string[],
        content: string,
        gentToken = true
    ) {
        return Promise.resolve(null);
    }

    setSessionMute(user: SipUser, session: Session, isMute: boolean) {
        return Promise.resolve(null);
    }

    setSessionHold(user: SipUser, session: Session, isHold: boolean) {
        return Promise.resolve(null);
    }
}
