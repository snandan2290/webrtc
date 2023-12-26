import { Injectable } from '@angular/core';
import {
    differenceInHours,
    differenceInMinutes,
    differenceInSeconds,
    isBefore,
    isToday,
    isYesterday,
    parseISO,
    startOfYesterday,
    format,
} from 'date-fns';

enum TimeCase {
    Today = 'Today',
    Yesterday = 'Yesterday',
    Older = 'Older'
}

@Injectable({ providedIn: 'root' })
export class DateTimeService {

  constructor() { }

  formatHistoryTime(historyTime: string): string {
    const time = parseISO(historyTime);
    const timeCase = this.detectTimeCase(time);
    switch(timeCase){
        case TimeCase.Today: {
            return format(time, 'h:mm a');
        }
        case TimeCase.Yesterday: {
            return `${format(time, 'dd/MM')}`;
        }
        case TimeCase.Older:
        default: {
            return `${format(time, 'dd/MM')}`;
        }
    }
  }

  formatHistoryDate(historyTime: string): string {
    const time = parseISO(historyTime);
    const timeCase = this.detectTimeCase(time);
    switch (timeCase) {
        case TimeCase.Today: {
            return `Today`;
        }
        case TimeCase.Yesterday: {
            return `Yesterday`;
        }
        case TimeCase.Older:
        default: {
            let day = time.getDate();
            let month = new Intl.DateTimeFormat('en-US', {
                month: 'long',
            }).format(time);
            let formattedDate = `${day} ${month}`;
            return formattedDate;
        }
    }
  }

  formatOnlyTimeDefault(historyTime: string) {
    const time = parseISO(historyTime);
    return `${format(time, 'h:mm a')}`;
  }

  private detectTimeCase(time: Date) {
      if(isToday(time)){
          return TimeCase.Today;
      }
      if(isYesterday(time)){
          return TimeCase.Yesterday;
      }
      const yesterday = startOfYesterday();
      if(isBefore(time, yesterday)){
          return TimeCase.Older;
      }
  }
}
