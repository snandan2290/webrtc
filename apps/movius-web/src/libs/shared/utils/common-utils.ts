//CB: 21Jan2020: TECH-DEBT: Extract constants to related constants.ts file.
import { Contact, ContactAddress } from '@movius/domain';
import { Inject, InjectionToken, Injectable } from '@angular/core';
import * as lpn from 'google-libphonenumber';
import {
    Address,
    DbContext,
    detectFormatGroupCharsRegex,
    detectSpaceRegex,
} from '../../shared';
import { detectPhonePlus } from './constants';
import { addMinutes, addSeconds, format } from 'date-fns';
import { validate as uuidValidate } from "uuid";
import { LoggerFactory } from '@movius/ts-logger';
import { Country } from '../components/country-selector/model/country.model';
import { CountryCode } from '../components/country-selector/model/country-code';
import { isEmpty } from 'lodash/fp';



@Injectable()
export class CountryCodeData implements CountryCode {
    static allCountries: any;
    constructor(
    ) {}
    public allCountries: ((string | number | string[])[] | (string | number | number[])[])[];

}


const logger = LoggerFactory.getLogger("")
//#region Types

export type FormModel<T> = { [P in keyof T]: [T[P], any?] };

//#endregion Types

//#region Formatting

export const getContactCallTitle = (peer: any) => {
    //TODO: CB:11Mar2021: TECH - Type should be UserContactGhost, but it will lead to ext dependency.
    //TODO: CB:11Mar2021: TECH - Consider move/extract dependency.
    if (!peer) return '';
    //console.warn('contact' in peer, {src: peer, error: 'Not UserContact or UserContactGhost is passed'});
    return !!peer?.contact
        ? getContactFriendlyName(peer.contact as Contact)
        : peer.name ?? addPulsToMultilineNumber(peer?.multiLine);
};

export const getContactRealNumber = (peer: any) => {
    if (!peer) return '';
    let realnumber = '';
    peer?.contact?.phones?.forEach(element => {
        if (element['phone'] == peer?.multiLine?.replace('whatsapp:', '')) {
            return realnumber = peer?.contact?.isWhatsAppContact == true ? element['orgPhone'] : element['orgPhone']?.replace('+', '');
        }
    });
    return (realnumber && realnumber != "") ? addPulsToMultilineNumber(realnumber) : realnumber;
};

export const getContactCallSubTitle = (peer: any) => {
    //TODO: CB:11Mar2021: TECH - Type should be UserContactGhost, but it will lead to ext dependency.
    //TODO: CB:11Mar2021: TECH - Consider move/extract dependency.
    if (!peer) return '';
    //console.warn('contact' in peer, {src: peer, error: 'Not UserContact or UserContactGhost is passed'});
    return !!peer?.contact ? peer?.multiLine : null;
};

export const getContactCallTitleAndSubtitle = (peer: any, isAnon: boolean = false): string[] => {
    if (isAnon) {
        return ['Anonymous', ''];
    }

    if (!peer) return ['', ''];

    return !!peer?.contact
        ? [getContactCallTitle(peer), formatPhoneToInternational(getContactCallSubTitle(peer))]
        : [peer.name ?? formatPhoneToInternational(peer?.multiLine), ''];
}

export const getContactFriendlyName = (contact: Contact) => {
    if (!contact) return '';
    return contact.firstName || contact.lastName
        ? [
            contact?.nameExtras?.title,
            contact.firstName,
            contact?.nameExtras?.middleName,
            contact.lastName,
            contact?.nameExtras?.suffix,
            contact?.nameExtras?.yomiFirstName ||
                contact?.nameExtras?.yomiLastName
                ? `\n(${[
                    contact?.nameExtras?.yomiFirstName,
                    contact?.nameExtras?.yomiLastName,
                ]
                    .filter((e) => !!e)
                    .join(' ')})`
                : null,
        ]
            .filter((e) => !!e)
            .join(' ')
        : addPulsToMultilineNumber(contact.phones[0]?.phone) || 'Unknown';
};

export const getPeerNumberWOSpecialChars = (number: string) => {
    //this will remove all the special characters and gives only numbers
    if (number?.length > 0) {
        return number.replace(/\D/g, "");
    }
}

