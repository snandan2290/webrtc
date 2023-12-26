export type failureInfo = 'upload_mms';
export type uploadMMS = {
    sent_to: string;
    sent_by: string;
}

export interface RetryQueue {
    id: string; // generic, but holds mms_id in pict ver
    type: failureInfo;
    data: uploadMMS; // can have multiple diff type in future
    failedCount: number;
    participants: String;
    targetUri: string;
    isforward: boolean;
}