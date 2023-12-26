import * as uuid from 'uuid';
import { elKEmitterSubject } from '../../../../apps/movius-web/src/libs/shared/utils/work-service'
import {LogAppender, ConsoleLogAppender} from './appenders/index';
import {MessageFormatter, SimpleMessageFormatter} from './format/index';


export enum LogLevel {
  Trace,
  Debug,
  Info,
  Warn,
  Error
}


export class LoggerConfiguration {

  public appender: LogAppender;
  public formatter: MessageFormatter;
  public maxLevel: LogLevel;

  constructor(){
    this.appender = new ConsoleLogAppender();
    this.formatter = new SimpleMessageFormatter();
    this.maxLevel = LogLevel.Trace;
    // if(sessionStorage.getItem("LoggerLevel") == null){
    //   sessionStorage.setItem("LoggerLevel",'0')
    //   console.log("log level === ",sessionStorage.getItem("LoggerLevel"));
    // }else
    //   console.log("log level === ",sessionStorage.getItem("LoggerLevel"));
  }

  public withMaxLevel(maxLevel: LogLevel): this {
    this.maxLevel = maxLevel;
    return this;
  }

  public withFormatter(formatter: MessageFormatter): this {
    this.formatter = formatter;
    return this;
  }

  public withAppender(appender: LogAppender): this {
    this.appender = appender;
    return this;
  }

}

export class Logger {
  x_log_idPOST:any;
  gBuffSize = 0;
  gBuffer:string[] = [];
  memTable:number[] = [];
  sessBuffSize = 0;
  isTeamsEnable = false;
  lastSentLogTime:any = new Date().getTime();
  GBUFFSIZELIMIT:number = 2000*1000; // (2000 represented in KiloBytes) by default 2 MB
  GBUFFMINSIZELIMIT:number = 400*1000;
  GBUFFMAXSIZELIMIT:number = 2000*1000;
  GBUFFVARSIZE:number = this.GBUFFSIZELIMIT/4; // (500 represented in KiloBytes) by 0.5MB
  ELK_LOG_LIMIT:number = 350; // (represented in KiloBytes) by default 350KB
  ELK_LOG_MAX_LIMIT:number = 390;
  ELK_LOG_MIN_LIMIT:number = 100;
  ELK_SERVER_DOMAIN = "";
  ELK_POST_USERID = "";
  ELK_POST_USERPWD = "";
  ErrInStoredSessionLogs = false;
  secureADKReqkeys = ["sip_username","sip_password","username","password","myid_token","user_name","userid","otp","tui_password","ami_host","ami_server","channel","auth_address","From", "To", "Subject", "RECIPIENT", "identity", "api_token","password"];
  secureADKResJSONkeys = ["sip_password","sip_username","stun_address","sip_address","adk_address","myid_token","user_name","userid","otp","tui_password","ami_host","ami_server","channel","auth_address","devices","device_number","api_token","email_id","password","user_mail_id"]
  secureADKResXMLkeys = ["sip_password>","sip_username>","stun_address>","sip_address>","adk_address>","myid_token>","user_name>","userid>","otp>","tui_password>","ami_host>","ami_server>","channel>","auth_address>","devices>","device_number>","api_token>","email_id>","password>","user_mail_id>"]
  EncodeString  = "xxxxx"
  unwantedErrorLogFilter = ["WebSocket"]
  isUnwantedErroLog = false
  elkPermissionClick: { addLog: boolean; };


  /***************************************************************************
   *                                                                         *
   * Constructors                                                            *
   *                                                                         *
   **************************************************************************/