export const sortParticipantsAsID = (parties: any) => {
    let sortParticipants = [];
    sortParticipants = parties.sort((a, b) => 0 - (a > b ? -1 : 1));
    let allNumbers = "";

    for (let i = 0; i < sortParticipants.length; i++) {
        if (i === 0) {
            allNumbers = sortParticipants[i];
        } else {
            allNumbers = allNumbers + sortParticipants[i];
        }
    }
    return allNumbers;
}

export const getContactGhostFriendlyName = (ghost: any) => {
    //TODO: CB:30Apr2021: TECH - Type should be UserContactGhost, but it will lead to ext dependency.
    //TODO: CB:30Apr2021: TECH - Consider move/extract dependency.
    //TODO: CB:30Apr2021: TECH - Use shared method with user-defined-type-guards for User, UserContact, UserContactGhost correct handling of name and address.
    if (!ghost) return '';
    //console.warn('contact' in ghost, {src: ghost, error: 'Not UserContactGhost is passed'});
    const contact: Contact = ghost.contact as Contact;
    if (contact) {
        return getContactFriendlyName(contact);
    } else {
        return ghost ? addPulsToMultilineNumber(ghost.multiLine) : '';
    }
};

export const getContactFriendlyAddress = (contact: Contact) => {
    if (!contact) return 'Unknown';
    return contact.emails && contact.emails[0]?.email;
};

export const getContactFriendlyPhone = (contact: Contact) => {
    if (!contact) return '';
    return contact.phones && contact.phones[0]?.phone;
};

export const getContactAddressString = (addr: ContactAddress) =>
    addr
        ? [addr.postal, addr.street, addr.street2, addr.state, addr.country]
            .filter((f) => !!f)
            .join(' ')
        : null;

export const getAddressString = (addr: Address) =>
    addr
        ? [
            addr.houseNumber,
            addr.houseNumberSuffix,
            addr.street,
            addr.street2,
            addr.city,
            addr.state,
            addr.postal,
            addr.country,
        ]
            .filter((f) => !!f)
            .join(' ')
        : null;

const splitStreetAddress = (street: string) => {
    if (!street) {
        return { street };
    }
    const parts = street.split(' ');
    const house = parts[0];
    const m = /^(\d+)-?([\D]*)$/;
    const r = m.exec(house);
    if (r && r.length > 0) {
        return {
            houseNumber: r[1],
            houseNumberSuffix: r[2],
            street: parts.slice(1).join(' '),
        };
    } else {
        return { street };
    }
};

export const convertContactAddressToAddress = (
    formAddress: Omit<ContactAddress, 'type'>
): Address => {
    const streetAddress = splitStreetAddress(formAddress.street);
    return {
        street: streetAddress.street,
        houseNumber: streetAddress.houseNumber,
        houseNumberSuffix: streetAddress.houseNumberSuffix,
        street2: formAddress.street2,
        city: formAddress.city,
        postal: formAddress.postal,
        state: formAddress.state,
        country: formAddress.country,
    };
};

export const convertAddressToContactAddress = (
    address: Address
): ContactAddress => {
    const streetStr = [
        [address.houseNumber, address.houseNumberSuffix]
            .filter((f) => !!f)
            .join(''),
        address.street,
    ]
        .filter((f) => !!f)
        .join(' ');

    return {
        street: streetStr,
        street2: address.street2,
        city: address.city,
        postal: address.postal,
        state: address.state,
        country: address.country,
    };
};

export const withHttp = (url) =>
    !/^https?:\/\//i.test(url) ? `http://${url}` : url;

export const getTimeFromTimer = (timeInSec: number) => {
    const helperDate = addSeconds(new Date(0), timeInSec);
    const dt = addMinutes(helperDate, helperDate.getTimezoneOffset());
    return format(dt, 'HH : mm : ss');
};

export const getHours = (timeInSec: number) => {
    return ('0' + Math.floor(timeInSec / 60 / 60)).slice(-2);
};

export const getMinutes = (timeInSec: number) => {
    return ('0' + Math.floor((timeInSec % (60 * 60)) / 60)).slice(-2);
};

export const getSeconds = (timeInSec: number) => {
    return ('0' + Math.floor(timeInSec % 60)).slice(-2);
};

export const noFormatGroupChars = (str: string) =>
    str && str.replace(detectFormatGroupCharsRegex, '').toLowerCase();
