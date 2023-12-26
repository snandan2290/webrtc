import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, BehaviorSubject, of } from 'rxjs';
import {
    AddUserDeviceResponseDto,
    GetNumbersResponseDTO,
    GetOtpResponseDto,
    GetUserInfoResponseDTO,
    LoginResponseDTO,
} from './dto';
import { GeoHttpService } from './geo-http.service';
import { NzModalService } from 'ng-zorro-antd/modal';
import { LoadingComponent } from '../components/loading/loading.component';
import {LoggerFactory} from '@movius/ts-logger';
import { getFeatureEnabled } from '../utils';

export interface SecretKeys {
    key: string;
    iv: string;
}
const logger = LoggerFactory.getLogger("")

@Injectable({ providedIn: 'root' })
export class AuthDataAccessService {
    // TODO : Temporary
    public freshOnboardUser = new BehaviorSubject(false);
    public freshOnboardUserDataPass = this.freshOnboardUser.asObservable();

    public tokenRecieved = new BehaviorSubject(false)
    public themeupdate = new BehaviorSubject(false)

    public teamsError = new BehaviorSubject({status:false,details:""})

    public unauthorized = new BehaviorSubject({status : true, details : ''})
    public cacheReload = new BehaviorSubject(false)
    public appLoaded = new BehaviorSubject(false)
    public LoadingSpinner = new BehaviorSubject<any>(false);
    LoadingSpinnerData = this.LoadingSpinner.asObservable();

    public isViaTeamsMblChk = new BehaviorSubject<any>(false);
    isViaTeamsMobileObs = this.isViaTeamsMblChk.asObservable();

    public serverCntcSts = new BehaviorSubject<any>(null);
    serverCntcStsData = this.serverCntcSts.asObservable();

    public secServerCntcSts = new BehaviorSubject<any>(null);
    secServerCntcStsData = this.secServerCntcSts.asObservable();

    public priAndSecServerCntcSts = new BehaviorSubject<any>(null);
    priAndsecServerCntcStsData = this.priAndSecServerCntcSts.asObservable();

    public exchangeDataProperty:boolean = false;


    constructor(private readonly http: HttpClient,
        private readonly geoHttpService: GeoHttpService,
        private readonly modalService: NzModalService,
    ) { }

    login(
        name: string,
        password: string,
        deviceNumber: string,
        secretKeys?: SecretKeys,
        sso_access_token?: string
    ): Observable<LoginResponseDTO> {
        const params = {};

        if (!!window['MOVIUS_APP_TYPE']) {
            params['MOVIUS_APP_TYPE'] = window['MOVIUS_APP_TYPE'];
        }

        if (name == null || name == "" || name == 'undefined' || name == 'null') {
            if (sessionStorage.getItem('userEmail') != "\"\""
                && sessionStorage.getItem('userEmail') != null
                && typeof (sessionStorage.getItem('userEmail')) != 'undefined') {
                name = sessionStorage.getItem('userEmail');
            }
        }

        if (password != "x") {
            params['password'] = password;
        }

        //console.log('from login sso_access_token - ', sso_access_token);
        //console.log('from login sso_access_token - ', params['sso_access_token']);

        if(sessionStorage.getItem("isLogingViaTeams") === "true" && sso_access_token != "" && typeof (sso_access_token) != 'undefined'){
            params["teams_access_token"] = sso_access_token;
        }else{
            if (sso_access_token != "" && typeof (sso_access_token) != 'undefined') {
                params['sso_access_token'] = sso_access_token;
            } else {
                if (sessionStorage.getItem('ssoToken') != "\"\""
                    && sessionStorage.getItem('ssoToken') != null
                    && typeof (sessionStorage.getItem('ssoToken')) != 'undefined') {
                    params['sso_access_token'] = sessionStorage.getItem('ssoToken');
                    //console.log('from sessionStorage sso_access_token - ', params['sso_access_token']);
                }
            }
        }

        // const headers = {
        //     headers: { 'request-meta': 'json/xml' }
        // };
        let url = `mml/accounts/${name}/login`;
        if (deviceNumber) {
            params['device_number'] = deviceNumber;
        }
        if (secretKeys) {
            params['c_key'] = secretKeys.key;
            params['c_value'] = secretKeys.iv;
        }
        // return this.http.post<LoginResponseDTO>(url, params, {
        //     headers: { 'request-meta': 'json/xml' },
        // });
        if(sessionStorage.getItem('Contex_res') != null)
	{
	  params['host_clientType']=sessionStorage.getItem('Contex_res')
	}
        this.exchangePopUpUpdate(true);
        const headers = { 'request-meta': 'json/xml' };

        //sessionStorage.setItem('login_params', JSON.stringify(params));
        return this.geoHttpService.callADKRtnResp(url, "post", params, headers);
    }

    public refresh_token_on_expiry() {
        //console.log('came to refresh_token_method');
        let name = '';
        if (sessionStorage.getItem('userEmail') != "\"\""
                && sessionStorage.getItem('userEmail') != null
                && typeof (sessionStorage.getItem('userEmail')) != 'undefined') {
                name = sessionStorage.getItem('userEmail');
            }
        let url;
        if(sessionStorage.getItem("isLogingViaTeams") === "true"){
            url = `mml/accounts/${name}/refresh_sso_token?api_token=${sessionStorage.getItem('__api_token__')}&refresh_token=${sessionStorage.getItem('refreshToken')}`;
        } else {
            url = `mml/accounts/${name}/refresh_sso_token?api_token=${sessionStorage.getItem('__api_token__')}&sso_access_token=${sessionStorage.getItem('ssoToken')}`;
        }
        const headers = { 'request-meta': 'json/xml' };
        const params = JSON.parse(sessionStorage.getItem('login_params')) ? JSON.parse(sessionStorage.getItem('login_params')) : JSON.parse(localStorage.getItem('login_params'));
        return this.geoHttpService.callADKRtnResp(url, "post", params, headers);
    }