  constructor(
    private readonly tag: string,
    private readonly config: LoggerConfiguration
  
    ) {
      elKEmitterSubject.subscribe(value => {
        this.elkPermissionClick = value;
      })
      if(window['GLOBAL_LOG_BUFFER_LIMIT_ELK'] !== undefined){
        if(window['GLOBAL_LOG_BUFFER_LIMIT_ELK']*1000 < this.GBUFFMINSIZELIMIT)
          this.GBUFFSIZELIMIT = this.GBUFFMINSIZELIMIT
        else if(window['GLOBAL_LOG_BUFFER_LIMIT_ELK']*1000 > this.GBUFFMAXSIZELIMIT)
          this.GBUFFSIZELIMIT = this.GBUFFMAXSIZELIMIT
        else
          this.GBUFFSIZELIMIT = window['GLOBAL_LOG_BUFFER_LIMIT_ELK']*1000
        this.GBUFFVARSIZE = this.GBUFFSIZELIMIT/4
      }
      if(window['GLOBAL_ELK_LOG_LIMIT'] !== undefined)
        if(this.ELK_LOG_MAX_LIMIT < window['GLOBAL_ELK_LOG_LIMIT'])
          this.ELK_LOG_LIMIT = this.ELK_LOG_MAX_LIMIT
        else if(this.ELK_LOG_MIN_LIMIT > window['GLOBAL_ELK_LOG_LIMIT'])
          this.ELK_LOG_LIMIT = this.ELK_LOG_MIN_LIMIT
        else
          this.ELK_LOG_LIMIT = window['GLOBAL_ELK_LOG_LIMIT']
      if(window['MOVIUS_EMBEDED_APP'] !== undefined
        && window['MOVIUS_EMBEDED_APP'] === "messaging"
        && sessionStorage.getItem("isLogingViaTeams")==="true")
        this.isTeamsEnable = true;
    }

  /***************************************************************************
   *                                                                         *
   * Public API                                                              *
   *                                                                         *
   **************************************************************************/

  public trace(message: any, ...additional: any[]): void {
    this.log(LogLevel.Trace, message, ...additional);
  }

  public debug(message: any, ...additional: any[]): void {
    this.log(LogLevel.Debug, message, ...additional);
  }

  public info(message: any, ...additional: any[]): void {
    this.log(LogLevel.Info, message, ...additional);
  }

  public warn(message: any, ...additional: any[]): void {
    this.log(LogLevel.Warn, message, ...additional);
  }

  public error(message: any, ...additional: any[]): void {
    this.log(LogLevel.Error, message, ...additional);
  }

  public log(level: LogLevel, message: any, ...additional: any[]): void {
    this.isUnwantedErroLog = false
    if(level < this.config.maxLevel) return;
    if (!message) { 
      message = this.formatContentToString(message)
    }

    this.logInternal(level, message, additional);
  }

  public saveELKpwd(input){
    this.ELK_POST_USERPWD = input;
  }

