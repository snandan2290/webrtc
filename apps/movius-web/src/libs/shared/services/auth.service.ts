import { Injectable } from '@angular/core';
import { SipUser } from '@scalio/sip';
import { CustomerSupport, FeatureStatus, UserFeatures } from '../models';
import { AuthDataAccessService } from './auth.data-access.service';
import { GetUserInfoResponseDTO } from './dto';
import { SipUserConfig, SipUserInfo, SipUserService } from './sip-user.service';
import { fromUint8Array, toUint8Array } from 'js-base64';
import { BehaviorSubject } from 'rxjs';
import {LoggerFactory} from '@movius/ts-logger';
import { getFeatureEnabled, loginFails, session_keys, setgeoUrl } from '..';
import { error } from 'console';
import { Store } from '@ngrx/store';
const logger = LoggerFactory.getLogger("")

export interface StartLoginResult {
    name: string;
    identity: string;
    orgId: string;
    activated: boolean;
    newWebSignIn: boolean;
}

const deviceIdLocalKey = 'movius_device_id';

@Injectable({ providedIn: 'root' })
export class AuthService {
    isUserLogin:boolean = false;
    customerCareEmail: any;
    customerRootDetails: any;
    customerCarePhone: any;
    brandingCustomerCareEmail: any;
    brandingCustomerCarePhone: any;
    adkAddress: string;
    public firstAPICall: boolean = true;
    public internetConnLoss = new BehaviorSubject<any>(false);
    internetConnLossPassData = this.internetConnLoss.asObservable();
    public onComposeRedirect:any = new BehaviorSubject(false);
    public onComposeRedirectData = this.onComposeRedirect.asObservable();
    public onSelectedMessageType:any = new BehaviorSubject('message');
    public onComposeMessageTypeSelected = this.onSelectedMessageType.asObservable();
    public peerIdOptInMsg:any = new BehaviorSubject(null);
    public onComposeMsgPeerIdValue = this.peerIdOptInMsg.asObservable();
    appEmbededStatus:string;

    // TODO : Temporary
    constructor(
        private readonly sipUserService: SipUserService,
        private readonly authDataAccess: AuthDataAccessService,
        private readonly store: Store,
    ) {
        this.appEmbededStatus = getFeatureEnabled()
    }

    ComposeRedirectEvent(val: any) {
        this.onComposeRedirect.next(val);
    }

    selectedMessageType(type: any) {
        this.onSelectedMessageType.next(type);
    }

    onOptInMsgPeerId(id: any) {
        this.peerIdOptInMsg.next(id);
    }

    private async getUserNumber(name: string, token: string) {
        const getNumbersResponse = await this.authDataAccess
            .getNumbers(name, token)
            .toPromise();

        const slNumber = getNumbersResponse.root.sl_number;

        if(slNumber === null || slNumber === undefined){
            sessionStorage.removeItem('ssoToken');
        }

        return slNumber
            ? typeof slNumber === 'string'
                ? slNumber
                : slNumber[0]
            : null;
    }

