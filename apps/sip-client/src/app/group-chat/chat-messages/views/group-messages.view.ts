import {
    MessageReceivedStatus,
    MessageStatus,
    MessageUser,
    MessageView,
} from './messages.view';
import { groupBy, pipe, toPairs, map as _map, every, maxBy } from 'lodash/fp';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface GroupMessageView {
    id: string;
    user: MessageUser;
    content: string;
    sentDateTime: string;
    // aggregated message status
    status: MessageStatus;
    messages: MessageView[];
}

const aggregateMessagesStatuses = (statuses: MessageStatus[]) => {
    const allReceived = every(
        (st: MessageStatus) => st.kind === 'MessageReceivedStatus',
        statuses
    );
    if (allReceived) {
        const latestReceivedDateTime: MessageStatus = maxBy(
            (st: MessageStatus) =>
                st.kind === 'MessageReceivedStatus' &&
                new Date(st.receivedDateTime),
            statuses
        );
        return {
            kind: 'MessageReceivedStatus',
            receivedDateTime: (latestReceivedDateTime as MessageReceivedStatus)
                .receivedDateTime,
        };
    } else {
        return statuses[0];
    }
};

export const createMessagesView = (
    messages: MessageView[]
): GroupMessageView[] =>
    pipe(
        groupBy((x: MessageView) => x.multiTargetTagId || x.id),
        toPairs,
        _map(([k, v]: [string, MessageView[]]) => ({
            id: k,
            user: v[0].user,
            content: v[0].content,
            sentDateTime: v[0].sentDateTime,
            status: aggregateMessagesStatuses(messages.map((m) => m.status)),
            messages: v,
        }))
    )(messages);

export const mapMessagesView = (messages$: Observable<MessageView[]>) =>
    messages$.pipe(map(createMessagesView));