  async sendPOSTlog(calledMethod?:any) {
    /** method is available to public and 
     * can post logs to ELK server 
     * only when ELK details are available */
    if(this.ELK_SERVER_DOMAIN !== "" && this.ELK_POST_USERID !== "" && this.ELK_POST_USERPWD !== ""){
      const auth = 'Basic ' + btoa(`${this.ELK_POST_USERID}:${this.ELK_POST_USERPWD}`);
      const x_movius_log_env = window['MOVIUS_API_BASE_URL'].split('/')[2].split('.')[0];
      const x_movius_log_device_type = 'MLDT';
      const x_movius_log_identity = sessionStorage.getItem('__api_identity__');
      this.x_log_idPOST = uuid;
      if(calledMethod){
        sessionStorage.setItem("incidentIDS_CLIENT",(new Date()).toString()+":::"+this.x_log_idPOST)
      }else{
        let incidentIds = sessionStorage.getItem("incidentIDS_ERROR")
        if(incidentIds !== null){
          incidentIds += "\n"+(new Date()).toString()+":::"+this.x_log_idPOST
          sessionStorage.setItem("incidentIDS_ERROR",incidentIds)
        }else
          sessionStorage.setItem("incidentIDS_ERROR",(new Date()).toString()+":::"+this.x_log_idPOST)
      }
      const url = "https://"+this.ELK_SERVER_DOMAIN+':8443/log';
      const body = this.fetchBufferForPOST();
      const bodySizeIntoMBs = body.length/1000;
      // this will return 400.1 if the size if 400.001 it will return 400 if it is 400/399.99
      // we need to only pass 400KB per request so using ceil for the same.
      const roundedSize = this.decimalAdjust('ceil', bodySizeIntoMBs, -1);
      let body_ary = []
      if(roundedSize > this.ELK_LOG_LIMIT){
          // this method will chunk the body into objects of array
          // so each object will not exceed more then 1.5MB size.
          body_ary = this.chunkBody(body,this.ELK_LOG_LIMIT*1000)
          for(let i=0;i < body_ary.length;i++){
              const requestOptions = {
                  method: 'POST',
                  headers: { 
                      'Authorization': auth,
                      'x-movius-log-env': x_movius_log_env,
                      'x-movius-log-device-type': x_movius_log_device_type,
                      'x-movius-log-identity': x_movius_log_identity,
                      'Content-Type': 'text/plain',
                      'x-movius-log-id': this.x_log_idPOST
                  },
                  body: body_ary[i]
              };
              try{
                  const result = await fetch(url, requestOptions);
                  const result_text = await result.text();
                  if(i === (body_ary.length - 1)){
                      this.resetGlobalBuffer();
                      this.debug('Sent multiple log entires');
                      return result_text;
                  }
              }catch{
                  this.debug(
                      'Sending multiple log entires failed at index '+i+' out of '+(body_ary.length - 1)
                      );
                  return 'not ok';
              }
          }
      }else{
          const requestOptions = {
              method: 'POST',
              headers: { 
                  'Authorization': auth,
                  'x-movius-log-env': x_movius_log_env,
                  'x-movius-log-device-type': x_movius_log_device_type,
                  'x-movius-log-identity': x_movius_log_identity,
                  'Content-Type': 'text/plain',
                  'x-movius-log-id': this.x_log_idPOST
              },
              body: body
          };
          try{
              const result = await fetch(url, requestOptions);
              const result_text = await result.text();
              this.resetGlobalBuffer();
              this.debug("sent single log entry");
              return result_text;
          }catch{
              this.debug('Sending single log entry failed');
              return 'not ok';
          }    
      }
    }
  }

  async sendPOSTlogHelp(bodyMessage?: string) {
    /** method is available to public and 
     * can post Messsage added in the Help support to ELK server 
     * only when ELK details are available */
    if (this.ELK_SERVER_DOMAIN !== "" && this.ELK_POST_USERID !== "" && this.ELK_POST_USERPWD !== "") {
      const auth = 'Basic ' + btoa(`${this.ELK_POST_USERID}:${this.ELK_POST_USERPWD}`);
      const x_movius_log_env = window['MOVIUS_API_BASE_URL'].split('/')[2].split('.')[0];
      const x_movius_log_device_type = 'MLDT';
      const x_movius_log_identity = sessionStorage.getItem('__api_identity__');
      this.x_log_idPOST = uuid;
      const url = `https://${this.ELK_SERVER_DOMAIN}:8443/stat`;
      const data = [{Survey: bodyMessage}];
      const body = JSON.stringify(data);
      const requestOptions = {
        method: 'POST',
        headers: {
          'Authorization': auth,
          'x-movius-log-env': x_movius_log_env,
          'x-movius-log-device-type': x_movius_log_device_type,
          'x-movius-log-identity': x_movius_log_identity,
          'Content-Type': 'application/json',
          'x-movius-log-id': this.x_log_idPOST
        },
        body: body,
      };
      try {
        await fetch(url, requestOptions);
        this.debug('Submitted sent successfully')
      } catch {
        return this.debug('Submit message failed');
      }
    }
  }


  /***************************************************************************
   *                                                                         *
   * Private methods                                                         *
   *                                                                         *
   **************************************************************************/

  private formatContentToString(content:any){
    if(typeof content === 'object'){
      try {
        return JSON.stringify(content, null, 2);
      } catch (e) {
        return content.toString();
      }
    }
    else if(content !== undefined)
      return content.toString()
    else if(content === undefined)
      return 'undefined'
  }

