import { Contact } from "@movius/domain";

export const clearNumber = (mlNumber: string) =>
    mlNumber && mlNumber.replace(/\D+/g, '');

export const clearNumbers = (mlNumbers: string[]) =>
    mlNumbers && mlNumbers.map(clearNumber);

export const clearContact = <T extends Partial<Contact> = Contact>(
    contact: T
): T => ({
    ...contact,
    phones:
        contact.phones &&
        contact.phones.map((m) => ({
            ...m,
            phone: clearNumber(m.phone),
            orgPhone: m.phone
        })),
});

export const clearContacts = (contacts: Contact[]) =>
    contacts && contacts.map(clearContact);
