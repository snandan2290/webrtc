import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MobileUiService } from '../../../feature-messaging/services/mobile-ui.service';
import { Observable } from 'rxjs';
import { MessagingWorkspaceView } from '../../../feature-messaging/components';

@Component({
    selector: 'pane-frame',
    templateUrl: './pane-frame.component.html',
    styleUrls: ['./pane-frame.component.scss'],
})
export class PaneFrameComponent implements OnInit {
    readonly view$: Observable<MessagingWorkspaceView>;
    //CB: DEBT: 17Dec2020: Default parts of Pane seem to become obsolete. Consider to remove.
    @Input()
    emphasizeHeader: boolean = false;
    @Input()
    includeDefaultHeader: boolean = true;
    @Input()
    includeDefaultBody: boolean = true;
    @Input()
    includeDefaultFooter: boolean = true;
    @Input()
    isBodyCentered: boolean = false;
    @Input()
    isMobileDevice: boolean = false;
    @Input()
    urlId: any;
    @Input()
    classesForList: any;
    @Input()
    stylesForList: any;
    isHideChatList: boolean = false;
    isHideChatHistory: boolean = false;
    public classesForMsgHistory: any = {};
    public stylesForMsgHistory: any = {};
    @Input() isChatHeight = false;
    @Input() scrollClass:string = ''
    @Output()
    backBtnClicked = new EventEmitter<boolean>();
    @Output()
    isBackBtnClicked = new EventEmitter<boolean>();
    isComposeMessageScreen: boolean = false;
    constructor(
        private readonly router: Router,
        private route: ActivatedRoute,
        private mobileUiService: MobileUiService
    ) {
        this.mobileUiService.hideChatListSubject.subscribe((val) => {
            this.isHideChatList = val;
        });
        this.mobileUiService.hideChatHistorySubject.subscribe((val) => {
            this.isHideChatHistory = val;
        });
        if (this.router.url.includes('messaging/chat/new')) {
            this.isComposeMessageScreen = true;
        }
        // const calcScreenHeight = () => {
        //     return 'innerHeight' in window
        //         ? window.innerHeight
        //         : document.documentElement.offsetHeight;
        // };
        // console.log('calcScreenHeight', calcScreenHeight())
    }

    // getChatHeight() {
    //     return this.includeDefaultFooter ? "pane__body_min_height" :
    //     "pane__body";
    // }

    ngOnInit(): void {
        this.isMobileDevice = ((sessionStorage.getItem('Contex_res')?.toLowerCase() === "ios") || (sessionStorage.getItem('Contex_res')?.toLowerCase() === "android"))
            ? true : false;
    }

    backToChatList() {
        // this.router.routeReuseStrategy.shouldReuseRoute = () => false;
        // this.router.navigate([`/messaging/chat/${this.urlId}`], {
        //     relativeTo: this.route,
        // });

        // window.location.reload();

        this.backBtnClicked.emit(true);
        this.isBackBtnClicked.emit(true);

        // this.mobileUiService.hideChatHistory(false);
        // this.mobileUiService.hideChatList(true);


        // let getHistory = this.mobileUiService.getHistory();
        // console.log(getHistory[0]);
        // console.log(this.mobileUiService.getPreviousUrl());
        // this.router.navigateByUrl(getHistory[0]);



        // this.mobileUiService.goBack();

        // this.mobileUiService.hideChatListSubject.subscribe((val) => {
        //     this.isHideChatList = val;
        // });
        // this.mobileUiService.hideChatHistorySubject.subscribe((val) => {
        //     this.isHideChatHistory = val;
        // });
        // console.log(
        //     'this.isHideChatList',
        //     this.isHideChatList,
        //     'this.isHideChatHistory',
        //     this.isHideChatHistory
        // );
        // this.classesForList = {
        //     messages__splitter: this.isMobileDevice,
        //     'messages__splitter--first': this.isMobileDevice,
        //     messages__general: this.isMobileDevice,
        // };
        // this.stylesForList = {
        //     display: this.isHideChatList ? 'block' : 'none',
        // };
        // this.classesForMsgHistory = {
        //     messages__splitter: this.isMobileDevice,
        //     'messages__splitter--second': this.isMobileDevice,
        //     messages__details: this.isMobileDevice,
        //     messages__splitter_full: this.isMobileDevice,
        // };
        // this.stylesForMsgHistory = {
        //     display: this.isHideChatHistory ? 'block' : 'none',
        // };
        // console.log(
        //     'this.classesForList',
        //     this.classesForList,
        //     'this.stylesForList',
        //     this.stylesForList,
        //     'this.classesForMsgHistory',
        //     this.classesForMsgHistory,
        //     'this.stylesForMsgHistory',
        //     this.stylesForMsgHistory
        // );
    }

    // getFooterStyle() {
    //     // return this.isMobileDevice ? 'pane__footer_mob' : 'pane__footer_browser';
    //     if (this.isMobileDevice) {
    //         return 'pane__footer_mob';
    //     } else if (this.isChatHeight && !this.isMobileDevice) {
    //         return 'pane__footer_side_by_side';
    //     } else {
    //         return 'pane__footer_browser';
    //     }
    // }

    getFooterStyle() {
        return this.isMobileDevice ? 'pane__footer_mob' : 'pane__footer';
    }
}