export const noSpace = (str: string) =>
    str && str.replace(detectSpaceRegex, '').toLowerCase();
export const noPhonePlus = (str: string) =>
    str && str.replace(detectPhonePlus, '').toLowerCase();
export const cleanPhoneNumber = (str: string) =>
    noSpace(noFormatGroupChars(str));

export const toSpacedCamelCase = (str: string) => {
    return !!str ? str.replace(/([a-z](?=[A-Z]))/g, '$1 ') : str;
};
export const capitalizeFirstLetter = (str: string) => {
    return !!str ? str.charAt(0).toUpperCase() + str.slice(1) : str;
};

export const convertPhoneToSpecificFormat = (srcNumber: string, format) => {
    let util = lpn.PhoneNumberUtil.getInstance();
    let parsed = util.parse(srcNumber, 'US');
    let intFormat = format;
    let res = util.format(parsed, intFormat);
    return res;
};

export const formatPhoneToInternational = (srcNumber: string) => {
    if(sessionStorage.getItem('invalidNum') == srcNumber){
        return srcNumber;
    }
    let withPlus = srcNumber;
    if (!withPlus.startsWith('+')) {
        withPlus = '+' + srcNumber;
    }
    //const noPlus = srcNumber.replace('+', '');
    // if (!noPlus.startsWith('1')) {
    //     return srcNumber;
    // }
    let util = lpn.PhoneNumberUtil.getInstance();
    if(isEmpty(util.regionToMetadataMap)){
        sessionStorage.setItem('invalidNum', srcNumber);
        return srcNumber;
    }
    let parsed = util.parse(withPlus, '');
    let intFormat = lpn.PhoneNumberFormat.INTERNATIONAL;
    let res = util.format(parsed, intFormat)?.toString();
    return res?.replace(/\+|\s|-/g, '').startsWith(srcNumber) ? res : srcNumber;
};

export const formatPhoneToNational = (srcNumber: string) => {
    let withPlus = srcNumber;
    if (!withPlus.startsWith('+')) {
        withPlus = '+' + srcNumber;
    }
    // const noPlus = srcNumber.replace('+', '');
    // if (!noPlus.startsWith('1')) {
    //     return srcNumber;
    // }
    let util = lpn.PhoneNumberUtil.getInstance();
    let parsed = util.parse(withPlus, '');
    let intFormat = lpn.PhoneNumberFormat.NATIONAL;

    let code = parsed.getCountryCode();
    let national = util.format(parsed, intFormat)?.replace('-', ' ') as string;
    let res = national.startsWith('\(') ? `+${code} ${national}` : national;
    return !!code && !!national ? res : srcNumber;
};

export const formatPhoneToNationalPasswordPage = (srcNumber: string) => {
    let withPlus = srcNumber.toString();
    if (!withPlus.startsWith('+')) {
        withPlus = '+' + srcNumber;
    }
    // const noPlus = srcNumber.replace('+', '');
    // if (!noPlus.startsWith('1')) {
    //     return srcNumber;
    // }
    let util = lpn.PhoneNumberUtil.getInstance();
    if(isEmpty(util.regionToMetadataMap)){
        return srcNumber;
    }
    let parsed = util.parse(withPlus, '');
    let intFormat = lpn.PhoneNumberFormat.NATIONAL;

    let code = parsed.getCountryCode();
    let national = util.format(parsed, intFormat)?.replace('-', ' ') as string;
    let res = national.startsWith('\(') ? `+${code} ${national}` : phoneFormatted(parsed, intFormat, code);
    return !!code && !!national ? res : srcNumber;
};

export const phoneFormatted = (parsed, intFormat, code) => {
    let resultValue: any = [];
    let splittedvalue = parsed.values_[2].toString().split('');
    splittedvalue.forEach((each, i) => {
        if (i === 0) {
            resultValue.push('(' + each);
        } else if (i === intFormat) {
            resultValue.push(each + ')');
        } else {
            resultValue.push(each);
        }
    });
    return "+" + code + resultValue.join('');
};

//#endregion Formatting

//#region Device
export const isMacintosh = () => {
    return navigator.platform.indexOf('Mac') > -1;
};

export const isWindows = () => {
    return navigator.platform.indexOf('Win') > -1;
};

