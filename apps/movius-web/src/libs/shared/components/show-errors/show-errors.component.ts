import { Component, Input, OnInit } from '@angular/core';
import { AbstractControl, AbstractControlDirective } from '@angular/forms';
import { regexMnemonics } from '../../utils';

@Component({
    selector: 'movius-web-show-errors',
    templateUrl: './show-errors.component.html',
    styleUrls: ['./show-errors.component.scss'],
})
export class ShowErrorsComponent implements OnInit {
    @Input()
    set control(value) {
        this._control = value;
    }
    get control() {
        return this._control;
    }

    @Input()
    customValidationMessage: string | { [key: string]: string };

    getCustomValidationMessage() {
        if (
            !this.control ||
            !this.control.errors ||
            this.control.errors.length === 0
        ) {
            return null;
        }
        if (typeof this.customValidationMessage === 'object') {
            const error = Object.keys(this.control.errors)[0];
            return this.customValidationMessage[error];
        } else {
            return this.customValidationMessage;
        }
    }

    private static readonly errorMessages = {
        required: () => 'This field is required',
        minlength: (params) =>
            'The min number of characters is ' + params.requiredLength,
        maxlength: (params) =>
            'The max allowed number of characters is ' + params.requiredLength,
        pattern: (params) =>
            'The required pattern is: ' +
                regexMnemonics[params.requiredPattern] ||
            params.requiredPattern,
        email: () => 'This field should be email',
        tldEmail: () => 'This field should be email',
        //TODO CB:22Jan2021: Consider custom validators' usage. e.g.:
        //TODO CB:22Jan2021: 'telephoneNumbers': (params) => params.message,
    };
    private _control: AbstractControlDirective | AbstractControl;

    shouldShowErrors(): boolean {
        return (
            this.control &&
            this.control.errors &&
            (this.control.dirty || this.control.touched)
        );
    }

    listOfErrors(): string[] {
        return !!this.control.errors
            ? Object.keys(this.control.errors).map((field) =>
                  this.getMessage(field, this.control.errors[field])
              )
            : [];
    }

    private getMessage(type: string, params: any) {
        return ShowErrorsComponent.errorMessages[type](params);
    }

    ngOnInit(): void {}
}