    public exchangePopUpUpdate(args: any) {
        this.exchangeDataProperty = args;
    }

    getNumbers(
        name: string,
        apiToken: string
    ): Observable<GetNumbersResponseDTO> {
        const url = `mml/accounts/${name}/getnumbers?api_token=${apiToken}`;
        // return this.http.get<GetNumbersResponseDTO>(url);
        return this.geoHttpService.callADKRtnResp(url, "get", null, null);
    }

    addUserDevice(
        name: string,
        id: string,
        apiToken: string
    ): Observable<AddUserDeviceResponseDto> {
        //logger.debug("addUserDevice method called")
        let url = `mml/accounts/${name}/adduserdevice?identity=${id}&api_token=${apiToken}&client_type=${getFeatureEnabled()}`;
        if(getFeatureEnabled() == 'messaging'){
             url = `mml/accounts/${name}/adduserdevice?identity=${id}&api_token=${apiToken}&client_type=${getFeatureEnabled()}&device_type=webrtc_teams`;
        }        
        // return this.http.get<AddUserDeviceResponseDto>(url);
        if(sessionStorage.getItem("isLogingViaTeams") !== "true"){
            this.loaderSpinnerEvent(true);
            this.loaderModalOpen();
        }
        return this.geoHttpService.callADKRtnResp(url, "get", null, null);
    }

    getOtp(
        name: string
    ): Observable<GetOtpResponseDto> {
        logger.debug("Get Otp method called")
        let url = `mml/accounts/${name}/getotp?user_name=${name}&format=xml`;
        return this.geoHttpService.callADKRtnResp(url, "get", null, null);
    }

    getUserInfo(
        name: string,
        id: string,
        apiToken: string
    ): Observable<GetUserInfoResponseDTO> {
        //logger.debug("getUserInfo method called")
        const url = `mml/accounts/${name}/get_user_info?identity=${id}&api_token=${apiToken}`;
        // return this.http.get<GetUserInfoResponseDTO>(url);
        return this.geoHttpService.callADKRtnResp(url, "get", null, null);
    }

    public onboardUserGdprStatusUpdate(args: any) {
        this.freshOnboardUser.next(args);
    }

    verifyPin(name: string, otp: string, apiToken: string) {
        const url = `mml/accounts/${name}/verifypin?user_otp=${otp}${apiToken ? `&api_token=${apiToken}` : ''
            }`;
        // return this.http.get(url);
        return this.geoHttpService.callADK(url, "get", null, null);
    }

    activate(
        name: string,
        id: string,
        orgId: string,
        otp: string,
        apiToken: string
    ) {
        const url = `mml/accounts/${name}/activate?organization=${orgId}&identity=${id}&user_otp=${otp}&api_token=${apiToken}`;
        // return this.http.get(url);
        return this.geoHttpService.callADKRtnResp(url, "get", null, null);
    }

    getBrandingDetails(apiName:string, apiToken:string){
        //logger.debug("getBrandingDetails method called")
        const url = `mml/accounts/${apiName}/discover?api_token=${apiToken}`
        return this.geoHttpService.callADKRtnResp(url,"get",null,null);
    }

    changePasswordWithOldPassword(
        name: string,
        password: string,
        newPassword: string,
        apiToken: string
    ) {
        const url = `mml/accounts/${name}/modify_password`;
        // return this.http.get(url, {
        //     params: {
        //         password,
        //         new_password: newPassword,
        //         api_token: apiToken,
        //     },
        // });
        const params = {
            password,
            new_password: newPassword,
            api_token: apiToken,
        }
        return this.geoHttpService.callADKRtnResp(url, "get", params, null);
    }

    changePasswordWithOtp(name: string, newPassword: string, otp: string) {
        const url = `mml/accounts/${name}/modify_password`;
        // return this.http.get(url, {
        //     params: {
        //         user_otp: otp,
        //         new_password: newPassword,
        //     },
        // });
        const params = {
            new_password: newPassword,
            user_otp: otp,
        }
        return this.geoHttpService.callADKRtnResp(url, "get", params, null);
    }

    triggerPasswordOtp(name: string) {
        const url = `mml/accounts/${name}/trigger_password_otp`;
        // return this.http.get(url);
        return this.geoHttpService.callADKRtnResp(url, "get", null, null);
    }

    public loaderSpinnerEvent(data: boolean){
        this.LoadingSpinner.next(data);
    }

    public loadViaTeamsMobileEvent(data: boolean){
        this.isViaTeamsMblChk.next(data);
    }

    public serverCntcStsDataEvent(data: any){
        this.serverCntcSts.next(data);
    }
    public secServerCntcStsDataEvent(data: any){
        this.secServerCntcSts.next(data);
    }
    public priAndSecServerCntcStsDataEvent(data: any){
        this.priAndSecServerCntcSts.next(data);
    }

    public loaderModalOpen(){
        this.modalService
        .create({
            nzContent: LoadingComponent,
            nzComponentParams: {
            },
            nzStyle: {
                height: '100%',
                width: '100%',
                top:'-1rem',
                margin:'0px',
                maxWidth : '100vw'
            },
            nzMask: false,
            nzFooter: null,
            nzClosable: false,
            nzMaskClosable: false,
            nzKeyboard:false,
        })
    }


}
