import { sortParticipantsAsID } from 'apps/movius-web/src/libs/shared';

export const getThreadPeerId = (userId: string, parties: string[]) =>
    parties.find((p) => p !== userId);

export const getThreadPeerIdGroup = (userId: string, party_list: string[]) => {
    return sortParticipantsAsID(party_list);
}