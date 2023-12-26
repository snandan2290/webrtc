import { Inject, Injectable, InjectionToken } from '@angular/core';
import { Subject } from 'rxjs';
import { Invitation, Session } from 'sip.js';
import { generateToken } from './generte-token';
import { getUserUri } from './get-user-options';
import { ISipService, SipConfig } from './models';
import { SipUser } from './sip-user';
import { LoggerFactory } from '@movius/ts-logger';
const logger = LoggerFactory.getLogger("")
export const SIP_CONFIG = new InjectionToken('SIP_CONFIG');

@Injectable()
export class SipService implements ISipService {
    constructor(@Inject(SIP_CONFIG) private readonly config: SipConfig) { }

    createUser(
        id: string,
        name: string,
        password: string = null,
        generateNameToken = true,
        extraHeaders: string[] = [],
        config?: SipConfig
    ) {
        logger.debug('Connecting to', config.server);
        const mergedConfig = config
            ? { ...this.config, ...config }
            : this.config;
        return new SipUser(
            mergedConfig.server,
            mergedConfig.domain,
            id,
            name,
            password,
            generateNameToken ? generateToken() : null,
            extraHeaders,
            mergedConfig.userAgentString,
            mergedConfig.onFixContactRegisterer,
            mergedConfig.ice,
            mergedConfig.iceGatheringTimeout,
            mergedConfig.registererExpiresTimeout,
            mergedConfig.stubs
        );
    }

    getUserUri = (userId: string) => {
        return getUserUri(userId, this.config.domain);
    };

    startUser(user: SipUser) {
        return user.start();
    }

    registerUser(user: SipUser, connectTransport = false) {
        //if(user != null){
        //const serverName = user.uri.split('@')[1].split('.')[0];
        return user.register(connectTransport);
        //}
    }

    stopUser(user: SipUser) {
        if (user.isConnected) {
            return user.stop();
        }
    }

    unregisterUser(user: SipUser, disconnectTransport = true) {
        return user.unregister(disconnectTransport);
    }

    inviteUser(user: SipUser, target: SipUser | string) {
        return user.invite(target);
    }

    acceptInvitation(user: SipUser, invitation: Invitation) {
        return user.acceptInvitation(invitation);
    }

    rejectInvitation(invitation: Invitation) {
        invitation.reject();
    }

    hangUpSession(user: SipUser, session: Session) {
        return user.hangUp(session);
    }

    async sendMessage(
        user: SipUser,
        target: SipUser | string,
        content: string,
        participants?: any,
        sendToWhatsApp: boolean = false,
        sendToLineorWechat: boolean = false,
        locationInfo?: {
            latitude: number,
            longitude: number,
            accuracy: number
        }
    ) {
        user.sendMessage(user, target, content, participants, sendToWhatsApp, sendToLineorWechat, locationInfo);
    }

    async reSendMessage(
        user: SipUser,
        target: SipUser | string,
        content: string,
        callId: string,
        isWhatsApp: boolean,
        mmsDetails?: {
            mms_id: string
            mms_type: string
        }
    ) {
        let groupOrNot: boolean = false;
        let groupPeerId: string = '';
        let groupIDResendMsg = sessionStorage.getItem('resend-' + callId);
        console.log("reSendMessage:::", 'resend-' + callId, sessionStorage.getItem('resend-' + callId))

        if (null === groupIDResendMsg) {
            console.log("reSendMessage:::", callId, sessionStorage.getItem(callId))
            groupIDResendMsg = sessionStorage.getItem(callId);
            if (null !== groupIDResendMsg && groupIDResendMsg.length > 1) {
                if (!groupIDResendMsg.includes("|")) {
                    groupIDResendMsg = sessionStorage.getItem("participants")
                }
            }
        }
        if (groupIDResendMsg !== "\"null\"" && groupIDResendMsg !== null) {
            groupPeerId = groupIDResendMsg;
            groupOrNot = true;
        }
        if (!mmsDetails) {
            mmsDetails = null;
        }
        user.sendMessage(user, target, content, null, isWhatsApp, null, null, mmsDetails, null, callId, groupPeerId, groupOrNot);
    }

    async sendMMSMessage(
        user: SipUser,
        target: SipUser | string,
        content: string,
        forward: boolean,
        mmsDetails?: {
            mms_id: string
            mms_type: string
        },
        group_parties?: string,
        isGroup?: boolean,
        isWhatsApp?: boolean,
        waDetails?: {
            iswhatsapp: boolean,
            participants: string,
            threadid: string
        }
    ) {

        user.sendMessage(user, target, content, group_parties, isWhatsApp ? true : false, null, null, mmsDetails, null, '', group_parties, isGroup, forward, waDetails);
    }

    async reSendMMSMessage(
        user: SipUser,
        target: SipUser | string,
        content: string,
        callId: string
    ) {
        let groupOrNot: boolean = false;
        let groupPeerId: string = '';
        const groupIDResendMsg = sessionStorage.getItem('resend-' + callId);
        if (groupIDResendMsg !== "\"null\"" && groupIDResendMsg !== null) {
            groupPeerId = sessionStorage.getItem('resend-' + callId);
            groupOrNot = true;
        }
        user.sendMessage(user, target, content, null, null, null, null,null, callId, null, groupPeerId, groupOrNot);
    }

    async sendMultiTargetMessage(
        user: SipUser,
        targets: SipUser[] | string[],
        content: string,
        gentToken = true
    ) {
        user.sendMultiTargetMessage(user, targets, content, gentToken);
    }

    setSessionMute(user: SipUser, session: Session, isMute: boolean) {
        user.setSessionMute(session, isMute);
    }

    setSessionHold(user: SipUser, session: Session, isHold: boolean) {
        user.setSessionHold(session, isHold);
    }
}
