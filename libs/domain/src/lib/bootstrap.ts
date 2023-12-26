import { EncryptService } from '@movius/encrypt';
import { deleteDB, openDB } from 'idb';
import { CallRepository } from './call-repository';
import { CallViewedRepository } from './call-viewed-repository';
import { ContactRepository } from './contact-repository';
import { IDbContext } from './db-context';
import { MessageRepository } from './message-repository';
import { MoviusDbSchema } from './models/db-schema';
import { ProfileRepository } from './profile-repository';

export const bootstrap = async (
    ver: number,
    encryptService: EncryptService
): Promise<IDbContext> => {
    // tslint:disable-next-line: radix
    let dBVersion = parseInt(localStorage.getItem('updateDB'));
    if (dBVersion === ver) {
        const dbName = 'movius-db';
        // await deleteDB(dbName);
        dBVersion ++;
        localStorage.setItem('updateDB', dBVersion.toString());
    }
    const db = await openDB<MoviusDbSchema>('movius-db', ver, {
        upgrade(d) {
            if(!d.objectStoreNames.contains('profiles')){
                //profiles
                d.createObjectStore('profiles', {
                    keyPath: 'mlnumber',
                });
            }
            if(!d.objectStoreNames.contains('contacts')){
                //contacts
                const contacts = d.createObjectStore('contacts', {
                    keyPath: 'id',
                    autoIncrement: true,
                });
                contacts.createIndex('owner', 'owner');
                contacts.createIndex('ownerAndMsGraphId', ['owner', 'msGraphId'], {
                    unique: true,
                });
            }
            if(!d.objectStoreNames.contains('calls')){
                //calls
                const calls = d.createObjectStore('calls', {
                    keyPath: ['id', 'owner'],
                });
                calls.createIndex('owner', 'owner');
                calls.createIndex('ownerAndPeer', ['owner', 'peerId']);
            }
            if(!d.objectStoreNames.contains('callsViewed')){
                //calls viewed
                const callsViewed = d.createObjectStore('callsViewed', {
                    keyPath: ['id', 'owner'],
                });
                callsViewed.createIndex('owner', 'owner');
            }
            if(!d.objectStoreNames.contains('messages')){
                //messages
                const messages = d.createObjectStore('messages', {
                    keyPath: ['id', 'owner'],
                });
                messages.createIndex('owner', 'owner');
                messages.createIndex('ownerAndPeer', ['owner', 'peerId']);
            }
            if(!d.objectStoreNames.contains('messageThreads')){
                //messageThreads
                const messagesThread = d.createObjectStore('messageThreads', {
                    keyPath: ['id', 'owner'],
                });
                messagesThread.createIndex('owner', 'owner');
            }
            if(!d.objectStoreNames.contains('participants')){
                //participants
                d.createObjectStore('participants', {
                    keyPath: ['id']
                });
            }
            if(!d.objectStoreNames.contains('addresses')){
                //addresses
                d.createObjectStore('addresses', {
                    keyPath: 'owner',
                });
            }
            if(!d.objectStoreNames.contains('settings')){
                //settings
                d.createObjectStore('settings', {
                    keyPath: 'mlnumber',
                });
            }
            if(!d.objectStoreNames.contains('messageInfo')){
                localStorage.setItem("__DB_change_1__","message_info");
                //messageInfo
                const msgInfo = d.createObjectStore('messageInfo', {
                    keyPath: 'id'
                });
                msgInfo.createIndex('id', 'id');
            }
            if(!d.objectStoreNames.contains('media')){
                d.createObjectStore('media',{
                    keyPath: 'id'
                })
            }
            if(!d.objectStoreNames.contains('retryQueue')){
                d.createObjectStore('retryQueue',{
                    keyPath: 'id'
                })
            }
        },
    });

    return {
        profile: new ProfileRepository(db, encryptService),
        contact: new ContactRepository(db, encryptService),
        call: new CallRepository(db, encryptService),
        message: new MessageRepository(db, encryptService),
        callViewed: new CallViewedRepository(db, encryptService),
    };
};