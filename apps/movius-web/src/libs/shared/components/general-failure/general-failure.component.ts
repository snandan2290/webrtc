import { Component, OnInit, Output, EventEmitter, OnDestroy } from '@angular/core';
import { BehaviorSubject, fromEvent, merge, Observable, of, Subscription } from 'rxjs';
import { mapTo, timeInterval } from 'rxjs/operators';
import { DataService, SipUserService } from '../..';
import {  LoggerFactory } from '@movius/ts-logger';
import { AuthDataAccessService } from '../../services/auth.data-access.service';
const logger = LoggerFactory.getLogger("")

declare var navigator : any;

@Component({
    selector: 'movius-web-general-failure',
    templateUrl: './general-failure.component.html',
    styleUrls: ['./general-failure.component.scss'],
})

export class GeneralFailureComponent implements OnInit, OnDestroy {

    readonly serverConnectionError$ = new BehaviorSubject<string>(null);
    onlineStatus$: Observable<boolean>;
    intervalId = 0;
    seconds = 11;
    @Output() passConnectionError = new EventEmitter();
    isOnline: boolean;
    private subscription: Subscription;
    connection$: Observable<any>;
    readonly slowConnection$= new BehaviorSubject<string>(null);
    isSlowNetwork: boolean = false;

    networkStrengthCheckUrl = "https://upload.wikimedia.org/wikipedia/commons/c/ca/1x1.png";

    constructor(
        private sipUserService: SipUserService,
        private dataService : DataService,
        private authDataService: AuthDataAccessService,
    ) { 
        this.connection$ = new Observable((observer) => {
            const { effectiveType } = navigator.connection;
            observer.next(effectiveType);

            const onConnectionChange = () => {
                const { effectiveType } = navigator.connection;
                observer.next(effectiveType);
            }

            navigator.connection.addEventListener('change', onConnectionChange)

            return () => {
                navigator.connection.removeEventListener('change', onConnectionChange);
                observer.complete();
            }
        });
    }

   
    ngOnInit() {
        this.checkConnectionStatus();
        this.serverConnectionError$.next(null);

        const connection = navigator.connection;

        if (!connection) {
            setInterval(() => {
                this.checkOnlineStatus(this.networkStrengthCheckUrl).then(res => {
                    if (res == "poor_internet") {
                        this.isSlowNetwork = true;
                        this.slowConnection$.next("slow_connection")
                        this.passConnectionError.emit(true)
                    }
                })
            }, 5000)

        }else{
            // this.connection$.subscribe((effectiveType: string) => {
            //     if (/\slow-2g|2g|3g/.test(effectiveType)) {
            //         this.isSlowNetwork = true;
            //         this.slowConnection$.next("slow_connection")
            //         this.passConnectionError.emit(true)
            //     } else {
            //         this.isSlowNetwork = false;
            //         this.slowConnection$.next(null)
            //         this.passConnectionError.emit(false)
            //     }

            // })
        }

        
    }
    ngOnDestroy() {
        this.subscription && this.subscription.unsubscribe();
    }

    refresh(): void {
        window.location.reload();
    }

    private async checkOnlineStatus (checkUrl: string) {
        try {
            const startTime = Date.now()
            const online = await fetch(checkUrl, {
                cache: 'no-store',
            });
            const endTime = Date.now()
            const resTime = endTime - startTime;
            if (online.status >= 200 && online.status < 300) {
                if (resTime > 0 && resTime < 1000) {
                    return 'good_internet'
                }
                if (resTime > 1000) {
                    return 'poor_internet';
                }
            } else {
                return false
            }
    
            // return online.status >= 200 && online.status < 300; // either true or false
        } catch (err) {
            return false;
            //return 'no_internet'; // definitely offline
    
        }
    };

