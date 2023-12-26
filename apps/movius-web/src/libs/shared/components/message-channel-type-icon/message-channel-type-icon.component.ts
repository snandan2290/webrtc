import {Component, Input} from '@angular/core';

@Component({
    selector: 'message-channel-type-icon',
    templateUrl: './message-channel-type-icon.component.html',
    styleUrls: ['./message-channel-type-icon.component.scss'],
})
export class MessageChannelTypeIconComponent {
    @Input() messageChannelType:string;
    @Input() alt:string;

    constructor(
    ) { }


    ngOnInit(): void {}
}
