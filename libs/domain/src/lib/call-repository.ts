import { EncryptService } from '@movius/encrypt';
import { IDBPDatabase } from 'idb';
import { orderBy } from 'lodash/fp';
import { CallSession, CallSessionEncrypted } from './models';
import {
    MoviusDbSchema,
    UserOwned,
    UserOwnedEncrypted,
} from './models/db-schema';

// Aggregator
export class CallRepository {
    constructor(
        private readonly db: IDBPDatabase<MoviusDbSchema>,
        private readonly encryptService: EncryptService
    ) { }

    private readonly encrypt = (msg: CallSession & UserOwned) =>
        this.encryptService.encryptObj<
            CallSessionEncrypted & UserOwnedEncrypted
        >(msg, ['peerId', 'owner']);

    private readonly decrypt = (
        msg: CallSessionEncrypted & UserOwnedEncrypted
    ) =>
        this.encryptService.decryptObj<CallSession & UserOwned>(msg, [
            'peerId',
            'owner',
        ]);

    private get ctx() {
        const transaction = this.db.transaction('calls', 'readwrite');
        const store = transaction.objectStore('calls');
        return { transaction, store };
    }

    async getCalls(owner: string) {
        const ownerEncrypted = await this.encryptService.encrypt(owner);
        const { store } = this.ctx;
        const encrypted = await store.index('owner').getAll(ownerEncrypted);
        const decrypted = await Promise.all(encrypted.map(this.decrypt));
        return decrypted;
    }

    async getLatesrtCallTs(owner: string) {

        const ownerEncrypted = await this.encryptService.encrypt(owner);
        const { store } = this.ctx;
        const encrypted = await store.index('owner').getAll(ownerEncrypted);
        const decrypted = await Promise.all(encrypted.map(this.decrypt));
        const ordered = orderBy('startTime', 'desc', decrypted);
        return ordered.length > 0 ? (ordered[0].startTime) : (null);
    }

    async addCall(owner: string, call: CallSession) {
        const encrypted = await this.encrypt({ ...call, owner });
        const { store } = this.ctx;
        return store.add(encrypted);
    }

    async addCallsRange(owner: string, calls: CallSession[]) {
        const encrypted = await Promise.all(
            calls.map((x) => this.encrypt({ ...x, owner }))
        );
        const { store } = this.ctx;
        return Promise.all(encrypted.map((call) => store.add(call)));
    }

    async updateCallsRange(owner: string, calls: CallSession[]) {
        const encrypted = await Promise.all(
            calls.map((x) => this.encrypt({ ...x, owner }))
        );
        const { store } = this.ctx;
        return Promise.all(encrypted.map((call) => store.put(call)));
    }

    async removePeerCalls(owner: string, peerId: string) {
        const ownerEncrypted = await this.encryptService.encrypt(owner);
        const encryptedPeerId = await this.encryptService.encrypt(peerId);
        const { store } = this.ctx;
        const keys = await store
            .index('ownerAndPeer')
            .getAllKeys([ownerEncrypted, encryptedPeerId]);
        return Promise.all(keys.map((key) => store.delete(key)));
    }

    async removePeerCall(owner: string, itemId: string) {
        const ownerEncrypted = await this.encryptService.encrypt(owner);
        const { store } = this.ctx;
        await store.delete([itemId, ownerEncrypted]);
    }
}
