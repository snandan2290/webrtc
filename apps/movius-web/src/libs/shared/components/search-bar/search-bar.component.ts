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
import { debounceTime, distinctUntilChanged, map } from 'rxjs/operators';
@Component({
    selector: 'movius-web-search-bar',
    templateUrl: './search-bar.component.html',
    styleUrls: ['./search-bar.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SearchBarComponent implements OnInit {
    searchTerm: string;
    public consoleMessages: string[] = [];
    showSuggetion:boolean = false

    @ViewChild('searchInput') searchInputRef: ElementRef<HTMLElement>;
    @Output() changed = new EventEmitter<string>();
    @Output() isActivated = new BehaviorSubject(false);
    userSearchTextUpdate = new BehaviorSubject<string>('');
    constructor() {
        this.userSearchTextUpdate.pipe(
            debounceTime(400))
            .subscribe((value:string) => {
                value = value.length ? value.trim() : value;
                this.consoleMessages.push(value);
                if(value == ''){
                    this.searchTerm = '';
                    this.changed.emit('');
                    sessionStorage.removeItem('msg_search_content');
                }else{
                    this.changed.emit(value);
                    sessionStorage.setItem('msg_search_content', value.trim());
                }
            });
    }

    ngOnInit(): void {}

    onActivate() {
        this.isActivated.next(true);
        setTimeout(() => {
            this.searchInputRef.nativeElement.focus();
        }, 0);
    }

    onClose() {
        this.userSearchTextUpdate.next('');
        this.isActivated.next(false);
    }

    clearAll() {
        this.userSearchTextUpdate.next('');
        this.isActivated.next(false);
    }

    handleChange(event){
        this.showSuggetion = false
        this.userSearchTextUpdate.next(event)
    }
    focused(){
        this.showSuggetion = true
    }
    blured(){
        this.showSuggetion = false
    }
    GetTheme(){
        let theme = localStorage.getItem("Theme")
        return theme ? "Dark" : null
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