export const getScreenPixelRatio = () => {
    return window?.devicePixelRatio;
};

export const isHighZoomedScreen = () => {
    return (
        isWindows() /*&& (window?.screen?.width / window?.screen?.height) > 1.75*/ &&
        getScreenPixelRatio() > 1.4
    );
};

export const isEmergencyNumber = (phone: any) => {
    if ([',', ';', '#'].some((char) => phone.includes(char))) {
        return true;
    } else if (phone === '911') {
        return true;
    }
    return false;
}

export const allowedSpecialCharacters = (arrayValue: any, compareArray: any) => {
    let resultValue: boolean;
    let splittedValue: any
    //allow whatsapp number
    if (arrayValue?.includes('whatsapp:')) {
        return false
    }
    if (arrayValue !== undefined && arrayValue !== null && arrayValue.length > 0) {
        splittedValue = arrayValue.split('');
        for (let i = 0; i < splittedValue.length; i++) {
            if (compareArray.indexOf(splittedValue[i]) !== -1) {
                resultValue = false;
            } else {
                resultValue = true;
                break;
            }
        }
        return resultValue;
    }

}

export const getALLCountryCode = () => {
    const phoneUtil = lpn.PhoneNumberUtil.getInstance();
    const countryISOCode = phoneUtil.getSupportedRegions()
    let countryCodeList = []
    for (let i = 0; i < countryISOCode.length; i++) {
        let countryCode = phoneUtil.getCountryCodeForRegion(countryISOCode[i])
        countryCodeList.push(countryCode.toString())
    }
    return countryCodeList
}

export const checkCCodeInNumber = (noSpecialCharNumber) => {
    let result = { "isCCFound": false, "CountryCode": "" }
    const phoneUtil = lpn.PhoneNumberUtil.getInstance();
    let number;
    let noSpecialCharNumberTemp = noSpecialCharNumber
    let numLength = noSpecialCharNumber.length
    if (!noSpecialCharNumber.startsWith("+"))
        noSpecialCharNumber = "+" + noSpecialCharNumber
    try {
        number = phoneUtil.parse(noSpecialCharNumber, "");
    } catch (e) { }
    if (number) {
        result['isCCFound'] = true
        result['CountryCode'] = number.getCountryCode().toString()
        return result
    } else {
        let cCode = getALLCountryCode()
        for (let i = 0; i < numLength; i++) {
            noSpecialCharNumberTemp = noSpecialCharNumberTemp.substring(0, numLength - i)
            const ccList = cCode.filter(cc => cc.startsWith(noSpecialCharNumberTemp))
            if (ccList.length === 0) {
                continue
            } else {
                result['isCCFound'] = true
                result['CountryCode'] = noSpecialCharNumberTemp
                return result
            }
        }
    }
    return result
}
//#endregion Device

export const getGeoUrl = () => {
    if (sessionStorage.getItem("__primary_adk_url__") === null &&
        sessionStorage.getItem("__secondary_adk_url__") !== null) {
        return sessionStorage.getItem("__secondary_adk_url__")
    } else if (sessionStorage.getItem("__primary_adk_url__") !== null &&
        sessionStorage.getItem("__secondary_adk_url__") === null) {
        return sessionStorage.getItem("__primary_adk_url__")
    } else if (sessionStorage.getItem("__primary_adk_url__") !== null &&
        sessionStorage.getItem("__secondary_adk_url__") !== null) {
        return {
            primary_adk_url: sessionStorage.getItem("__primary_adk_url__"),
            secondary_adk_url: sessionStorage.getItem("__secondary_adk_url__")
        }
    } else {
        return null
    }
}

export const setgeoUrl = (params: string[] | null) => {
    if (params !== null) {
        if (params[0]) {
            sessionStorage.setItem("__primary_adk_url__", params[0]);
            if (params[1])
                sessionStorage.setItem("__secondary_adk_url__", params[1]);
        }
        else if (params[1])
            sessionStorage.setItem("__primary_adk_url__", params[1]);
    } else {
        sessionStorage.removeItem('__primary_adk_url__');
        sessionStorage.removeItem('__secondary_adk_url__');
    }
}

