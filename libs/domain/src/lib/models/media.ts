export interface Media{
    id: string; // mms_session
    data: Blob;
    update_r_download_time: string;
    fileName: string;
    retryExceeded?: true; // DONT add false by default
}