    async startLogin(
        name: string,
        password: string,
        sso_access_token: string
    ): Promise<StartLoginResult> {
        try {
            this.authDataAccess.loaderSpinnerEvent(true);
            // this.authDataAccess.loaderModalOpen();
            setgeoUrl(null)
            const deviceId = localStorage.getItem(deviceIdLocalKey);
            const secretKey = window.crypto.getRandomValues(new Uint8Array(16));
            const secretIv = window.crypto.getRandomValues(new Uint8Array(12));
            const secretKeyStr = fromUint8Array(secretKey);
            const secretIvStr = fromUint8Array(secretIv);
            const keys = {
                key: secretKeyStr,
                iv: secretIvStr,
            };

            const loginResponse = await this.authDataAccess
                .login(name, password, deviceId, keys, sso_access_token)
                .toPromise();
            const apiAuthToken = encodeURIComponent(
                loginResponse.root.api_token
            );
            if(loginResponse.root.teams_sso_token) sessionStorage.setItem("ssoToken",loginResponse.root.teams_sso_token);
            this.isUserLogin = true
            if(loginResponse.root.teams_refresh_token) sessionStorage.setItem("refreshToken",loginResponse.root.teams_refresh_token);


            //here need to do another api call with the secondary server login details
            //so that will have api token available for secondary server
            //if api_token will be differnt for each server even with same login credentials


            const isUserRegistered = loginResponse.root.user_state === '2';

            this.customerRootDetails = loginResponse.root;
            if (this.customerRootDetails.branding === undefined) {
                this.customerCareEmail = this.customerRootDetails.root.customer_care_email;
                this.customerCarePhone = this.customerRootDetails.root.customer_care_phone;
            } else {
                this.brandingCustomerCareEmail = this.customerRootDetails.branding.customer_care_email;
                this.brandingCustomerCarePhone = this.customerRootDetails.branding.customer_care_phone;
            }

            const identity = isUserRegistered
                ? loginResponse.root.identity
                : await this.getUserNumber(name, apiAuthToken);

            if (!isUserRegistered && !identity) {
                throw new Error('NUMBERS_NOT_AVAILABLE');
            }

            const orgId = loginResponse.root.orgid;
            sessionStorage.setItem(
                '__api_user_info__',
                JSON.stringify(loginResponse)
            );

            const customerSupport: CustomerSupport = {
                phone:
                    loginResponse.root.branding?.customer_care_phone ||
                    loginResponse.root.customer_care_phone ||
                    loginResponse.root['root'].customer_care_phone,
                email:
                    loginResponse.root.branding?.customer_care_email ||
                    loginResponse.root.customer_care_email ||
                    loginResponse.root['root'].customer_care_email,
            };
            this.authData = {
                token: apiAuthToken,
                name,
                identity,
                orgId,
                customerSupport,
            };

            return {
                identity,
                name,
                orgId,
                activated: isUserRegistered,
                newWebSignIn: loginResponse.root.new_web_signin === 'true',
            };
        } catch (err) {
            throw err;
        }
    }

    async activateUser(otp: string, data: StartLoginResult) {
        await this.authDataAccess
            .verifyPin(data.name, otp, this.apiAuthToken)
            .toPromise();
        const result = await this.authDataAccess
            .activate(
                data.name,
                data.identity,
                data.orgId,
                otp,
                this.apiAuthToken
            )
            .toPromise();

        this.adkAddress = result['root'].adk_address;
    }

    async activateSSOUser(otp: string, data) {
        await this.authDataAccess
            .activate(
                data.name,
                data.identity,
                data.orgId,
                otp,
                this.apiAuthToken
            )
            .toPromise();
    }

    async updatePasswordUsingOldPassword(
        oldPassword: string,
        newPassword: string,
        email?: string
    ) {
        // TODO : email required in UX !!!
        const name = this.apiName || email;

        const deviceId = localStorage.getItem(deviceIdLocalKey);

        const loginResponse = await this.authDataAccess
            .login(name, oldPassword, deviceId)
            .toPromise();

        await this.authDataAccess
            .changePasswordWithOldPassword(
                name,
                oldPassword,
                newPassword,
                loginResponse.root.api_token
            )
            .toPromise();
    }

    async updatePasswordUsingOtp(
        newPassword: string,
        otp: string,
        email?: string
    ) {
        // TODO : email required in UX !!!
        let name = null;
        if(email !== null && email !== undefined){
            name = email
        }else if (this.apiName !== '' || this.apiName !== null) {
            name = this.apiName;
        } else if(sessionStorage.getItem('userEmail') !== null){
            name = sessionStorage.getItem('userEmail');
        }

        await this.authDataAccess
            .changePasswordWithOtp(name, newPassword, otp)
            .toPromise();
    }

    async triggerPasswordOtp() {
        // TODO : email required in UX !!!
        const name = this.apiName;

        await this.authDataAccess.triggerPasswordOtp(name).toPromise();
    }

    private getGdprFeatureStatus(dto: GetUserInfoResponseDTO): FeatureStatus {
        // https://moviuscorp.atlassian.net/browse/WDC-241
        if (dto.root.gdpr_compliant === 'true') {
            if (
                dto.root.gdpr_deferred === 'true' &&
                dto.root.sls_num_data.gdpr_suspended === 'true'
            ) {
                return 'enabled_declined';
            } else if (
                dto.root.gdpr_deferred === 'false' &&
                dto.root.sls_num_data.gdpr_suspended === 'false'
            ) {
                return 'enabled_accepted';
            } else if (
                !dto.root.gdpr_deferred &&
                !dto.root.sls_num_data.gdpr_suspended
            ) {
                return 'unknown';
            } else {
                console.error('Unexpected gdpr status !!!');
                return 'unknown';
            }
        } else {
            return 'disabled';
        }
    }