export const convertDataURIToBinary = (dataURI) => {
    let BASE64_MARKER = ';base64,';
    let base64Index = dataURI.indexOf(BASE64_MARKER) + BASE64_MARKER.length;
    let base64 = dataURI.substring(base64Index);
    let raw = window.atob(base64);
    let rawLength = raw.length;
    let array = new Uint8Array(new ArrayBuffer(rawLength));

    for (let i = 0; i < rawLength; i++) {
        array[i] = raw.charCodeAt(i);
    }
    return array;
}

export const convertBinaryToBlob = (dataResponse, fileType, isFullBlob?) => {
    let binaryDataResponse;
    if (isFullBlob) {
        binaryDataResponse = dataResponse
    } else {
        binaryDataResponse = `data:${fileType};base64,` + dataResponse
    }

    const binary = convertDataURIToBinary(binaryDataResponse);
    const blob = new Blob([binary], { type: fileType });
    return blob;
}

export const convertFileToBlob = (file) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
    });
}

export const blobToBase64 = (blob) => {
    return new Promise((resolve, _) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.readAsDataURL(blob);
    });
}

export const base64toFile = (dataurl, filename) => {
    var arr = dataurl.split(','),
        mime = arr[0].match(/:(.*?);/)[1],
        bstr = atob(arr[1]),
        n = bstr.length,
        u8arr = new Uint8Array(n);
    while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
    }
    let ext = mime.split('/')[1];
    const filenameWithExt = filename + '.' + ext;
    return new File([u8arr], filenameWithExt, { type: mime });
}

export function checkIfIsWhatsAppThread(messages) {
    return messages.length ? messages.some((message) => message.fromNumber.includes('whatsapp') || message.peerId?.includes('whatsapp')) : false;
}

export function checkIfIsWhatsOptInReqAccepted(messages) {
    return messages.length ? messages.some((message) => message.stype === 25) : false;
}

export function getLastInCommingMsgTime(messages, peerId: string) {
    const lastInCommingMessageDt = null;
    if (messages.length) {
        const lastInCommingMessage = messages.find(msg => msg.isSystem === false && msg.fromNumber === peerId)
        return lastInCommingMessage ? lastInCommingMessage.sentTime : null
    }
    return lastInCommingMessageDt;
}


// 120000 , 86400000 
export function isTimeCrossed(date, miliseconds = window['MOVIUS_WHATSAPP_TIME_THRESHOLD']) {
    if (date) {
        const lastMessageDateMilliseconds = new Date(date.toString().replace('ZZ', 'Z')).getTime();
        //console.log('Last Message Date' + new Date(date))
        const actualTimeMilliseconds = new Date().getTime()
        //console.log('Current Date' + new Date())
        if (actualTimeMilliseconds - lastMessageDateMilliseconds > miliseconds) {
            return true;
        }
    }
    return false;
}




export function covertToTimeZoneDate(date) {
    if (date) {
        var datearr = date.toString().split(' ');
        if (datearr.length) {
            return datearr.join('T') + 'Z';
            // console.log('date',d)
            // console.log('date str',new Date(d).toString())
        }
    }

    return date;
}

export function isTimeCrossedForSendingMessage(date, sipmsgtime, miliseconds = window['MOVIUS_SIP_CNT_CHK_INTERVAL']) {
    if (date) {
        const pendingMsgMilliseconds = new Date(date.toString().replace('ZZ', 'Z')).getTime();
        const sipMsgTimeMilliseconds = new Date(sipmsgtime.toString().replace('ZZ', 'Z')).getTime();
        if (sipMsgTimeMilliseconds - pendingMsgMilliseconds < miliseconds) {
            return true;
        }
    }
    return false;
}


export function getValidPeerId (peerId) {
    if (peerId) {
        const getPeerId = peerId.includes("|") ? sortParticipantsAsID(peerId.split('|')) : peerId.includes(",") ? sortParticipantsAsID(peerId.split(',')) : peerId;
        return getPeerId
    }
}

export function getValidParticipantsArray(arrayList) {
    if (arrayList) {
        const getParticipants = arrayList.includes("|") ? arrayList.split('|') : arrayList.includes(",") ? arrayList.split(',') : [arrayList];
        return getParticipants
    }
}
export function addPulsToMultilineNumber(number) {
    if (number) {
        number = number.includes('+') ? number.replace('+','') : number
        if (chkOnlyAlphabets(number)) {
            return number
        } else if (getChannelTypeForLineWechatDetails(number) == 'Line' || getChannelTypeForLineWechatDetails(number) == 'WeChat') {
            return number;
        } else {
            return `+${number}`
        }
    }
}

