import { EncryptService } from '@movius/encrypt';
import { IDBPDatabase } from 'idb';
import { flatten } from 'lodash/fp';
import { Contact, ContactEncrypted, NewContact } from './models';
import { DbObjectStore } from './models/db-object-store';
import {
    MoviusDbSchema,
    UserOwned,
    UserOwnedEncrypted,
} from './models/db-schema';
import { clearContact, clearNumber, clearNumbers } from './utils/clear-contact';

// Aggregator
export class ContactRepository {
    constructor(
        private readonly db: IDBPDatabase<MoviusDbSchema>,
        private readonly encryptService: EncryptService
    ) {}

    private readonly encrypt = (contact: Contact & UserOwned) =>
        this.encryptService.encryptObjDeep<
            ContactEncrypted & UserOwnedEncrypted
        >(contact);

    private readonly decrypt = (
        contact: ContactEncrypted & UserOwnedEncrypted
    ) => this.encryptService.decryptObjDeep<Contact & UserOwned>(contact);

    private get ctx() {
        const transaction = this.db.transaction('contacts', 'readwrite');
        const store = transaction.objectStore('contacts');
        return { transaction, store };
    }

    private async getOwnerContact(owner: string, multiLines: string[]) {
        multiLines = clearNumbers(multiLines);
        const allOwnerContacts = await this.getContacts(owner);
        const contact = allOwnerContacts.find((f) =>
            f.phones.find(
                (p) => multiLines.indexOf(clearNumber(p.phone)) !== -1
            )
        );
        return contact;
    }

    async addOrUpdateContacts(
        owner: string,
        contacts: Contact[]
    ): Promise<number[]> {
        const encrypted = await Promise.all(
            contacts.map((contact) => this.encrypt({ ...contact, owner }))
        );
        try {
            const { store } = this.ctx;

            return await Promise.all(
                encrypted.map((contactEncrypted) =>
                    this.addOrUpdateContact(store, contactEncrypted)
                )
            );
        } catch (err) {
            console.error('error', err);
            throw err;
        }
    }

    async removeContacts(contactIds: number[]): Promise<void> {
        try {
            const store = this.ctx.store;
            await Promise.all(contactIds.map((m) => this.ctx.store.delete(m)));
        } catch (err) {
            console.error('error', err);
            throw err;
        }
    }

    private async addOrUpdateContact(
        store: DbObjectStore<'contacts'>,
        contact: ContactEncrypted & UserOwnedEncrypted
    ): Promise<number> {
        const id = await store
            .index('ownerAndMsGraphId')
            .getKey([contact.owner, contact.msGraphId]);
        if (id) {
            const storeContact = store.put({ ...contact, id });
            return storeContact;
        } else {
            const storeAdd = store.add(contact);
            return storeAdd;
        }
    }

    async addContact(owner: string, contact: Omit<Contact, 'id'>) {
        const encrypted = await this.encrypt({ ...contact, owner } as Contact &
            UserOwned);
        const { store } = this.ctx;
        const storeAdd = await store.add(encrypted);
        return storeAdd;
    }

    async getContact(owner: string, contact: NewContact) {
        const contactNumbers = flatten(contact.phones.map((m) => m.phone));
        return this.getOwnerContact(owner, contactNumbers);
    }

    async findContact(id: number) {
        const { store } = this.ctx;
        const contact = await store.get(id);
        return this.decrypt(contact);
    }

    async removeContact(id: number) {
        const { store } = this.ctx;
        const contact = await store.get(id);
        await store.delete(id);
        return this.decrypt(contact);
    }

    async removeAll(ownerId: string) {
        const ownerIdEncrypted = await this.encryptService.encrypt(ownerId);
        const { store } = this.ctx;
        const contactKeys = await store
            .index('owner')
            .getAllKeys(ownerIdEncrypted);
        return Promise.all(contactKeys.map((k) => store.delete(k)));
    }

    async updateContact(owner: string, contact: Contact) {
        const encrypted = await this.encrypt({
            ...contact,
            owner,
        });
        const { store } = this.ctx;
        await store.put(encrypted);
    }

    async updateContactImage(contactId: number, img: string) {
        const encryptedImg = await this.encryptService.encrypt(img);
        const { store } = this.ctx;
        const contact = await store.get(contactId);
        if (!contact) {
            console.warn('Contact not found', contactId);
            return;
        }
        contact.img = encryptedImg;
        await store.put(contact);
    }

    async getContacts(owner: string) {
        const ownerEncrypted = await this.encryptService.encrypt(owner);
        const { store } = this.ctx;
        const encryptedContacts = await store
            .index('owner')
            .getAll(ownerEncrypted);
        const contacts = await Promise.all(encryptedContacts.map(this.decrypt));
        return contacts;
    }
    
    async updateContactForNumberFormat(phone: string, internationalNumber: string) {
        const owner = sessionStorage.getItem('__api_identity__');
        const ownerEncrypted = await this.encryptService.encrypt(owner);
        const { store } = this.ctx;
        const encryptedContacts = await store
            .index('owner')
            .getAll(ownerEncrypted);
        const contacts = await Promise.all(encryptedContacts.map(this.decrypt));
 
        for (let i = 0; i < contacts.length; i++) {
            let count = contacts[i].phones.filter(x => x.phone == phone)
 
            if (count.length > 0) {
                for (let j = 0; j < contacts[i].phones.length; j++) {
                    if (contacts[i].phones[j].phone == phone) {
                        contacts[i].phones[j].phone = internationalNumber;
                        // this.updateContact(owner, contacts[i]);  
                        return contacts[i];
                    }
                }
                break;
            }
        }
        return null;
    }
}