    private getE911FeatureStatus(dto: GetUserInfoResponseDTO): FeatureStatus {
        if (dto.root.sls_num_data.e911_support_enable === 'true') {
            // change this status later after login  from getE911Status
            sessionStorage.setItem("_USER_E911_STATUS_", 'enabled_declined')
            return 'enabled_declined';
        } else {
            sessionStorage.setItem("_USER_E911_STATUS_", 'disabled')
            return 'disabled';
        }
    }

    private checkSecondarySipConfig(connectionInfo){
        if( connectionInfo &&
            (typeof connectionInfo.sec_asterisk_ip === 'string') &&
            connectionInfo.sec_ws_port && connectionInfo.sec_wss_port
        ){
            return true
        }else{
            logger.warn("Secondary SIP user Config is insufficient,")
            logger.warn("so skiping secondary server registration")
            sessionStorage.removeItem("secondarysipuserdata")
            return false
        }
    }

    
    checkAccountStatus(userInfo){
        console.log('Executing checkAccountStatus method')
        let suspended = userInfo['root']["sls_num_data"].suspended
        let suspend_web = userInfo['root']["sls_num_data"].suspend_web
        console.log(suspended == true || suspend_web == true || suspended == "true" || suspend_web == "true")
        if(suspended == true || suspend_web == true || suspended == "true" || suspend_web == "true"){
            return false;
        }
    }

