export type CallNowPayload = {
    callNow: boolean;
    hash: string;
}

export const getCallNowPayload = () => {
   const payload: CallNowPayload = {
       callNow: true,
       hash: getCallNowHash(),
   }
   return payload;
};

export const getCallNowHash = () => {
    return (Math.random() + 1).toString().substring(2)
};
