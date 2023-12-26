import { createReducer, on } from '@ngrx/store';
import { assoc } from 'lodash/fp';
import { setTransportStatus, TransportStatus } from './actions';

export interface AppState {
    transportStatus: TransportStatus;
}

const initialState: AppState = {
    transportStatus: 'disconnected',
};

const _appReducer = createReducer<AppState>(
    initialState,
    on(setTransportStatus, (state, { status }) =>
        assoc('transportStatus', status, state)
    )
);

export const appReducer = (state, action) => {
    return _appReducer(state, action);
};
