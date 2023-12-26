import { Directive, ElementRef, EventEmitter, Output } from '@angular/core';

@Directive({
    selector: '[moviusWebThreadScroll]',
})
export class ThreadScrollDirective {

    @Output() appInfiniteScroll = new EventEmitter<void>();
    private intersectionObserver: IntersectionObserver;

    constructor(private el: ElementRef) {}

    ngAfterViewInit() {
        this.intersectionObserver = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    this.appInfiniteScroll.emit();
                }
            });
        });

        this.intersectionObserver.observe(this.el.nativeElement);
    }

    handleIntersect(entries, observer) {
        entries.forEach((entry) => {
            console.log("is intersecting.")
        });
      }

    ngOnDestroy() {
        this.intersectionObserver.disconnect();
    }
}
