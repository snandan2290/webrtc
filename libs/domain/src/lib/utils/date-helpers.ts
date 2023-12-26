import { parseISO } from 'date-fns';

export const serverDateToISO = (date: string) => {
    if (!date) {
        return null;
    } else {
        if (!date.endsWith('Z')) {
            //date = date + 'Z';
            //return parseISO(date).toISOString();
            return date?.replace(' ', 'T').slice(0, -3) + 'Z';
        }
    }
};
