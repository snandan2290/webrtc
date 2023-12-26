import {
    HttpClient,
    HttpErrorResponse,
    HttpResponse,
} from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Location } from '@angular/common';
import { catchError } from 'rxjs/internal/operators/catchError';
import { of } from 'rxjs/internal/observable/of';
import { map } from 'rxjs/internal/operators/map';
import { Observable } from 'rxjs/internal/Observable';
import { forkJoin, throwError } from 'rxjs';
import { LoggerFactory } from '@movius/ts-logger';
import { getGeoUrl } from '..';
import { Router } from '@angular/router';
import { CookieService } from 'ngx-cookie-service';
import { tap,finalize } from 'rxjs/operators';
import { loginFails } from '..';

const logger = LoggerFactory.getLogger("")

const adk = ":8021/adk/"
let fullUrl = null;
let isGeo = false;

const join = (prefix: string, baseUrl: string, url: string) =>
    Location.joinWithSlash(baseUrl, url.substring(prefix.length));

const urlHasSchema = (url: string) =>
    url && (url.startsWith('http://') || url.startsWith('https://'));

const urlIsADK = (domain: string) => {
    if (!urlHasSchema(domain)) {
        domain = "https://".concat(domain)
    }
    if (!(domain && (domain.includes(adk)))) {
        return domain.concat(adk);
    } else {
        return domain;
    }
}

const getBaseUrlByPrefix = (api: string, url: string, adk: string) => {
    // consider api.url default base url if prefix is not defined
    return join('', urlIsADK(api), url);
};

const getFullUrl = (config: string, url: string) => {
    // Is schema presented consider url is full
    if (!urlHasSchema(url)) {
        return getBaseUrlByPrefix(config, url, adk);
    } else {
        return url;
    }
};

const getLogoutUrl = () => {
    return window.document.baseURI;
};

@Injectable({ providedIn: 'root' })
export class GeoHttpService {
    /** maintain two address variables
     * 1) for the geo-http library to use, which will change based on the current successful adk address
     * => adk_address[1] value => { primary: "primary_adk_address", secondary: "secondary_adk_address" }
     * when curAvailGeoAdkAddrs changes, then this adk_address[1]'s value will be changed
     * ex:
     * primary from adk is serverA
     * secondary from adk is serverB
     * => adk_address[1] value => { primary: "serverA", secondary: "serverB" }
     * now serverA is down,
     * then curAvailGeoAdkAddrs value changed from => "serverA" to "serverB", then
     * => adk_address[1] value => { primary: "serverB", secondary: "serverA" }
     *
     * 2) for GeoHttpService class to keep track on the available geo address which will not change periodically.
     * => adkGeoAddrs[0] value => { primary: "primary_adk_address", secondary: "secondary_adk_address" }
     */
    adk_address: Array<any> = [];
    adkGeoAddrs: Array<any> = [];
    curAvailGeoAdkAddrs: string;
    geoServer = "primary";
    constructor(
        private http: HttpClient,
        private readonly router: Router,
        private cookieService: CookieService,
    ) { }

    public checkIsUpdateNeeded(adkUrlA: string[], adkUrlB: string[], isStrict: boolean) {
        if (adkUrlA[0] === adkUrlB[0]) {
            if (adkUrlA[1] !== adkUrlB[1]) {
                return true
            }
        } else {
            if (isStrict === true)
                return true
            if (!((adkUrlA[1] === adkUrlB[0])
                && (adkUrlA[0] === adkUrlB[1]))) {
                return true
            }
        }
        return false
    }

    public updateADKGeoAddress(geoADKUrlAPIResponse: {} | string | null) {
        if (geoADKUrlAPIResponse !== null) {
            if (typeof geoADKUrlAPIResponse === 'string') {
                this.adkGeoAddrs.pop()
                if (this.adk_address.length === 1 &&
                    this.adk_address[0].indexOf(geoADKUrlAPIResponse) === -1) {
                    this.adk_address[0] = urlIsADK(geoADKUrlAPIResponse)
                }
            } else {
                if (this.adkGeoAddrs.length === 0) {
                    this.adkGeoAddrs.push({
                        primary: geoADKUrlAPIResponse['primary_adk_url'],
                        secondary: geoADKUrlAPIResponse['secondary_adk_url']
                    })
                } else {
                    let isUpdationNeeded = false
                    isUpdationNeeded = this.checkIsUpdateNeeded([
                        geoADKUrlAPIResponse['primary_adk_url'],
                        geoADKUrlAPIResponse['secondary_adk_url']
                    ], [
                        this.adkGeoAddrs[0]["primary"],
                        this.adkGeoAddrs[0]["secondary"]
                    ], true)
                    if (isUpdationNeeded === true) {
                        this.adkGeoAddrs[0]["primary"] = geoADKUrlAPIResponse['primary_adk_url'];
                        this.adkGeoAddrs[0]["secondary"] = geoADKUrlAPIResponse['secondary_adk_url'];
                    }
                }
                if (this.curAvailGeoAdkAddrs === undefined) {
                    this.curAvailGeoAdkAddrs = geoADKUrlAPIResponse['primary_adk_url']
                } else if (this.curAvailGeoAdkAddrs !== undefined
                    && this.curAvailGeoAdkAddrs !== geoADKUrlAPIResponse['primary_adk_url']
                    && this.curAvailGeoAdkAddrs !== geoADKUrlAPIResponse['secondary_adk_url']) {
                    this.curAvailGeoAdkAddrs = geoADKUrlAPIResponse['primary_adk_url']
                }
            }
        } else {
            this.adkGeoAddrs.pop()
            if (this.adk_address.length === 2 || this.adk_address[0]?.length > 1) {
                this.adk_address.pop()
            }
        }
    }

