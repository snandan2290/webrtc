import {LogLevel} from '../logger';

export interface LogAppender {
  appendLog(level: LogLevel, messagePrefix: string, message: string, args: any[]): void;
}
