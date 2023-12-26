import {
    ChangeDetectionStrategy,
    Component,
    EventEmitter,
    Input,
    OnInit,
    Output,
} from '@angular/core';

export enum CallControlButtonTypes {
    Hold = 'Hold',
    Unhold='Unhold',
    Keypad = 'Keypad',
    Mute = 'Mute',
    Unmute = 'Unmute',
    Start = 'Start',
    Stop = 'Stop',
    Accept = 'Accept',
    Reject = 'Reject',
    Swap = 'Swap',
}

export interface CallControlButtonParams {
    iconUri: string;
    activeIconUri?: string;
    disabledIconUri?: string;
    cssClass: string;
    text: string;
    toggleText?:string
}

@Component({
    selector: 'movius-web-call-control-button',
    templateUrl: './call-control-button.component.html',
    styleUrls: ['./call-control-button.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CallControlButtonComponent implements OnInit {
    static styleMappings: { [index: string]: CallControlButtonParams } = {
        [CallControlButtonTypes.Hold]: {
            iconUri: 'assets/icons/movius/calls/icons-call-hold.svg',
            activeIconUri:
                'assets/icons/movius/calls/icons-call-hold-active.svg',
            disabledIconUri:
                'assets/icons/movius/calls/icons-call-hold-disabled.svg',
            cssClass: 'hold',
            text: CallControlButtonTypes.Hold,
            toggleText : CallControlButtonTypes.Unhold
        },
        [CallControlButtonTypes.Keypad]: {
            iconUri: 'assets/icons/movius/calls/icons-call-keyboard.svg',
            disabledIconUri: 'assets/icons/movius/calls/icons-call-keyboard-disabled.svg',
            cssClass: 'keypad',
            text: CallControlButtonTypes.Keypad,
            toggleText : CallControlButtonTypes.Keypad
        },
        [CallControlButtonTypes.Mute]: {
            iconUri: 'assets/icons/movius/calls/icons-call-unmute.svg',
            activeIconUri:
                'assets/icons/movius/calls/icons-call-mute-active.svg',
            disabledIconUri:
            'assets/icons/movius/calls/icons-call-unmute-disabled.svg',
            cssClass: 'mute',
            text: CallControlButtonTypes.Mute,
            toggleText: CallControlButtonTypes.Unmute
        },
        [CallControlButtonTypes.Start]: {
            iconUri: 'assets/icons/movius/calls/icons-call-call.svg',
            cssClass: 'start',
            text: CallControlButtonTypes.Start,
            toggleText:CallControlButtonTypes.Start
        },
        [CallControlButtonTypes.Stop]: {
            iconUri: 'assets/icons/movius/calls/icons-call-end-call.svg',
            cssClass: 'stop',
            text: CallControlButtonTypes.Stop,
            toggleText: CallControlButtonTypes.Stop,
        },
        [CallControlButtonTypes.Accept]: {
            iconUri:
                'assets/icons/movius/calls/icons-accept.svg',
            cssClass: 'accept',
            text: CallControlButtonTypes.Accept,
            toggleText: CallControlButtonTypes.Accept,
        },
        [CallControlButtonTypes.Reject]: {
            iconUri:
                'assets/icons/movius/calls/icons-reject.svg',
            cssClass: 'reject',
            text: CallControlButtonTypes.Reject,
            toggleText: CallControlButtonTypes.Reject,
        },
        [CallControlButtonTypes.Swap]: {
            iconUri:
                'assets/icons/movius/calls/icons-call-swap-calls-white.svg',
            activeIconUri:
                'assets/icons/movius/calls/icons-call-swap-calls-white.svg',
            disabledIconUri:
                'assets/icons/movius/calls/icons-call-swap-calls-white.svg',
            cssClass: 'swap',
            text: CallControlButtonTypes.Swap,
            toggleText: CallControlButtonTypes.Swap,
        },
    };

    @Input()
    doShowText = false;
    @Input()
    isActive = false;
    @Input()
    isSmall = false;
    @Input()
    isGrad = false;
    @Input()
    type: CallControlButtonTypes;
    @Input()
    isDisabled = false;
    @Output()
    clicked = new EventEmitter();

    selectedParameters: CallControlButtonParams;

    constructor() {}

    ngOnInit(): void {
        this.selectedParameters =
            CallControlButtonComponent.styleMappings[this.type];
    }
    
    getActivePrefix() {
        return this.isActive ? '--active' : '';
    }
}
