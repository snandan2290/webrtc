import { Observable, Subject } from 'rxjs';
import { flatMap } from 'rxjs/operators';
import {
    Invitation,
    Message,
    Notification,
    Referral,
    SessionState,
    Subscription,
    UserAgentDelegate,
} from 'sip.js';
import {
    IncomingReferRequest,
    IncomingRegisterRequest,
    IncomingSubscribeRequest,
} from 'sip.js/lib/core';
import { OutgoingRequestEvent } from './create-outgoing-request-observable-delegate';
import { createSessionObservableDelegate } from './create-session-observable-delegate';
import {
    invitationAsObservable,
    UserSessionEvent,
} from './invitation-as-observable';

import { serverDateToISO } from '@movius/domain';
import {LoggerFactory} from '@movius/ts-logger';
import { getMessageChannelType, getMsgChannelTypeFromParticipants, getValidParticipantsArray } from 'apps/movius-web/src/libs/shared/utils/common-utils';
const logger = LoggerFactory.getLogger("")

export interface ConnectUserEvent {
    kind: 'ConnectUserEvent';
}

export interface DisconnectUserEvent {
    kind: 'DisconnectUserEvent';
    error?: Error;
}

export interface readMessage {
    thread: string,
    timestamp: string,
    peerid: string,
    message: string
}
export interface InviteUserEvent {
    kind: 'InviteUserEvent';
    invitation: Invitation;
}

export interface MessageUserEvent {
    kind: 'MessageUserEvent';
    message: Message;
    body: string;
}

export interface NotifyUserEvent {
    kind: 'NotifyUserEvent';
    notification: Notification;
}

export interface ReferUserEvent {
    kind: 'ReferUserEvent';
    referral: Referral;
}

export interface RegisterUserEvent {
    kind: 'RegisterUserEvent';
    registration: any;
}

export interface SubscribeUserEvent {
    kind: 'SubscribeUserEvent';
    subscription: Subscription;
}

export interface ReferRequestUserEvent {
    kind: 'ReferRequestUserEvent';
    request: IncomingReferRequest;
}

export interface RegisterRequestUserEvent {
    kind: 'RegisterRequestUserEvent';
    request: IncomingRegisterRequest;
}

export interface SubscribeRequestUserEvent {
    kind: 'SubscribeRequestUserEvent';
    request: IncomingSubscribeRequest;
}

export interface IncomingInviteSessionUserEvent {
    kind: 'IncomingInviteSessionUserEvent';
    invitation: Invitation;
    event: UserSessionEvent;
}

export type UserEvent =
    | ConnectUserEvent
    | DisconnectUserEvent
    | InviteUserEvent
    | MessageUserEvent
    | NotifyUserEvent
    | ReferUserEvent
    | RegisterUserEvent
    | SubscribeUserEvent
    | ReferRequestUserEvent
    | RegisterRequestUserEvent
    | SubscribeRequestUserEvent
    | IncomingInviteSessionUserEvent;

