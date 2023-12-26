export interface NameExtras<T = string | ArrayBuffer> {
    title?: T;
    middleName?: T;
    suffix?: T;
    nickName?: T;
    yomiFirstName?: T;
    yomiLastName?: T;
}

export interface ContactWork<T = string | ArrayBuffer> {
    company?: T;
    jobTitle?: T;
    yomiCompany?: T;
}

export interface ContactOther<T = string | ArrayBuffer> {
    personalWebPage?: T;
    significantOther?: T;
    birthday?: T;
}

export type ContactAddressType =
    | 'BusinessAddress'
    | 'HomeAddress'
    | 'OtherAddress';

export interface ContactAddressBase<T = string | ArrayBuffer> {
    street: T;
    street2: T;
    city: T;
    postal: T;
    state: T;
    country: T;
    type?: T;
}

export type ContactAddress = ContactAddressBase<string>;

export interface ContactBase<T = string | ArrayBuffer> {
    id?: number;
    type: 'personal' | 'organization' | 'Line' | 'WeChat';
    img?: T;
    firstName: T;
    lastName: T;
    nameExtras?: NameExtras<T>;
    work?: ContactWork<T>;
    other?: ContactOther<T>;
    phones: { type: T; phone: T; orgPhone: T }[];
    emails: { type: T; email: T }[];
    addresses?: ContactAddressBase<T>[];
    msGraphId?: T;
    chat?: string;
    note?: string;
    isWhatsAppContact?:boolean;
}

export type Contact = ContactBase<string>;

export type NewContact = Omit<Contact, 'id'>;

export type ContactEncrypted = ContactBase<ArrayBuffer>;