    async refreshUserInfo(){
        const name = this.apiName;
        const identity = this.apiIdentity;
        let device:any = null;
        try{
            device = await this.authDataAccess
            .addUserDevice(name, identity, this.apiAuthToken)
            .toPromise();
            if(device['root'])
            sessionStorage.setItem("reload_device",JSON.stringify(device))
        }catch (err) {
            console.log('error on session for device ',err);
        }

        this.updateDeviceInfo(device)
        const connectionInfo = device.root.connection_info;
        const deviceData = device.root.device_data;
        const userId = deviceData.sip_username;
        this.apiToken = encodeURIComponent(device.root.api_token);
        this.updateUserInfo(name,identity,deviceData,userId,connectionInfo)
        this.updateBranding(name)

    }
    async finishLogin(): Promise<{
        user: SipUser;
        features: UserFeatures;
        encryptConfig: {
            key: Uint8Array;
            iv: Uint8Array;
        };
        customerSupport: CustomerSupport;
    }> {
        const name = this.apiName;
        const identity = this.apiIdentity;
        setgeoUrl(null)

        let device:any = null;
        //let otpdata:any = null;
        let actstatus:any= true;
        this.authDataAccess.loaderSpinnerEvent(true);
        // this.authDataAccess.loaderModalOpen();
        try{
            if(!sessionStorage.getItem("reload_device") || this.appEmbededStatus != "messaging" ){
                device = await this.authDataAccess
               .addUserDevice(name, identity, this.apiAuthToken)
               .toPromise();
               if(device['root'] && this.appEmbededStatus == "messaging" )
                sessionStorage.setItem("reload_device",JSON.stringify(device))
           }else{
               device = JSON.parse(sessionStorage.getItem("reload_device"))
           }
        }catch (err) {
            console.log('error on session for device ',err);
            sessionStorage.removeItem("reload_device")
            device = await this.authDataAccess
               .addUserDevice(name, identity, this.apiAuthToken)
               .toPromise();
        }



        //need to get the secondary server details from mcp.yml file using addUserDevice
        this.updateDeviceInfo(device)
        const connectionInfo = device.root.connection_info;
        const deviceData = device.root.device_data;
        const userId = deviceData.sip_username;
        this.apiToken = encodeURIComponent(device.root.api_token);

        let userInfo:any=null
        try{
            if(!sessionStorage.getItem("reload_userinfo") || this.appEmbededStatus != "messaging"){
                userInfo = await this.authDataAccess
                .getUserInfo(name, identity, this.apiToken)
                .toPromise();
                actstatus = this.checkAccountStatus(userInfo)
                if(userInfo['root'] && this.appEmbededStatus == "messaging"){
                    sessionStorage.setItem("reload_userinfo",JSON.stringify(userInfo))
                }
            }else{
                userInfo = JSON.parse(sessionStorage.getItem("reload_userinfo"))
                this.updateUserInfo(name,identity,deviceData,userId,connectionInfo)
                /*userInfo = await this.authDataAccess
                .getUserInfo(name, identity, this.apiToken)
                .toPromise();
                actstatus = this.checkAccountStatus(userInfo)*/
            }

        }catch(err){
            sessionStorage.removeItem("reload_userinfo");
            userInfo = await this.authDataAccess
            .getUserInfo(name, identity, this.apiToken)
            .toPromise();
        }
        actstatus = this.checkAccountStatus(userInfo)
           //userInfo['root']['sls_num_data'].e911_support_enable = 'true';
        if (userInfo['root'].gdpr_compliant === 'true' && userInfo['root']['sls_num_data'].gdpr_suspended === 'true') {
            this.authDataAccess.onboardUserGdprStatusUpdate(true);
        }

        this.adkAddress = userInfo.root.adk_address;

        const isExchangeEnabled =
            userInfo.root.sls_num_data.contacts_allow_exchange !== 'false';
        const gdprStatus = this.getGdprFeatureStatus(userInfo);
        const e911Status = this.getE911FeatureStatus(userInfo);
        // console.log("auth.service:: e911Status:"+e911Status);
        this.storeUserInfoInStorage(userInfo,deviceData)

        const latestUserMessageDateTime = this.sipUserService.getLatestUserMessageDateTime(
            userId
        );

        const mlNumber = userInfo.root.sls_num_data.sls_number;
        const extraHeaders = [
            `X-CAFE-IDENTITY: ${mlNumber}`,
            `X-CAFE-IDENTITY-INFO: identity='${mlNumber}',last_message='${latestUserMessageDateTime || ''
            }'`,
            'X-MCP-SECURECALL: yes',
            'Env-Type: primary'
        ];

        const sipUserConfig: SipUserConfig = {
            serverConfig: {
                ip: connectionInfo.asterisk_ip,
                wsPort: connectionInfo.ws_port,
                wssPort: connectionInfo.wss_port,
            },
            stunUrl: connectionInfo.stun_url,
            secondaryStunUrl: connectionInfo.sec_stun_url,
            turnConfig: {
                url: connectionInfo.turn_url,
                userName: connectionInfo.turn_username,
                password: connectionInfo.turn_password,
            },
            proxyPort: connectionInfo.outbound_proxy_port,
            secondaryProxyPort: connectionInfo.sec_outbound_proxy_port,
        };

        const isSecSipConfigPresent = this.checkSecondarySipConfig(connectionInfo)
        let sipSecondaryUserConfig: SipUserConfig
        if(isSecSipConfigPresent){
             //secondary sip configuaration information
             sipSecondaryUserConfig = {
                serverConfig: {
                    ip: connectionInfo.sec_asterisk_ip.toString(),
                    wsPort: connectionInfo.sec_ws_port,
                    wssPort: connectionInfo.sec_wss_port,
                },
                stunUrl: connectionInfo.sec_stun_url,
                secondaryStunUrl: connectionInfo.sec_stun_url,
                turnConfig: {
                    url: connectionInfo.turn_url,
                    userName: connectionInfo.turn_username,
                    password: connectionInfo.turn_password,
                },
                proxyPort: connectionInfo.sec_outbound_proxy_port,
                secondaryProxyPort: connectionInfo.outbound_proxy_port,
            };

            console.log('sipSecondaryUserConfig', sipSecondaryUserConfig);
        } 
        // else if(sec_gw_address){
        //     sipSecondaryUserConfig = sipUserConfig;
        //     sipSecondaryUserConfig.web_rtc = sec_gw_address;
        // }

        //need to call adduserdevice api for secondary server


        const userName = mlNumber;
        const password = deviceData.sip_password;

        let webrtcdata: any;
        let priwebrtcvals: any;
        let secwebrtcvals: any;
        if(getFeatureEnabled() == 'messaging' && deviceData.webrtc_gw_address){
            webrtcdata = await this.getWebrtcData(deviceData, connectionInfo, device);
            logger.debug('Webrtc Config Details::', webrtcdata);
            priwebrtcvals = {
                web_rtc: webrtcdata?.pri_gw_address,
                sip_username: userId,
                adk_address: webrtcdata?.pri_adk_address,
                otp: webrtcdata?.otp
            }
            secwebrtcvals = {
                web_rtc: webrtcdata?.sec_gw_address,
                sip_username: userId,
                adk_address: webrtcdata?.sec_adk_address,
                otp: webrtcdata?.otp
            }

            Object.assign(sipUserConfig, priwebrtcvals);
            const adk_url=sessionStorage.getItem('__primary_adk_url__').split('.')[0]
            extraHeaders.push(`X-CAFE-SERVER: `+adk_url)
            extraHeaders.push(`X-CAFE-APP: web-msteams`)
        }
        const sipUserInfo: SipUserInfo = {
            id: userId,
            name: userName,
            password,
            skipGenerateNameToken: true,
            extraHeaders,
            config: sipUserConfig,
        };


        let sipSecondaryUserInfo: SipUserInfo
        if(isSecSipConfigPresent || secwebrtcvals?.web_rtc){
            //secondary sip configuaration information
            if(secwebrtcvals?.web_rtc){
                sipSecondaryUserConfig = sipUserConfig;
            }
            sipSecondaryUserInfo = {
                id: userId,
                name: userName,
                password,
                skipGenerateNameToken: true,
                extraHeaders,
                config: sipSecondaryUserConfig,
            };
        }

        sessionStorage.setItem('sipuserdata', JSON.stringify(sipUserInfo))
        

        const user = await this.sipUserService.register(sipUserInfo);
        if(isSecSipConfigPresent || (secwebrtcvals && secwebrtcvals?.web_rtc)){
            logger.debug('Secondary Sip Config or Secwebrtc Config Present');
            extraHeaders[3] = 'Env-Type: secondary'
            if(secwebrtcvals?.web_rtc){
                Object.assign(sipSecondaryUserConfig, secwebrtcvals);
                const adk_url=sessionStorage.getItem('__secondary_adk_url__').split('.')[0]
                extraHeaders.push(`X-CAFE-SERVER: `+adk_url)
                extraHeaders.push(`X-CAFE-APP: web-msteams`)
            }
            sessionStorage.setItem('secondarysipuserdata', JSON.stringify(sipSecondaryUserInfo));
            await this.sipUserService.register_secondary_site();
        }
        //const user = await this.sipUserService.primary_register(sipUserInfo, sipSecondaryUserInfo);



        const encryptKey = typeof (userInfo.root.c_key) === 'undefined' ? null : toUint8Array(userInfo.root.c_key);
        const encryptIv = typeof (userInfo.root.c_value) === 'undefined' ? null : toUint8Array(userInfo.root.c_value);
        console.log("sso token " + sessionStorage.getItem("ssoToken") +" "+ sessionStorage.getItem("__api_user_info__"))
        if(sessionStorage.getItem("ssoToken") && sessionStorage.getItem("__api_user_info__"))
        {
            this.isUserLogin = true;
            console.log("user is logged in using session.")
        }

        if(!this.isUserLogin){
            let userOrgBranding:any=null
            if(!sessionStorage.getItem("reload_orgbrand") || this.appEmbededStatus != "messaging"){
                userOrgBranding = await this.authDataAccess.
                getBrandingDetails(name, this.apiToken)
                .toPromise();
                if(userOrgBranding['root'] && this.appEmbededStatus == "messaging"){
                    console.log("Reload org ")
                    sessionStorage.setItem("reload_orgbrand",JSON.stringify(userOrgBranding))
                }
            }else{
                userOrgBranding = JSON.parse(sessionStorage.getItem("reload_orgbrand"))
                // this.updateBranding(name)
            }

            const api_user_info = sessionStorage.getItem("__api_user_info__")
            if(api_user_info !== null && userOrgBranding.root.branding.operator_icon !== undefined){
                let parsedUserInfo = JSON.parse(api_user_info)
                parsedUserInfo["root"]["root"]["operator_icon"] = userOrgBranding.root.branding.operator_icon
                sessionStorage.setItem("__api_user_info__",JSON.stringify(parsedUserInfo))
            }
        }
        // this.authDataAccess.loaderSpinnerEvent(false);


        return {
            user,
            encryptConfig: {
                key: encryptKey,
                iv: encryptIv,
            },
            customerSupport: this.customerSupport,
            features: {
                gdprStatus,
                e911Status,
                exchangeSyncStatus: isExchangeEnabled ? 'unknown' : 'off',
                allowCalls:
                    userInfo.root.sls_num_data.allow_webrtc_calls === 'true',
                allowMessages: userInfo.root.sls_num_data.allow_sms === 'true',
                actstatus: actstatus
            },
        };
    }

