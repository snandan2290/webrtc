import { UserContact } from '../../feature-contacts/models';
import { ActiveCall } from './active-call';
import { HistorySession } from './history-session';

export interface PeerCallingState<
    T extends HistorySession = HistorySession,
    P extends UserContact = UserContact
> {
    peer: P;
    history: T[];
    active: ActiveCall[];
    isAnonymous: boolean;
}
