import {
    SIPExtension,
    UserAgent,
    UserAgentDelegate,
    UserAgentOptions,
} from 'sip.js';
import {
    SessionDescriptionHandlerConfiguration,
    TransportOptions,
} from 'sip.js/lib/platform/web';
import { isFinite } from 'lodash/fp';
import { IceSipConfig } from './models';

export const getUserUri = (id: string, domain: string, token?: string) =>
    token ? `sip:${id}.${token}@${domain}` : `sip:${id}@${domain}`;

export const getUserOptions = (
    server: string,
    id: string,
    name: string,
    password: string,
    token: string,
    domain: string,
    delegate: UserAgentDelegate,
    userAgentString?: string,
    iceConfig?: IceSipConfig,
    iceGatheringTimeout?: number
): UserAgentOptions => {
    const userUri = getUserUri(id, domain, token).replace(':8089', '');
    const uri = UserAgent.makeURI(userUri);
    const transportOptions: any = {
        server,
        traceSip: true,
        reconnectionAttempts: 10,
        reconnectTimer: 1000,
        transportRecoveryAttempts: 10,
        transportRecoveryTimer: 100,
    };
    const stunUrls = ((iceConfig && iceConfig.stunUrls) || []).map((m) => ({
        urls: m,
    }));
    const turns = iceConfig.turn
        ? [
              {
                  urls: iceConfig.turn.url,
                  username: iceConfig.turn.user,
                  credential: iceConfig.turn.password,
              },
          ]
        : [];
    const iceServers = [...stunUrls, ...turns];
    iceGatheringTimeout = isFinite(iceGatheringTimeout)
        ? iceGatheringTimeout * 1000
        : undefined;
    console.log('iceGatheringTimeout: ', iceGatheringTimeout);
    const sessionConfiguration: SessionDescriptionHandlerConfiguration = {
        iceGatheringTimeout,
        peerConnectionConfiguration: {
            iceTransportPolicy: 'relay',
            iceServers,
        },
    };
    console.log('iceConfig', sessionConfiguration);
    return {
        ...({
            uri,
            transportOptions,
            delegate,
            displayName: name,
            userAgentString,
            sessionDescriptionHandlerFactoryOptions: sessionConfiguration,
            sipExtension100rel: SIPExtension.Supported,
        } as UserAgentOptions),
        ...(!!password
            ? { authorizationUsername: id, authorizationPassword: password }
            : {}),
    };
};
