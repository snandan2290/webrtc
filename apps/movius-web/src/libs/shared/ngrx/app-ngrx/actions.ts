import { createAction, props } from '@ngrx/store';

export type TransportStatus = 'connected' | 'disconnected' | 'registered';

export const setTransportStatus = createAction(
    '[App] Set Transport Status',
    props<{ status: TransportStatus }>()
);
