import { Contact } from '@movius/domain';
import { take } from 'lodash/fp';
import { PeerCalls } from '../../../feature-calling';
import { cleanPhoneNumber } from '../../../shared';

export const frequentlyUsedFilter = (
    callsHash: { [peerId: string]: PeerCalls },
    contacts: Contact[]
) => {
    const aggregatedPeerCalls = Object.values(callsHash).reduce((acc, call) => {
        const contact = contacts.find((contact) =>
            contact.phones.some(
                (phone) =>
                    cleanPhoneNumber(phone.phone) ===
                    cleanPhoneNumber(call.peerId)
            )
        );
        if (contact) {
            const pervCall = acc[contact.id];
            const pervSessionsCount = pervCall ? pervCall.sessionsCount : 0;
            return {
                ...acc,
                [contact.id]: {
                    sessionsCount: call.sessions.length + pervSessionsCount,
                    contact,
                },
            };
        } else {
            return acc;
        }
    }, {} as { [key: number]: { contact: Contact; sessionsCount: number } });

    const sortedContacts = Object.values(aggregatedPeerCalls)
        .sort((a, b) => b.sessionsCount - a.sessionsCount)
        .map((m) => m.contact);

    return take(5, sortedContacts);
};
