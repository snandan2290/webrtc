export interface SipMessage {
    // message id
    id: string;
    // group id if any
    groupId?: string;
    // uri
    from: string;
    // uri
    to: string;
    sentTime: string;
    receivedTime?: string;
    content: string;
}
