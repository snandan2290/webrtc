import {LogLevel} from '../logger';

export interface MessageFormatter {

  formatMessagePrefix(level: LogLevel, tag: string, timestamp: Date, appName: string): string;

}
