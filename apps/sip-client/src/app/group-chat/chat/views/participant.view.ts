export type ParticipantStatus = 'online' | 'offline';

export interface ParticipantView {
    uri: string;    
    name: string;
    status: ParticipantStatus;
    identifierUri?: string;
}
