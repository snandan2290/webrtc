import {
    ChangeDetectionStrategy,
    ChangeDetectorRef,
    Component,
    EventEmitter,
    Input,
    Output,
} from '@angular/core';
import { flatten } from 'lodash';
import { sortBy } from 'lodash/fp';
import { UserContact } from '../../../feature-contacts';
import { MessagingDataAccessService } from '../../../feature-messaging';
import { Peer } from '../../../shared';
import { ActiveCall, PeerCallingState } from '../../models';

export type PopoverCall = ActiveCall & { peer: UserContact };

@Component({
    selector: 'movius-web-popover-call-stack',
    templateUrl: './popover-call-stack.component.html',
    styleUrls: ['./popover-call-stack.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PopoverCallStackComponent {
    private _sessions: PeerCallingState[];
    calls: PopoverCall[];
    @Output() accept = new EventEmitter<string>();
    @Output() cancel = new EventEmitter<string>();
    @Output() swap = new EventEmitter<string>();
    @Output() mute = new EventEmitter<{
        callId: string;
        isMute: boolean;
    }>();
    @Output() hold = new EventEmitter<{
        callId: string;
        isHold: boolean;
    }>();

    constructor(public readonly cdr: ChangeDetectorRef,
        private messagingDataAccessService: MessagingDataAccessService) {}

    ngOnInit(): void {
        this.messagingDataAccessService.setVMStatus(true);
    }

    @Input() set sessions(val: PeerCallingState[]) {
        this._sessions = val;
        const calls = flatten(
            val.map((m) => m.active.map((x) => ({ ...x, peer: m.peer })))
        );
        this.calls = sortBy((call) => {
            if (call.kind === 'OngoingActiveCall') {                
                if (call.status === 'active') {
                    // active always on top
                    return 1;
                } else {
                    // active but on hold next
                    return 2;
                }                
            } else {
                if (call.direction === 'outgoing') {
                    return 3;
                } else {
                    // incoming always at the bottom
                    return 4;
                }
            }
        }, calls);
    }

    get sessions() {
        return this._sessions;
    }

    trackBySession(_, session: PeerCallingState) {
        return session.peer.id;
    }

    trackByCall(_, call: ActiveCall) {
        return call.callId;
    }
}
