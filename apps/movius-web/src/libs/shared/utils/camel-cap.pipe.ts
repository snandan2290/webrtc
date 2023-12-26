import { Pipe, PipeTransform } from '@angular/core';
import { capitalizeFirstLetter, toSpacedCamelCase } from './common-utils';

@Pipe({
  name: 'camelCap'
})
export class CamelCapPipe implements PipeTransform {

  transform(value: string, ...args: unknown[]): string {
    return capitalizeFirstLetter(toSpacedCamelCase(value));
  }

}
