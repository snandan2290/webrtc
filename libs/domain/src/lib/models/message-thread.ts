export interface MessageThread {
    id: string;
    readTime: string;
    isMuted?: boolean;
    createdAt?:Date;
    lastIncommingMessageAt?:string
    isWhatsAppThread?:boolean;
    whatsOptInReqStatus?:OptInStatus;
    hideThread?:boolean
    optInRequestCount?: number
    seq?:number;
    parties_list?: string;
    messageChannelType?:string;
}

enum OptInStatus {
    OptInRequestSent = 2,
    OptInRequestAccepted,
    OptInRequestRejected
  }