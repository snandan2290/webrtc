import { Injectable } from '@angular/core';
import { Store } from '@ngrx/store';
import { SipConfig, SipService, SipUser } from '@scalio/sip';
import { BehaviorSubject } from 'rxjs';
import { User } from '../models';
import { selectUser } from '../ngrx';
import {LoggerFactory} from '@movius/ts-logger';
const logger = LoggerFactory.getLogger("")

export interface SipUserTurnConfig {
    url: string;
    userName: string;
    password: string;
}

export interface SipServerConfig {
    ip: string;
    wsPort: string;
    wssPort: string;
}

export interface SipUserConfig {
    serverConfig?: SipServerConfig;
    stunUrl?: string;
    secondaryStunUrl?: string;
    turnConfig?: SipUserTurnConfig;
    proxyPort?: string;
    secondaryProxyPort?: string;
    web_rtc?: string;
    sip_username?: string;
    adk_address?: string;
    otp?: string;
}

export interface SipUserInfo {
    id: string;
    name: string;
    password?: string;
    skipGenerateNameToken?: boolean;
    extraHeaders?: string[];
    config?: SipUserConfig;
}

const getSipConfig = (sipUserConfig: SipUserConfig): SipConfig => ({
    server: sipUserConfig.web_rtc ? `wss://${sipUserConfig.web_rtc}:443/ws?adk_primary=${sipUserConfig.adk_address}&sip_username=${sipUserConfig.sip_username}&device=msteams&otp=${sipUserConfig.otp}` : `wss://${sipUserConfig.serverConfig.ip}:${sipUserConfig.serverConfig.wssPort}/ws`,
    domain: `${sipUserConfig.serverConfig.ip}:${sipUserConfig.serverConfig.wssPort}`,
    ice: {
        stunUrls: [
            sipUserConfig.stunUrl,
            sipUserConfig.secondaryStunUrl,
        ].filter((f) => !!f),
        turn: sipUserConfig.turnConfig && {
            url: sipUserConfig.turnConfig.url,
            user: sipUserConfig.turnConfig.userName,
            password: sipUserConfig.turnConfig.password,
        },
    },
});

/**
 * Facade service
 */
@Injectable({ providedIn: 'root' })
export class SipUserService {
    get sipUser() {
        return this.registeredSipUser$.value;
    }

    get secondarysipUser() {
        return this.registeredSecondarySipUser$.value;
    }

    get getActiveSipUser() {
        //const serverStatus = this.getServerStatus();

        let p: any = this.registeredSipUser$.value;
        let s: any = this.registeredSecondarySipUser$.value;


        if (this.registeredSipUser$.value != null && p.registerer.state == 'Registered') {
            return this.registeredSipUser$.value;
        } else if (this.registeredSecondarySipUser$.value != null && s.registerer.state == 'Registered') {
            return this.registeredSecondarySipUser$.value;
        } else {
            this.reRegister();
            if(sessionStorage.getItem('secondarysipuserdata') !== null){
                this.register_secondary_site();
            }
        }

    }

    getActiveCallSipUser(serverName: string) {
        if (serverName.includes(sessionStorage.getItem('pri_server_name'))) {
            return this.registeredSipUser$.value;
        } else if (serverName.includes(sessionStorage.getItem('sec_server_name'))) {
            return this.registeredSecondarySipUser$.value;
        }
    }

    readonly registeredSipUser$ = new BehaviorSubject<SipUser>(null);
    readonly registeredSecondarySipUser$ = new BehaviorSubject<SipUser>(null);

    public userNumberStatus: any = undefined;
    public expireTime: number;
    registererInterval = 0;

    constructor(
        private readonly sipService: SipService,
        private readonly store: Store
    ) {
        if (!!window['MOVIUS_REGISTERER_EXPIRES_TIMEOUT']) {
            this.expireTime = parseInt(
                window['MOVIUS_REGISTERER_EXPIRES_TIMEOUT']
            );
        }

        if (this.expireTime != null) {
            this.expireTime = (this.expireTime / 2) + 1000;
        }else{
            this.expireTime = 5000;
        }

    }

    private create(info: SipUserInfo) {
        return this.sipService.createUser(
            info.id,
            info.name,
            info.password,
            false,
            info.extraHeaders,
            info.config && getSipConfig(info.config)
        );
    }

