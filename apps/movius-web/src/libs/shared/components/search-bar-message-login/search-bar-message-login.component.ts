import {
    ChangeDetectionStrategy,
    Component,
    ElementRef,
    EventEmitter,
    OnInit,
    Output,
    ViewChild,
} from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Component({
    selector: 'movius-web-search-bar-message-login',
    templateUrl: './search-bar-message-login.component.html',
    styleUrls: ['./search-bar-message-login.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SearchBarMessageLoginComponent implements OnInit {
    searchTerm: string;
    isMobileDevice:boolean;
    @ViewChild('searchInput') searchInputRef: ElementRef<HTMLElement>;
    @Output() changed = new EventEmitter<string>();
    @Output() isActivated = new BehaviorSubject(false);
    showSuggetion:boolean = false

    constructor() {
        this.isMobileDevice = ((sessionStorage.getItem('Contex_res')?.toLowerCase() === "ios") || (sessionStorage.getItem('Contex_res')?.toLowerCase() === "android"))
    }

    ngOnInit(): void {
        this.isActivated.next(false);
    }

    handleChange(value: string) {
        this.showSuggetion = false
        this.changed.emit(value);
    }

    haandleOnChange(value:string){
        if(this.isMobileDevice || !value)
            this.handleChange(value)
    }

    onActivate() {
        this.isActivated.next(true);
        setTimeout(() => {
            this.searchInputRef.nativeElement.focus();
        }, 0);
    }

    onClose() {
        this.clearAll();
        this.isActivated.next(false);
    }

    clearAll() {
        this.searchTerm = '';
        this.handleChange(this.searchTerm);
    }
    focused(){
        this.showSuggetion = true
    }
    blured(){
        this.showSuggetion = false
    }
    checkFilterValue(searchTerm, event) {
        if (searchTerm == '') {
            this.clearAll();
        }else {
            if(event.key != 'Enter'){
                this.showSuggetion = true
            }
        }
    }
}