    async updateUserInfo(name,identity,deviceData,userId,connectionInfo){
        let userInfo:any=null
                userInfo = await this.authDataAccess
                .getUserInfo(name, identity, this.apiToken)
                .toPromise();
                if(userInfo['root']){
                    sessionStorage.setItem("reload_userinfo",JSON.stringify(userInfo))
                }


        if (userInfo['root'].gdpr_compliant === 'true' && userInfo['root']['sls_num_data'].gdpr_suspended === 'true') {
            this.authDataAccess.onboardUserGdprStatusUpdate(true);
        }

        this.adkAddress = userInfo.root.adk_address;

        this.storeUserInfoInStorage(userInfo,deviceData)

        const latestUserMessageDateTime = this.sipUserService.getLatestUserMessageDateTime(
            userId
        );

        const mlNumber = userInfo.root.sls_num_data.sls_number;
        const extraHeaders = [
            `X-CAFE-IDENTITY: ${mlNumber}`,
            `X-CAFE-IDENTITY-INFO: identity='${mlNumber}',last_message='${latestUserMessageDateTime || ''
            }'`,
            'X-MCP-SECURECALL: yes',
        ];

        const sipUserConfig: SipUserConfig = {
            serverConfig: {
                ip: connectionInfo.asterisk_ip,
                wsPort: connectionInfo.ws_port,
                wssPort: connectionInfo.wss_port,
            },
            stunUrl: connectionInfo.stun_url,
            secondaryStunUrl: connectionInfo.sec_stun_url,
            turnConfig: {
                url: connectionInfo.turn_url,
                userName: connectionInfo.turn_username,
                password: connectionInfo.turn_password,
            },
            proxyPort: connectionInfo.outbound_proxy_port,
            secondaryProxyPort: connectionInfo.sec_outbound_proxy_port,
        };

        const isSecSipConfigPresent = this.checkSecondarySipConfig(connectionInfo)
        let sipSecondaryUserConfig: SipUserConfig
        if(isSecSipConfigPresent){
             //secondary sip configuaration information
             sipSecondaryUserConfig = {
                serverConfig: {
                    ip: connectionInfo.sec_asterisk_ip.toString(),
                    wsPort: connectionInfo.sec_ws_port,
                    wssPort: connectionInfo.sec_wss_port,
                },
                stunUrl: connectionInfo.sec_stun_url,
                secondaryStunUrl: connectionInfo.sec_stun_url,
                turnConfig: {
                    url: connectionInfo.turn_url,
                    userName: connectionInfo.turn_username,
                    password: connectionInfo.turn_password,
                },
                proxyPort: connectionInfo.sec_outbound_proxy_port,
                secondaryProxyPort: connectionInfo.outbound_proxy_port,
            };

            console.log('sipSecondaryUserConfig', sipSecondaryUserConfig);
        }

        //need to call adduserdevice api for secondary server


        const userName = mlNumber;
        const password = deviceData.sip_password;

        const sipUserInfo: SipUserInfo = {
            id: userId,
            name: userName,
            password,
            skipGenerateNameToken: true,
            extraHeaders,
            config: sipUserConfig,
        };


        let sipSecondaryUserInfo: SipUserInfo
        if(isSecSipConfigPresent){
            //secondary sip configuaration information
            sipSecondaryUserInfo = {
                id: userId,
                name: userName,
                password,
                skipGenerateNameToken: true,
                extraHeaders,
                config: sipSecondaryUserConfig,
            };
        }

        // sessionStorage.setItem('sipuserdata', JSON.stringify(sipUserInfo))
        // if(isSecSipConfigPresent){
        //     sessionStorage.setItem('secondarysipuserdata', JSON.stringify(sipSecondaryUserInfo));
        // }
    }

