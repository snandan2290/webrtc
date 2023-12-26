export interface StateStatusInitial {
    kind: 'StateStatusInitial';
}

export interface StateStatusLoading {
    kind: 'StateStatusLoading';
}

export interface StateStatusLoaded {
    kind: 'StateStatusLoaded';
    dateTime: string;
}

export interface StateStatusError {
    kind: 'StateStatusError';
    dateTime: string;
    message: string;
}

export type StateStatus =
    | StateStatusInitial
    | StateStatusLoading
    | StateStatusLoaded
    | StateStatusError;
