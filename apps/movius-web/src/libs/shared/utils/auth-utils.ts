import { AbstractControl, ValidationErrors } from '@angular/forms';

export const matchValidator = (matchTo: string): ((AbstractControl) => ValidationErrors | null) => {
    return (control: AbstractControl): ValidationErrors | null => {
        const targetValue = control.value;
        if (!targetValue) {
            return null;
        }
        const parent = control.parent;
        if (!parent) {
            console.warn('You must use matchValuesValidator as a part of a FromGroup')
            return null;
        }
        const sourceValue = parent.controls[matchTo].value;
        return targetValue === sourceValue ? null : { mismatch: true };
    };
};