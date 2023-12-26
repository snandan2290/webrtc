// Generated by https://quicktype.io

export interface GetCallsDTO {
    return: string;
    desc: string;
    participant: string;
    calls: Call[];
}

export interface Call {
    caller_number: string;
    called_number: string;
    call_type: 'IN' | 'OUT' | 'MISD';
    call_duration: string;
    call_starttime: string;
    call_mode: string;
    created_at: string;
    updated_at: any[];
    uuid: string;
}