    async register(info: SipUserInfo) {
        logger.debug('*** sip-user.service Primary Server Register Process Started...');
        if (!!this.sipUser) {
            console.warn(
                '*** sip-user.service register sipUser already exists, exit'
            );
            // throw new Error('User already registered');
        }
        const serverName = info.config.serverConfig.ip.split('.')[0];
        sessionStorage.setItem('pri_server_name', serverName);
        const sipUser = this.create(info);
        //await this.sipService.startUser(sipUser);
        try {
            await this.sipService.startUser(sipUser);
        } catch (err) {
            logger.debug('*** startUser API service', err);
        }
        const f = await this.sipService.registerUser(sipUser);
        logger.debug('*** sip-user.service Primary Register User Result::', f);
        if (!f) {
            this.registeredSipUser$.next(null);
            logger.debug('*** user registration fails, try register once again');
            const f = await this.sipService.registerUser(sipUser);
            logger.debug('*** registration attempt 2 result', f);
            if (!f) {
                logger.debug('*** registration failure!!');
                //throw new Error('Registration failure');
            }
        }
        this.registeredSipUser$.next(sipUser);

        if (sipUser != null && sipUser.transport.state == 'Connected') {
            sessionStorage.setItem(serverName, 'true');
        } else {
            sessionStorage.setItem(serverName, 'false');
        }
        // if(sessionStorage.getItem('secondarysipuserdata') !== null){
        //     this.register_secondary_site();
        // }
        //console.log('*** primary sip user', sipUser);
        return sipUser;
    }

    async register_secondary_site() {
        logger.debug('*** sip-user.service Secondary Server Register Process Started...');
        const sipUser = this.sipUser;
        //if (!sipUser) {
        //console.error('*** sip-user.service reregister sipUser not exists');
        //throw new Error('User is not registered');
        //}

        //get secondary_user_info from session
        const sipSecondaryUserInformation = JSON.parse(
            sessionStorage.getItem('secondarysipuserdata')
        );

        console.log('*** sipSecondaryUserInformation', sipSecondaryUserInformation);
        const serverName = sipSecondaryUserInformation.config.serverConfig.ip.split('.')[0];
        sessionStorage.setItem('sec_server_name', serverName);

        const sipUserInfo: SipUserInfo = {
            id: sipSecondaryUserInformation.id,
            name: sipSecondaryUserInformation.name,
            password: sipSecondaryUserInformation.password,
            skipGenerateNameToken: true,
            extraHeaders: sipSecondaryUserInformation.extraHeaders,
            config: sipSecondaryUserInformation.config,
        };

        const sipUserData = this.create(sipUserInfo);

        try {
            await this.sipService.startUser(sipUserData);
        } catch (err) {

            console.log(err);

            await this.sipService.startUser(sipUserData);
            const f = await this.sipService.registerUser(sipUserData, true);

            if (sipUserData != null && sipUserData.transport.state == 'Connected') {
                sessionStorage.setItem(serverName, 'true');
            } else {
                sessionStorage.setItem(serverName, 'false');
            }

            //console.log('*** secondary sip user', sipUserData);
            return sipUserData;
        }
        //await this.sipService.startUser(sipUserData);
        const f = await this.sipService.registerUser(sipUserData, true);

        logger.debug('*** sip-user.service Secondary Register User Result::', f);
        if (!f) {
            sessionStorage.setItem(serverName, 'false');
            this.registeredSecondarySipUser$.next(null);
            logger.debug('*** secondary user registration fails, try register once again');
            const f = await this.sipService.registerUser(sipUserData);
            logger.debug('*** secondary user registration attempt 2 result', f);
            if (!f) {
                logger.debug('*** secondary user registration failure!!');
                //await this.unregister();
                throw new Error('Secondary user Registration failure');
            }
        }

        if (sipUserData != null && sipUserData.transport.state == 'Connected') {
            sessionStorage.setItem(serverName, 'true');
            this.registeredSecondarySipUser$.next(sipUserData);
        } else {
            sessionStorage.setItem(serverName, 'false');
            this.registeredSecondarySipUser$.next(null);
        }



        //console.log('*** secondary sip user', sipUserData);
        return sipUserData;
    }

