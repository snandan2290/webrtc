import { groupBy, sortBy } from 'lodash/fp';
import { combineLatest, Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Peer } from '../../../shared';
import { PeerChatSession, SipMessage } from '../../models';

const mapSessionMessage = (peerId: string) => (message: SipMessage) => ({
    id: message.id,
    from: peerId === message.from ? ('peer' as 'peer') : ('me' as 'me'),
    sentTime: message.sentTime,
    receivedTime: message.receivedTime,
    readTime: null,
    content: message.content,
});

const mapSession = (peer: Peer, messages: SipMessage[]): PeerChatSession => {
    // const latestMessage = messages[messages.length - 1];
    return {
        id: peer.id,
        kind: 'PeerChatSession',
        peer: peer,
        messages: messages.map(mapSessionMessage(peer.id)),
    };
};

const handle = (
    contacts: Peer[],
    messages: SipMessage[]
): PeerChatSession[] => {
    const groupedMessagesFrom = groupBy(
        (msg: SipMessage) => msg.from,
        messages
    );
    const groupedMessagesTo = groupBy((msg: SipMessage) => msg.to, messages);
    return contacts.map((peer) => {
        const notOrderedMessages = [
            ...(groupedMessagesFrom[peer.id] || []),
            ...(groupedMessagesTo[peer.id] || []),
        ];
        const orderedMessages = sortBy((msg: SipMessage) => {
            const date = new Date(msg.sentTime);
            return date;
        }, notOrderedMessages);
        return mapSession(peer, orderedMessages);
    });
};

const getPeerId = (peers: Peer[], idOrMultiLine: string) => {
    const peerFromMultiline = peers.find((f) => f.multiLine === idOrMultiLine);
    return peerFromMultiline ? peerFromMultiline.id : idOrMultiLine;
};

// movius server use to / from header as a multiLine number, we need convert it devicenumber (id)
const mapMessage = (peers: Peer[]) => (msg: SipMessage) => ({
    ...msg,
    to: getPeerId(peers, msg.to),
    from: getPeerId(peers, msg.from),
});

/**
 * Given peers and active messages streams, create active sessions with messages for each user
 * @param contacts$
 * @param messages$
 */
export const getActivePeerChatSessions = (
    contacts$: Observable<Peer[]>,
    messages$: Observable<SipMessage[]>
): Observable<PeerChatSession[]> =>
    combineLatest([contacts$, messages$]).pipe(
        map(([contacts, messages]) => {
            const mappedMsgs = messages.map(mapMessage(contacts));
            return handle(contacts, mappedMsgs);
        })
    );