    public updtAdkFlowWRTSuccess() {
        const temp = { ...this.adk_address[1] }
        this.adk_address[1]['primary'] = temp['secondary']
        this.adk_address[1]['secondary'] = temp['primary']
    }

    public checkAvailAdkAdrsVsAdkGeoAdrs() {
        if (
            this.adk_address.length === 0 ||
            (this.adk_address.length === 1 && this.adkGeoAddrs.length === 1) ||
            (this.adk_address[1] &&
                this.checkIsUpdateNeeded([
                    this.adk_address[1]["primary"],
                    this.adk_address[1]["secondary"]
                ], [
                    this.adkGeoAddrs[0]['primary'],
                    this.adkGeoAddrs[0]['secondary']
                ], false)
            )
        )
            return true
        else
            return false
    }

    /* public checkADKGeoConfig() {
        if (window['MOVIUS_API_BASE_URL'] !== "" && this.adk_address.length === 0)
            this.adk_address.push(window['MOVIUS_API_BASE_URL'])

        if (this.adkGeoAddrs.length === 1){
            if(this.adk_address.length === 2)
                this.adk_address.pop()
            this.adk_address.push(this.adkGeoAddrs[0])
        }
        console.log("GeoHttpService:: checkADKGeoConfig:: dk_address:: " + this.adk_address)
        if (this.adk_address.length === 2) {
            isGeo = true;
        } else {
            console.log("GeoHttpService::: Not a Geo setup!!")
        }
    } */

    public checkADKGeoConfig() {
        if (sessionStorage.getItem("isLogingViaTeams") === "true" && window['MOVIUS_SITES'] !== "" && this.adk_address.length === 0 && sessionStorage.getItem('baseUrl') == null) {
            //console.log(window['MOVIUS_API_BASE_URL']);
            this.adk_address.push(window['MOVIUS_SITES'])
        }
        else if(window['MOVIUS_API_BASE_URL'] !== "" || sessionStorage.getItem('baseUrl') !== null) {  
            if(sessionStorage.getItem('baseUrl') !== null) {
                this.adk_address.push(sessionStorage.getItem('baseUrl'));
            } else if(window['MOVIUS_API_BASE_URL'] !== "") {
                this.adk_address.push(window['MOVIUS_API_BASE_URL']);
            }
        }
        if (this.adkGeoAddrs.length === 1) {
            if (this.adk_address.length === 2)
                this.adk_address.pop()
            this.adk_address.push(this.adkGeoAddrs[0])
        }
        console.log("GeoHttpService:: checkADKGeoConfig:: dk_address:: " + this.adk_address)
        if (this.adk_address.length === 2) {
            isGeo = true;
        } else {
            console.log("GeoHttpService::: Not a Geo setup!!")
        }
    }

    /* public processAndGetFullUrl(url){
        const geoADKUrlAPIResponse  = getGeoUrl()
        this.updateADKGeoAddress(geoADKUrlAPIResponse)
        if(this.adk_address.length === 2 && this.curAvailGeoAdkAddrs !== this.adk_address[1]['primary']){
            this.updtAdkFlowWRTSuccess()
        }
        if(this.checkAvailAdkAdrsVsAdkGeoAdrs())
            this.checkADKGeoConfig()
        if (this.adk_address.length === 2){
            return getFullUrl(this.adk_address[1]['primary'], url);
        }else if(this.adk_address.length === 1){
            return getFullUrl(this.adk_address[0], url);
        }
    } */

    public processAndGetFullUrl(url) {
        const geoADKUrlAPIResponse = getGeoUrl()
        this.updateADKGeoAddress(geoADKUrlAPIResponse)
        if (this.adk_address.length === 2 && this.curAvailGeoAdkAddrs !== this.adk_address[1]['primary']) {
            this.updtAdkFlowWRTSuccess()
        }
        if (this.checkAvailAdkAdrsVsAdkGeoAdrs())
            this.checkADKGeoConfig()
        if (this.adk_address.length === 2) {
            return getFullUrl(this.adk_address[1]['primary'], url);
        } else if (this.adk_address.length === 1) {
            //console.log(this.adk_address.length);
            //console.log(this.adk_address);
            if (this.adk_address[0] instanceof Array && this.adk_address[0].length > 1) {
                let urls = [];
                this.adk_address[0].forEach(function (value, index) {
                    urls[index] = getFullUrl(value, url)
                })
                // urls[0] = getFullUrl(this.adk_address[0][0], url);
                // urls[1] = getFullUrl(this.adk_address[0][1], url);

                return urls;
            }
            else if (this.adk_address[0] instanceof Array && this.adk_address[0].length == 1) {
                return getFullUrl(this.adk_address[0][0], url);
            }
            else {
                return getFullUrl(this.adk_address[0], url);
            }
        }
    }

    public doHandleHttpErr(error_code: any, api_error_code: any): boolean {
        const is5xx = /^5\d{2}$/.test(error_code);
        const is4xx = /^4\d{2}$/.test(error_code);
        if ((is5xx ||
            is4xx) &&
            isGeo) {
            return true;
        }
        return false;
    }