  private logInternal(level: LogLevel, message: any, additional: any[] = []): void {
    if (this.config.appender) {
      const prefix = this.formatMessagePrefix(level, this.tag, new Date());
      message = this.formatContentToString(message)
      this.isUnwantedErroLog = this.isUnWantedError(message)
      message = this.formatLogContent(message)
      if(additional.length > 1){
        /** when additional is having more elements */
        let additionalTemp = []
        for(let i=0;i<additional.length;i++){
          const additionalTempString = this.formatContentToString(additional[i])
          this.isUnwantedErroLog = this.isUnWantedError(additionalTempString)
          additionalTemp.push(this.formatLogContent(additionalTempString))
        }
        additional = additionalTemp
      }else if(additional.length === 1){
        /** when additional is having only one element */
        const additionalTempString = this.formatContentToString(additional[0])
        this.isUnwantedErroLog =  this.isUnWantedError(additionalTempString)
        let additionalTemp = this.formatLogContent(additionalTempString)
        additional.pop()
        additional.push(additionalTemp)
      }
      if(this.isUnwantedErroLog === false)
        this.updateBuffer(prefix,message,additional);
      if(this.ELK_SERVER_DOMAIN === "" && this.ELK_POST_USERID === "")
        this.updateELKdetails();
      this.config.appender.appendLog(level, prefix, message, additional);
      this.updateErrorStatus(level,false)
      if(this.ELK_SERVER_DOMAIN !== "" && this.ELK_POST_USERID !== "" && this.ELK_POST_USERPWD !== "")
        this.checkToPOSTLogOrNot()
    }
  }
  
  private updateErrorStatus(level : LogLevel | string, isOldLogs : boolean){
    if(isOldLogs === true){
      if((typeof level === 'string' && level.indexOf(" [E]") !== -1 && !this.isUnWantedError(level))){
        this.ErrInStoredSessionLogs = true
      }
    }else{
      if(level === 4 && !this.isUnwantedErroLog ){
        this.ErrInStoredSessionLogs = true
      }
    }
  }

  private checkToPOSTLogOrNot(){
    if(window['MOVIUS_ELK_LOGGING'] === true && this.elkPermissionClick.addLog === true || 
      window['MOVIUS_ELK_LOGGING'] === false && this.elkPermissionClick.addLog === true ||
      window['MOVIUS_ELK_LOGGING'] === true && this.elkPermissionClick.addLog === false) {
      if(this.ErrInStoredSessionLogs === true){
        this.sendPOSTlog();
        this.ErrInStoredSessionLogs = false
        this.lastSentLogTime = new Date().getTime();
      }
    }
  }

  private updateELKdetails(){
    if(sessionStorage.getItem("__ELK_SERVER_DOMAIN__") !== null &&
    sessionStorage.getItem("__ELK_SERVER_DOMAIN__") !== undefined && 
    sessionStorage.getItem("__ELK_SERVER_DOMAIN__") !== "undefined" && 
    sessionStorage.getItem("__ELK_SERVER_DOMAIN__") !== "null")
      this.ELK_SERVER_DOMAIN = sessionStorage.getItem("__ELK_SERVER_DOMAIN__")
    if(sessionStorage.getItem('__ELK_POST_USERID__') !== null && 
    sessionStorage.getItem('__ELK_POST_USERID__') !== undefined && 
    sessionStorage.getItem('__ELK_POST_USERID__') !== "undefined" && 
    sessionStorage.getItem('__ELK_POST_USERID__') !== "null")
      this.ELK_POST_USERID = sessionStorage.getItem("__ELK_POST_USERID__")
  }

