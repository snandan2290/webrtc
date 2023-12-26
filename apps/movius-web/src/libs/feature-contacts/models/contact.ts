import { Contact } from '@movius/domain';
import { User } from '../../shared';
export interface UserContact extends User {
    contact?: Contact;
}

export interface UserContactGhost extends UserContact {
    multiLineType: string;
    groupId?: string;
    participants?: string;
    type?: any;
}

export type MultiLineUriProvider = (mlNumber: string) => string;