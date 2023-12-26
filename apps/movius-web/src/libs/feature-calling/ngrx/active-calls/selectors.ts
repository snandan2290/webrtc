import { createFeatureSelector } from '@ngrx/store';
import { ActiveCallsState } from './reducer';

export const selectActiveCalls = createFeatureSelector<ActiveCallsState>(
    'activeCalls'
);