    public callADK(url: string, type: string, params: any, headers: any): any {
        this.geoServer = "primary"
        fullUrl = this.processAndGetFullUrl(url)
        logger.debug("HTTP req => ", fullUrl, params)
        if (type === 'post') {
            return this.http.post(fullUrl, params, { observe: 'response', 'headers': headers }).pipe(
                catchError((err) => {
                    logger.debug("callADK " + this.geoServer + " " + type + " ADK:: error caught in service")
                    logger.error(err);
                    if (err.error.apiReturnCode == 23502 || err.error.apiReturnCode == 23501) {
                        this.router.navigate([
                            '/auth/login',
                            { info: err.error.message },
                        ]);
                    } else if (err.error.apiReturnCode == 23701) {
                        this.router.navigate([
                            '/auth/login',
                            { info: "MultiLine Desktop is disabled for your Organization." },
                        ]);
                    }
                    // console.log("callADK " + this.geoServer + " " + type + " ADK:: error caught in service")
                    // console.log(err);
                    if (this.doHandleHttpErr(err['status'], err['error']['apiReturnCode']) &&
                        (this.adk_address.length === 2)
                    ) {
                        console.log("callADK " + this.geoServer + " " + type + " ADK:: Routing request to Secondary");
                        return this.callSecADK(url, type, null, null);
                    } else {
                        logger.error(err);
                        throw err;
                    }
                })
            );
        } else {
            if (url.includes('tandc') || url.includes('e911_terms')) {
                return this.http.get(fullUrl, { responseType: 'text', }).pipe(
                    catchError((err) => {
                        logger.debug("callADK" + this.geoServer + type + " ADK:: error caught in service")
                        logger.error(err);
                        // console.log("callADK" + this.geoServer + type + " ADK:: error caught in service")
                        // console.log(err);
                        if (this.doHandleHttpErr(err['status'], err['error']['apiReturnCode']) &&
                            (this.adk_address.length === 2)
                        ) {
                            console.log("callADK " + this.geoServer + " " + type + " ADK::  Routing request to Secondary");
                            return this.callSecADK(url, type, null, null);
                        } else {
                            logger.error(err);
                            throw err;
                        }
                    })
                )
            } else {
                return this.http.get(fullUrl, { observe: 'response', 'headers': headers, 'params': params }).pipe(
                    map((resp) => {
                        if (url.includes('set_status_e911') &&
                            !(this.doHandleHttpErr(resp['status'], '200'))) {
                            sessionStorage.setItem('_USER_E911_STATUS_', 'enabled_accepted');
                        } else if (url.includes('verifypin') &&
                            !(this.doHandleHttpErr(resp['status'], '200'))) { // return for the verifyPin response to get OTP pin.
                            logger.debug("HTTP res =>", resp['url'], " Response :", resp['status'], " ", resp['statusText'])
                            return resp;
                        }
                    }),
                    catchError((err) => {
                        logger.debug("callADK" + this.geoServer + type + " ADK:: error caught in service")
                        logger.error(err);
                        // console.log("callADK" + this.geoServer + type + " ADK:: error caught in service")
                        // console.log(err);
                        if (this.doHandleHttpErr(err['status'], err['error']['apiReturnCode']) &&
                            (this.adk_address.length === 2)
                        ) {
                            console.log("callADK " + this.geoServer + " " + type + " ADK::  Routing request to Secondary");
                            return this.callSecADK(url, type, null, null);
                        } else {
                            logger.error(err)
                            throw err;
                        }
                    })
                );
            }
        }
    }

    public callSecADK(url: string, type: string, params: any, headers: any) {
        this.geoServer = "secondary"
        fullUrl = getFullUrl(this.adk_address[1]["secondary"], url);
        logger.debug("HTTP req => ", fullUrl, params)
        if (type === 'post') {
            return this.http.post(fullUrl, params, { observe: 'response', 'headers': headers }).pipe(
                map(() => {
                    this.curAvailGeoAdkAddrs = this.adk_address[1]['secondary']
                    logger.debug("Primary ADK address [" + this.adk_address[1]['primary'] + "] is down")
                    logger.debug("Seconday ADK address [", this.curAvailGeoAdkAddrs, "] is considered as initial url further")
                }),
                catchError((err, caught) => {
                    logger.debug("callSecADK " + this.geoServer + " " + type + " ADK:: error caught in service")
                    logger.error(err);
                    if (err.error.apiReturnCode == 23502 || err.error.apiReturnCode == 23501) {
                        this.router.navigate([
                            '/auth/login',
                            { info: err.error.message },
                        ]);
                    } else if (err.error.apiReturnCode == 23701) {
                        this.router.navigate([
                            '/auth/login',
                            { info: "MultiLine Desktop is disabled for your Organization." },
                        ]);
                    }
                    // console.log("callSecADK " + this.geoServer + " " + type + " ADK:: error caught in service")
                    // console.log(err);
                    return of(err);
                })
            );
        } else {
            if (url.includes('tandc') || url.includes('e911_terms')) {
                return this.http.get(fullUrl, { responseType: 'text', }).pipe(
                    map(() => {
                        this.curAvailGeoAdkAddrs = this.adk_address[1]['secondary']
                        logger.debug("Primary ADK address [" + this.adk_address[1]['primary'] + "] is down")
                        logger.debug("Seconday ADK address [", this.curAvailGeoAdkAddrs, "] is considered as initial url further")
                    }),
                    catchError((err) => {
                        logger.debug("callADK" + this.geoServer + type + " ADK:: error caught in service")
                        logger.error(err);
                        // console.log("callADK" + this.geoServer + type + " ADK:: error caught in service")
                        // console.log(err);
                        logger.error(err);
                        throw err;
                    })
                )
            } else {
                return this.http.get(fullUrl, { observe: 'response', 'headers': headers, 'params': params }).pipe(
                    map(() => {
                        this.curAvailGeoAdkAddrs = this.adk_address[1]['secondary']
                        logger.debug("Primary ADK address [" + this.adk_address[1]['primary'] + "] is down")
                        logger.debug("Seconday ADK address [", this.curAvailGeoAdkAddrs, "] is considered as initial url further")
                    }),
                    catchError((err) => {
                        logger.debug("callSecADK " + this.geoServer + " " + type + " ADK:: error caught in service")
                        logger.error(err);
                        // console.log("callSecADK " + this.geoServer + " " + type + " ADK:: error caught in service")
                        // console.log(err);
                        throw err;
                    })
                );
            }
        }
    }

