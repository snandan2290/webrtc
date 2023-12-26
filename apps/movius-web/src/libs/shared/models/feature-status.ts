export type FeatureStatus =
    | 'unknown'
    | 'enabled_accepted'
    | 'enabled_declined'
    | 'disabled';

export interface FeatureProfile {
    email: string;
}

export type FeatureProfileStatus =
    | 'unknown'
    | 'off'
    | 'disabled'
    | { enabled: FeatureProfile };

export interface UserFeatures {
    gdprStatus: FeatureStatus;
    e911Status: FeatureStatus;
    exchangeSyncStatus: FeatureProfileStatus;
    allowCalls: boolean;
    allowMessages: boolean;
    actstatus?: boolean;
}
