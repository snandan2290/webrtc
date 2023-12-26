import { state } from '@angular/animations';
import {
    DATE_TIME_HEADER,
    MULTI_TARGET_TAG_ID_HEADER,
    UserAgentEvent,
} from '@scalio/sip';
import { Observable } from 'rxjs';
import { scan } from 'rxjs/operators';

export interface MessageUser {
    isMe: boolean;
    uri: string;
    name: string;
}

export interface MessageSendingStatus {
    kind: 'MessageSendingStatus';
}

export interface MessageReceivedStatus {
    kind: 'MessageReceivedStatus';
    receivedDateTime: string;
}

export interface MessageErrorStatus {
    kind: 'MessageErrorStatus';
    error: string;
}

export type MessageStatus =
    | MessageSendingStatus
    | MessageReceivedStatus
    | MessageErrorStatus;

export interface MessageView {
    id: string;
    multiTargetTagId?: string;
    user: MessageUser;
    content: string;
    sentDateTime: string;
    status: MessageStatus;
}

export const createMessagesView = (userIdentifier: string) => (
    acc: MessageView[],
    evt: UserAgentEvent
) => {
    switch (evt.kind) {
        case 'UserAgentOutgoingActionEvent': {
            switch (evt.action.kind) {
                case 'UserAgentOutgoingMessageAction':
                    const message = evt.action.message;
                    const dt = message.getHeader(DATE_TIME_HEADER);
                    const multiTargetTagId = message.getHeader(
                        MULTI_TARGET_TAG_ID_HEADER
                    );
                    if (!dt) {
                        console.warn(
                            `Message ${message.callId} date time header is not found`
                        );
                    }
                    const newMsg: MessageView = {
                        id: message.callId,
                        multiTargetTagId: multiTargetTagId,
                        user: {
                            isMe: true,
                            name: message.from.displayName,
                            uri: message.from.uri.toString(),
                        },
                        sentDateTime: dt,
                        status: {
                            kind: 'MessageSendingStatus',
                        },
                        content: message.body.body,
                    };
                    return [newMsg, ...acc];
            }
            break;
        }
        case 'UserAgentCommonEvent':
            switch (evt.event.kind) {
                case 'MessageUserEvent':
                    console.log('Message.view--------> Test case')
                    const request = evt.event.message.request;
                    // movius server will dispatch same message to the sender
                    if (userIdentifier === request.from.uri.user) {
                        console.warn('received message from user itself');
                        return acc;
                    }
                    const dt = request.getHeader(DATE_TIME_HEADER) || request.getHeader('X-CAFE-MESSAGE-TIMESTAMP');
                    const multiTargetTagId = request.getHeader(
                        MULTI_TARGET_TAG_ID_HEADER
                    );
                    if (!dt) {
                        console.warn(
                            `Message ${evt.event.message.request.callId} date time header is not found`
                        );
                    }
                    const newMsg: MessageView = {
                        id: evt.event.message.request.callId,
                        multiTargetTagId,
                        user: {
                            isMe: false,
                            name: request.from.displayName,
                            uri: request.from.uri.toString(),
                        },
                        sentDateTime: dt,
                        status: {
                            kind: 'MessageReceivedStatus',
                            receivedDateTime: new Date().toISOString(),
                        },
                        content: evt.event.body,
                    };
                    evt.event.message.accept();
                    return [newMsg, ...acc];
            }
            break;
        case 'UserAgentSendMessageEvent': {
            switch (evt.event.kind) {
                case 'AcceptOutgoingRequestEvent':
                    const id = evt.event.response.message.callId;
                    const originalMessage = acc.find((f) => f.id === id);
                    if (!originalMessage) {
                        console.warn(
                            `Original message with id ${id} is not found`
                        );
                        return acc;
                    } else {
                        const updMessage: MessageView = {
                            ...originalMessage,
                            status: {
                                kind: 'MessageReceivedStatus',
                                receivedDateTime: new Date().toString(),
                            },
                        };
                        return acc.map((m) => (m.id === id ? updMessage : m));
                    }
            }
            break;
        }
    }
    return acc;
};

export const getMessages = (userIdentifier: string) => (
    userAgentEvents$: Observable<UserAgentEvent>
) => userAgentEvents$.pipe(scan(createMessagesView(userIdentifier), []));
