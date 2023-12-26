import { Component, Input, OnInit, EventEmitter, Output } from '@angular/core';

@Component({
    selector: 'movius-web-ui-sliding-toggle-switch',
    templateUrl: './ui-sliding-toggle-switch.component.html',
    styleUrls: ['./ui-sliding-toggle-switch.component.scss']
})
export class UiSlidingToggleSwitchComponent implements OnInit {

    @Input()
    isEnabled: boolean = false;
    @Input()
    leftText: string;
    @Input()
    rightText: string;
    @Output()
    stateChanged: EventEmitter<boolean> = new EventEmitter(false);

    constructor() { }

    ngOnInit(): void {
    }

    onChange(){
        this.stateChanged.emit(this.isEnabled);
    }

}