    async updateBranding(name){
        if(!sessionStorage.getItem("ssoToken") && !sessionStorage.getItem("__api_user_info__")){
            let userOrgBranding:any=null
                userOrgBranding = await this.authDataAccess.
                getBrandingDetails(name, this.apiToken)
                .toPromise();
                if(userOrgBranding['root']){
                    sessionStorage.setItem("reload_orgbrand",JSON.stringify(userOrgBranding))
                }

            const api_user_info = sessionStorage.getItem("__api_user_info__")
            if(api_user_info !== null && userOrgBranding.root.branding.operator_icon !== undefined){
                let parsedUserInfo = JSON.parse(api_user_info)
                parsedUserInfo["root"]["root"]["operator_icon"] = userOrgBranding.root.branding.operator_icon
                sessionStorage.setItem("__api_user_info__",JSON.stringify(parsedUserInfo))
            }
        }
    }
    async storeUserInfoInStorage(userInfo:any,deviceData:any){
        sessionStorage.setItem(
            '__max_mms_size__',
            userInfo.root.max_mms_size
        );

        sessionStorage.setItem(
            '__enable_picture_message__',
            userInfo.root.sls_num_data.enable_picture_message
        );
        sessionStorage.setItem(
            '__enable_group_message__',
            userInfo.root.sls_num_data.enable_group_message
        );
        sessionStorage.setItem(
            '__number_of_participants__',
            userInfo.root.number_of_participants
        );
        sessionStorage.setItem(
            '__enable_whatsapp_message__',
            userInfo.root.sls_num_data.whatsapp_config.enable_whatsapp_message
        );
        sessionStorage.setItem(
            '__whatsapp_business_number__',
            userInfo.root.sls_num_data.whatsapp_config.whatsapp_business_number
        );
        sessionStorage.setItem(
            '__whatsapp_group_messaage__',
            userInfo.root.sls_num_data.whatsapp_config.enable_whatsapp_group_message
        );
        sessionStorage.setItem(
            '__whatsapp_share_chat_history__',
            userInfo.root.sls_num_data.whatsapp_config.enable_whatsapp_share_chat
        );
        sessionStorage.setItem(
            '__enable_whatsapp_templates__',
            JSON.stringify(userInfo.root.sls_num_data.whatsapp_config.whatsapp_templates)
        );
        sessionStorage.setItem(
            '__enable_whatsapp_picture_message__',
            userInfo.root.sls_num_data.whatsapp_config.enable_whatsapp_picture_message
        );
        const deviceData_userInfo = userInfo.root.device_data;
        if (deviceData.elk_address === undefined && deviceData_userInfo !== undefined) {
            if (deviceData_userInfo.elk_address !== undefined){
                sessionStorage.setItem(
                    '__ELK_SERVER_DOMAIN__',
                    userInfo.root.device_data.elk_address
                )
                sessionStorage.setItem(
                    '__ELK_POST_USERID__',
                    userInfo.root.device_data.elk_address_user
                )
                logger.saveELKpwd(userInfo.root.device_data.elk_address_pwd)
            }
        }
    }

