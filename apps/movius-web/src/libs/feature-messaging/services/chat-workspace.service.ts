import { ElementRef, Injectable } from '@angular/core';
import { Subject,  BehaviorSubject} from 'rxjs';


export type ScrollToBottomFlag = 'none' | 'ignoreWhenOffset';

@Injectable()
export class ChatWorkspaceService {
    private readonly _scrollToBottom = new Subject<ScrollToBottomFlag>();
    private nameSource = new BehaviorSubject<string>('');
    name = this.nameSource.asObservable()

    onScrollToBottom(flag: ScrollToBottomFlag = 'none') {
        // give time to render items
        //console.log('ChatWorkspaceService:onScrollToBottom', flag);
        setTimeout(() => {
            this._scrollToBottom.next(flag);
        }, 0);
    }

    get scrollToBottom() {
        return this._scrollToBottom.asObservable();
    }

    changeName(name: string) {
        this.nameSource.next(name);
    }

    getElementByclass(classname: string): ElementRef | null {
        const element = document.getElementsByClassName(classname);
        return element.length > 0 ? new ElementRef(element[0]) : null
    }
}
