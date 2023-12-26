import { UserAgentEvent } from '@scalio/sip';
import { Observable } from 'rxjs';
import { scan, startWith } from 'rxjs/operators';
import { SessionState } from 'sip.js';

export interface ActionsView {
    isConnectAvailable: boolean;
    isRegisterAvailable: boolean;
    isCallAvailable: boolean;
    isAcceptCallAvailable: boolean;
    isRejectCallAvailable: boolean;
    isMuteAvailable: boolean;
    isUnMuteAvailable: boolean;
    isHoldAvailable: boolean;
    isUnHoldAvailable: boolean;
    isHangUpAvailable: boolean;
    isUnregisterAvailable: boolean;
    isDisconnectAvailable: boolean;
}

export const defaultActionsView: ActionsView = {
    isConnectAvailable: true,
    isRegisterAvailable: false,
    isCallAvailable: false,
    isAcceptCallAvailable: false,
    isRejectCallAvailable: false,
    isMuteAvailable: false,
    isUnMuteAvailable: false,
    isHoldAvailable: false,
    isUnHoldAvailable: false,
    isHangUpAvailable: false,
    isUnregisterAvailable: false,
    isDisconnectAvailable: false,
};

export const createActionsView = (
    userId: string,
    userAgentEvents$: Observable<UserAgentEvent>
): Observable<ActionsView> => {
    return userAgentEvents$.pipe(
        scan((acc, val) => {
            console.log('evt !!!', userId, val);
            switch (val.kind) {
                case 'UserAgentOutgoingActionEvent':
                    switch (val.action.kind) {
                        case 'OutgoingHangUpAction':
                            return {
                                isConnectAvailable: false,
                                isRegisterAvailable: false,
                                isCallAvailable: true,
                                isAcceptCallAvailable: false,
                                isRejectCallAvailable: false,
                                isMuteAvailable: false,
                                isHoldAvailable: false,
                                isHangUpAvailable: false,
                                isUnregisterAvailable: true,
                                isDisconnectAvailable: true,
                                isUnMuteAvailable: false,
                                isUnHoldAvailable: false,
                            };
                        case 'OutgoingMuteAction':
                            return {
                                ...acc,
                                isMuteAvailable: !val.action.isMuted,
                                isUnMuteAvailable: val.action.isMuted,
                            };
                        case 'OutgoingHoldAction':
                            return {
                                ...acc,
                                isHoldAvailable: !val.action.isOnHold,
                                isUnHoldAvailable: val.action.isOnHold,
                            };
                    }
                    break;
                case 'UserAgentInviterSessionEvent':
                    {
                        switch (val.event.kind) {
                            case 'ByeSessionEvent': {
                                return {
                                    isConnectAvailable: false,
                                    isRegisterAvailable: false,
                                    isCallAvailable: true,
                                    isAcceptCallAvailable: false,
                                    isRejectCallAvailable: false,
                                    isMuteAvailable: false,
                                    isHoldAvailable: false,
                                    isHangUpAvailable: false,
                                    isUnregisterAvailable: true,
                                    isDisconnectAvailable: true,
                                    isUnMuteAvailable: false,
                                    isUnHoldAvailable: false,
                                };
                            }
                        }
                    }
                    if (val.inviter.state === SessionState.Initial) {
                        return {
                            isConnectAvailable: false,
                            isRegisterAvailable: false,
                            isCallAvailable: false,
                            isAcceptCallAvailable: false,
                            isRejectCallAvailable: false,
                            isMuteAvailable: false,
                            isHoldAvailable: false,
                            isHangUpAvailable: true,
                            isUnregisterAvailable: true,
                            isDisconnectAvailable: true,
                            isUnMuteAvailable: false,
                            isUnHoldAvailable: false,
                        };
                    }
                    break;
                case 'UserAgentOutgoingInviteEvent':
                    switch (val.event.kind) {
                        case 'ProgressOutgoingRequestEvent':
                            return {
                                isConnectAvailable: false,
                                isRegisterAvailable: false,
                                isCallAvailable: false,
                                isAcceptCallAvailable: false,
                                isRejectCallAvailable: false,
                                isMuteAvailable: false,
                                isHoldAvailable: false,
                                isHangUpAvailable: true,
                                isUnregisterAvailable: true,
                                isDisconnectAvailable: true,
                                isUnMuteAvailable: false,
                                isUnHoldAvailable: false,
                            };
                        case 'RejectOutgoingRequestEvent':
                            return {
                                isConnectAvailable: false,
                                isRegisterAvailable: false,
                                isCallAvailable: true,
                                isAcceptCallAvailable: false,
                                isRejectCallAvailable: false,
                                isMuteAvailable: false,
                                isHoldAvailable: false,
                                isHangUpAvailable: false,
                                isUnregisterAvailable: true,
                                isDisconnectAvailable: true,
                                isUnMuteAvailable: false,
                                isUnHoldAvailable: false,
                            };
                        case 'AcceptOutgoingRequestEvent':
                            return {
                                isConnectAvailable: false,
                                isRegisterAvailable: false,
                                isCallAvailable: false,
                                isAcceptCallAvailable: false,
                                isRejectCallAvailable: false,
                                isMuteAvailable: true,
                                isHoldAvailable: true,
                                isHangUpAvailable: true,
                                isUnregisterAvailable: true,
                                isDisconnectAvailable: true,
                                isUnMuteAvailable: false,
                                isUnHoldAvailable: false,
                            };
                    }
                    break;
                case 'UserAgentCommonEvent':
                    switch (val.event.kind) {
                        case 'ConnectUserEvent':
                            return {
                                isConnectAvailable: false,
                                isRegisterAvailable: true,
                                isCallAvailable: false,
                                isAcceptCallAvailable: false,
                                isRejectCallAvailable: false,
                                isMuteAvailable: false,
                                isHoldAvailable: false,
                                isHangUpAvailable: false,
                                isUnregisterAvailable: false,
                                isDisconnectAvailable: true,
                                isUnMuteAvailable: false,
                                isUnHoldAvailable: false,
                            };
                        case 'RegisterUserEvent':
                            return {
                                isConnectAvailable: false,
                                isRegisterAvailable: false,
                                isCallAvailable: true,
                                isAcceptCallAvailable: false,
                                isRejectCallAvailable: false,
                                isMuteAvailable: false,
                                isHoldAvailable: false,
                                isHangUpAvailable: false,
                                isUnregisterAvailable: true,
                                isDisconnectAvailable: true,
                                isUnMuteAvailable: false,
                                isUnHoldAvailable: false,
                            };
                        case 'DisconnectUserEvent':
                            return defaultActionsView;
                        case 'InviteUserEvent':
                            return {
                                isConnectAvailable: false,
                                isRegisterAvailable: false,
                                isCallAvailable: false,
                                isAcceptCallAvailable: true,
                                isRejectCallAvailable: true,
                                isMuteAvailable: false,
                                isHoldAvailable: false,
                                isHangUpAvailable: false,
                                isUnregisterAvailable: true,
                                isDisconnectAvailable: true,
                                isUnMuteAvailable: false,
                                isUnHoldAvailable: false,
                            };
                        case 'IncomingInviteSessionUserEvent':
                            switch (val.event.event.kind) {
                                case 'UserSessionStateEvent':
                                    switch (val.event.event.state) {
                                        case SessionState.Terminated:
                                            return {
                                                isConnectAvailable: false,
                                                isRegisterAvailable: false,
                                                isCallAvailable: true,
                                                isAcceptCallAvailable: false,
                                                isRejectCallAvailable: false,
                                                isMuteAvailable: false,
                                                isHoldAvailable: false,
                                                isHangUpAvailable: false,
                                                isUnregisterAvailable: true,
                                                isDisconnectAvailable: true,
                                                isUnMuteAvailable: false,
                                                isUnHoldAvailable: false,
                                            };
                                        case SessionState.Established:
                                            return {
                                                isConnectAvailable: false,
                                                isRegisterAvailable: false,
                                                isCallAvailable: false,
                                                isAcceptCallAvailable: false,
                                                isRejectCallAvailable: false,
                                                isMuteAvailable: true,
                                                isHoldAvailable: true,
                                                isHangUpAvailable: true,
                                                isUnregisterAvailable: true,
                                                isDisconnectAvailable: true,
                                                isUnMuteAvailable: false,
                                                isUnHoldAvailable: false,
                                            };
                                    }
                            }
                    }
                    break;
                case 'UserAgentRegisterEvent':
                    switch (val.event.kind) {
                        case 'AcceptOutgoingRequestEvent':
                            return {
                                isConnectAvailable: false,
                                isRegisterAvailable: false,
                                isCallAvailable: true,
                                isAcceptCallAvailable: false,
                                isRejectCallAvailable: false,
                                isMuteAvailable: false,
                                isHoldAvailable: false,
                                isHangUpAvailable: false,
                                isUnregisterAvailable: true,
                                isDisconnectAvailable: true,
                                isUnMuteAvailable: false,
                                isUnHoldAvailable: false,
                            };
                    }
                    break;
                case 'UserAgentUnregisterEvent':
                    switch (val.event.kind) {
                        case 'AcceptOutgoingRequestEvent':
                            return {
                                isConnectAvailable: false,
                                isRegisterAvailable: true,
                                isCallAvailable: false,
                                isAcceptCallAvailable: false,
                                isRejectCallAvailable: false,
                                isMuteAvailable: false,
                                isHoldAvailable: false,
                                isHangUpAvailable: false,
                                isUnregisterAvailable: false,
                                isDisconnectAvailable: true,
                                isUnMuteAvailable: false,
                                isUnHoldAvailable: false,
                            };
                    }
                    break;
            }

            return acc;
        }, defaultActionsView),
        startWith(defaultActionsView)
    );
};