export function getFeatureEnabled() {
    if (window['MOVIUS_EMBEDED_APP'] === 'messaging' || sessionStorage.getItem("isLogingViaTeams") == "true") {
        return 'messaging'
    } else {
        return 'mldt'
    }
}

export function getMessageChannelType(messageType: string, number: string, threadId?: string) {
    console.log('Passed from number is', number);
    if (messageType == 'whatsapp') {
        if (number.startsWith('100')) {
            return 'WeChat';
        } else if (number.startsWith('101')) {
            return 'Line';
        } else {
            return 'whatsapp';
        }
    } else {
        return 'normalMsg';
    }



    // if (number.startsWith('100')) {
    //     return 'WeChat'
    // } else if (number.startsWith('101')) {
    //     return 'Line'
    // } else if(messageType == 'whatsapp') {
    //     return 'whatsapp'
    // } else {
    //     return 'normalMsg'
    // }


}

export function getMsgChannelTypeFromParticipants(participants: any, channelType?: string) {
    if (channelType) {
        return channelType;
    }
    if (participants) {
        if (participants?.find((peer) => peer?.startsWith('whatsapp'))) {
            if (participants?.find((peer) => peer?.startsWith('whatsapp:100'))){
                return 'WeChat'
            } else if (participants?.find((peer) => peer?.startsWith('whatsapp:101'))) {
                return 'Line'
            } else {
                return 'whatsapp'
            }
        } else {
            return 'normalMsg'
        }
    }   
}


export function getMsgChannelTypeForSingleParticipant(participant) {
    if (participant.startsWith('whatsapp')) {
        if (participant.startsWith('whatsapp:100')) {
            return 'WeChat'
        } else if (participant.startsWith('whatsapp:101')) {
            return 'Line'
        } else {
            return 'whatsapp'
        }
    } else {
        return 'normalMsg'
    }
}

export function getChannelTypeForLineWechatDetails(participant) {
    if (participant) {
        if (participant.startsWith('100') || participant.startsWith('+100') || participant.startsWith('whatsapp:100') || participant.startsWith('whatsapp:+100')) {
            return 'WeChat'
        } else if (participant.startsWith('101') || participant.startsWith('+101') || participant.startsWith('whatsapp:101') || participant.startsWith('whatsapp:+101')) {
            return 'Line'
        } else {
            return 'whatsapp'
        }
    }
}


export function isUserLeftGroup(participants: any) {
    const apiUserIdentity = sessionStorage.getItem('__api_identity__');
    if (participants) {
        if (participants?.find(peer => peer == apiUserIdentity)) {
            return false;
        } else {
            return true;
        }   
    }
}

export function chkonlydigits(val) {
    const onlyNumbersRegex = /^[0-9]+$/;
    if (val) {
        if (val.match(onlyNumbersRegex)) {
            return true
        } else {
            return false
        }
    }
}

export function chkOnlyAlphabets (val) {
    if (val) {
        const isChkOnlyAlphabets = /^[A-Z][a-z]+/;
        if (val.match(isChkOnlyAlphabets)) {
            return true;
        } else {
            return false;
        }
    }
}

export function getPeerIdFromThreadId(peerId, hash) {
    if (peerId) {
        if (uuidValidate(peerId)) {
            return hash[peerId]?.participants?.join('')
        } else {
            return getValidPeerId(peerId)
        }
    }
}

export function getPeerIdFromThreadIdUpdateParticipant(participants) {
    if (participants) {
        return participants?.join('')
    }
}


export function getValidOptinSatus(isWhatsappThread, channelType) {
    if (isWhatsappThread) {
        if (channelType == 'Line' || channelType == 'WeChat') {
            return '3'
        } else {
            return '2'
        }
    }
}

export function getValidSipId(participants) {
    if (participants) {
        const isWhatsappUser = participants.some((f) => f.includes('whatsapp'))
        const getWhatsappUser = participants.find(item => item.includes('whatsapp'))
        if (isWhatsappUser) {
            participants = participants.filter(item => item !== getWhatsappUser);
            participants.unshift(getWhatsappUser);
            return participants
        } else {
            return participants
        }
    }
}

