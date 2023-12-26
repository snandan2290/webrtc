import {
    ChangeDetectionStrategy,
    Component,
    EventEmitter,
    Input,
    OnInit,
    Output,
} from '@angular/core';

@Component({
    selector: 'movius-web-labeled-button',
    templateUrl: './labeled-button.component.html',
    styleUrls: ['./labeled-button.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LabeledButtonComponent implements OnInit {
    @Input() text: string;
    @Input() imgUri: string;
    @Input() isDisabled: boolean | string = false;
    @Input() hoverUrl:string
    @Output() clicked = new EventEmitter();
    activeImageUri:string
    e911UserStatus: any;
    bg_color:string = "#5C5FC8"
    constructor() {
    }

    ngOnInit(): void {
        this.activeImageUri = this.imgUri
    }

    onClick() {
        this.clicked.emit();
    }

    changeImage() {
        this.activeImageUri = this.hoverUrl ? this.hoverUrl : this.imgUri;
        this.bg_color = "#3d3e78"
    }

    resetImage() {
        this.activeImageUri = this.imgUri;
        this.bg_color = "#5C5FC8"
    }

    isDisplayErrorPopup = () => {
        return (
            this.isDisabled === 'another-active-call' ||
            this.isDisabled === 'network-error' ||
            this.isDisabled === 'calls-not-allowed' ||
            this.isDisabled === 'mic-not-allowed' ||
            this.isDisabled === 'e911-declined'
        );
    };

    get disbaledCallButton() {
        this.e911UserStatus = sessionStorage.getItem("_USER_E911_STATUS_");
        // console.log("SupportWorkspaceComponent:: e911UserStatus::" + this.e911UserStatus)
        // console.log("SupportWorkspaceComponent:: callingStatus_tmp::" + this.callingStatus_tmp)
        if (this.e911UserStatus === 'disabled') {
            return this.isDisabled !== 'allowed';
        }
        if (this.e911UserStatus === "enabled_accepted" &&
            this.isDisabled === 'allowed') {
            return false;
        } else {
            return (
                this.isDisabled === 'network-error' ||
                this.isDisabled === 'calls-not-allowed' ||
                this.isDisabled === 'mic-not-allowed' ||
                this.isDisabled === 'e911-declined' ||
                this.isDisabled === 'another-active-call'
            );;
        }
    }
}
