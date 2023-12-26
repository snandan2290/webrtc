import { Invitation, Session } from 'sip.js';
import { FixContactRegisterer, SipUser, SipUserStubs } from './sip-user';

export interface IceSipConfig {
    stunUrls: string[];
    turn?: {
        url: string;
        user: string;
        password: string;
    };
}

export interface SipConfig {
    server?: string;
    domain?: string;
    userAgentString?: string;
    onFixContactRegisterer?: FixContactRegisterer;
    ice?: IceSipConfig;
    stubs?: SipUserStubs;
    iceGatheringTimeout?: number;
    registererExpiresTimeout?: number;
}

export interface ISipService {
    createUser(
        id: string,
        name: string,
        password: string,
        generateNameToken,
        extraHeaders: string[],
        config?: SipConfig
    ): SipUser;

    getUserUri(userId: string): string;

    startUser(user: SipUser): Promise<any>;

    registerUser(user: SipUser): Promise<any>;

    stopUser(user: SipUser): Promise<void>;

    unregisterUser(user: SipUser): Promise<any>;

    inviteUser(user: SipUser, target: SipUser | string): Promise<any>;

    acceptInvitation(user: SipUser, invitation: Invitation): void;

    rejectInvitation(invitation: Invitation): void;

    hangUpSession(user: SipUser, session: Session): Promise<void>;

    sendMessage(
        user: SipUser,
        target: SipUser | string,
        content: string
    ): Promise<void>;

    reSendMessage(
        user: SipUser,
        target: SipUser | string,
        content: string,
        callId: string,
        isWhatsApp: boolean
    ): Promise<void>;

    setSessionMute(user: SipUser, session: Session, isMute: boolean): void;

    setSessionHold(user: SipUser, session: Session, isHold: boolean): void;
}
