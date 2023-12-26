import { Contact, ContactAddress } from '@movius/domain';
import { Injectable } from '@angular/core';
import {
    Contact as ContactDTO,
    Person as PersonDTO,
    PhysicalAddress,
} from '@movius/msgraph';
import { isEmpty } from 'lodash';
import { getChannelTypeForLineWechatDetails, getPeerNumberWOSpecialChars, getInternationalNumber } from './common-utils';
import * as lpn from 'google-libphonenumber';


const phoneUtil: any = lpn.PhoneNumberUtil.getInstance();

const mapFromMsGraphAddress = (
    type: string,
    dto: PhysicalAddress
): ContactAddress => ({
    street: dto.street,
    street2: null,
    city: dto.city,
    postal: dto.postalCode,
    state: dto.state,
    country: dto.countryOrRegion,
    type,
});

const cleanPhone = (str: string) => (str ? str.replace(/\D+/g, '') : str);

const mapToMsGraphAddress = (address: ContactAddress): PhysicalAddress =>
    address
        ? {
              street: address.street,
              city: address.city,
              postalCode: address.postal,
              state: address.state,
              countryOrRegion: address.country,
          }
        : undefined;

export const mapFromMsGraphContact = (dto: ContactDTO): Contact => {
    return {
        type: 'personal',
        // not yet defined, will be created when stored to storage
        msGraphId: dto.id,
        firstName: dto.givenName,
        lastName: dto.surname,
        nameExtras: {
            title: dto.title,
            middleName: dto.middleName,
            suffix: dto.generation,
            nickName: dto.nickName,
            yomiFirstName: dto.yomiGivenName,
            yomiLastName: dto.yomiSurname,
        },
        other: {
            personalWebPage: dto.businessHomePage,
            significantOther: dto.spouseName,
            birthday: dto.birthday,
        },
        work: {
            company: dto.companyName,
            yomiCompany: dto.yomiCompanyName,
            jobTitle: dto.jobTitle,
        },
        phones: [
            ...dto.homePhones.map((m) => ({
                type: 'HomePhone',
                phone: prefixCountryCodeToContactNumber(m),
            })),
            ...dto.businessPhones.map((m) => ({
                type: 'BusinessPhone',
                phone: prefixCountryCodeToContactNumber(m),
            })),
            ...(dto.mobilePhone
                ? [{ type: 'MobilePhone', phone: prefixCountryCodeToContactNumber(dto.mobilePhone) }]
                : []),
        ],
        emails: dto.emailAddresses.map((m) => ({
            type: m.name,
            email: m.address,
        })),
        addresses: [
            dto.businessAddress && !isEmpty(dto.businessAddress)
                ? mapFromMsGraphAddress('BusinessAddress', dto.businessAddress)
                : null,
            dto.homeAddress && !isEmpty(dto.homeAddress)
                ? mapFromMsGraphAddress('HomeAddress', dto.homeAddress)
                : null,
            dto.otherAddress && !isEmpty(dto.otherAddress)
                ? mapFromMsGraphAddress('OtherAddress', dto.otherAddress)
                : null,
        ].filter((f) => !!f),
        chat: dto.imAddresses.join(','),
        note: dto.personalNotes,
    } as Contact;
};

const mapPersonPhoneType = (
    type: string
): 'BusinessPhone' | 'MobilePhone' | 'HomePhone' => {
    switch (type) {
        case 'business':
            return 'BusinessPhone';
        case 'mobile':
            return 'MobilePhone';
        case 'home':
            return 'HomePhone';
    }
};

export const mapFromMsGraphPerson = (dto: PersonDTO): Contact => {
    const splitNames = dto.displayName ? dto.displayName.split(' ') : [];
    const firstName = dto.givenName || splitNames[0] || '';
    const lastName = dto.surname || splitNames[1] || '';
    return {
        type: 'organization',
        // not yet defined, will be created when stored to storage
        msGraphId: dto.id,
        firstName,
        lastName,
        nameExtras: {
            title: null,
            middleName: null,
            suffix: null,
            nickName: null,
            yomiFirstName: null,
            yomiLastName: null,
        },
        other: {
            personalWebPage: null,
            significantOther: null,
            birthday: dto.birthday,
        },
        work: {
            company: dto.companyName,
            yomiCompany: dto.yomiCompany,
            jobTitle: dto.jobTitle,
        },
        phones: dto.phones.map((m) => ({
            type: mapPersonPhoneType(m.type),
            phone: m.number,
        })),
        emails: dto.scoredEmailAddresses.map((m) => ({
            type: 'PersonalEmail',
            email: m.address,
        })),
        // TODO
        addresses: [],
        chat: dto.imAddress,
        note: dto.personNotes,
    } as Contact;
};

/*
export const mapFromMsGraphContactOrPerson = (
    dto: (ContactDTO & { kind: 'contact' }) | (PersonDTO & { kind: 'person' })
): Contact => {
    if (dto.kind === 'contact') {
        return mapFromMsGraphContact(dto);
    } else {
        return mapFromMsGraphPerson(dto);
    }
};
*/

export const mapToMsGraphContact = (contact: Contact): Partial<ContactDTO> => {
    const businessAddress =
        contact.addresses &&
        mapToMsGraphAddress(
            contact.addresses.find((f) => f.type === 'BusinessAddress')
        );
    const homeAddress =
        contact.addresses &&
        mapToMsGraphAddress(
            contact.addresses.find((f) => f.type === 'HomeAddress')
        );
    const businessPhones = (contact.phones || [])
        .filter((f) => f.type === 'BusinessPhone')
        .map((m) => m.phone);
    const emailAddresses = contact.emails.map((m) => ({
        name: m.type,
        address: m.email,
    }));
    const homePhones = (contact.phones || [])
        .filter((f) => f.type === 'HomePhone')
        .map((m) => m.phone);
    const mobilePhone = (contact.phones || []).find(
        (f) => f.type === 'MobilePhone'
    )?.phone;
    const otherAddress =
        contact.addresses &&
        mapToMsGraphAddress(
            contact.addresses.find((f) => f.type === 'OtherAddress')
        );
    const result = {
        birthday: contact.other?.birthday,
        businessAddress,
        businessHomePage: contact.other?.personalWebPage,
        businessPhones: businessPhones,
        companyName: contact.work?.company,
        emailAddresses: emailAddresses,
        generation: contact.nameExtras?.suffix,
        givenName: contact.firstName,
        homeAddress,
        homePhones: homePhones,
        imAddresses: contact.chat ? [contact.chat] : [],
        jobTitle: contact.work?.jobTitle,
        middleName: contact.nameExtras?.middleName,
        mobilePhone: mobilePhone || '',
        nickName: contact.nameExtras?.nickName,
        otherAddress,
        personalNotes: contact.note,
        spouseName: contact.other?.significantOther,
        surname: contact.lastName,
        title: contact.nameExtras?.title,
        yomiCompanyName: contact.work?.yomiCompany,
        yomiGivenName: contact.nameExtras?.yomiFirstName,
        yomiSurname: contact?.nameExtras?.yomiLastName,
    } as ContactDTO;

    return result; // pickBy(identity, result);
};


export const prefixCountryCodeToContactNumber = (cntNumber) => {
    //console.log('Number from msgraph sync', cntNumber);
    if(cntNumber && getPeerNumberWOSpecialChars(cntNumber) != undefined){
        cntNumber = getPeerNumberWOSpecialChars(cntNumber);
        const valnum = getPeerNumberWOSpecialChars(getInternationalNumber(cntNumber))
        //console.log('sync contact valnum::', valnum);
        return valnum;
    }
}
