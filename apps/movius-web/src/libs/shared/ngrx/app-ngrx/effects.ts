import { Inject, Injectable, Optional } from '@angular/core';
import { LoggerFactory } from '@movius/ts-logger';
import { createEffect } from '@ngrx/effects';
import { combineLatest, interval } from 'rxjs';
import {
    distinctUntilChanged,
    filter,
    map,
    switchMap,
    tap,
} from 'rxjs/operators';
import { TransportState } from 'sip.js';
import { SipUserService, AuthService } from '../../services';
import { setTransportStatus, TransportStatus } from './actions';
const logger = LoggerFactory.getLogger('');

export interface CheckOnlineStatusSettings {
    // default '/assets/images/1x1.png'
    checkUrl: string;
    // default 5000
    checkInterval: number;
}

const DEFAULT_CHECK_ONLINE_STATUS_SETTINGS: CheckOnlineStatusSettings = {
    //'https://upload.wikimedia.org/wikipedia/commons/c/ca/1x1.png';
    checkUrl: '/assets/images/1x1.png',
    checkInterval: 5000,
};

const checkOnlineStatus = async (checkUrl: string) => {
    try {
        return navigator.onLine;
    } catch (err) {
        return false; // definitely offline
    }
};

export const CHECK_ONLINE_STATUS_SETTINGS = 'CHECK_ONLINE_STATUS_SETTINGS';

@Injectable()
export class AppEffects {
    private readonly checkOnlineStatus$ = interval(
        this.checkOnlineStatusSettings?.checkInterval ||
            DEFAULT_CHECK_ONLINE_STATUS_SETTINGS.checkInterval
    ).pipe(
        switchMap(() =>
            checkOnlineStatus(
                this.checkOnlineStatusSettings?.checkUrl ||
                    DEFAULT_CHECK_ONLINE_STATUS_SETTINGS.checkUrl
            )
        )
    );
    constructor(
        private readonly sipUserService: SipUserService,
        @Optional()
        @Inject(CHECK_ONLINE_STATUS_SETTINGS)
        private readonly checkOnlineStatusSettings: CheckOnlineStatusSettings,
        // private authService: AuthService
    ) {}

    onlineStatus$ = createEffect(
        () =>
            combineLatest([
                this.checkOnlineStatus$.pipe(distinctUntilChanged()),
                this.sipUserService.registeredSipUser$.pipe(
                    filter((f) => !!f),
                    switchMap((sipUser) => sipUser.transportStateChangeEvent$),
                    distinctUntilChanged()
                ),
                this.sipUserService.registeredSecondarySipUser$.pipe(
                    filter((f) => !!f),
                    switchMap((sipUser) => sipUser.transportStateChangeEvent$),
                    distinctUntilChanged()
                ),
            ]).pipe(
                tap(([online, transportState, secondaryTransportStatus]) => {
                    logger.debug(
                        `*** online status changed, online: ${online}, transport state: ${transportState}, user state: ${this.sipUserService.sipUser?.state}, navigator onLine : ${window.navigator.onLine} `
                    );
                    this.getIpAddress();
                    if (
                        online &&
                        (transportState === TransportState.Disconnecting ||
                            transportState === TransportState.Disconnected)
                    ) {
                        logger.debug(
                            `*** Online and transport disconnected, reregister!`
                        );
                        //this.sipUserService.reRegister();
                    } else if (
                        !online &&
                        transportState === TransportState.Connected
                    ) {
                        logger.debug(
                            `*** Offline and transport connected, unregister!`
                        );
                        this.sipUserService.unregister(false);
                    } else if (
                        online &&
                        (secondaryTransportStatus ===
                            TransportState.Disconnecting ||
                            secondaryTransportStatus ===
                                TransportState.Disconnected)
                    ) {
                        logger.debug(
                            `*** Online and secondary transport is disconnected, reregister!`
                        );
                        //this.sipUserService.register_secondary_site();
                    }
                })
            ),
        { dispatch: false }
    );

