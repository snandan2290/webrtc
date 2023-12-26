import { createFeatureSelector, createSelector } from '@ngrx/store';
import { forEach } from 'lodash';
import {
    filter,
    flatten,
    fromPairs,
    map,
    orderBy,
    pipe,
    pluck,
    toPairs,
    uniqBy,
} from 'lodash/fp';
import {
    MultiLineUriProvider,
    selectContactGhosts,
} from '../../feature-contacts';
import { createUnknownUserContactGhost } from '../../feature-contacts/utils';
import {
    PeerChatMessage,
    PeerMessagingState,
    StateStatusLoadedSeq,
} from '../models';
import { MessagingState, PeerMessages } from './reducer';
import { LoggerConfiguration, LoggerFactory } from '@movius/ts-logger';
import { getMsgChannelTypeFromParticipants, getPeerIdFromThreadId, getValidPeerId } from '../../shared';
import { parseISO } from 'date-fns';
const logger = LoggerFactory.getLogger("")


export const selectMessaging = createFeatureSelector<MessagingState>(
    'messaging'
);

export const selectMessagesStatus = createSelector(
    selectMessaging,
    (state) => state.status
);

export const selectMessageSearchText = createSelector(
    selectMessaging,
    (state) => state.searchText
);

const sortMessage = (message: PeerChatMessage) =>
    message?.sentTime ? new Date(message.sentTime) : new Date(-8640000000000000);

export interface PeerChatMessageView extends PeerChatMessage {
    isRead: boolean;
}

export const selectThreads = createSelector(
    selectMessaging,
    (state) => state.threads
);

export const selectHash = createSelector(
    selectMessaging,
    (state) => state.hash
);

export const selectPeerThreads = createSelector(selectMessaging, (state) =>
    fromPairs(
        Object.values(state.hash).map((m) => [
            m.peerId,
            state.threads[m.threadId],
        ])
    )
);

export const selectPeerMessages = createSelector<
    any,
    MessagingState,
    { [peerId: string]: PeerChatMessageView[] }
>(selectMessaging, (state) =>
    pipe(
        toPairs,
        map(([k, v]: [string, PeerMessages]) => {
            // change key of peerId in threadId
            k = getValidPeerId(k)
            if (k.includes('whatsapp:') && !state.hash[v.threadId]) {
                 k = v.threadId
            }
            let threadReadTime = state.threads[v.threadId]?.readTime;
            if (threadReadTime != undefined && !threadReadTime?.endsWith('Z')) {
                //let date = state.threads[v.threadId]?.readTime + 'Z';
                //threadReadTime =  parseISO(date).toISOString();
                threadReadTime = threadReadTime?.replace(' ', 'T').slice(0, -3) + 'Z';
            }
            let invalidThreadReadTime = false;
            if(threadReadTime?.includes('00:00:00')){
                invalidThreadReadTime = true;
            }
            let threadDT = threadReadTime && new Date(threadReadTime);
            if(v?.messages?.length){
                const messages = v?.messages?.map((message) => ({
                    ...message,
                    isRead:
                    sessionStorage.getItem('loadInitialHistoryStoreSuccessHandler') == null || invalidThreadReadTime || message?.from === 'me' ||
                        (threadDT && threadDT >= new Date(message.sentTime)),
                    threadId: v.threadId
                }));
                const uniqResult = uniqBy((a) => a?.id, messages);
                return [k, orderBy(sortMessage, 'desc', uniqResult)];
            }
            //console.log('peermessage data before filter', messages);
            //const uniqResult = uniqBy((k) => k.peer.id, result);
            //console.log('peermessage data after filter', uniqResult);
        }),
        fromPairs
    )(state.hash)
);

export const getPeerIds = createSelector<
    any,
    MessagingState,
    { [peerId: string]: PeerChatMessageView[] }
>(selectMessaging, (state) =>
    pipe(
        toPairs,
        map(([k, v]: [string, PeerMessages]) => {
            const peerId = v.peerId;
            return [k , peerId];
        }),
        fromPairs
    )(state.hash)
);

export const selectPendingMessages = createSelector<
    any,
    MessagingState,
    (PeerChatMessage & { peerId: string })[]
>(selectMessaging, (state) =>
    pipe(
        toPairs,
        map(([peerId, v]: [string, PeerMessages]) => {
            v?.messages?.filter(
                (f) =>
                    f?.state.kind === 'MessageStateError' ||
                    f?.state.kind === 'MessageStateSending'
            )
                .map((m) => ({ ...m, peerId }))
        }),
        flatten
    )(state.hash)
);

