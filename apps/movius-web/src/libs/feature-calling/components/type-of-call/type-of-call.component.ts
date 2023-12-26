import {
    ChangeDetectionStrategy,
    Component,
    Input,
    OnInit,
} from '@angular/core';
import { HistorySessionCompleted } from '../../models';
import { HistorySessionView } from '../../ngrx';

export enum TypeOfCall {
    Inbound = 'Inbound',
    Outbound = 'Outbound',
    Declined = 'Declined',
}

interface LogoParameters {
    cssClass: string;
    text: string;
}

export interface HistorySessionGrouped extends HistorySessionCompleted {
    groupCount?: number;
}

@Component({
    selector: 'movius-web-type-of-call',
    templateUrl: './type-of-call.component.html',
    styleUrls: ['./type-of-call.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TypeOfCallComponent implements OnInit {
    static styleMappings: { [index: string]: LogoParameters } = {
        [TypeOfCall.Inbound]: {
            cssClass: 'call-inbound',
            text: 'Incoming',
        },
        [TypeOfCall.Outbound]: {
            cssClass: 'call-outbound',
            text: 'Outgoing',
        },
        [TypeOfCall.Declined]: {
            cssClass: 'call-declined',
            text: 'Missed',
        },
    };

    @Input() historySession: HistorySessionGrouped | HistorySessionView;
    @Input() callType: string;

    @Input() isDarkMode: boolean = false;

    constructor() {}

    ngOnInit(): void {}

    get selectedParameters() {
        if (
            this.historySession.kind === 'HistorySessionCompleted' &&
            this.historySession.type === 'rejected'
        ) {
            return TypeOfCallComponent.styleMappings[TypeOfCall.Declined];
        }
        if (this.historySession.direction === 'incoming') {
            return TypeOfCallComponent.styleMappings[TypeOfCall.Inbound];
        } else {
            return TypeOfCallComponent.styleMappings[TypeOfCall.Outbound];
        }
    }
}
