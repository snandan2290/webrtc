import { EncryptService } from '@movius/encrypt';
import { IDBPDatabase } from 'idb';
import { omit } from 'lodash/fp';
import { Address, AddressEncrypted, Profile, ProfileEncrypted } from './models';
import { MoviusDbSchema } from './models/db-schema';
import { ExchangeSyncInterval, UserSettings } from './models/settings';
import {LoggerFactory} from '@movius/ts-logger';
const logger = LoggerFactory.getLogger("")

const getIntervalMs = (interval: ExchangeSyncInterval) => {
    switch (interval) {
        case '30min':
            return 30 * 1000 * 60;
        case '1hour':
            return 60 * 1000 * 60;
        case '2hours':
            return 2 * 60 * 1000 * 60;
        case '4hours':
            return 4 * 60 * 1000 * 60;
        case '12hours':
            return 12 * 60 * 1000 * 60;
        default:
            return 'never' as 'never';
    }
};

// Aggregator
export class ProfileRepository {
    constructor(
        private readonly db: IDBPDatabase<MoviusDbSchema>,
        private readonly encryptService: EncryptService
    ) {}

    private profileCtx() {
        const transaction = this.db.transaction('profiles', 'readwrite');
        const store = transaction.objectStore('profiles');
        return { transaction, store };
    }

    private addressCtx() {
        const transaction = this.db.transaction('addresses', 'readwrite');
        const store = transaction.objectStore('addresses');
        return { transaction, store };
    }

    async isProfileExist(mlnumber: string) {
        const encryptedMLNumber = await this.encryptService.encrypt(mlnumber);
        const { store } = this.profileCtx();
        const count = await store.count(encryptedMLNumber);
        const totalCount = await store.count();
        const profileStatus = {
         isProfileExist: count > 0,
         isOtherProfilesExist: totalCount > 0 && count == 0 || totalCount > 1 && count == 1
        }
        logger.debug("General:: ProfileStatus::", profileStatus);
        return profileStatus;
        //return count > 0;
    }

    async isProfileHaveAddress(mlnumber: string) {
        const encryptedMLNumber = await this.encryptService.encrypt(mlnumber);
        const { store } = this.addressCtx();
        const count = await store.count(encryptedMLNumber);
        return count > 0;
    }

    async getProfileAndAddress(mlnumber: string) {
        const encryptedMLNumber = await this.encryptService.encrypt(mlnumber);
        const transaction = this.db.transaction(
            ['addresses', 'profiles', 'settings'],
            'readonly'
        );
        const addressesStore = transaction.objectStore('addresses');
        const profileStore = transaction.objectStore('profiles');
        const profileEncrypted = await profileStore.get(encryptedMLNumber);
        const addressEncrypted = await addressesStore.get(encryptedMLNumber);
        const settings = await transaction
            .objectStore('settings')
            .get(encryptedMLNumber);
        const cleanProfile = omit(
            ['encryptIv', 'encryptSecretKey'],
            profileEncrypted
        );
        const profile = await this.encryptService.decryptObj<Profile>(
            cleanProfile,
            ['email']
        );

        const address =
            addressEncrypted &&
            (await this.encryptService.decryptObj<Address>(
                addressEncrypted,
                '*'
            ));

        return {
            profile,
            address,
            settings:
                settings &&
                ({
                    exchange: settings.exchange,
                } as UserSettings),
        };
    }

    async createProfile(mlnumber: string, email: string) {
        const profile = {
            mlnumber,
            email: email,
        };
        const encrypted = await this.encryptService.encryptObj<
            ProfileEncrypted
        >(profile, '*');
        const { store } = this.profileCtx();
        await Promise.all([store.clear()])
        return store.add(encrypted);
    }

    async updateAddress(mlnumber: string, address: Address) {
        const mlnumberEncrypted = await this.encryptService.encrypt(mlnumber);
        const addressEncrypted = await this.encryptService.encryptObj<
            AddressEncrypted
        >(address, '*');
        const transaction = this.db.transaction(['addresses'], 'readwrite');
        const addresses = transaction.objectStore('addresses');
        return await addresses.put({
            ...addressEncrypted,
            owner: mlnumberEncrypted,
        });
    }

    async updateSettings(mlnumber: string, settings: UserSettings) {
        const encryptedMLNumber = await this.encryptService.encrypt(mlnumber);
        const transaction = this.db.transaction(['settings'], 'readwrite');
        const exchangeNextSyncTime = getIntervalMs(
            settings.exchange.syncInterval
        );
        const now = new Date().getTime();
        const item = {
            mlnumber: encryptedMLNumber,
            ...settings,
            exchangeNextSyncTime:
                exchangeNextSyncTime === 'never'
                    ? ('never' as 'never')
                    : now + exchangeNextSyncTime,
        };
        await transaction.objectStore('settings').put(item);
        return item;
    }

    async getSettings(mlnumber: string) {
        const encryptedMLNumber = await this.encryptService.encrypt(mlnumber);
        const transaction = this.db.transaction(['settings'], 'readonly');
        const settings = await transaction
            .objectStore('settings')
            .get(encryptedMLNumber);

        return settings;
    }

    async resetSyncExchangeInterval(mlnumber: string) {
        const encryptedMLNumber = await this.encryptService.encrypt(mlnumber);
        const transaction = this.db.transaction(['settings'], 'readwrite');
        const store = transaction.objectStore('settings');
        const settings = await store.get(encryptedMLNumber);
        if (settings) {
            settings.exchange = { syncInterval: 'never' };
            settings.exchangeNextSyncTime = 'never';
            await store.put(settings);
        }
    }

    async recalculateNextSyncExchangeTime(mlnumber: string) {
        const encryptedMLNumber = await this.encryptService.encrypt(mlnumber);
        const transaction = this.db.transaction(['settings'], 'readwrite');
        const store = transaction.objectStore('settings');
        const settings = await store.get(encryptedMLNumber);
        const exchangeNextSyncTime = getIntervalMs(
            settings.exchange.syncInterval
        );
        if (exchangeNextSyncTime !== 'never') {
            const now = new Date().getTime();
            settings.exchangeNextSyncTime = now + exchangeNextSyncTime;
            await store.put(settings);
            return settings.exchangeNextSyncTime;
        } else {
            return 'never' as 'never';
        }
    }
}
