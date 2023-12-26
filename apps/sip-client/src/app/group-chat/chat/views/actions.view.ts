import { UserAgentEvent } from '@scalio/sip';
import { Observable } from 'rxjs';
import { scan, startWith } from 'rxjs/operators';
import { UserAgentState } from 'sip.js';

export interface ActionsView {
    isConnectAvailable: boolean;
    isRegisterAvailable: boolean;
    isSendMessageAvailable: boolean;
    isUnregisterAvailable: boolean;
    isDisconnectAvailable: boolean;
}

export const defaultActionsView: ActionsView = {
    isConnectAvailable: true,
    isRegisterAvailable: false,
    isSendMessageAvailable: false,
    isUnregisterAvailable: false,
    isDisconnectAvailable: false,
};

export const createActionsView = (
    userAgentEvents$: Observable<UserAgentEvent>
): Observable<ActionsView> => {
    return userAgentEvents$.pipe(
        scan((acc, val) => {
            switch (val.kind) {
                case 'UserAgentCommonEvent':
                    switch (val.event.kind) {
                        case 'ConnectUserEvent':
                            return {
                                isConnectAvailable: false,
                                isRegisterAvailable: true,
                                isSendMessageAvailable: false,
                                isUnregisterAvailable: false,
                                isDisconnectAvailable: true,
                            };
                        case 'RegisterUserEvent':
                            return {
                                isConnectAvailable: false,
                                isRegisterAvailable: false,
                                isSendMessageAvailable: true,
                                isUnregisterAvailable: true,
                                isDisconnectAvailable: true,
                            };
                        case 'DisconnectUserEvent':
                            return {
                                isConnectAvailable: true,
                                isRegisterAvailable: false,
                                isSendMessageAvailable: false,
                                isUnregisterAvailable: false,
                                isDisconnectAvailable: false,
                            };
                    }
                    break;
                case 'UserAgentRegisterEvent':
                    switch (val.event.kind) {
                        case 'AcceptOutgoingRequestEvent':
                            return {
                                isConnectAvailable: false,
                                isRegisterAvailable: false,
                                isSendMessageAvailable: true,
                                isUnregisterAvailable: true,
                                isDisconnectAvailable: true,
                            };
                        case 'RejectOutgoingRequestEvent':
                            return {
                                isConnectAvailable: true,
                                isRegisterAvailable: false,
                                isSendMessageAvailable: false,
                                isUnregisterAvailable: false,
                                isDisconnectAvailable: false,
                            };
                    }
                    break;
                case 'UserAgentUnregisterEvent':
                    switch (val.event.kind) {
                        case 'AcceptOutgoingRequestEvent':
                            return {
                                isConnectAvailable: false,
                                isRegisterAvailable: true,
                                isSendMessageAvailable: false,
                                isUnregisterAvailable: false,
                                isDisconnectAvailable: true,
                            };
                    }
                    break;
                case 'UserAgentStateChangedEvent':
                    switch (val.state) {
                        case UserAgentState.Stopped:
                            return {
                                isConnectAvailable: true,
                                isRegisterAvailable: false,
                                isSendMessageAvailable: false,
                                isUnregisterAvailable: false,
                                isDisconnectAvailable: false,
                            };
                    }
                    break;
            }
            return acc;
        }, defaultActionsView),
        startWith(defaultActionsView)
    );
};