    /* public callADKRtnResp(url: string, type: string, params: any, headers: any): Observable<any> {
        this.geoServer = "primary"
        fullUrl = this.processAndGetFullUrl(url)
        logger.debug("HTTP req => ",fullUrl,params)
        sessionStorage.setItem('prvUrl', url);
        localStorage.setItem('prvUrl', url);
        sessionStorage.setItem('prvType', type);
        sessionStorage.setItem('prvParams', JSON.stringify(params));
        sessionStorage.setItem('prvHeaders', JSON.stringify(headers));
        if (type === 'post') {
            return this.http.post<any>(fullUrl, params, {
                observe: 'response',
                headers: headers,
            })
                .pipe(
                    map((resp) => {
                        if(url.includes("/login"))
                        {
                            delete params['password'];
                            sessionStorage.setItem('login_params', JSON.stringify(params));
                            localStorage.setItem('login_params', JSON.stringify(params));
                        }
                        if (resp['error'] === undefined) {
                            if (url.includes('add_e911_subscriber')) {
                                console.log("update E911");
                                sessionStorage.setItem('_USER_E911_STATUS_', 'enabled_accepted');
                            }
                        } else if (url.includes('add_e911_subscriber') &&
                                !this.doHandleHttpErr(resp['status'], resp['error']['apiReturnCode'])) {
                                console.log("update E911");
                                sessionStorage.setItem('_USER_E911_STATUS_', 'enabled_accepted');
                        }
                        logger.debug("HTTP res =>",resp['url']," Response :",resp['status']," ",resp['statusText'])
                        return resp['body'];
                    }),
                    catchError((err) => {
                        logger.debug("callADKRtnResp " + this.geoServer + " " + type + " ADK:: error caught in service")
                        logger.error(err);

                        if(err.error.apiReturnCode == 13002){

                            this.cookieService.delete("sso_response", "/", "moviuscorp.net", true, "None");
                            logger.debug("user logging out");
                            localStorage.removeItem('selectedGroup');
                            sessionStorage.clear();

                            this.router.navigate([
                                '/auth/login',
                                { info: 'timeoutExpired' },
                            ]);
                        }

                        if(sessionStorage.getItem('ssoToken') == null && err.error.apiReturnCode == '22018'){
                            this.router.navigate([
                                '/auth/login',
                                { info: 'timeoutExpired' },
                            ]);
                        }

                        //For SSO user need to get the fresh token and call prev api call using fresh token
                        if (sessionStorage.getItem('ssoToken') != null && err.error.apiReturnCode == '22018') {
                            let name = '';
                            if (sessionStorage.getItem('userEmail') != "\"\""
                                && sessionStorage.getItem('userEmail') != null
                                && typeof (sessionStorage.getItem('userEmail')) != 'undefined') {
                                name = sessionStorage.getItem('userEmail');
                            }
                            if (name == "") {
                                name = sessionStorage.getItem('__api_name__');
                            }

                            let refresh_token_url;
                            if (sessionStorage.getItem("isLogingViaTeams") === "true") {
                                refresh_token_url = `mml/accounts/${name}/refresh_sso_token?api_token=${sessionStorage.getItem('__api_token__')}&refresh_token=${sessionStorage.getItem('refreshToken')}`;
                            } else {
                                refresh_token_url = `mml/accounts/${name}/refresh_sso_token?api_token=${sessionStorage.getItem('__api_token__')}&sso_access_token=${sessionStorage.getItem('ssoToken')}`;
                            }
                            //const headers = { 'request-meta': 'json/xml' };
                            const paramslg = JSON.parse(sessionStorage.getItem("login_params"));
                            const fullUrlt = this.processAndGetFullUrl(refresh_token_url)


                            const refresh_api_token_resp = this.fetchData(fullUrlt, "post", paramslg);

                            //console.log('refresh_token_data is', refresh_api_token_resp);

                            refresh_api_token_resp.then((data) => {
                                //console.log("Promise resolved with: ", data);
                                return this.callADKRtnResp(sessionStorage.getItem('prvUrl').replace(/&api_token=.*&ver=/, '&api_token=' + sessionStorage.getItem('__api_token__') + '&ver='), sessionStorage.getItem('prvType'), JSON.parse(sessionStorage.getItem('prvParams')), JSON.parse(sessionStorage.getItem('prvHeaders'))).toPromise();
                            }).catch((error) => {
                                console.log("Promise rejected with " + JSON.stringify(error));
                            });
                        }

                        // console.log("callADKRtnResp " + this.geoServer + " " + type + " ADK:: error caught in service")
                        // console.log(err);
                        if (this.doHandleHttpErr(err['status'], err['error']['apiReturnCode']) &&
                            (this.adk_address.length === 2)
                        ) {
                            console.log("callADKRtnResp " + this.geoServer + "" + type + " ADK::  Routing request to Secondary");
                            return this.callSecADKRtnResp(url, type, params, headers);
                        } else {
                            logger.error(err)
                            if(url.includes("upload_mms")){
                                return of(err);
                            }
                            throw err;
                        }
                    })
                );
        } else {
            return this.http.get<any>(fullUrl, { observe: 'response', 'params': params, 'headers': headers })
                .pipe(
                    map((resp) => {
                        // console.log(this.geoServer + type + " ADK:: response: " + JSON.stringify(resp));
                        logger.debug("HTTP res =>",resp['url']," Response :",resp['status']," ",resp['statusText'])
                        return resp['body'];
                    }),
                    catchError((err) => {
                        logger.debug("callADKRtnResp " + this.geoServer + "" + type + " ADK:: error caught in service")
                        logger.error(err);


                        //For non sso user redirecting to the login page
                        if(sessionStorage.getItem('ssoToken') == null && err.error.apiReturnCode == '22018'){
                            this.router.navigate([
                                '/auth/login',
                                { info: 'timeoutExpired' },
                            ]);
                        }
                        //For SSO user need to get the fresh token and call prev api call using fresh token
                        if(sessionStorage.getItem('ssoToken') != null && err.error.apiReturnCode == '22018') {
                            let name = '';
                            if (sessionStorage.getItem('userEmail') != "\"\""
                                    && sessionStorage.getItem('userEmail') != null
                                    && typeof (sessionStorage.getItem('userEmail')) != 'undefined') {
                                    name = sessionStorage.getItem('userEmail');
                                }
                            if(name == ""){
                                name = sessionStorage.getItem('__api_name__');
                            }

                            let refresh_token_url;
                            if(sessionStorage.getItem("isLogingViaTeams") === "true"){
                                refresh_token_url = `mml/accounts/${name}/refresh_sso_token?api_token=${sessionStorage.getItem('__api_token__')}&refresh_token=${sessionStorage.getItem('refreshToken')}`;
                            } else {
                                refresh_token_url = `mml/accounts/${name}/refresh_sso_token?api_token=${sessionStorage.getItem('__api_token__')}&sso_access_token=${sessionStorage.getItem('ssoToken')}`;
                            }
                            //const headers = { 'request-meta': 'json/xml' };
                            const paramslg = JSON.parse(sessionStorage.getItem("login_params"));
                            const fullUrlt = this.processAndGetFullUrl(refresh_token_url)


                            const refresh_api_token_resp = this.fetchData(fullUrlt, "post", paramslg);

                            //console.log('refresh_token_data is', refresh_api_token_resp);

                            refresh_api_token_resp.then((data) => {
                                //console.log("Promise resolved with: ", data);
                                return this.callADKRtnResp(sessionStorage.getItem('prvUrl').replace(/&api_token=.*&ver=/, '&api_token=' + sessionStorage.getItem('__api_token__') + '&ver='), sessionStorage.getItem('prvType'), JSON.parse(sessionStorage.getItem('prvParams')), JSON.parse(sessionStorage.getItem('prvHeaders'))).toPromise();
                            }).catch((error) => {
                                console.log("Promise rejected with " + JSON.stringify(error));
                            });
                        }
                        // console.log("callADKRtnResp " + this.geoServer + "" + type + " ADK:: error caught in service")
                        // console.log(err);
                        if (this.doHandleHttpErr(err['status'], err['error']['apiReturnCode']) &&
                            (this.adk_address.length === 2)
                        ) {
                            console.log("callADKRtnResp " + this.geoServer + " " + type + " ADK::  Routing request to Secondary");
                            return this.callSecADKRtnResp(url, type, params, headers);
                        } else {
                            logger.error(err);
                            return of(err);
                        }
                    })
                );
        }
    } */