    async reRegister() {
        //await this.register_secondary_site();
        logger.debug('*** sip-user.service reregister');
        const sipUser = this.sipUser;
        //if (!sipUser) {
        //console.error('*** sip-user.service reregister sipUser not exists');
        //throw new Error('User is not registered');
        //}

        //get secondary_user_info from session
        const primaryUserInformation = JSON.parse(
            sessionStorage.getItem('sipuserdata')
        );

        console.log('*** sipprimaryUserInformation', primaryUserInformation);
        const serverName = primaryUserInformation.config.serverConfig.ip.split('.')[0];
        sessionStorage.setItem('pri_server_name', serverName);

        const sipUserInfo: SipUserInfo = {
            id: primaryUserInformation.id,
            name: primaryUserInformation.name,
            password: primaryUserInformation.password,
            skipGenerateNameToken: true,
            extraHeaders: primaryUserInformation.extraHeaders,
            config: primaryUserInformation.config,
        };

        const sipUserData = this.create(sipUserInfo);

        try {
            await this.sipService.startUser(sipUserData);
        } catch (err) {
            // this.registeredSecondarySipUser$.next(null);
            console.log(err);

            await this.sipService.startUser(sipUserData);
            const f = await this.sipService.registerUser(sipUserData, true);

            if (sipUserData != null && sipUserData.transport.state == 'Connected') {
                sessionStorage.setItem(serverName, 'true');
                this.registeredSipUser$.next(sipUserData);
            } else {
                sessionStorage.setItem(serverName, 'false');
                this.registeredSipUser$.next(null);
            }

            //console.log('*** primary sip user', sipUserData);
            return sipUserData;
        }
        //await this.sipService.startUser(sipUserData);
        const f = await this.sipService.registerUser(sipUserData, true);

        logger.debug('*** sip-user.service registerprimaryUser result', f);
        if (!f) {
            sessionStorage.setItem(serverName, 'false');
            this.registeredSipUser$.next(null);
            logger.debug('*** primary user registration fails, try register once again');
            const f = await this.sipService.registerUser(sipUserData);
            logger.debug('*** primary user registration attempt 2 result', f);
            if (!f) {
                logger.debug('*** primary user registration failure!!');
                //await this.unregister();
                throw new Error('Primary user Registration failure');
            }
        }

        /*const status = sessionStorage.getItem(serverName);
        console.log('Registration of Server ' + serverName + ' Status : ', status);
        if (status == 'true') {
            this.registeredSipUser$.next(sipUserData);
        }
        else {
            if (status == 'false') {
                this.registeredSipUser$.next(null);
            }
        }*/

        if (sipUserData != null && sipUserData.transport.state == 'Connected') {
            sessionStorage.setItem(serverName, 'true');
            this.registeredSipUser$.next(sipUserData);
        } else {
            sessionStorage.setItem(serverName, 'false');
            this.registeredSipUser$.next(null);
        }



        //console.log('*** primary sip user', sipUserData);
        return sipUserData;
    }

    async unregister(resetUser = true, disconnectTransport = true) {
        logger.debug('*** sip-user.service unregister');
        if (this.sipUser) {
            //@ts-ignore
            if (!window.Cypress) {
                this.sipService.unregisterUser(
                    this.sipUser,
                    disconnectTransport
                );
            }
            if (resetUser) {
                logger.debug('*** sip-user.service reset user');
                this.registeredSipUser$.next(null);
            }
        }
    }

    get user() {
        let user: User;
        this.store.select(selectUser).subscribe((x) => (user = x));
        return user;
    }

    setLatestUserMessageDateTime(dateTime: string) {
        const userId = this.sipUser?.userId;
        if (!userId) {
            return;
        }
        const key = `user_${userId}_latest_message_date_time`;
        const existedDateTime = localStorage.getItem(key);
        if (
            !existedDateTime ||
            new Date(existedDateTime) < new Date(dateTime)
        ) {
            localStorage.setItem(key, dateTime);
        }
    }

    getLatestUserMessageDateTime(userId: string) {
        const key = `user_${userId}_latest_message_date_time`;
        return localStorage.getItem(key);
    }

    resetLatestUserMessageDateTime() {
        const userId = this.sipUser?.userId;
        if (!userId) {
            return;
        }
        const key = `user_${userId}_latest_message_date_time`;
        localStorage.removeItem(key);
    }

    clearRegistererInterval(){
        clearInterval(this.registererInterval)
    }

    setRegistererTimer(){
        this.registerer();
    }

    private registerer() {
        this.registererInterval = window.setInterval(() => {
            if (this.sipUser == null) {
                this.reRegister();
            } else {
                let p: any = this.sipUser;
                if (p.registerer.state == 'Unregistered') {
                    this.reRegister();
                }
            }

            if(sessionStorage.getItem('secondarysipuserdata') !== null){
                if (this.secondarysipUser == null) {
                    this.register_secondary_site();
                } else {
                    let s: any = this.secondarysipUser;
                    if (s.registerer.state == 'Unregistered') {
                        this.register_secondary_site();
                    }
                }
            }

        }, this.expireTime * 60);
    }

    public getServerStatus() {
        const serverStatus: string[] = [];


        const primary_info = JSON.parse(
            sessionStorage.getItem('sipuserdata')
        );

        const secondary_info = JSON.parse(
            sessionStorage.getItem('secondarysipuserdata')
        );

        const pri_s = primary_info.config.serverConfig.ip;

        const remove_after_1 = pri_s.indexOf('.');
        const primary_server_name = pri_s.substring(0, remove_after_1);

        sessionStorage.setItem('pri_server_name', primary_server_name);

        const sec_s = secondary_info.config.serverConfig.ip;
        const remove_after_2 = sec_s.indexOf('.');

        const secondary_server_name = sec_s.substring(0, remove_after_2);

        sessionStorage.setItem('sec_server_name', secondary_server_name);

        const primary_status = sessionStorage.getItem(primary_server_name);
        const secondary_status = sessionStorage.getItem(secondary_server_name);

        const pri_status = sessionStorage.getItem(primary_server_name);
        const sec_status = sessionStorage.getItem(secondary_server_name);


        serverStatus.push(pri_status);
        serverStatus.push(sec_status);
        return serverStatus;
    }
}