  private checkPosToDel(reductSize,indexRange):number[]{ 
    let overFlowedLogSize = this.gBuffSize - this.GBUFFSIZELIMIT
    reductSize += overFlowedLogSize
    /** get the range of log statements needed to be removed */
    /** reductSize -- log buffer size that needs to be reduced */
    /** indexRange -- aprx indexRange for check against reductSize */
    let lastIncmtdIndex = 0
    let finalIndexFound = false
    let sizeTotalFindxRange = 0
    while(finalIndexFound !== true){
        if(this.memTable.length <= lastIncmtdIndex+indexRange)
          return [lastIncmtdIndex,sizeTotalFindxRange]
        let subsetMemTab = this.memTable.slice(lastIncmtdIndex,lastIncmtdIndex+indexRange)
        const subsetSum = subsetMemTab.reduce((sum,subsetValue)=> sum+subsetValue,0)
        sizeTotalFindxRange = sizeTotalFindxRange + subsetSum
        // if the sizeTotalFindxRange is greater then reductSize then
        // range of log to be removed is found 
        if(sizeTotalFindxRange >= reductSize)
          finalIndexFound = true
        lastIncmtdIndex += indexRange
    }
    return [lastIncmtdIndex,sizeTotalFindxRange]
  }
  
  private checkAndUpdateBufferWSession(oldLogFSession:string){
    let oldLogs = oldLogFSession.split("$#$");
    oldLogs = oldLogs.filter(e =>  e);
    this.gBuffSize += oldLogs.reduce((sum,subsetValue)=> sum+subsetValue.length,0)
    while(oldLogs.length>0){
      let lastItem = oldLogs.pop()
      this.gBuffer.unshift(lastItem)
      this.memTable.unshift(lastItem.length)
      this.updateErrorStatus(lastItem,true)
    } 
  }

  private isUnWantedError(logContent){
    let isUnwanted = false
    for(let i=0;i<this.unwantedErrorLogFilter.length;i++){
      if(logContent.indexOf(this.unwantedErrorLogFilter[i]) !== -1)
        isUnwanted = true
    }
    return isUnwanted
  }

  private formatLogContent(resultStr){
    if(resultStr.length > 0){
      /**elimintate http request params key and values*/
      if(resultStr.indexOf("http") !== -1 && resultStr.indexOf("<") === -1){
        const httpReq = resultStr.split("?");
        if(httpReq.length > 1){
          const httpReqKeyValues = httpReq[1].split("&");
          for(let i=0;i<httpReqKeyValues.length;i++){
            const keyValuePair = httpReqKeyValues[i].split("=")
            if(this.secureADKReqkeys.indexOf(keyValuePair[0]) !== -1){
              if(keyValuePair[1] !== "")
                resultStr = resultStr.replaceAll(keyValuePair[1],this.EncodeString)
              resultStr = resultStr.replaceAll(keyValuePair[0],this.EncodeString)
            }
          }
        }
      }
      /**eliminate sip values from log content */
      if(resultStr.indexOf("sip:") !== -1){
        const sipArry = resultStr.split("sip:");
        if(sipArry.length > 0){
          const sipvalueArry = sipArry[1].split(";")[0]
          if(sipvalueArry.length > 0){
            resultStr = resultStr.replaceAll(sipvalueArry,this.EncodeString)
          }
        }
      }
      /**eliminate secureAKDkeys in http response in xml format*/
      if(resultStr.indexOf("<") !== -1){
        for(let i=0;i<this.secureADKResXMLkeys.length;i++){
          if(resultStr.indexOf(this.secureADKResXMLkeys[i]) !== -1){
            const httXMLres = resultStr.split(this.secureADKResXMLkeys[i])
            const valueForElimination = httXMLres[1].replace("</","")
            resultStr = resultStr.replaceAll(this.secureADKResXMLkeys[i].replace(">",""),this.EncodeString)
            if(valueForElimination !== "")
              resultStr = resultStr.replaceAll(valueForElimination,this.EncodeString)
          }
        }
      }
      /**eliminate secureAKDkeys in http response in JSON format*/
      if(resultStr.indexOf("{") !== -1 && resultStr.indexOf("}") !== -1){
        const httpres = resultStr.split(",");
        if(httpres.length > 0){
          for(let i=0;i<httpres.length;i++){
            for(let j=0;j<this.secureADKResJSONkeys.length ;j++){
              if(httpres[i].indexOf(this.secureADKResJSONkeys[j]) !== -1){
                const keyPortion = httpres[i].replace(/\s/g, "")
                if(keyPortion.indexOf("\""+this.secureADKResJSONkeys[j]+"\"") === -1)
                  return
                const keyValue = keyPortion.split(this.secureADKResJSONkeys[j]);
                if(keyValue.length > 1){
                  const maskableValue = keyValue[1].split(`":"`)[1].replace("\"","")
                  if(maskableValue !== ''){
                    resultStr = resultStr.replaceAll(maskableValue,this.EncodeString)
                  }
                  resultStr = resultStr.replaceAll(this.secureADKResJSONkeys[j],this.EncodeString)
                }
              }
            }
          }
        }
      }
    }
    return resultStr 
  }

