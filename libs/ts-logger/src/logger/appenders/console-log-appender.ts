import {LogAppender} from './log-appender';
import {LogLevel} from '../logger';

export class ConsoleLogAppender implements LogAppender{

  /***************************************************************************
   *                                                                         *
   * Fields                                                                  *
   *                                                                         *
   **************************************************************************/

  private readonly isIE: boolean;

  /***************************************************************************
   *                                                                         *
   * Constructor                                                             *
   *                                                                         *
   **************************************************************************/

  constructor(forceIe = false){
    this.isIE = forceIe || navigator.appName === 'Microsoft Internet Explorer' ||
      !!(navigator.userAgent.match(/Trident/) ||
        navigator.userAgent.match(/rv:11/));
  }

  /***************************************************************************
   *                                                                         *
   * Public API                                                              *
   *                                                                         *
   **************************************************************************/

  public appendLog(level: LogLevel, messagePrefix: string, message: string, additional: any[]): void {
    this.log(level, messagePrefix, message, additional);
  }

  /***************************************************************************
   *                                                                         *
   * Private methods                                                         *
   *                                                                         *
   **************************************************************************/


  private log(level: LogLevel, messagePrefix: string, message: string, additional: any[]): void {
    // Coloring doesn't work in IE
    if (this.isIE) {
      this.logIE(level, messagePrefix + ' ' + message, additional);
    }else {
      const color = this.getColor(level);
      console.log(`%c${messagePrefix} `, `color:${color}`, message, ...additional);
    }
  }

  private logIE(level: LogLevel, formattedMessage: string, additional: any[]): void {
    switch (level) {
      case LogLevel.Info:
        console.info(formattedMessage, ...additional);
        break;
      case LogLevel.Warn:
        console.warn(formattedMessage, ...additional);
        break;
      case LogLevel.Error:
        console.error(formattedMessage, ...additional);
        break;
      default:
        console.log(formattedMessage, ...additional);
        break;
    }
  }

  private getColor(level: LogLevel): string {
    switch (level) {
      case LogLevel.Trace:
        return 'blue';
      case LogLevel.Debug:
        return 'teal';
      case LogLevel.Info:
        return 'gray';
      case LogLevel.Warn:
        return 'orange';
      case LogLevel.Error:
        return 'red';
    }
  }

}
