import { createFeatureSelector, createSelector } from '@ngrx/store';
import { AppState } from './reducer';

export const selectAppState = createFeatureSelector<AppState>('app');

export const selectTransportStatus = createSelector(
    selectAppState,
    (state) => state.transportStatus
);
