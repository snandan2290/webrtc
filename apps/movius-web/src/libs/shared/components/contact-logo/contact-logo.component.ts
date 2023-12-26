import { ChangeDetectionStrategy, ChangeDetectorRef, Component, ElementRef, Input, OnInit } from '@angular/core';
import { Contact } from '@movius/domain';
import { UserContact, UserContactGhost } from '../../../feature-contacts/models';
import { pxInRem } from '../../utils';
import {AuthDataAccessService} from '../../services/auth.data-access.service'
type ContactModel = Contact | UserContact | UserContactGhost;
type ContactInput = ContactModel | ContactDummy;

export interface ContactDummy {
    dummyFirstName: string;
    dummyLastName: string;
    dummyImg : string;
}

export interface ContactLogoView {
    hasImage: boolean,
    hasFirstName: boolean,
    hasLastName: boolean,
    hasAnyName: boolean,
}

export interface ContactLogoViewData {
    firstName?: string;
    lastName?: string;
    img?: string;
}

@Component({
    selector: 'movius-web-contact-logo',
    templateUrl: './contact-logo.component.html',
    styleUrls: ['./contact-logo.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ContactLogoComponent implements OnInit {

    public static readonly defContainerWidthInRem = 2.5;

    @Input()
    set peer(val: ContactModel | ContactDummy) {
        if (!!val) {
            const initial = this.fromInputToView(val);
            this.view = initial;
        }
    };
    isGroupImage = false;
    @Input() externalStyleClass: string;
    @Input() alt: string;
    @Input() doZoomLetters: boolean = false;
    @Input() isMuted: boolean = false;
    @Input() isGroup:boolean = false;

    view: ContactLogoView & ContactLogoViewData = {
        hasImage: false,
        hasAnyName: false,
        hasFirstName: false,
        hasLastName: false
    };

    constructor(private readonly _elRef: ElementRef,private AuthDataAccessService:AuthDataAccessService,private cdr:ChangeDetectorRef) {
    }

    ngOnInit(): void {
        // this.AuthDataAccessService.themeupdate.subscribe(res=>{
        //     this.cdr.markForCheck();
        //     this.cdr.detectChanges();
        // })
        // document.getElementById('unregistred_icon').style.display = 'none';
    }

    ngAfterViewInit(){
        this.AuthDataAccessService.themeupdate.subscribe(res=>{
            this.cdr.markForCheck();
            this.cdr.detectChanges();
        })
    }

    hasImage(peer: UserContact) {
        return !!(peer?.img);
    }

    hasFirstName(peer: UserContact) {
        return !!(peer?.contact?.firstName);
    }

    hasLastName(peer: UserContact) {
        return !!(peer?.contact?.lastName);
    }

    hasAnyName(peer: UserContact) {
        return (this.hasFirstName(peer) || this.hasLastName(peer));
    }

    GetTheme(){
        let theme = localStorage.getItem("Theme")
        return theme ? "Dark" : null
    }


    getZoom() {
        return (this._elRef.nativeElement.clientWidth !== ContactLogoComponent.defContainerWidthInRem && this.doZoomLetters) ?
            (this._elRef.nativeElement.clientWidth / pxInRem / ContactLogoComponent.defContainerWidthInRem) : 1;
    }

    private fromInputToView(src: ContactModel | ContactDummy): ContactLogoView & ContactLogoViewData {
        if(this.isUserContactGhost(src)){
            this.isGroupImage = this.isGroups(src.multiLine)
            return this.fromGhostToView(src);
        }else if (this.isUserContact(src)){
            return this.fromUserContactToView(src);
        }else if (this.isContactDummy(src)){
            return this.fromDummyToView(src);
        }else {
            return this.fromContactToView(src);
        }
    }

    isGroups (number:string) {
        const groupParticipants = sessionStorage.getItem(number);
        if (groupParticipants !== 'undefined' && groupParticipants != null && groupParticipants !== "\"\"") {
            const participants = groupParticipants.split('|');
            if (participants.length > 2) {
                return true;
            }
        }
        return false;
    }

    private fromContactToView(src: Contact): ContactLogoView & ContactLogoViewData {
        const isFn = !!(src?.firstName);
        const isLn = !!(src?.lastName);
        const isImg = !!(src?.img);
        const view = {
            hasImage: isImg,
            hasFirstName: isFn,
            hasLastName: isLn,
            hasAnyName: isFn || isLn,
            // isWhatsAppContact: src?.isWhatsAppContact
        }
        return {...view,
            firstName: src?.firstName,
            lastName: src?.lastName,
            img: src?.img
        };
    }

    private fromDummyToView(src: ContactDummy): ContactLogoView & ContactLogoViewData {
        const dummyCnt: Contact = {
            id: 0,
            type: 'personal',
            firstName: src?.dummyFirstName,
            lastName: src?.dummyLastName,
            img: src?.dummyImg,
            addresses: null,
            phones: null,
            emails: null,
        };
        return this.fromContactToView(dummyCnt);
    }

    private fromGhostToView(src: UserContactGhost): ContactLogoView & ContactLogoViewData {
        const cont = src?.contact;
        return this.fromContactToView(cont);
    }

    private fromUserContactToView(src: UserContact): ContactLogoView & ContactLogoViewData {
        const cont = src?.contact;
        return this.fromContactToView(cont);
    }

    private isUserContactGhost(src: ContactInput): src is UserContactGhost {
        return (src as UserContactGhost).multiLineType !== undefined;
    }

    private isUserContact(src: ContactInput): src is UserContact {
        return (src as UserContactGhost).contact !== undefined;
    }

    private isContactDummy(src: ContactInput): src is ContactDummy {
        return (src as ContactDummy).dummyImg !== undefined;
    }

    private getColorForName(name: string): string {
        const hashCode = this.getHashCode(name);
        const hue = hashCode % 360;
        return `hsl(${hue}, 40%, 80%)`;
    }

    private getHashCode(str: string): number {
        try{
            let hash = 0;
            if(str){
                if (str.length === 0) return hash;
                for (let i = 0; i < str.length; i++) {
                    const char = str.charCodeAt(i);
                    hash = (hash << 5) - hash + char;
                    hash = hash & hash;
                }
                //console.log("hash",hash)
                return Math.abs(hash);
            }
            return Math.abs(hash);
        }catch(e){
            console.log(e)
        }

    }

}
