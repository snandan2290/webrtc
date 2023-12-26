import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
    name: 'highlighText'
})
export class HighlighterPipe implements PipeTransform{
    transform(value: any, args: any,type:string): unknown {
      if(!args || args.length < 2) {
        return value;
      }

      const specials = ['-','[',']','/','{','}','(',')','*','+','?', '.','\\','^','$','|',];
      const rgxEscaper = RegExp('[' + specials.join('\\') + ']', 'gim');
      args = args.replace(rgxEscaper, '\\$&');
      const re = new RegExp(`\\\\?${args}` + `(?!([^<]+)?>)`, 'gim');
      const match = value.match(re);
      if (!match) {
        return value;
      }
      value = value.replace(re, '<span class="highlighted-text">$&</span>');
      return value;
    }
}