export const selectPeerMessagesAndStatuses = createSelector<
    any,
    MessagingState,
    { [peerId: string]: PeerChatMessageView[] },
    {
        [peerId: string]: {
            status: StateStatusLoadedSeq;
            messages: PeerChatMessage[];
            threadId: string;
            isMuted: boolean;
            peerId: string;
            participants:any;
            isGroup:boolean;
            messageChannelType:string;
        };
    }
>(selectMessaging, selectPeerMessages, (state, peerMessages) =>
    pipe(
        toPairs,
        map(([k, v]: [string, PeerMessages]) => [
            k,
            {
                threadId: v.threadId,
                isMuted:
                    state.threads[v.threadId] &&
                    !!state.threads[v.threadId].isMuted,
                status: v.status,
                messages: peerMessages[k],
                peerId: v.peerId,
                participants: v.participants,
                isGroup: v.participants?.length > 1 ? true : false,
                messageChannelType: getMsgChannelTypeFromParticipants(v.participants, v.messageChannelType)
            },
        ]),
        fromPairs
    )(state.hash)
);

export const selectPeerMessageStatus = (peerId: string) =>
    createSelector<any, MessagingState, StateStatusLoadedSeq>(
        selectMessaging,
        (state) => {
            const peerState = state.hash[peerId];
            return peerState && peerState.status;
        }
    );

export const selectAllMessages = createSelector<
    any,
    MessagingState,
    PeerChatMessage[]
>(selectMessaging, (state) =>
    flatten(Object.values(state.hash).map((m) => m.messages))
);

export const selectWhatsAppOptInStatus = (peerId: string) =>
createSelector<any, MessagingState, any>(
    selectMessaging,
    (state) => {
        const id = peerId?.includes('whatsapp') ? state.hash[peerId]?.threadId : peerId;
        const peerState = state.hash[id];
        const messageChannelType = getMsgChannelTypeFromParticipants(state.hash[peerId]?.participants, state.hash[peerId]?.messageChannelType);

        return {
            isWhatsAppThread: peerState  ? peerState.isWhatsAppThread: false,
            whatsOptInReqStatus: peerState ? peerState.whatsOptInReqStatus : sessionStorage.getItem('opt-in-status-for-thread-id-' + peerState?.threadId),
            lastIncommingMessageAt: peerState  ? peerState.lastIncommingMessageAt : null,
            optInRequestCount: peerState  ? peerState.optInRequestCount : 1,
            whatsAppDisabled: peerState && peerState.messages?.length ? peerState.messages.find(obj => obj?.content.startsWith('Looks like this contact')) : (peerState && (peerState.whatsOptInReqStatus == "2" && peerState.seq == 5)),
            createdAt: peerState  ? peerState.createdAt : null,
            participants: state.hash[peerId]?.participants,
            isGroup: state.hash[peerId]?.participants?.length > 1 ? true : false,
            messageChannelType
        };
    }
);


export const selectAllMessagesKeys = createSelector<
    any,
    PeerChatMessage[],
    string[]
>(selectAllMessages, (messages) => pluck('id', messages));

export const selectPeerThreadStatuses = createSelector<
    any,
    MessagingState,
    {
        [peerId: string]: {
            threadId: string;
            status: StateStatusLoadedSeq;
        };
    }
>(selectMessaging, (state) => {
    return pipe(
        toPairs,
        map(([k, v]: [string, PeerMessages]) => {
            return [
                k,
                {
                    threadId: v.threadId,
                    status: v.status
                },
            ]
        }),
        filter(([_, v]) => !!v['threadId']),
        fromPairs
    )(state.hash);
});

export const selectIsMessagingLoaded = createSelector<
    any,
    MessagingState,
    boolean
>(selectMessaging, (state) => state.status.kind === 'StateStatusLoaded');

export const selectPeerMessagesByKey = (key:string) => createSelector<any,MessagingState,any>(selectMessaging, (state) => state.hash[key]);

//

const sortPeerMessagingState = (state: PeerMessagingState) =>
    state.messages[0]
        ? new Date(state.messages[0].sentTime)
        : new Date(-8640000000000000);

