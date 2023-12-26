// Generated by https://quicktype.io

import { MessageType } from "../../models";

export interface GetAllThreadsDTO {
    threads: Thread[];
    return: number;
    desc: string;
}

export interface Thread {
    id: string;
    t_created: string;
    t_joined: string;
    t_read: string;
    t_last_msg: string;
    seq: string;
    parties: string[];
    parties_list: string;
    messages: Message[];
    att_status?:string
}

export interface Message {
    ts: string;
    id: string;
    seq: number;
    seq_a: number;
    from: string;
    to?: string;
    body: string;
    multimedia_id: string;
    multimedia_content_type: string;
    stype?: number;
    parties_list: string;
    messageType : MessageType
}