  private deleteBuffer(toBDeleted:number[]){
    this.gBuffer.splice(0,toBDeleted[0])
    this.memTable.splice(0,toBDeleted[0])
    this.gBuffSize -= toBDeleted[1]
    sessionStorage.setItem("LogContent",this.fetchBuffer())
    // adding console.log coz this.debug creates infinite loop
    console.log("logger:: [",toBDeleted[0],"] log lines of size [",Math.ceil(toBDeleted[1]/1000),"KB](approx.) has been cleared")
    console.log("logger::the buffer has been reduced as max limit reached")
  }

  private updateBuffer(content :string, message: any, additional: any[] = []){
    const sessionBuff = sessionStorage.getItem("LogContent")
    const presentBuff = this.fetchBuffer()
    if(sessionBuff != null){
      if(sessionBuff.length > this.sessBuffSize){
        this.checkAndUpdateBufferWSession(sessionBuff)
      }
    }
    const logContent = content +' '+message+' '+ additional.toString()+'\n';
    this.gBuffSize += logContent.length
    this.memTable.push(logContent.length)
    this.gBuffer.push(logContent)
    sessionStorage.setItem("LogContent",this.fetchBuffer())
    if(this.gBuffSize >= this.GBUFFSIZELIMIT){ // check for the overflow
      if(this.gBuffer.length > 8){
        /** get the total lines needed to be deleted */
        const toBDeleted = this.checkPosToDel(this.GBUFFVARSIZE,Math.floor(this.gBuffer.length/8))
        this.deleteBuffer(toBDeleted)
      }else{
        /** cornerCase: when log lines are few but bufferLimit reached */
        this.deleteBuffer([this.gBuffer.length,this.gBuffSize])
      }
    }
  }

  private fetchBuffer():string{
    const fetchdBuff = this.gBuffer.join("$#$")
    this.sessBuffSize = fetchdBuff.length
    return fetchdBuff
  }

  private fetchBufferForPOST():string{
    const fetchdBuff = this.gBuffer.join("")
    return fetchdBuff
  }

  private resetGlobalBuffer(){
    this.gBuffer = []
    this.memTable = []
    this.gBuffSize = 0
    sessionStorage.removeItem("LogContent")
  }

  private decimalAdjust(type, value, exp) {
    // If the exp is undefined or zero...
    if (typeof exp === 'undefined' || +exp === 0) {
      return Math[type](value);
    }
    value = +value;
    exp = +exp;
    // If the value is not a number or the exp is not an integer...
    if (isNaN(value) || !(typeof exp === 'number' && exp % 1 === 0)) {
      return NaN;
    }
    // Shift
    value = value.toString().split('e');
    value = Math[type](+(value[0] + 'e' + (value[1] ? (+value[1] - exp) : -exp)));
    // Shift back
    value = value.toString().split('e');
    return +(value[0] + 'e' + (value[1] ? (+value[1] + exp) : exp));
  }

  private chunkBody(str, length) {
    return str.match(new RegExp('[^]{1,' + length + '}', 'g'));
  }

  private formatMessagePrefix(level: LogLevel, tag: string, timestamp: Date): string {
    if(this.config.formatter){
      const appNme = this.isTeamsEnable ? "MLDTTeams":"MLDT"
      return this.config.formatter.formatMessagePrefix(level, tag, timestamp, "MLDT");
    }else{
      throw new Error('No log message formatter is configured!');
    }
  }
}

