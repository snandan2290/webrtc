import {
    DATE_TIME_HEADER,
    MULTI_TARGET_TAG_ID_HEADER,
    UserAgentEvent,
} from '@scalio/sip';
import { Observable } from 'rxjs';
import { map, scan } from 'rxjs/operators';
import {
    IncomingRequestMessage,
    OutgoingRequestMessage,
} from 'sip.js/lib/core';
import { SipMessage } from '../../models';

const getDateTimeHeader = (
    message: OutgoingRequestMessage | IncomingRequestMessage
) => {
    const dateTimeHeaderValue = message.getHeader(DATE_TIME_HEADER);
    if (dateTimeHeaderValue) {
        return dateTimeHeaderValue;
    } else {
        const timestamp = message.getHeader('X-CAFE-MESSAGE-TIMESTAMP');
        return timestamp && timestamp + ' GMT';
    }
};

const reducer = (userIdentifier: string) => (
    acc: { [id: string]: SipMessage },
    evt: UserAgentEvent
) => {
    switch (evt.kind) {
        case 'UserAgentOutgoingActionEvent': {
            switch (evt.action.kind) {
                case 'UserAgentOutgoingMessageAction':
                    // send outgoing message
                    const message = evt.action.message;
                    if (!message.body.body) {
                        // just ack
                        return acc;
                    }
                    const dt = getDateTimeHeader(message);
                    const multiTargetTagId = message.getHeader(
                        MULTI_TARGET_TAG_ID_HEADER
                    );
                    if (!dt) {
                        console.warn(
                            `Message ${message.callId} date time header is not found`
                        );
                    }
                    const newMsg: SipMessage = {
                        id: message.callId,
                        groupId: multiTargetTagId,
                        from: message.from.uri.user,
                        to: message.to.uri.user,
                        sentTime: dt,
                        content: message.body.body,
                    };
                    return { ...acc, [newMsg.id]: newMsg };
            }
            break;
        }
        case 'UserAgentCommonEvent':
            switch (evt.event.kind) {
                case 'MessageUserEvent':
                    // incoming message
                    console.log('get-messages--------> Test case')
                    const request = evt.event.message.request;
                    // movius server will dispatch same message to the sender
                    if (userIdentifier === request.from.uri.user) {
                        console.warn('received message from user itself');
                        return acc;
                    }
                    const dt = getDateTimeHeader(request);
                    const multiTargetTagId = request.getHeader(
                        MULTI_TARGET_TAG_ID_HEADER
                    );
                    if (!dt) {
                        console.warn(
                            `Message ${evt.event.message.request.callId} date time header is not found`
                        );
                    }
                    evt.event.message.accept();

                    if (!!evt.event.body) {
                        const newMsg: SipMessage = {
                            id: evt.event.message.request.callId,
                            groupId: multiTargetTagId,
                            from: request.from.uri.user,
                            to: request.to.uri.user,
                            sentTime: dt,
                            receivedTime: new Date().toISOString(),
                            content: evt.event.body,
                        };
                        // TODO : Accept message here (is it good enough ?)

                        return { ...acc, [newMsg.id]: newMsg };
                    } else {
                        // consider empty body as just ack
                        return acc;
                    }
            }
            break;
        case 'UserAgentSendMessageEvent': {
            switch (evt.event.kind) {
                case 'AcceptOutgoingRequestEvent':
                    const id = evt.event.response.message.callId;
                    const originalMessage = acc[id];
                    if (!originalMessage) {
                        console.warn(
                            `Original message with id ${id} is not found`
                        );
                        return acc;
                    } else {
                        const updMessage: SipMessage = {
                            ...originalMessage,
                            receivedTime: new Date().toString(),
                        };
                        return { ...acc, [updMessage.id]: updMessage };
                    }
            }
            break;
        }
    }
    return acc;
};

export const getMessages = (userIdentifier: string) => (
    events$: Observable<UserAgentEvent>
): Observable<SipMessage[]> =>
    events$.pipe(
        scan(reducer(userIdentifier), {}),
        map((acc) => Object.values(acc))
    );
