import { Injectable } from '@angular/core';
// https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/encrypt
// GCM does provide built-in authentication, and for this reason it's often recommended over the other two AES modes.
import { assocPath, flatten, fromPairs, get } from 'lodash/fp';

export interface EncryptConfig {
    secretKey: ArrayBuffer;
    iv: ArrayBuffer;
}

const getKeysDeep = (
    prefix: string[],
    obj: any,
    type: 'encrypt' | 'decrypt'
): string[][] => {
    const ownKeys = Object.keys(obj)
        .filter((k) =>
            type === 'encrypt'
                ? typeof obj[k] === 'string'
                : obj[k] instanceof ArrayBuffer
        )
        .map((k) => [...prefix, k]);
    const childrenKeys = flatten(
        Object.keys(obj)
            .filter((k) => obj[k] && typeof obj[k] === 'object')
            .map((k) => getKeysDeep([...prefix, k], obj[k], type))
    );
    return [...ownKeys, ...childrenKeys];
};

@Injectable({ providedIn: 'root' })
export class EncryptService {
    private iv: ArrayBuffer;
    private secretKey: CryptoKey;

    async setConfig(config: EncryptConfig) {
        this.iv = config.iv;
        this.secretKey = await this.importSecretKey(config.secretKey);
    }

    private importSecretKey(rawKey: ArrayBuffer) {
        return window.crypto.subtle.importKey('raw', rawKey, 'AES-GCM', true, [
            'encrypt',
            'decrypt',
        ]);
    }

    async encrypt(str: string) {
        if (!str) {
            return null;
        }
        const enc = new TextEncoder();
        const encoded = enc.encode(str);
        const encrypted = await window.crypto.subtle.encrypt(
            {
                name: 'AES-GCM',
                iv: this.iv,
            },
            this.secretKey,
            encoded
        );
        return encrypted;
    }

    async decrypt(str: ArrayBuffer) {
        if (!str) {
            return null;
        }
        const decrypted = await window.crypto.subtle.decrypt(
            {
                name: 'AES-GCM',
                iv: this.iv,
            },
            this.secretKey,
            str
        );
        const dec = new TextDecoder();
        return dec.decode(decrypted);
    }

    async encryptObj<
        K,
        T extends { [key: string]: any } = { [key: string]: any }
    >(obj: T, keys: (keyof T)[] | '*'): Promise<K> {
        if (keys === '*') {
            keys = Object.keys(obj).filter((k) => typeof obj[k] === 'string');
        }
        const encryptedKeys = await Promise.all(
            keys.map((k) => this.encrypt(obj[k]).then((v) => [k, v]))
        );
        const encryptedObj = fromPairs(encryptedKeys);
        return ({ ...obj, ...encryptedObj } as unknown) as K;
    }

    async decryptObj<
        K,
        T extends { [key: string]: any } = { [key: string]: any }
    >(obj: T, keys: (keyof T)[] | '*'): Promise<K> {
        if (keys === '*') {
            keys = Object.keys(obj).filter(
                (k) => obj[k] instanceof ArrayBuffer
            );
        }
        const encryptedKeys = await Promise.all(
            keys.map((k) => this.decrypt(obj[k]).then((v) => [k, v]))
        );
        const decryptedObj = fromPairs(encryptedKeys);
        return ({ ...obj, ...decryptedObj } as unknown) as K;
    }

    async encryptObjDeep<
        K,
        T extends { [key: string]: any } = { [key: string]: any }
    >(obj: T): Promise<K> {
        const keys = getKeysDeep([], obj, 'encrypt');
        const encryptedPairs = await Promise.all(
            keys.map((k) => this.encrypt(get(k, obj)).then((v) => ({ k, v })))
        );
        const encryptedObj = encryptedPairs.reduce(
            (acc, { k, v }) => assocPath(k, v, acc),
            obj
        );
        return (encryptedObj as unknown) as K;
    }

    async decryptObjDeep<
        K,
        T extends { [key: string]: any } = { [key: string]: any }
    >(obj: T): Promise<K> {
        const keys = getKeysDeep([], obj, 'decrypt');
        const encryptedPairs = await Promise.all(
            keys.map((k) => this.decrypt(get(k, obj)).then((v) => ({ k, v })))
        );
        const encryptedObj = encryptedPairs.reduce(
            (acc, { k, v }) => assocPath(k, v, acc),
            obj
        );
        return (encryptedObj as unknown) as K;
    }
}
