// Generated by https://quicktype.io

export interface LoginResponseDTO {
    root: LoginRoot;
}

export interface LoginRoot {
    teams_sso_token: string;
    teams_refresh_token: string;
    orgid: string;
    sms_only: string;
    e911_support_enable: string;
    branding: Branding;
    api_token: string;
    root: RootDetails;
    user_state: string;
    return: string;
    desc: string;
    identity?: string;
    customer_care_phone?: string;
    customer_care_email?: string;
    new_web_signin: string;
}

export interface Branding {
    operator_icon: string;
    header_footer_color: string;
    text_color: string;
    about_us_image: string;
    about_us_color: string;
    onboarding: Onboarding;
    customer_care_phone: string;
    customer_care_email: string;
    device_level_contact_name: string;
    twitter_link: string;
    linkedin_link: string;
    facebook_link: string;
    youtube_link: string;
    dialer_color: string;
    minimum_client_version: string;
    allowed_application_names: string;
}

export interface RootDetails {
    operator_icon: string;
    header_footer_color: string;
    text_color: string;
    about_us_image: string;
    about_us_color: string;
    onboarding: Onboarding;
    customer_care_phone: string;
    customer_care_email: string;
    device_level_contact_name: string;
    twitter_link: string;
    linkedin_link: string;
    facebook_link: string;
    youtube_link: string;
    dialer_color: string;
    minimum_client_version: string;
    allowed_application_names: string;
}

export interface Onboarding {
    language: Language;
}

export interface Language {
    SignUp: EnterSecurityPin;
    EnterSecurityPin: EnterSecurityPin;
    HaveNotRecievedPin: HaveNotRecievedPin;
    SetupMyIDs: EnterSecurityPin;
    CustomizeNumber: CustomizeNumber;
    _value: string;
}

export interface CustomizeNumber {
    title: string;
}

export interface EnterSecurityPin {
    title: string;
    body: string;
}

export interface HaveNotRecievedPin {
    body: string;
}
