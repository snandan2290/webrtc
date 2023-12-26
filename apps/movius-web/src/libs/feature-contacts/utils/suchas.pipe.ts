import { Pipe, PipeTransform } from '@angular/core';

@Pipe({name: 'suchAs'})
export class SuchAsPipe<T> implements PipeTransform {
    transform(value: T[], suchAs: (e) => boolean):any {
        if(!!suchAs){
            return value.filter(e => suchAs(e));
        }
        return value;
    }
}