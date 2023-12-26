import { Component, OnInit, Output } from '@angular/core';
import { Subject } from 'rxjs';

@Component({
    selector: 'movius-web-empty-messages',
    templateUrl: './empty-messages.component.html',
    styleUrls: ['./empty-messages.component.scss']
})
export class EmptyMessagesComponent implements OnInit {

    @Output() isMessageClicked: Subject<boolean> = new Subject();

    constructor() { }

    ngOnInit(): void {
    }

    onMessage() {
        this.isMessageClicked.next(true);
    }

    GetTheme(){
        let theme = localStorage.getItem("Theme")
        return theme ? "Dark" : null
    }

}
