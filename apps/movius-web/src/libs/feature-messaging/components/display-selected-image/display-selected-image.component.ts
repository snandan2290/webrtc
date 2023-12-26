import { Component, EventEmitter, Input, OnInit, Output } from "@angular/core";
import { Router } from "@angular/router";
import * as bowser from "bowser";
import { allowedSpecialCharacters, cleanPhoneNumber, getPeerNumberWOSpecialChars } from "../../../shared/utils/common-utils";
import { MMSService } from '../../services/mms.service'

@Component({
    selector: 'display-selected-image',
    templateUrl: './display-selected-image.component.html',
    styleUrls: ['./display-selected-image.component.scss'],
})
export class DisplaySelectedImageComponent implements OnInit {
    @Output() imagePreviewCancel = new EventEmitter();
    @Input() imageBlob: any;
    @Output() sendMMSEvent = new EventEmitter();
    @Output() sendNewMMSEvent = new EventEmitter();
    @Output() msgFormError = new EventEmitter();
    @Input() messageFormError: any;
    private allowedCharcs: string[] = [
        '-', '+', '(', ')', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9', ','
    ];
    private _emergencyNumbers: string[] = [
        "119", "129", "17", "911", "112", "113", "102", "000", "999", "211",
        "117", "110", "122", "190", "993", "132", "133", "123", "111", "106",
        "11", "101", "991", "1730", "22", "191", "114", "199", "100", "130",
        "103", "193", "997", "18", "66", "902", "1011", "118", "0000", "15",
        "105", "995", "10111", "115", "197", "155", "903", "901", "192", "194", "108"
    ];
    _selectedContactMultiline: string;
    @Input() set selectedContactMultiline(newValue: string) {
        this._selectedContactMultiline = newValue;
    }

    get selectedContactMultiline(): string {
        return this._selectedContactMultiline;
    }
    getConnectionErrorValue: boolean = false;

    constructor(private router:Router , private mmsService : MMSService){}

    ngOnInit(): void {
        window.addEventListener('keydown', event => {
            if(event.key === "Enter") {
                this.onSendMMS();
            }
        });
        this.mmsService.isImageTypeGif.subscribe((res) => {
            this.imagePreviewCancel.emit();
            this.mmsService.updatePreviewImageCancelStatus(false)
        })
    }

    cancelPreview() {
        this.imagePreviewCancel.emit();
        this.mmsService.updatePreviewImageCancelStatus(false)
    }

    onSendMMS() {
        if(this.getConnectionErrorValue || this.disableSendButton){
            return
        }
        const url = this.router.url
        if (url.includes("/messaging/chat/new") || url.includes("/messaging/chat/edit")) {
            this.sendNewMMSEvent.emit(this.imageBlob.file);
        } else {
            this.sendMMSEvent.emit(this.imageBlob.file);
        }
    }

    get disableSendButton(){
        const url = this.router.url
        if(!url.includes("/messaging/chat/edit") && !url.includes("/messaging/chat/new")) return false
        return this.messageError === null ? false : true
    }

    messageErrorWrpr() {
        //CB:16May2021: TECH-DEBT: Divergant changes - similar logic is detected in new-call-workspace.component.ts
        //CB:16May2021: TECH-DEBT: Divergant changes - refactor.
        const destination = this.selectedContactMultiline;
        if (!destination || destination.length == 0) {
            return 'empty-destination';
        } else if ([',', ';', '#'].some((char) => destination.includes(char))) {
            return 'conference-destination';
        } else if (sessionStorage.getItem("__api_identity__") === getPeerNumberWOSpecialChars(destination)) {
            return 'self-destination';
        } else if (allowedSpecialCharacters(destination, this.allowedCharcs)) {
            return 'specialCharacterValidation';
        } else if (destination === null) {
            return 'invalid-data';
        } else if (/\D/.test(destination)) {
            const clear = cleanPhoneNumber(destination);
            return /\D/.test(clear) ? 'invalid-number' : null;
        } else if (this._emergencyNumbers.indexOf(destination) !== -1) {
            return 'destination-emergency-error'
        }
        return null;
    }

    get messageError() {
        const err = this.messageErrorWrpr()
        this.msgFormError.emit(err);
        return err
    }

    public getConnectionError(event: any) {
        this.getConnectionErrorValue = event;
    }
}