export const createUserAgentObservableDelegate = () => {
    const subj = new Subject<UserEvent>();
    const delegate: UserAgentDelegate = {
        onConnect: () => {
            subj.next({ kind: 'ConnectUserEvent' });
        },
        onDisconnect: (error?: Error) => {
            subj.next({ kind: 'DisconnectUserEvent', error });
        },
        onInvite: (invitation: Invitation) => {
            const invitationStream = invitationAsObservable(invitation);
            const sub = invitationStream.subscribe((event) => {
                subj.next({
                    kind: 'IncomingInviteSessionUserEvent',
                    invitation,
                    event,
                });
                if (
                    event.kind === 'UserSessionStateEvent' &&
                    event.state === SessionState.Terminated
                ) {
                    sub.unsubscribe();
                }
            });
            subj.next({ kind: 'InviteUserEvent', invitation });
        },
        onMessage: (message: Message) => {
            if (message.request.getHeader('X-CAFE-SYSTEM-MESSAGE-TYPE') === '32' || 
                  (message.request.getHeader('X-CAFE-SYSTEM-MESSAGE-TYPE') === '34' && 
                  sessionStorage.getItem('__api_identity__') === message.request.getHeader('From').split(" ")[0].split("\"")[1])){
                logger.debug('Skipping the message for Message Type = ' + message.request.getHeader('X-CAFE-SYSTEM-MESSAGE-TYPE'))
                message.accept();
            } else if((sessionStorage.getItem('thread-whatsapp:'+message.request.getHeader('From').split(" ")[0].split("\"")[1]) === message.request.getHeader('X-CAFE-MESSAGE-THREAD')) 
                && (message.request.getHeader('X-CAFE-MSG-CALLER-TYPE') === undefined)){
                    logger.debug('Looks like sync message for WA without required paramters, skip it')
                    message.accept();
            }else {
                subj.next({
                    kind: 'MessageUserEvent',
                    message,
                    body: message.request.body,
                });
                const messageId = message.request.getHeader('X-Cafe-Message-Id');
                

                const systemCafeHeader = Number(message.request.getHeader('X-CAFE-SYSTEM-MESSAGE-TYPE'));
                let whatsOptInReqStatus;

                switch(systemCafeHeader){
                    case 25:
                        {
                            whatsOptInReqStatus = 3;
                            break;
                        }
                    case 21:{
                        whatsOptInReqStatus = 4;
                        break;
                    }
                    case 33: {
                        whatsOptInReqStatus = 5;
                        break;
                    }
                    case 34: {
                        whatsOptInReqStatus = 3;
                        break;
                    }
                    case 30: {
                        whatsOptInReqStatus = 3;
                        break;
                    }
                    case 31: {
                        whatsOptInReqStatus = 3;
                        break;
                    }
                    case 16: {
                        whatsOptInReqStatus = 2;
                        break;
                    }
                    case 29: {
                        whatsOptInReqStatus = 3;
                        break;
                    }
                    case 37: {
                        whatsOptInReqStatus = 5;
                        break;
                    }
                    case 35: {
                        whatsOptInReqStatus = 3;
                        break;
                    }
                }

                if(systemCafeHeader && whatsOptInReqStatus){
                    const threadId = message.request.getHeader('X-CAFE-MESSAGE-THREAD');
                    sessionStorage.setItem('opt-in-status-for-thread-id-' + threadId, whatsOptInReqStatus);
                }


                if(message.request.getHeader('X-CAFE-MSG-CALLER-TYPE') === 'whatsapp')
                {
                    sessionStorage.setItem('thread-whatsapp:'+message.request.getHeader('From').split(" ")[0].split("\"")[1],message.request.getHeader('X-CAFE-MESSAGE-THREAD'))
                }
                if (sessionStorage.getItem(messageId) != null) {
                    logger.debug('Message got processed, delete from session');
                    sessionStorage.removeItem(messageId);
                } else {
                    logger.debug('Message was not processed by Messaging service');
                    message.accept();
                    let fromNumber = message.request.getHeader('From').split(" ")[0].split("\"")[1];
                    const threadId = message.request.getHeader('X-CAFE-MESSAGE-THREAD');
                    let parties_list = message.request.getHeader('X-Cafe-Participants');
                    let messageChannelType = '';
                    if(parties_list){
                        messageChannelType = getMsgChannelTypeFromParticipants(getValidParticipantsArray(parties_list))
                    } else {
                        messageChannelType = getMessageChannelType(message.request.getHeader('X-Cafe-Msg-Caller-Type'), fromNumber, threadId)
                    }
                    const isCalllogNotification = message.request.getHeader('X-CAFE-NOTIFICATION') === 'Calllog';
                    const messageReadTime = serverDateToISO(message.request.getHeader('X-CAFE-MESSAGE-READ-TIMESTAMP'));
                    const isReadStatusNotification = message.request.getHeader('X-CAFE-SYSTEM-MESSAGE-TYPE') === '1';
                    const isVoicemailNotification = message.request.getHeader('X-CAFE-SYSTEM-MESSAGE-TYPE') === '3';
                    const isSysMsg = message.request.getHeader('X-CAFE-SYSTEMGEN') === 'Yes'
                    const multimediaId = message.request.getHeader('X-CAFE-MULTIMEDIA-ID');
                    const multimediaType = message.request.getHeader('X-CAFE-MULTIMEDIA-CONTENT-TYPE');
                    const system_type = message.request.getHeader('X-CAFE-SYSTEM-MESSAGE-TYPE');
                    
                    if (isCalllogNotification) {
                        logger.debug("SIP message to refresh call log");
                        sessionStorage.setItem('LostMessage-Calllog', 'Calllog');
                    }
                    else if (isVoicemailNotification) {
                        logger.debug("SIP message to voicemail fetch");
                        sessionStorage.setItem('LostMessage-Voicemail', 'Voicemail');
                    }
                    else if (messageReadTime !== null && isSysMsg && isReadStatusNotification) {
                        let pendingMsg: readMessage[] = [];
                        logger.debug("SIP message to update message read status");
                        if (JSON.parse(sessionStorage.getItem('LostMessage-readStatus')) !== null) {
                            pendingMsg = JSON.parse(JSON.parse(JSON.stringify(sessionStorage.getItem('LostMessage-readStatus'))));
                        }
                        let count = pendingMsg.push(
                            {
                                "thread": message.request.getHeader('X-CAFE-MESSAGE-THREAD'),
                                "timestamp": serverDateToISO(message.request.getHeader('X-CAFE-MESSAGE-READ-TIMESTAMP')),
                                "message": message.request.getHeader('X-CAFE-MESSAGE-ID'),
                                "peerid": sessionStorage.getItem('__api_identity__')
                            }
                        )
                        sessionStorage.setItem('LostMessage-readStatus', JSON.stringify(pendingMsg));
                    }
                    else {
                        let allNumbers = "";
                        let isGroupMsg = false;
                        const fromNumber = message.request.getHeader('From').split(" ")[0].split("\"")[1];
                        
                        let to_ = message.request.getHeader('To').replace("<sip:+", "").split("@")[0];
                        let parties_list = message.request.getHeader('X-Cafe-Participants');
                        if (parties_list !== null && parties_list !== undefined) {
                            isGroupMsg = true
                            const participants = parties_list.split('|');
                            const sortParticipants = participants.sort((a, b) => 0 - (a > b ? -1 : 1));
                            let SortedPartiesList = "";
    
                            for (let i = 0; i < sortParticipants.length; i++) {
                                if (i === 0) {
                                    SortedPartiesList = sortParticipants[i];
                                    allNumbers = sortParticipants[i];
                                } else {
                                    SortedPartiesList = SortedPartiesList + '|' + sortParticipants[i];
                                    allNumbers = allNumbers + sortParticipants[i];
                                }
                            }
                            parties_list = SortedPartiesList
                        }
                        else if ((sessionStorage.getItem('__api_identity__') === fromNumber)) { // Sync the 1:1 lost message initated from MML to MLDT
                            logger.debug("Sent SIP message sync");
                            allNumbers = message.request.getHeader('X-CAFE-RECIPIENT');
                        }
                        else {
                            allNumbers = fromNumber;
                        }
                        if (sessionStorage.getItem('__api_identity__') !== fromNumber) {
                            to_=sessionStorage.getItem('__api_identity__')
                        }
                        const LostMsgData = {
                            "contactMlNumber":message.request.from.uri.user.replace(/(\+)(\d+)/, '$2'),
                            "messageRecipient":message.request.getHeader('X-CAFE-RECIPIENT'),
                            "peerid": allNumbers,
                            "messageId":message.request.getHeader('X-Cafe-Message-Id'),
                            "fromNumber": fromNumber,
                            "to":to_,
                            "content":message.request.body,
                            "messageTime":serverDateToISO(message.request.getHeader('X-CAFE-MESSAGE-TIMESTAMP')),
                            "isSystem":isSysMsg,
                            "threadId": message.request.getHeader('X-CAFE-MESSAGE-THREAD'),
                            "partiesList":parties_list,
                            "isGroupMsg":isGroupMsg,
                            "multimediaId":multimediaId,
                            "multimediaType":multimediaType,
                            "messageChannelType":messageChannelType,
                            "system_type":system_type
                        }
                        sessionStorage.setItem('LostMessage-Msg-' + message.request.getHeader('X-Cafe-Message-Id'), JSON.stringify(LostMsgData));
                    }
                    //message.accept();
                }
             }
        },
        onNotify: (notification: Notification) => {
            subj.next({ kind: 'NotifyUserEvent', notification });
        },
        onRefer: (referral: Referral) => {
            subj.next({ kind: 'ReferUserEvent', referral });
        },
        onRegister: (registration: any) => {
            subj.next({ kind: 'RegisterUserEvent', registration });
        },
        onSubscribe: (subscription: Subscription) => {
            subj.next({ kind: 'SubscribeUserEvent', subscription });
        },
        onReferRequest: (request: IncomingReferRequest) => {
            subj.next({ kind: 'ReferRequestUserEvent', request });
        },
        onRegisterRequest: (request: IncomingRegisterRequest) => {
            subj.next({
                kind: 'RegisterRequestUserEvent',
                request,
            });
        },
        onSubscribeRequest: (request: IncomingSubscribeRequest) => {
            subj.next({ kind: 'SubscribeRequestUserEvent', request });
        },
    };

    return { delegate, stream: subj };
};

const isWhatsappMsg = (request) => {
    /*const msgCallerType = request.getHeader('X-CAFE-MSG-CALLER-TYPE');
    if(msgCallerType && msgCallerType.includes("whatsapp")) return true;
    const recipient = request.getHeader('X-CAFE-RECIPIENT');
    if(recipient && recipient.includes("whatsapp")) return true;
    const msgCalledType = request.getHeader('X-CAFE-MSG-CALLED-TYPE');
    if(msgCalledType && msgCalledType.includes("whatsapp")) return true;*/
    const wa_participants = request.getHeader('X-CAFE-PARTICIPANTS');
    if(wa_participants && wa_participants.includes("whatsapp")) return true;
    // const sysMsgType = request.getHeader('X-CAFE-SYSTEM-MESSAGE-TYPE');
    // if(sysMsgType && 
    //     (sysMsgType == "29"
    //     || sysMsgType == "30"
    //     || sysMsgType == "31"
    //     || sysMsgType == "33"
    //     || sysMsgType == "34"
    //     )
    // ) return true;
    return false;
}