    public callADKRtnResp(url: string, type: string, params: any, headers: any): Observable<any> {
        this.geoServer = "primary"
        fullUrl = this.processAndGetFullUrl(url);
        logger.debug("HTTP req => ", fullUrl, params)
        sessionStorage.setItem('prvUrl', url);
        sessionStorage.setItem('prvType', type);
        sessionStorage.setItem('prvParams', JSON.stringify(params));
        sessionStorage.setItem('prvHeaders', JSON.stringify(headers));
        if (type === 'post') {
            if (fullUrl instanceof Array && fullUrl.length > 1) {
                let listResponse = null;
                let priorityindex = null;
                const requests = fullUrl.map(url => this.http.post<any>(url, params, {
                    observe: 'response',
                    headers: headers,
                }));

                return forkJoin(requests.map(request =>
                    request.pipe(
                    catchError(error => of({ success: false,error : error }))
                    ))
                ).pipe(
                    tap(responses => {
                        responses.forEach((response, index) => {
                            logger.debug("Base url is ",fullUrl[index]);
                            logger.debug("Login Response",response)
                            if(response["status"] && (response["status"] == 200 || response["status"] == "200") ){
                                if(priorityindex == null || (priorityindex && priorityindex >= index)){
                                    (window as any).MOVIUS_API_BASE_URL = this.adk_address[0][index];
                                    sessionStorage.setItem('baseUrl', this.adk_address[0][index]);
                                    listResponse = response
                                    priorityindex = index
                                }
                            }else{
                                logger.debug("Base url is not ",fullUrl[index])
                            }
                        });
                    }),map((res)=>{
                        console.log("Finalize")
                        if(listResponse){
                            if (url.includes("/login")) {
                                delete params['password'];
                                sessionStorage.setItem('login_params', JSON.stringify(params));
                            }
                            if (listResponse['error'] === undefined) {
                                if (url.includes('add_e911_subscriber')) {
                                    console.log("update E911");
                                    sessionStorage.setItem('_USER_E911_STATUS_', 'enabled_accepted');
                                }
                            } else if (url.includes('add_e911_subscriber') &&
                                !this.doHandleHttpErr(listResponse['status'], listResponse['error']['apiReturnCode'])) {
                                console.log("update E911");
                                sessionStorage.setItem('_USER_E911_STATUS_', 'enabled_accepted');
                            }
                            logger.debug("HTTP res =>", listResponse['url'], " Response :", listResponse['status'], " ", listResponse['statusText'])
                            return listResponse['body'];
                        }else{
                            let err;
                            err = res.filter((e) => e['error'].error.apiReturnCode != 25001)
                            logger.error("Error after filter = " + err);
                            if(err.length>0){
                                err = err[0]['error'] ? err[0]['error'] : err[0];
                            } else {
                                err = res[0]['error']
                            }
                            
                            
                            logger.debug("callADKRtnResp " + this.geoServer + " " + type + " ADK:: error caught in service")
                            logger.error("Final Error = " + err.error.apiReturnCode);
                            
                            if (err.error.apiReturnCode == 23502) {
                                this.router.navigate([
                                    '/auth/login',
                                    { info: err.error.message },
                                ]);
                                //return loginFails({ error: err.error.message });
                            } else if (err.error.apiReturnCode == 23701) {
                                this.router.navigate([
                                    '/auth/login',
                                    { info: "MultiLine Desktop is disabled for your Organization." },
                                ]);
                                //return loginFails({ error: err.error.message });
                            } else if (err.error.apiReturnCode == 13002) {
                                this.cookieService.delete("sso_response", "/", "moviuscorp.net", true, "None");
                                logger.debug("user logging out");
                                localStorage.removeItem('selectedGroup');
                                sessionStorage.clear();

                                this.router.navigate([
                                    '/auth/login',
                                    { info: 'timeoutExpired' },
                                ]);
                            }

                            if (sessionStorage.getItem('ssoToken') == null && err.error.apiReturnCode == '22018') {
                                this.router.navigate([
                                    '/auth/login',
                                    { info: 'timeoutExpired' },
                                ]);
                            }

                            //For SSO user need to get the fresh token and call prev api call using fresh token
                            if (sessionStorage.getItem('ssoToken') != null && err.error.apiReturnCode == '22018') {
                                let name = '';
                                if (sessionStorage.getItem('userEmail') != "\"\""
                                    && sessionStorage.getItem('userEmail') != null
                                    && typeof (sessionStorage.getItem('userEmail')) != 'undefined') {
                                    name = sessionStorage.getItem('userEmail');
                                }
                                if (name == "") {
                                    name = sessionStorage.getItem('__api_name__');
                                }

                                let refresh_token_url;
                                if (sessionStorage.getItem("isLogingViaTeams") === "true") {
                                    refresh_token_url = `mml/accounts/${name}/refresh_sso_token?api_token=${sessionStorage.getItem('__api_token__')}&refresh_token=${sessionStorage.getItem('refreshToken')}`;
                                } else {
                                    refresh_token_url = `mml/accounts/${name}/refresh_sso_token?api_token=${sessionStorage.getItem('__api_token__')}&sso_access_token=${sessionStorage.getItem('ssoToken')}`;
                                }
                                //const headers = { 'request-meta': 'json/xml' };
                                const paramslg = JSON.parse(sessionStorage.login_params);
                                const fullUrlt = this.processAndGetFullUrl(refresh_token_url)


                                const refresh_api_token_resp = this.fetchData(fullUrlt, "post", paramslg);

                                //console.log('refresh_token_data is', refresh_api_token_resp);

                                refresh_api_token_resp.then((data) => {
                                    //console.log("Promise resolved with: ", data);
                                    return this.callADKRtnResp(sessionStorage.getItem('prvUrl').replace(/&api_token=.*&ver=/, '&api_token=' + sessionStorage.getItem('__api_token__') + '&ver='), sessionStorage.getItem('prvType'), JSON.parse(sessionStorage.getItem('prvParams')), JSON.parse(sessionStorage.getItem('prvHeaders'))).toPromise();
                                }).catch((error) => {
                                    console.log("Promise rejected with " + JSON.stringify(error));
                                });
                            }

                            // console.log("callADKRtnResp " + this.geoServer + " " + type + " ADK:: error caught in service")
                            // console.log(err);
                            if (this.doHandleHttpErr(err['status'], err['error']['apiReturnCode']) &&
                                (this.adk_address.length === 2)
                            ) {
                                console.log("callADKRtnResp " + this.geoServer + "" + type + " ADK::  Routing request to Secondary");
                                return this.callSecADKRtnResp(url, type, params, headers);
                            } else {
                                logger.error(err)
                                if (url.includes("upload_mms")) {
                                    return of(err);
                                }
                                throw err;
                            }
                        }

                    })
                )
            }
            else {
                return this.http.post<any>(fullUrl, params, {
                    observe: 'response',
                    headers: headers,
                })
                    .pipe(
                        map((resp) => {
                            //console.log(resp);
                            if (url.includes("/login")) {
                                delete params['password'];
                                sessionStorage.setItem('login_params', JSON.stringify(params));
                            }
                            if (resp['error'] === undefined) {
                                if (url.includes('add_e911_subscriber')) {
                                    console.log("update E911");
                                    sessionStorage.setItem('_USER_E911_STATUS_', 'enabled_accepted');
                                }
                            } else if (url.includes('add_e911_subscriber') &&
                                !this.doHandleHttpErr(resp['status'], resp['error']['apiReturnCode'])) {
                                console.log("update E911");
                                sessionStorage.setItem('_USER_E911_STATUS_', 'enabled_accepted');
                            }
                            logger.debug("HTTP res =>", resp['url'], " Response :", resp['status'], " ", resp['statusText'])
                            return resp['body'];
                        }),
                        catchError((err) => {
                            //console.log(err);
                            logger.debug("callADKRtnResp " + this.geoServer + " " + type + " ADK:: error caught in service")
                            logger.error(err);

                            if(err.error.apiReturnCode == 23701) {
                                this.router.navigate([
                                    '/auth/login',
                                    { info: 'MultiLine Desktop is disabled for your Organization.' },
                                ]);
                            } else if(err.error.apiReturnCode == 23501 || err.error.apiReturnCode == 23502){
                                this.router.navigate([
                                    '/auth/login',
                                    { info: 'Account is suspended.' },
                                ]);
                            } else if (err.error.apiReturnCode == 13002) {
                                this.cookieService.delete("sso_response", "/", "moviuscorp.net", true, "None");
                                logger.debug("user logging out");
                                localStorage.removeItem('selectedGroup');
                                sessionStorage.clear();

                                this.router.navigate([
                                    '/auth/login',
                                    { info: 'timeoutExpired' },
                                ]);
                            }

                            if (sessionStorage.getItem('ssoToken') == null && err.error.apiReturnCode == '22018') {
                                this.router.navigate([
                                    '/auth/login',
                                    { info: 'timeoutExpired' },
                                ]);
                            }

                            //For SSO user need to get the fresh token and call prev api call using fresh token
                            if (sessionStorage.getItem('ssoToken') != null && err.error.apiReturnCode == '22018') {
                                let name = '';
                                if (sessionStorage.getItem('userEmail') != "\"\""
                                    && sessionStorage.getItem('userEmail') != null
                                    && typeof (sessionStorage.getItem('userEmail')) != 'undefined') {
                                    name = sessionStorage.getItem('userEmail');
                                }
                                if (name == "") {
                                    name = sessionStorage.getItem('__api_name__');
                                }

                                let refresh_token_url;
                                if (sessionStorage.getItem("isLogingViaTeams") === "true") {
                                    refresh_token_url = `mml/accounts/${name}/refresh_sso_token?api_token=${sessionStorage.getItem('__api_token__')}&refresh_token=${sessionStorage.getItem('refreshToken')}`;
                                } else {
                                    refresh_token_url = `mml/accounts/${name}/refresh_sso_token?api_token=${sessionStorage.getItem('__api_token__')}&sso_access_token=${sessionStorage.getItem('ssoToken')}`;
                                }
                                //const headers = { 'request-meta': 'json/xml' };
                                const paramslg = JSON.parse(sessionStorage.login_params);
                                const fullUrlt = this.processAndGetFullUrl(refresh_token_url)


                                const refresh_api_token_resp = this.fetchData(fullUrlt, "post", paramslg);

                                //console.log('refresh_token_data is', refresh_api_token_resp);

                                refresh_api_token_resp.then((data) => {
                                    //console.log("Promise resolved with: ", data);
                                    return this.callADKRtnResp(sessionStorage.getItem('prvUrl').replace(/&api_token=.*&ver=/, '&api_token=' + sessionStorage.getItem('__api_token__') + '&ver='), sessionStorage.getItem('prvType'), JSON.parse(sessionStorage.getItem('prvParams')), JSON.parse(sessionStorage.getItem('prvHeaders'))).toPromise();
                                }).catch((error) => {
                                    console.log("Promise rejected with " + JSON.stringify(error));
                                });
                            }

                            // console.log("callADKRtnResp " + this.geoServer + " " + type + " ADK:: error caught in service")
                            // console.log(err);
                            if (this.doHandleHttpErr(err['status'], err['error']['apiReturnCode']) &&
                                (this.adk_address.length === 2)
                            ) {
                                console.log("callADKRtnResp " + this.geoServer + "" + type + " ADK::  Routing request to Secondary");
                                return this.callSecADKRtnResp(url, type, params, headers);
                            } else {
                                logger.error(err)
                                if (url.includes("upload_mms")) {
                                    return of(err);
                                }
                                throw err;
                            }
                        })
                    );
            }

        } else {
            return this.http.get<any>(fullUrl, { observe: 'response', 'params': params, 'headers': headers })
                .pipe(
                    map((resp) => {
                        // console.log(this.geoServer + type + " ADK:: response: " + JSON.stringify(resp));
                        logger.debug("HTTP res =>", resp['url'], " Response :", resp['status'], " ", resp['statusText'])
                        if(fullUrl.includes("/get_user_info")){
                         let suspended = resp.body.root.sls_num_data.suspended
                         let suspend_web = resp.body.root.sls_num_data.suspend_web
                         console.log(suspended == true || suspend_web == true || suspended == "true" || suspend_web == "true")
                         if(suspended == true || suspend_web == true || suspended == "true" || suspend_web == "true"){
                            this.router.navigate([
                                '/auth/login',
                                { info: 'Account is suspended.' },
                            ]);
                            //return loginFails({ error: "Account is suspended." });
                            }
                            else if(resp.body.return == 25004){
                                this.router.navigate([
                                    '/auth/login',
                                    { info: 'The username or password you entered do not match.' },
                                ]);
                            }
                         }
                        return resp['body'];
                    }),
                    catchError((err) => {
                        logger.debug("callADKRtnResp " + this.geoServer + "" + type + " ADK:: error caught in service")
                        logger.error(err);

                        //For non sso user redirecting to the login page
                        if (sessionStorage.getItem('ssoToken') == null && err.error.apiReturnCode == '22018') {
                            this.router.navigate([
                                '/auth/login',
                                { info: 'timeoutExpired' },
                            ]);
                        } else if(err.error.apiReturnCode == '23701'){
                            this.router.navigate([
                                '/auth/login',
                                { info: 'MultiLine Desktop is disabled for your Organization.' },
                            ]);
                        } 
                        
                        //For SSO user need to get the fresh token and call prev api call using fresh token
                        if (sessionStorage.getItem('ssoToken') != null && err.error.apiReturnCode == '22018') {
                            let name = '';
                            if (sessionStorage.getItem('userEmail') != "\"\""
                                && sessionStorage.getItem('userEmail') != null
                                && typeof (sessionStorage.getItem('userEmail')) != 'undefined') {
                                name = sessionStorage.getItem('userEmail');
                            }
                            if (name == "") {
                                name = sessionStorage.getItem('__api_name__');
                            }

                            let refresh_token_url;
                            if (sessionStorage.getItem("isLogingViaTeams") === "true") {
                                refresh_token_url = `mml/accounts/${name}/refresh_sso_token?api_token=${sessionStorage.getItem('__api_token__')}&refresh_token=${sessionStorage.getItem('refreshToken')}`;
                            } else {
                                refresh_token_url = `mml/accounts/${name}/refresh_sso_token?api_token=${sessionStorage.getItem('__api_token__')}&sso_access_token=${sessionStorage.getItem('ssoToken')}`;
                            }
                            //const headers = { 'request-meta': 'json/xml' };
                            const paramslg = JSON.parse(sessionStorage.login_params);
                            const fullUrlt = this.processAndGetFullUrl(refresh_token_url)


                            const refresh_api_token_resp = this.fetchData(fullUrlt, "post", paramslg);

                            //console.log('refresh_token_data is', refresh_api_token_resp);

                            refresh_api_token_resp.then((data) => {
                                //console.log("Promise resolved with: ", data);
                                return this.callADKRtnResp(sessionStorage.getItem('prvUrl').replace(/&api_token=.*&ver=/, '&api_token=' + sessionStorage.getItem('__api_token__') + '&ver='), sessionStorage.getItem('prvType'), JSON.parse(sessionStorage.getItem('prvParams')), JSON.parse(sessionStorage.getItem('prvHeaders'))).toPromise();
                            }).catch((error) => {
                                console.log("Promise rejected with " + JSON.stringify(error));
                            });
                        }
                        // console.log("callADKRtnResp " + this.geoServer + "" + type + " ADK:: error caught in service")
                        // console.log(err);
                        if (this.doHandleHttpErr(err['status'], err['error']['apiReturnCode']) &&
                            (this.adk_address.length === 2)
                        ) {
                            console.log("callADKRtnResp " + this.geoServer + " " + type + " ADK::  Routing request to Secondary");
                            return this.callSecADKRtnResp(url, type, params, headers);
                        } else {
                            logger.error(err);
                            return of(err);
                        }
                    })
                );
        }
    }

