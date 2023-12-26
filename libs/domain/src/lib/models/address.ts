export interface AddressBase<T = string | ArrayBuffer> {
    firstName?: T;
    lastName?: T;
    street?: T;
    street2?: T;
    city?: T;
    postal?: T;
    state?: T;
    country?: T;
    // hno
    houseNumber?: string;
    // hns
    houseNumberSuffix?: string;
}

export type Address = AddressBase<string>;

export type AddressEncrypted = AddressBase<ArrayBuffer>;
