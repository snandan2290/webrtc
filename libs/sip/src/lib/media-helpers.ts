import { Session } from 'sip.js';
import { SessionDescriptionHandler } from 'sip.js/lib/platform/web';

export const setupSessionRemoteMedia = (
    session: Session,
    mediaElement: HTMLAudioElement
) => {
    if (!session) {
        throw new Error('Session does not exist.');
    }

    if (mediaElement) {
        const remoteStream = getRemoteMediaStream(session);
        if (!remoteStream) {
            throw new Error('Remote media stream undefined.');
        }
        mediaElement.autoplay = true; // Safari hack, because you cannot call .play() from a non user action
        mediaElement.srcObject = remoteStream;

        mediaElement.play().catch((error: Error) => {
            console.error(`Failed to play remote media`);
            console.error(error.message);
        });

        remoteStream.onaddtrack = (): void => {
            console.log(`Remote media onaddtrack`);
            mediaElement.load(); // Safari hack, as it doesn't work otheriwse
            mediaElement.play().catch((error: Error) => {
                console.error(`[Failed to play remote media`);
                console.error(error.message);
            });
        };
    }
};

export const cleanupMedia = (media: HTMLMediaElement) => {
    media.srcObject = null;
    media.pause();
};

const getRemoteMediaStream = (session: Session): MediaStream | undefined => {
    const sdh = session.sessionDescriptionHandler;
    if (!sdh) {
        return undefined;
    }
    if (!(sdh instanceof SessionDescriptionHandler)) {
        throw new Error(
            'Session description handler not instance of web SessionDescriptionHandler'
        );
    }
    return sdh.remoteMediaStream;
};
