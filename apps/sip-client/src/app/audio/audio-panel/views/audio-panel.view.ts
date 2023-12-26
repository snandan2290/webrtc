import { Invitation, Session } from 'sip.js';
import { ActionsView } from './actions.view';
import { ParticipantView } from './participant.view';

export interface UserView {
    uri: string;
    name: string;
    actions: ActionsView;
}

export interface AudioPanelView {
    user: UserView;
    session?: Session;
    invitation?: Invitation;
    participants: ParticipantView[];
}
