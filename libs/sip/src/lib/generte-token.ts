const randomString = (length: number, chars: string): string => {
    let result = '';
    for (let i = length; i > 0; --i) {
        result += chars[Math.round(Math.random() * (chars.length - 1))];
    }
    return result;
};

export const generateToken = () =>
    randomString(
        32,
        [
            '0123456789',
            'abcdefghijklmnopqrstuvwxyz',
            'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
        ].join('')
    );
