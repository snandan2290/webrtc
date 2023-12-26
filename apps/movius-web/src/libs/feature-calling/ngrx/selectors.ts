import { createSelector } from '@ngrx/store';
import { flatten, orderBy, uniqBy } from 'lodash/fp';
import {
    createUnknownUserContactGhost,
    MultiLineUriProvider,
    selectContactGhosts,
    UserContactGhost,
} from '../../feature-contacts';
import {
    ActiveCall,
    HistorySession,
    HistorySessionCalling,
    HistorySessionCompleted,
    HistorySessionOngoing,
    PeerCallingState,
} from '../models';
import { selectActiveCalls } from './active-calls';
import {
    selectCallingHistorySessions,
    selectMissedViewed,
} from './calling-history';

const sortSession = (session: HistorySession) => new Date(session.startTime);
const sortActiveCall = (call: ActiveCall) => new Date(call.startedDateTime);

export type HistorySessionCompletedView = HistorySessionCompleted & {
    viewed: boolean;
};

export type HistorySessionView =
    | HistorySessionCalling
    | HistorySessionOngoing
    | HistorySessionCompletedView;

export type PeerCallingStateView = PeerCallingState<
    HistorySessionView,
    UserContactGhost
>;

const sortCallingState = (callingState: PeerCallingStateView) => {
    if (callingState.active[0]) {
        return new Date(callingState.active[0].startedDateTime);
    } else {
        return callingState.history[0]
            ? new Date(callingState.history[0].startTime)
            : new Date(-8640000000000000);
    }
};

export const selectCallingContactGhosts = (
    p: MultiLineUriProvider,
    mlNumber?: string
) =>
    createSelector(
        selectCallingHistorySessions,
        selectActiveCalls,
        selectContactGhosts(p),
        (history, active, ghosts) => {
            const historyPeerIds = Object.keys(history);
            const historyGhosts = historyPeerIds
                .map((peerId) => {
                    const ghost = ghosts.find((f) => f.id === peerId);
                    return ghost
                        ? null
                        : createUnknownUserContactGhost(p, peerId);
                })
                .filter((f) => !!f);
            const activePeerIds = Object.values(active).map((m) => m.peerId);
            const activeGhosts = activePeerIds
                .map((peerId) => {
                    const ghost = ghosts.find((f) => f.id === peerId);
                    return ghost
                        ? null
                        : createUnknownUserContactGhost(p, peerId);
                })
                .filter((f) => !!f);
            const result = [...ghosts, ...historyGhosts, ...activeGhosts];
            if (mlNumber && !result.find((f) => f.id === mlNumber)) {
                return [createUnknownUserContactGhost(p, mlNumber), ...result];
            } else {
                return result;
            }
        }
    );

const isCallAnonymous = (active: ActiveCall[], history: HistorySessionView[]) =>
    active[0]?.isAnonymous === true || history[0]?.isAnonymous === true;

export const selectPeersCallingStates = (
    p: MultiLineUriProvider,
    mlNumber?: string
) =>
    createSelector(
        selectCallingHistorySessions,
        selectActiveCalls,
        selectCallingContactGhosts(p, mlNumber),
        selectMissedViewed,
        (
            callingHistory,
            activeCalls,
            contacts,
            missedViewed
        ): PeerCallingStateView[] => {
            const result = contacts.map((peer) => {
                const history = callingHistory[peer?.multiLine] || [];
                const orderedHistory = orderBy(sortSession, 'desc', history);
                const historyView = orderedHistory.map((m) =>
                    m.kind === 'HistorySessionCompleted'
                        ? {
                              ...m,
                              viewed:
                                  m.type !== 'rejected' || !!missedViewed[m.id],
                          }
                        : m
                );
                const active = Object.values(activeCalls).filter(
                    (f) => f.peerId === peer?.multiLine
                );
                const orderedActive = orderBy(sortActiveCall, 'desc', active);
                return {
                    peer,
                    history: historyView,
                    active: orderedActive,
                    isAnonymous: isCallAnonymous(active, historyView),
                };
            });

            const uniqResult = uniqBy((k) => k.peer.id, result);

            const orderedResult = orderBy(sortCallingState, 'desc', uniqResult);

            return orderedResult;
        }
    );

export const selectRawCallingHistory = () =>
    createSelector(selectCallingHistorySessions, (callingHistory): string[] => {
        const totalHistory = flatten(Object.values(callingHistory));
        const orderedHistory = orderBy(sortSession, 'desc', totalHistory);
        const historyView = orderedHistory.filter(
            (m) => m.kind === 'HistorySessionCompleted'
        );
        const res = historyView.map((el) => el.id);
        return res;
    });
