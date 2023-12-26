import { AbstractControl, ValidatorFn } from '@angular/forms';

export const pxInRem = 16;

//#region Angular-specific regex
export const uiPhoneNumberFormatRegex = /^[\d\(\)\-\+]+$/;
//#endregion Angular-specific regex

//#region General-case regex
export const detectFormatGroupCharsRegex = /[\(\)\+\-]+/g;
export const detectSpaceRegex = /[\s]+/g;
export const detectPhonePlus = /[\+]+/g;
export const emailRegex = /(?:[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*|"(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21\x23-\x5b\x5d-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])*")@(?:(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?|\[(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?|[a-z0-9-]*[a-z0-9]:(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21-\x5a\x53-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])+)\])/;
export const repeatedEmailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*$/;
//#region General-case regex

export const regexMnemonics: { [rgx: string]: string } = {
    [uiPhoneNumberFormatRegex.toString()]: 'Only formatted phone numbers',
};

export const session_keys = [
"Contex_res",
"isLogingViaTeams",
"oidc",
"userEmail",
"authToken",
"teams_error_status",
"teams_error_desc",
"__api_identity__",
"__api_user_info__",
"reload_userinfo",
"reload_orgbrand",
"reload_device",
"ssoToken",
"refreshToken",
"__api_name__",
"__api_auth_org_id__",
"__api_token__",
"__api_auth_token__",
"__api_customer_support_email__",
"__api_customer_support_phone__",
"__primary_adk_url__",
"__secondary_adk_url__",
"baseUrl"
]

//#region Custom Validators
export const topLevelDomainEmailValidator = (
    srcPattern = emailRegex
): ValidatorFn => {
    return (control: AbstractControl): { [key: string]: any } | null => {
        if (!control.value) {
            return null;
        }
        const ok = srcPattern.test(control.value.toLowerCase());
	const secondEmailRegx = repeatedEmailRegex.test(control.value.toLowerCase());
        return !(ok && secondEmailRegx) ? { tldEmail: { value: control.value } } : null;
    };
};
//#endregion Custom Validators
