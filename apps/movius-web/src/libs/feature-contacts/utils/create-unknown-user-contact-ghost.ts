import { MultiLineUriProvider, UserContactGhost } from '../models';

export const createUnknownUserContactGhost = (
    p: MultiLineUriProvider,
    peerId: string
) =>
    ({
        id: peerId,
        uri: p(peerId),
        multiLineUri: p(peerId),
        name: null,
        img: null,
        multiLine: peerId,
        multiLineType: 'unknown',
    } as UserContactGhost);
