export type CallingStatus =
    | 'allowed'
    | 'network-error'
    | 'e911-declined'
    | 'calls-not-allowed'
    | 'mic-not-allowed'
    | 'another-active-call';