export const selectMessagesContactGhosts = (
    p: MultiLineUriProvider,
    mlNumber?: string
) =>
    createSelector(
        selectPeerMessages,
        selectContactGhosts(p),
        getPeerIds,
        selectHash,
        (messages, ghosts, peerIds, hash) => {
            let hashedRecords = hash
            let peerIdArray:any = [];
            let peerIdWGrpParties = [];
            Object.values(hash).forEach((data) => {
                if (data.isGroup) {
                    const validPeerId = getValidPeerId(data.peerId);
                    peerIdArray.push(getPeerIdFromThreadId(validPeerId, hash))
                }
                data.participants?.forEach((value) => {
                    if (value.includes('whatsapp:') === true) {
                        const getWAReplacedValue = value.replace('whatsapp:', '');
                        peerIdArray.push(getWAReplacedValue)
                    }
                    peerIdArray.push(value)
                })
            })
            peerIdWGrpParties = uniqBy((a) => a, peerIdArray);
            peerIdWGrpParties = [...new Set(peerIdWGrpParties)];
            const unknownGhosts = peerIdWGrpParties
                .map((peerId) => {
                    return createUnknownUserContactGhost(p, peerId);
                })
                .filter((f) => !!f);
            const result = [...ghosts, ...unknownGhosts];
            let getmlNumber;
            if (hashedRecords[mlNumber]?.participants?.length == 1) {
                getmlNumber = hashedRecords[mlNumber]?.participants[0] ? hashedRecords[mlNumber]?.participants[0] : hashedRecords[mlNumber]?.peerId
            } else {
                getmlNumber = mlNumber;
            }
            
            if (getmlNumber && !result.find((f) => f.id === getmlNumber)) {
                return [createUnknownUserContactGhost(p, getmlNumber), ...result];
            } else {
                return result;
            }
        }
    );

export const selectPeersMessages = (p: MultiLineUriProvider) =>
    createSelector(
        selectPeerMessages,
        selectMessagesContactGhosts(p),
        selectThreads,
        selectHash,
        (peerMessages:any, contacts, threads, hash:any): PeerMessagingState[] => {
            const result = [];
            //logger.debug('selectors-messaging::selectPeersMessages::HashLength', Object.values(hash).length);
            Object.values(hash).forEach((hashValue: any) => {
                let hashKeyValue;
                let peer;
                if (hashValue?.messageChannelType != 'normalMsg') {
                    hashKeyValue = hashValue?.threadId;
                } else {
                    hashKeyValue = hashValue?.peerId
                }
                let getValidPeerId = getPeerIdFromThreadId(hash[hashKeyValue]?.peerId, hash);
                peer = contacts.filter((peer) => peer.id == getValidPeerId)
                peer = peer[0]
                const thread = threads[hash[hashKeyValue]?.threadId]?.id || hash[hashKeyValue]?.threadId;
                const isMuted = threads[hash[hashKeyValue]?.threadId]?.isMuted || false;
                const participants = hash[hashKeyValue]?.participants || threads[hash[hashKeyValue]?.threadId]?.parties_list?.split(',');
                const isWhatsAppThread = hash[hashKeyValue]?.isWhatsAppThread
                const messages = peerMessages[hashKeyValue] || [];
                const newCount = messages.filter((f) => !f?.isRead).length;
                const whatsOptInReqStatus = hash[hashKeyValue]?.whatsOptInReqStatus;
                const isGroup = hash[hashKeyValue]?.isGroup || participants?.length > 1 ? true : false;
                const messageChannelType = hash[hashKeyValue]?.messageChannelType;
                if (hash[hashKeyValue] && !hash[hashKeyValue].hideThread) {
                    result.push({
                        peer,
                        messages,
                        newCount,
                        isMuted,
                        threadId: thread,
                        peerId: peer?.id,
                        participants,
                        whatsOptInReqStatus,
                        isGroup,
                        isWhatsAppThread,
                        messageChannelType
                    });
                }
            })
            // filter duplicate data
            //const newResult = [...new Map(result.map((m) => [m.threadId, m])).values()];
            const orderedResult = orderBy(
                sortPeerMessagingState,
                'desc',
                result
            );
            //logger.debug('orderedResult::::selectors-messaging::selectPeersMessages', orderedResult);
            //logger.debug('orderedResult::::selectors-messaging::selectPeersMessages::Length', orderedResult.length);
            return orderedResult;
        }
    );

//
export const selectPeersMessagesIsLoaded = createSelector(
    selectIsMessagingLoaded,
    (isLoaded) => isLoaded
);
