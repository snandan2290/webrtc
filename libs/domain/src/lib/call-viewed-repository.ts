import { EncryptService } from '@movius/encrypt';
import { IDBPDatabase } from 'idb';
import { CallSessionViewed } from './models/call-session-viewed';
import {
    MoviusDbSchema,
    UserOwned,
    UserOwnedEncrypted,
} from './models/db-schema';

// Aggregator
export class CallViewedRepository {
    constructor(
        private readonly db: IDBPDatabase<MoviusDbSchema>,
        private readonly encryptService: EncryptService
    ) {}

    private readonly encrypt = (msg: CallSessionViewed & UserOwned) =>
        this.encryptService.encryptObj<CallSessionViewed & UserOwnedEncrypted>(
            msg,
            ['owner']
        );

    private readonly decrypt = (msg: CallSessionViewed & UserOwnedEncrypted) =>
        this.encryptService.decryptObj<CallSessionViewed & UserOwned>(msg, [
            'owner',
        ]);

    private get ctx() {
        const transaction = this.db.transaction('callsViewed', 'readwrite');
        const store = transaction.objectStore('callsViewed');
        return { transaction, store };
    }

    async getCallsViewed(owner: string) {
        const ownerEncrypted = await this.encryptService.encrypt(owner);
        const { store } = this.ctx;
        const result = await store.index('owner').getAll(ownerEncrypted);
        return result.map((m) => m.id);
    }

    async putAsViewed(owner: string, sessionIds: string[]) {
        const encrypted = await Promise.all(
            sessionIds.map((x) => this.encrypt({ id: x, viewed: true, owner }))
        );
        const { store } = this.ctx;
        return Promise.all(encrypted.map((call) => store.put(call)));
    }
}
