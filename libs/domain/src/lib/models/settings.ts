export type ExchangeSyncInterval =
    | 'never'
    | '30min'
    | '1hour'
    | '2hours'
    | '4hours'
    | '12hours';

export interface ExchangeSyncSettings {
    syncInterval: ExchangeSyncInterval;
}

export interface UserSettings {
    exchange: ExchangeSyncSettings;
}

export interface UserSettingsEntity extends UserSettings {
    mlnumber: ArrayBuffer;
    exchangeNextSyncTime: number | 'never';
}
