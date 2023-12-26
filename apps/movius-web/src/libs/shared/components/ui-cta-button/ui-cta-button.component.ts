import {
    ChangeDetectionStrategy,
    Component,
    EventEmitter,
    Input,
    OnInit,
    Output,
} from '@angular/core';

export type CtaBtnTypes = 'Call' | 'Message' | 'Contact';

@Component({
    selector: 'movius-web-ui-cta-button',
    templateUrl: './ui-cta-button.component.html',
    styleUrls: ['./ui-cta-button.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UiCtaButtonComponent implements OnInit {
    @Input() btnType: CtaBtnTypes;
    @Input() isDisabled: boolean = false;
    @Output() clicked = new EventEmitter();
    e911UserStatus: any;

    constructor() {
    }

    ngOnInit(): void { }

}
