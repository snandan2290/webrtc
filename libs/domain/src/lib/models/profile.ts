export interface ProfileBase<T = 'string' | ArrayBuffer> {
    mlnumber: T;
    email: T;
}

export type Profile = ProfileBase<string>;

export type ProfileEncrypted = ProfileBase<ArrayBuffer>;

/*
export interface ProfileWithEncrypt extends ProfileBase<ArrayBuffer> {
    encryptIv: ArrayBuffer;
    // TODO : Temporary
    encryptSecretKey: ArrayBuffer;
}
*/