export function getValidXCafeParticipants(participants:string) {
    if (participants) {
        return participants.includes('"') ? JSON.parse(participants) : participants
    }
}
export function getBaseUrl () {
    if(window['MOVIUS_BASE_URL'])
        return window['MOVIUS_BASE_URL']
    else
        if(document && document.baseURI)
            return document.baseURI+'index.html'
        else
            return '/index.html'
}


export function getInternationalNumber(phone: string, reqCntCodeChk?: boolean): string {
    const phoneUtil = lpn.PhoneNumberUtil.getInstance();
    if(reqCntCodeChk) {
        if (!phone.includes('+')) {
            let lclCntCodePrefixedphone = sessionStorage.getItem('loggedInuserCntCode').replace('+', '') + phone;
            let number: any;
            try{
                number = phoneUtil.parse('+' + lclCntCodePrefixedphone, "");
                if (!phoneUtil.isPossibleNumber(number) && !phoneUtil.isValidNumber(number)) {
                    phone = phone;
                } else {
                    phone = sessionStorage.getItem('loggedInuserCntCode').replace('+', '') + phone;
                }
            }catch{
                phone = phone;
            }        
        } else {
            phone = phone
        }

    }
    //console.log('final phn val', phone);
    try {
        let number = phoneUtil.parse('+' + phone, "");
        let internationalNumber = phoneUtil.format(number, lpn.PhoneNumberFormat.INTERNATIONAL);
        if (!phoneUtil.isPossibleNumber(number)) {
            let validNumber = phoneUtil.parse(sessionStorage.getItem('loggedInuserCntCode') + phone, sessionStorage.getItem('loggedInuserCntName'));
            internationalNumber = phoneUtil.format(validNumber, lpn.PhoneNumberFormat.INTERNATIONAL);
            //this.dbContext.contact.updateContactForNumberFormat(phone, internationalNumber);
        } else {
            if (!phoneUtil.isValidNumber(number)) {
                let validNumber = phoneUtil.parse(sessionStorage.getItem('loggedInuserCntCode') + phone, sessionStorage.getItem('loggedInuserCntName'));
                internationalNumber = phoneUtil.format(validNumber, lpn.PhoneNumberFormat.INTERNATIONAL);
                //this.dbContext.contact.updateContactForNumberFormat(phone, internationalNumber);
            }
        }

        if (internationalNumber != null) {
            return internationalNumber;
        }
    } catch (ex) {
        try {
            let validNumber = phoneUtil.parse(sessionStorage.getItem('loggedInuserCntCode') + phone, sessionStorage.getItem('loggedInuserCntName'));
            let internationalNumber = phoneUtil.format(validNumber, lpn.PhoneNumberFormat.INTERNATIONAL);
            //console.log('International Number2 : ', internationalNumber);
            return internationalNumber;
        } catch {
            return phone
        }
    }

    return phone;
}

  export function getCountryIsoCode(
    countryCode: number,
    number: lpn.PhoneNumber
  ): string | undefined {
    // Will use this to match area code from the first numbers
    const rawNumber = number['values_']['2'].toString();
    // List of all countries with countryCode (can be more than one. e.x. US, CA, DO, PR all have +1 countryCode)
    const countries = this.allCountries.filter(
        (c) => c.dialCode === countryCode.toString()
    );
    // Main country is the country, which has no areaCodes specified in country-code.ts file.
    const mainCountry = countries.find((c) => c.areaCodes === undefined);
    // Secondary countries are all countries, which have areaCodes specified in country-code.ts file.
    const secondaryCountries = countries.filter(
        (c) => c.areaCodes !== undefined
    );
    let matchedCountry = mainCountry ? mainCountry.iso2 : undefined;
  
    /*
    Iterate over each secondary country and check if nationalNumber starts with any of areaCodes available.
    If no matches found, fallback to the main country.
    */
    secondaryCountries.forEach((country) => {
        country.areaCodes.forEach((areaCode) => {
            if (rawNumber.startsWith(areaCode)) {
                matchedCountry = country.iso2;
            }
        });
    });
  
    return matchedCountry;
  }