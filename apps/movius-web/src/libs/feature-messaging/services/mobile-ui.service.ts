import { Injectable } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { Location } from '@angular/common';
@Injectable({
    providedIn: 'root',
})
export class MobileUiService {
    public isMobileDevice: boolean = false;
    public classesForList: any = {};
    public classesForMsgHistory: any = {};
    public stylesForList: any = {};
    public stylesForMsgHistory: any = {};
    public isHideChatList: boolean = false;
    public isHideChatHistory: boolean = false;
    public hideChatListSubject = new BehaviorSubject<boolean>(false);
    public hideChatHistorySubject = new BehaviorSubject<any>(false);
    public isFromMobileDevice = new BehaviorSubject<boolean>(false);

    private history: string[] = [];

    constructor(private router: Router, private location: Location) {
        this.isMobileDevice = ((sessionStorage.getItem('Contex_res')?.toLowerCase() === "ios") || (sessionStorage.getItem('Contex_res')?.toLowerCase() === "android"))
            ? true : false;
        if (!this.isMobileDevice) {
            this.hideChatListSubject.next(true);
            this.hideChatHistorySubject.next(false);
        }
    }

    hideChatList(hideorshow: boolean) {
        this.hideChatListSubject.next(hideorshow);
    }

    hideChatHistory(hideorshow: boolean) {
        this.hideChatHistorySubject.next(hideorshow);
    }

    getHideChatListSubjectValue(): any {
        return this.hideChatListSubject;
    }

    getHideChatHistorySubjectValue(): any {
        return this.hideChatHistorySubject;
    }

    showHideListAndChatHistoryTwo() {
        console.log(
            'this.isHideChatList',
            this.isHideChatList,
            'this.isHideChatHistory',
            this.isHideChatHistory
        );
        this.classesForList = {
            messages__splitter: this.isMobileDevice,
            'messages__splitter--first': this.isMobileDevice,
            messages__general: this.isMobileDevice,
        };
        this.stylesForList = {
            display: this.isHideChatList ? 'block' : 'none',
        };
        this.classesForMsgHistory = {
            messages__splitter: this.isMobileDevice,
            'messages__splitter--second': this.isMobileDevice,
            messages__details: this.isMobileDevice,
            messages__splitter_full: this.isMobileDevice,
        };
        this.stylesForMsgHistory = {
            display: this.isHideChatHistory ? 'block' : 'none',
        };
        console.log(
            'this.classesForList',
            this.classesForList,
            'this.stylesForList',
            this.stylesForList,
            'this.classesForMsgHistory',
            this.classesForMsgHistory,
            'this.stylesForMsgHistory',
            this.stylesForMsgHistory
        );
    }

    public startSaveHistory(): void {
        this.router.events.subscribe((event) => {
            if (event instanceof NavigationEnd) {
                this.history.push(event.urlAfterRedirects);
            }
        });
    }

    public getHistory(): string[] {
        return this.history;
    }

    public goBack(): void {
        this.history.pop();

        if (this.history.length > 0) {
            this.location.back();
        } else {
            this.router.navigateByUrl('/');
        }
    }

    public getPreviousUrl(): string {
        if (this.history.length > 0) {
            return this.history[this.history.length - 2];
        }

        return '';
    }
}