    updateDeviceInfo(device:any)
    {
         const connectionInfo = device.root.connection_info;
         console.log('connectionInfo', connectionInfo);
         if(connectionInfo.primary_adk && connectionInfo.secondary_adk){
             setgeoUrl([
                 typeof connectionInfo.primary_adk === 'string' ? connectionInfo.primary_adk : null,
                 typeof connectionInfo.secondary_adk === 'string' ? connectionInfo.secondary_adk : null,
             ])
         }else{
             setgeoUrl(null)
         }
         const deviceData = device.root.device_data;
         const userId = deviceData.sip_username;

         if (deviceData.elk_address !== undefined) {
             sessionStorage.setItem(
                 '__ELK_SERVER_DOMAIN__',
                 deviceData.elk_address
             )
             sessionStorage.setItem(
                 '__ELK_POST_USERID__',
                 deviceData.elk_address_user
             )
             logger.saveELKpwd(deviceData.elk_address_pwd)
         }

         // store device id
         if (deviceData.sip_username) {
             localStorage.setItem(deviceIdLocalKey, deviceData.sip_username);
         }
    }

    async logout() {
        await this.sipUserService.unregister(true,false);
        this.authData = null;
    }
    async clearReloadSessions(){
        session_keys.forEach((key)=>{
        sessionStorage.removeItem(key);
        localStorage.removeItem(key);

        })
        sessionStorage.removeItem("reload_device");
        sessionStorage.removeItem("reload_orgbrand");
        sessionStorage.removeItem("reload_userinfo");
        localStorage.removeItem("cacheRehidrate");
    }

    get user() {
        return this.sipUserService.user;
    }

