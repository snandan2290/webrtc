import { User } from './user';

export interface Peer extends User {    
    lastTimeOnline?: string | null;
}