    private async fetchData(fullUrlt, type, paramslg) {
        const data = await this.http.post<any>(fullUrlt, type, paramslg).toPromise();
        sessionStorage.setItem('__api_token__', encodeURIComponent(data['root'].api_token));
        sessionStorage.setItem('ssoToken', data['root'].sso_access_token);
        return data;
    }

    public callSecADKRtnResp(url: string, type: string, params: any, headers: any) {
        this.geoServer = "secondary"
        fullUrl = getFullUrl(this.adk_address[1]["secondary"], url);
        logger.debug("HTTP req => ", fullUrl, params)
        if (type === 'post') {
            return this.http.post<any>(fullUrl, params, {
                observe: 'response',
                headers: headers,
            })
                .pipe(
                    map((resp) => {
                        // console.log(this.geoServer + type + " ADK:: response: " + JSON.stringify(resp));
                        this.curAvailGeoAdkAddrs = this.adk_address[1]['secondary']
                        logger.debug("Primary ADK address [" + this.adk_address[1]['primary'] + "] is down")
                        logger.debug("Seconday ADK address [", this.curAvailGeoAdkAddrs, "] is considered as initial url further")
                        logger.debug("HTTP res =>", resp['url'], " Response :", resp['status'], " ", resp['statusText'])
                        return resp['body'];
                    }),
                    catchError((err) => {
                        logger.debug("callSecADKRtnResp " + this.geoServer + "" + type + " ADK:: error caught in service")
                        logger.error(err);
                        if(err.error.apiReturnCode == 23701) {
                            this.router.navigate([
                                '/auth/login',
                                { info: 'MultiLine Desktop is disabled for your Organization.' },
                            ]);
                        } else if(err.error.apiReturnCode == 23501 || err.error.apiReturnCode == 23502){
                            this.router.navigate([
                                '/auth/login',
                                { info: 'Account is suspended.' },
                            ]);
                        }
                        // console.log("callSecADKRtnResp " + this.geoServer + "" + type + " ADK:: error caught in service")
                        // console.log(err);
                        return of(err);
                    })
                );
        } else {
            return this.http.get<any>(fullUrl, { observe: 'response', 'params': params, 'headers': headers }).pipe(
                map((resp) => {
                    this.curAvailGeoAdkAddrs = this.adk_address[1]['secondary']
                    logger.debug("Primary ADK address [" + this.adk_address[1]['primary'] + "] is down")
                    logger.debug("Seconday ADK address [", this.curAvailGeoAdkAddrs, "] is considered as initial url further")
                    logger.debug("HTTP res =>", resp['url'], " Response :", resp['status'], " ", resp['statusText'])
                    // console.log(this.geoServer + type + " ADK:: response: " + JSON.stringify(resp));
                    return resp['body'];
                }),
                catchError((err) => {
                    logger.debug("callSecADKRtnResp " + this.geoServer + " " + type + " ADK:: error caught in service")
                    logger.error(err);
                    return of(err);
                })
            );
        }
    }


}
