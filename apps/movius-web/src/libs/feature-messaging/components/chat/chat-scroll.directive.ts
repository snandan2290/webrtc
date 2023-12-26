import {
    Directive,
    ElementRef,
    EventEmitter,
    Input,
    Output,
} from '@angular/core';
@Directive({
    selector: '[moviusWebChatScroll]',
})
export class ChatScrollDirective {
    @Output() appInfiniteScroll = new EventEmitter<void>();
    private intersectionObserver: IntersectionObserver;
    constructor(private el: ElementRef) {}
    initialLoad: boolean = false;
    ngAfterViewInit() {
        const element = document.getElementsByClassName('chatscroll');
        let chatContainer =
            element.length > 0
                ? new ElementRef(element[0]).nativeElement
                : null;

        this.intersectionObserver = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    if (
                        chatContainer.scrollHeight > chatContainer.clientHeight
                    ) {
                        this.appInfiniteScroll.emit();
                    } else if (!this.initialLoad) {
                        this.initialLoad = true;
                        this.appInfiniteScroll.emit();
                    }
                }
            });
        });

        this.intersectionObserver.observe(this.el.nativeElement);
    }
}
