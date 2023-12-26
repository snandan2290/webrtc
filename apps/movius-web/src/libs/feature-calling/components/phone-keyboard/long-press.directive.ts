import {
    Directive,
    ElementRef,
    EventEmitter,
    Input,
    OnDestroy,
    Output,
} from '@angular/core';
import { timeStamp } from 'console';
import { fromEvent, merge, of, Subscription, timer } from 'rxjs';
import {
    filter,
    map,
    switchMap,
    tap,
    take,
    distinctUntilChanged,
    mapTo,
    debounceTime,
} from 'rxjs/operators';

@Directive({
    selector: '[moviusWebLongPress]',
})
export class LongPressDirective implements OnDestroy {
    private eventSubscribe: Subscription;

    @Input()
    mouseLongPressThreshold = 2000;

    @Output()
    mouseLongPress = new EventEmitter();

    @Output()
    mouseJustClick = new EventEmitter();

    constructor(private elementRef: ElementRef) {
        const mousedown = fromEvent<MouseEvent>(
            elementRef.nativeElement,
            'mousedown'
        ).pipe(
            filter((event) => event.button == 0), // Only allow left button (Primary button)
            map((event) => true) // turn on threshold counter
        );
        const touchstart = fromEvent(
            elementRef.nativeElement,
            'touchstart'
        ).pipe(map(() => true));
        const touchEnd = fromEvent(elementRef.nativeElement, 'touchend').pipe(
            map(() => false)
        );
        const mouseup = fromEvent<MouseEvent>(
            elementRef.nativeElement,
            'mouseup'
        ).pipe(
            filter((event) => event.button == 0),
            tap((event) => {
                event.stopPropagation();
                event.preventDefault();
            }), // Only allow left button (Primary button)
            map(() => false) // reset threshold counter
        );
        let skipNext = false;
        this.eventSubscribe = merge(mousedown, mouseup, touchstart, touchEnd)
            .pipe(
                distinctUntilChanged(),
                switchMap((state) => {
                    return state
                        ? timer(this.mouseLongPressThreshold).pipe(mapTo(true))
                        : of(false);
                })
            )
            .subscribe((value) => {
                if (!skipNext) {
                    if (value) {
                        this.mouseLongPress.emit();
                        skipNext = true;
                    } else {
                        this.mouseJustClick.emit();
                    }
                } else {
                    skipNext = false;
                }
            });
    }

    ngOnDestroy(): void {
        if (this.eventSubscribe) {
            this.eventSubscribe.unsubscribe();
        }
    }
}
