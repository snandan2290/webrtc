import { Directive, ElementRef, HostListener } from '@angular/core';

@Directive({
    selector: 'input[type=number], input[oneNumberOnly]'
})
export class OneNumberInputDirective {

    constructor(private elRef: ElementRef) { }

    @HostListener('input', ['$event']) onInputChange(event) {
      const initialValue = this.elRef.nativeElement.value;
      const replaced = initialValue.replace(/[^0-9]*/g, '');
      const final = replaced?.toString().length > 1 ? replaced.substring(0, 1) : replaced;

      this.elRef.nativeElement.value = final;
      if ( final !== this.elRef.nativeElement.value) {
        event.stopPropagation();
      }
    }

}