    private checkConnectionStatus() {
        this.onlineStatus$ = merge(
            of(navigator.onLine),
            fromEvent(window, 'online').pipe(mapTo(true)),
            fromEvent(window, 'offline').pipe(mapTo(false))
        );
        this.onlineStatus$.subscribe(data => {
            this.isOnline = data
            if (data === false) {
                this.passConnectionError.emit(true)
                this.dataService.setConnectionStatus(true);
                sessionStorage.setItem('networkwentdown', 'yes');
            } else {
                if(this.isSlowNetwork)
                    return
    
                this.passConnectionError.emit(false)
                this.dataService.setConnectionStatus(false);

                if(sessionStorage.getItem('networkwentdown') == 'yes'){
                    console.log('network went down and came back');
                    //here we can do registration and clear the session variable again
                    if(sessionStorage.getItem('call_is_active') == 'false'){
                       this.sipUserService.reRegister();
                       if(sessionStorage.getItem('secondarysipuserdata') != null){
                        this.sipUserService.register_secondary_site();
                       }
                    }
                    sessionStorage.removeItem('networkwentdown');
                }
            }
        })

        clearInterval(this.intervalId);
        this.intervalId = window.setInterval(() => {
            
            this.seconds -= 1;
            let p: any = this.sipUserService.sipUser;
            let s: any = this.sipUserService.secondarysipUser;

            //When both servers are null
            if (this.sipUserService.sipUser === null && this.sipUserService.secondarysipUser === null) {
                this.serverConnectionError$.next('Disconnected');
                this.passConnectionError.emit(true);
                this.dataService.setConnectionStatus(true);
            }

            //when secondary server is null 
            if (this.sipUserService.sipUser !== null && this.sipUserService.secondarysipUser === null) {
                if (p.registerer.state == 'Unregistered' || p.transport.state != 'Connected') {
                    //if (sessionStorage.getItem(sessionStorage.getItem('sec_server_name')) === 'false' && sessionStorage.getItem(sessionStorage.getItem('pri_server_name')) === 'false') {
                        this.serverConnectionError$.next('Disconnected');
                        this.passConnectionError.emit(true);
                        this.dataService.setConnectionStatus(true);
                    //} else {
                        // this.serverConnectionError$.next(null);
                        // this.passConnectionError.emit(false);
                        // this.dataService.setConnectionStatus(false);
                        if(this.isSlowNetwork)
                            return
                    //}
                } else {
                    this.serverConnectionError$.next(null);
                    if (this.isOnline === false) {
                        this.passConnectionError.emit(true);
                        this.dataService.setConnectionStatus(true);
                    } else {
                        this.passConnectionError.emit(false);
                        this.dataService.setConnectionStatus(false);
                        if (this.isSlowNetwork)
                            return
                    }
                }
            }

            //When primary server is null
            if (this.sipUserService.sipUser === null && this.sipUserService.secondarysipUser !== null) {
                if (s.registerer.state == 'Unregistered' || s.transport.state != 'Connected') {
                    //if (sessionStorage.getItem(sessionStorage.getItem('sec_server_name')) === 'false' && sessionStorage.getItem(sessionStorage.getItem('pri_server_name')) === 'false') {
                        this.serverConnectionError$.next('Disconnected');
                        this.passConnectionError.emit(true);
                        this.dataService.setConnectionStatus(true);
                    //} else {
                        // this.serverConnectionError$.next(null);
                        // this.passConnectionError.emit(false);
                        // this.dataService.setConnectionStatus(false);
                        if (this.isSlowNetwork)
                            return
                    //}
                } else {
                    this.serverConnectionError$.next(null);
                    if (this.isOnline === false) {
                        this.passConnectionError.emit(true);
                        this.dataService.setConnectionStatus(true);
                    } else {
                        this.passConnectionError.emit(false);
                        this.dataService.setConnectionStatus(false);
                        if (this.isSlowNetwork)
                            return
                    }
                }
            }

            //When both servers are not null
            if (this.sipUserService.sipUser !== null && this.sipUserService.secondarysipUser !== null) {
                if ((p.registerer.state == 'Unregistered' || p.transport.state != 'Connected') && (s.registerer.state == 'Unregistered' || s.transport.state != 'Connected')) {
                    this.serverConnectionError$.next('Disconnected');
                    this.passConnectionError.emit(true);
                    this.dataService.setConnectionStatus(true);
                } else {
                    this.serverConnectionError$.next(null);
                    if (this.isOnline === false) {
                        this.passConnectionError.emit(true);
                        this.dataService.setConnectionStatus(true);
                    } else {
                        this.passConnectionError.emit(false);
                        this.dataService.setConnectionStatus(false);
                        if (this.isSlowNetwork)
                            return
                    }
                }
            }

            let secServerValue;
            this.authDataService.secServerCntcStsData.subscribe(data => {
                secServerValue = data;
            })

            let priServerValue;
            this.authDataService.serverCntcStsData.subscribe(data => {
                priServerValue = data;
            })

            if(this.isOnline === false){
                this.passConnectionError.emit(true)
                this.dataService.setConnectionStatus(true);
                sessionStorage.setItem('networkwentdown', 'yes');
            }else if(sessionStorage.getItem('secondarysipuserdata') !== null && priServerValue == 'Disconnected' && secServerValue == 'Disconnected' || (sessionStorage.getItem('secondarysipuserdata') !== null && (p != undefined && p?.transport?.state != 'Connected') && (s != undefined && s?.transport?.state != 'Connected'))){
                //this.authDataService.priAndSecServerCntcStsDataEvent('Disconnected');
                this.serverConnectionError$.next('Disconnected');
                this.passConnectionError.emit(true);
                this.dataService.setConnectionStatus(true);
            }else if((sessionStorage.getItem('secondarysipuserdata') == null || sessionStorage.getItem('secondarysipuserdata') == undefined) && priServerValue == 'Disconnected' || (p != undefined && p?.transport?.state != 'Connected')) {
                //this.authDataService.serverCntcStsDataEvent('Disconnected');
                this.serverConnectionError$.next('Disconnected');
                this.passConnectionError.emit(true);
                this.dataService.setConnectionStatus(true);
            }else {
                this.serverConnectionError$.next(null);
                this.passConnectionError.emit(false);
                this.dataService.setConnectionStatus(false);
            }

             if(sessionStorage.getItem('waiting_value_on_fail_register') != undefined && sessionStorage.getItem('waiting_value_on_fail_register') == 'false'){
                //logs used for debugging when registration failed and event not reached to messaging service
                logger.debug('Waiting Session Value::',  sessionStorage.getItem('waiting_value_on_fail_register'));
                logger.debug('Registration Session Value::',  sessionStorage.getItem('registration_value'));
                logger.debug('Registration Fail Status Code Value::',  sessionStorage.getItem('register_fail_status_code'));
                sessionStorage.removeItem('waiting_value_on_fail_register');
                sessionStorage.removeItem('registration_value');
            }
            
        }, 3000);
    }
}