    transportStatusChangeConnectedDisconnected$ = createEffect(
        () =>
            combineLatest([
                this.sipUserService.registeredSipUser$.pipe(
                    filter((f) => !!f),
                    switchMap((sipUser) => sipUser.transportStateChangeEvent$),
                    distinctUntilChanged()
                ),
                this.sipUserService.registeredSecondarySipUser$.pipe(
                    filter((f) => !!f),
                    switchMap((sipUser) => sipUser.transportStateChangeEvent$),
                    distinctUntilChanged()
                ),
            ]).pipe(
                tap(([primaryTransportStatus, secondaryTransportStatus]) => {
                    logger.debug(
                        `*** primary and secondary status changed: ${primaryTransportStatus}, secondary state: ${secondaryTransportStatus} `
                    );
                    if (primaryTransportStatus == 'Disconnected') {
                        this.sipUserService.sipUser.hangupSessions();
                    } else if (secondaryTransportStatus == 'Disconnected') {
                        this.sipUserService.secondarysipUser.hangupSessions();
                    }

                    if (
                        primaryTransportStatus == 'Connected' ||
                        secondaryTransportStatus == 'Connected'
                    ) {
                        let status = 'connected' as TransportStatus;
                        this.testMtd(status);
                    } else if (
                        primaryTransportStatus == 'Disconnected' &&
                        secondaryTransportStatus == 'Disconnected'
                    ) {
                        let status = 'disconnected' as TransportStatus;
                        this.testMtd(status);
                    } else if (
                        primaryTransportStatus == 'Connecting' &&
                        secondaryTransportStatus == 'Connecting'
                    ) {
                        let status = 'registered' as TransportStatus;
                        this.testMtd(status);
                    }
                })
            ),
        { dispatch: false }
    );

    registeredSipUser$ = createEffect(() =>
        this.sipUserService.registeredSipUser$.pipe(
            filter((f) => !!f),
            switchMap((user) => user.userAgentEvents$),
            filter(
                (event) =>
                    event.kind === 'UserAgentRegisterEvent' &&
                    event.event.kind === 'AcceptOutgoingRequestEvent'
            ),
            map(() => {
                logger.debug('*** User registered');
                // document.getElementById('unregistred_icon').style.display = 'none';
                // document.getElementById('registred_icon').style.display = 'block';
                return setTransportStatus({ status: 'registered' });
            })
        )
    );

    unRegisteredSipUser$ = createEffect(
        () =>
            this.sipUserService.registeredSipUser$.pipe(
                filter((f) => !!f),
                switchMap((user) => user.userAgentEvents$),
                filter(
                    (event) =>
                        (event.kind === 'UserAgentRegisterEvent' &&
                            event.event.kind === 'RejectOutgoingRequestEvent' &&
                            event.event.response.message.statusCode === 408) ||
                        (event.kind === 'UserAgentTransportStateChangedEvent' &&
                            event.state === 'Disconnected') // Have we need to check status here ?
                ),
                tap(async () => {
                    logger.debug('*** User unregistered');
                    // document.getElementById('registred_icon').style.display = 'none';
                    // document.getElementById('unregistred_icon').style.display = 'block';
                    //await this.sipUserService.unregister(false, true);
                    //await this.sipUserService.reRegister();
                })
            ),
        { dispatch: false }
    );

    async getIpAddress() {
        try {
            const response = await fetch('https://api.ipify.org/?format=json');
            const data = await response.json();
            // logger.debug('data--------', data.ip);
            if (
                sessionStorage.getItem('__ip_address__getIP_level') != null &&
                sessionStorage.getItem('__ip_address__getIP_level') != ''
            ) {
                if (
                    sessionStorage.getItem('__ip_address__getIP_level') != data.ip
                ) {
                    sessionStorage.setItem('__ip_address__getIP_level', data.ip);
                    this.sipUserService.reRegister();
                }
            } else {
                if (sessionStorage.getItem('__ip_address__getIP_level') == null) {
                    sessionStorage.setItem('__ip_address__getIP_level', data.ip);
                }
            }
        } catch (e) {
            console.log('exception network', e)
        }
    }

    async testMtd(status1: TransportStatus) {
        setTransportStatus({ status: status1 });
    }
}