    // password is temporary
    private set authData(
        data: {
            name: string;
            token: string;
            identity: string;
            orgId: string;
            customerSupport: CustomerSupport;
        } | null
    ) {
        if (data) {
            sessionStorage.setItem('__api_auth_token__', data.token);
            sessionStorage.setItem('__api_auth_org_id__', data.orgId);
            sessionStorage.setItem('__api_name__', data.name);
            sessionStorage.setItem('__api_identity__', data.identity);
            sessionStorage.setItem(
                '__api_customer_support_email__',
                data.customerSupport.email
            );
            sessionStorage.setItem(
                '__api_customer_support_phone__',
                data.customerSupport.phone
            );
        } else {
            sessionStorage.removeItem('__api_auth_token__');
            sessionStorage.removeItem('__api_auth_org_id__');
            sessionStorage.removeItem('__api_token__');
            sessionStorage.removeItem('__api_name__');
            sessionStorage.removeItem('__api_identity__');
            sessionStorage.removeItem('__api_customer_support_email__');
            sessionStorage.removeItem('__api_customer_support_phone__');
            localStorage.removeItem(deviceIdLocalKey);
            setgeoUrl(null)
        }
    }

    public set apiToken(token: string) {
        if (token) {
            sessionStorage.setItem('__api_token__', token);
        } else {
            sessionStorage.removeItem('__api_token__');
        }
    }

    public get apiToken() {
        return sessionStorage.getItem('__api_token__');
    }

    public get apiAuthToken() {
        return sessionStorage.getItem('__api_auth_token__');
    }

    public get apiAuthOrgId() {
        return sessionStorage.getItem('__api_auth_org_id__');
    }

    // The same as email
    public get apiName() {
        return sessionStorage.getItem('__api_name__') !== null ? sessionStorage.getItem('__api_name__') :sessionStorage.getItem('userEmail')  ;
    }

    // The same as multilineNumber
    public get apiIdentity() {
        return sessionStorage.getItem('__api_identity__');
    }

    public get customerSupport() {
        return {
            email: sessionStorage.getItem('__api_customer_support_email__'),
            phone: sessionStorage.getItem('__api_customer_support_phone__'),
        };
    }

    public get maxGroupParticpants() {
        return sessionStorage.getItem('__number_of_participants__');
    }

    public get checkGroupMsgEnable() {
        return sessionStorage.getItem('__enable_group_message__');
    }

    public get checkPictureMsgEnable() {
        return sessionStorage.getItem('__enable_picture_message__');
    }

    public get checkMaxMmsSize() {
        return sessionStorage.getItem('__max_mms_size__');
    }

    public get isWhatsappGroupEnabled () {
        return sessionStorage.getItem('__whatsapp_group_messaage__') == 'true' ? true : false;
    }

    internetConnLossEvent(val: any) {
        this.internetConnLoss.next(val)
    }

    async getWebrtcData(deviceData, connectionInfo, device){
        let otpdata:any = null;
        let otp = '';
        let webrtc_gw_addresses: any;
        let pri_gw_address = '';
        let sec_gw_address = '';
        let pri_sip_address = '';
        let sec_sip_address = '';
        let pri_adk_address = '';
        let sec_adk_address = '';
            webrtc_gw_addresses = deviceData.webrtc_gw_address.includes('|') ? deviceData.webrtc_gw_address.split('|') : deviceData.webrtc_gw_address;
            if (Array.isArray(webrtc_gw_addresses)) {
                pri_gw_address = webrtc_gw_addresses[0];
                sec_gw_address = webrtc_gw_addresses[1];
            } else {
                pri_gw_address = webrtc_gw_addresses;
            }

            sessionStorage.setItem('device_data_name', device.root.device_data.sip_username);
            //Getting otp for passing websocket  for the webrtc validation
            try{
                otpdata = await this.authDataAccess
                .getOtp(device.root.device_data.sip_username+'@')
                .toPromise();
             }catch (err){
                 logger.debug('Error on getting otp during login::', err);
             }
            otp = otpdata.root?.otp;

            const sip_address = deviceData.sip_address.includes('|') ? deviceData.sip_address.split('|') : deviceData.sip_address;
            const adk_address = deviceData.adk_address.includes('|') ? deviceData.adk_address.split('|') : deviceData.adk_address;
            if(Array.isArray(sip_address)){
                pri_sip_address = sip_address[0];
                sec_sip_address = sip_address[1];
            }
            if(Array.isArray(sip_address)){
                pri_adk_address = adk_address[0];
                sec_adk_address = adk_address[1];
            }else {
                pri_adk_address = adk_address;
            }
            return {
                otp, pri_gw_address, sec_gw_address, pri_adk_address, sec_adk_address
            }
    }
}
