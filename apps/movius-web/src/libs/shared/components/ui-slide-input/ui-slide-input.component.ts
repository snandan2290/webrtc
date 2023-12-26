import {
    Component,
    ElementRef,
    EventEmitter,
    Input,
    OnInit,
    Output,
    ViewChild,
} from '@angular/core';
import {
    AbstractControl,
    AbstractControlDirective,
    ControlContainer,
    FormGroup,
    FormGroupDirective,
} from '@angular/forms';

@Component({
    selector: 'movius-web-ui-slide-input',
    templateUrl: './ui-slide-input.component.html',
    styleUrls: ['./ui-slide-input.component.scss'],
    viewProviders: [
        {
            provide: ControlContainer,
            useExisting: FormGroupDirective,
        },
    ],
})
export class UiSlideInputComponent implements OnInit {
    @ViewChild('inputFieldControl', { read: ElementRef })
    inputFieldControlEl: ElementRef;
    @ViewChild('inputField', { read: ElementRef }) inputFieldEl: ElementRef;

    // CB: 19Apr2021: INFO - For validation provide either:
    // {inputFormControlName and form} set of input properties
    // OR
    // {control} single input property.
    @Input()
    inputFormControlName;
    @Input()
    uiTitle;
    @Input()
    cyAttribute;
    @Input()
    doSlideTitle: boolean = true;
    @Input()
    control: AbstractControlDirective | AbstractControl;
    @Input()
    form: FormGroup;
    @Input()
    customValidationMessage: string | { [key: string]: string };
    @Input()
    isDate = false;
    @Input()
    isNumber = false;
    @Input()
    MandatoryStar:any;
    // @Input()
    // canGrowHeight = true;

    @Output()
    onInput = new EventEmitter();

    currentActive = false;
    constructor() {}

    ngOnInit(): void {}

    get getHeaderVisibility() {
        // if(!this.canGrowHeight) {
        //     return 'visible';
        // }
        const hasAnyValue =
            !!this.control?.value ||
            !!this.inputFieldControlEl?.nativeElement?.value ||
            !!this.inputFieldEl?.nativeElement?.value;

        return (this.currentActive || hasAnyValue) ? 'visible' : 'hidden';
    }

    // get getDisplayProperty() {
    //     if(this.canGrowHeight) {
    //         return 'flex';
    //     }
    //     return !!this.currentActive ||
    //     this.inputFieldControlEl?.nativeElement?.value ||
    //     this.inputFieldEl?.nativeElement?.value
    //     ? 'flex'
    //     : 'none';
    // }

    get isRequiredControl() {
        const abs = this.control as AbstractControl;
        const validator = abs?.validator
            ? abs.validator({} as AbstractControl)
            : null;
        return validator && validator.required;
    }

    onInputHandler(event: InputEvent) {
        this.onInput?.emit(event);
    }
}
