import { IDBPObjectStore, StoreNames } from 'idb';
import { MoviusDbSchema } from './db-schema';

export type DbObjectStore<S extends StoreNames<MoviusDbSchema>> = IDBPObjectStore<
    MoviusDbSchema,
    StoreNames<MoviusDbSchema>[],
    S
>;
