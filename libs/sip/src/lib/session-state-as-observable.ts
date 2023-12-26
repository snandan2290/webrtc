import { Observable } from 'rxjs';
import { Session, SessionState } from 'sip.js';

export const sessionStateAsObservable = (
    session: Session
): Observable<SessionState> =>
    new Observable((obs) => {
        session.stateChange.addListener((state) => {
            switch (state) {
                case SessionState.Terminated:
                    // Session has terminated.
                    obs.next(state);
                    obs.complete();
                    break;
                default:
                    obs.next(state);
                    break;
            }
        });
    });
