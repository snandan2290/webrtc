import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { GeoHttpService } from '../../shared/services/geo-http.service';

@Injectable()
export class ResetPasswordDataAccessService {

    public passwordInvalid:boolean = false;

    constructor(private readonly http: HttpClient,
        private readonly geoHttpService: GeoHttpService) { }

    triggerResetPassword(email: string) {
        const url = `mml/accounts/${email}/trigger_password_otp`;
        // return this.http.get(url, {});
        return this.geoHttpService.callADK(url, "get", null, null);
    }

    updatePassword(email: string, password: string, otp: string) {
        const url = `mml/accounts/${email}/modify_password`;
        // return this.http.get(url, {
        //     params: {
        //         new_password: password,
        //         user_otp: otp,
        //     },
        // });
        const params = {
            new_password: password,
            user_otp: otp,
        }
        return this.geoHttpService.callADK(url, "get", params, null);
    }

    resendPin(email: string, apiToken: string, orgId: string) {
        const url = `mml/accounts/${email}/resend_otp?api_token=${apiToken}&Orgid=${orgId} `;
        // return this.http.get(url);
        return this.geoHttpService.callADK(url, "get", null, null);
    }

    verifyPin(name: string, otp: string, apiToken: string) {
        const url = `mml/accounts/${name}/verifypin?user_otp=${otp}${
            apiToken ? `&api_token=${apiToken}` : ''
        }`;
        // return this.http.get(url);
        return this.geoHttpService.callADK(url, "get", null, null);
    }
}
