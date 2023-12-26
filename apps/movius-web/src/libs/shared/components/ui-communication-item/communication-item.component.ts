import { UserContact } from '../../../feature-contacts/models/contact';
import {
    ChangeDetectionStrategy,
    Component,
    EventEmitter,
    Input,
    OnInit,
    Output,
} from '@angular/core';

@Component({
    selector: 'communication-item',
    templateUrl: './communication-item.component.html',
    styleUrls: ['./communication-item.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CommunicationItemComponent implements OnInit {
    
    @Output() onBackCLicked = new EventEmitter();

    @Input()
    logoUrl: string;

    @Input()
    isVertical: boolean;

    @Input()
    addCustomLogo = false;

    @Input()
    removeLogo = false;

    @Input()
    externalStyle: Object;

    @Input()
    peer: UserContact;

    @Input()
    isMuted: boolean;

    @Input()
    isFullWidth: boolean = false;

    @Input()
    showBackOption:boolean = false;

    @Input()
    isGroup:boolean;
    isMobileDevice: boolean;

    constructor() {
        this.isMobileDevice = ((sessionStorage.getItem('Contex_res')?.toLowerCase() === "ios") || (sessionStorage.getItem('Contex_res')?.toLowerCase() === "android"))
            ? true : false;
    }

    GetTheme(){
        let theme = localStorage.getItem("Theme")
        return theme ? "Dark" : null
    }

    ngOnInit(): void {}
}
