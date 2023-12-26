import {MessageFormatter} from './message-formatter';
import {LogLevel} from '../logger';
import { DatePipe } from '@angular/common';

export class SimpleMessageFormatter implements MessageFormatter {

  public formatMessagePrefix(level: LogLevel, tag: string, timestamp: Date, appName: string): string {
    const datepipe: DatePipe = new DatePipe('en-US')
    let formattedDate = datepipe.transform(timestamp, 'yyyy-MM-dd HH:mm:ss.SSS Z') 
    return `[${formattedDate} ${appName}] [${LogLevel[level].charAt(0)}]`;
    //`${timestamp.toISOString()} [${LogLevel[level].toUpperCase()}] ${tag} `;
  }

}
