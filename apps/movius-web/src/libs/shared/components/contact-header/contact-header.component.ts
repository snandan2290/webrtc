import {
    Component,
    OnInit,
    Input,
    ChangeDetectionStrategy,
    Output,
    EventEmitter,
    OnChanges,
    SimpleChanges,
} from '@angular/core';
import { Router } from '@angular/router';
import { DbContext } from '../../services';
import { addPulsToMultilineNumber } from '../../../shared';

export type ContactHeaderType = 'Basic' | 'Popup'

@Component({
    selector: 'movius-web-contact-header',
    templateUrl: './contact-header.component.html',
    styleUrls: ['./contact-header.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ContactHeaderComponent implements OnInit {
    @Input()
    srcLogoUri: string;
    @Input()
    srcContactName: any;
    @Input()
    srcContactAddress: string;
    @Input()
    srcContactStatus: string;
    @Input()
    addCustomLogo = false;
    @Input()
    contactType: string;
    @Input()
    contactHeaderType: ContactHeaderType = 'Basic';
    @Input()
    isClickable: boolean = false;

    @Output() logoClicked = new EventEmitter();

    @Output() nameClicked = new EventEmitter();

    constructor() {}

    ngOnInit(): void {}


    addPulsToMultilineNumber = addPulsToMultilineNumber

    
}
