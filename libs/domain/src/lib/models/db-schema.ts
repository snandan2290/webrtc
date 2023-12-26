import { DBSchema } from 'idb';
import { AddressEncrypted } from './address';
import { CallSessionEncrypted } from './call-session';
import { CallSessionViewed } from './call-session-viewed';
import { ContactEncrypted } from './contact';
import { Media } from './media';
import { MessageEncrypted } from './message';
import { MessageThread } from './message-thread';
import { messageInfoType } from './messageInfo';
import { ParticipantThread } from './participants';
import { Profile, ProfileEncrypted } from './profile';
import { RetryQueue } from './retryQueue';
import { UserSettingsEntity } from './settings';

export interface UserOwned {
    owner: string;
}

export interface UserOwnedEncrypted {
    owner: ArrayBuffer;
}

export interface MoviusDbSchema extends DBSchema {
    profiles: {
        key: ArrayBuffer;
        value: ProfileEncrypted;
    };
    addresses: {
        key: ArrayBuffer;
        value: AddressEncrypted & UserOwnedEncrypted;
    };
    settings: {
        key: ArrayBuffer;
        value: UserSettingsEntity;
    };
    contacts: {
        key: number;
        value: ContactEncrypted & UserOwnedEncrypted;
        indexes: {
            owner: ArrayBuffer;
            ownerAndMsGraphId: [ArrayBuffer, ArrayBuffer];
        };
    };
    calls: {
        key: [string, ArrayBuffer];
        value: CallSessionEncrypted & UserOwnedEncrypted;
        indexes: {
            owner: ArrayBuffer;
            ownerAndPeer: [ArrayBuffer, ArrayBuffer];
        };
    };
    callsViewed: {
        key: [string, ArrayBuffer];
        value: CallSessionViewed & UserOwnedEncrypted;
        indexes: {
            owner: ArrayBuffer;
        };
    };
    messages: {
        key: [string, ArrayBuffer];
        value: MessageEncrypted & UserOwnedEncrypted;
        indexes: {
            owner: ArrayBuffer;
            ownerAndPeer: [ArrayBuffer, ArrayBuffer];
        };
    };
    messageThreads: {
        key: [string, ArrayBuffer];
        value: MessageThread & UserOwnedEncrypted;
        indexes: {
            owner: ArrayBuffer;
        };
    };
    participants: {
        key: [string];
        value: ParticipantThread;
    };
    messageInfo: {
        key: string
        value: messageInfoType,
        indexes: {
            id: string
        }
    }
    media: {
        key: string;
        value: Media;
    };
    retryQueue: {
        key: string;
        value: RetryQueue;
    };
}
