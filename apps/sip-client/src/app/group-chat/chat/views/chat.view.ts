import { ActionsView } from './actions.view';
import { ParticipantView } from './participant.view';

export interface UserView {
    uri: string;
    name: string;
    actions: ActionsView;
}

export interface ChatView {
    user: UserView;
    participants: ParticipantView[];
}
