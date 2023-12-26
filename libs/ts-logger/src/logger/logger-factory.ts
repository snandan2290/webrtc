import {Logger, LoggerConfiguration} from './logger';



export class LoggerFactory {

  /***************************************************************************
   *                                                                         *
   * Fields                                                                  *
   *                                                                         *
   **************************************************************************/

  private static readonly Default = new LoggerFactory(new LoggerConfiguration());

  private readonly loggers = new Map<string, Logger>();

  public static loggerInstance:any;

  /***************************************************************************
   *                                                                         *
   * Constructor                                                             *
   *                                                                         *
   **************************************************************************/

  constructor(
    private readonly configuration: LoggerConfiguration,
   ){
  }

  /***************************************************************************
   *                                                                         *
   * Static API                                                              *
   *                                                                         *
   **************************************************************************/

  public static getLogger(name: string): Logger {
    if(this.loggerInstance === undefined){
      this.loggerInstance = LoggerFactory.Default.getLogger(name)
      return this.loggerInstance
    }else{
      return this.loggerInstance
    }
  }

  public static getDefaultConfiguration(): LoggerConfiguration {
    return LoggerFactory.Default.getConfiguration();
  }

  /***************************************************************************
   *                                                                         *
   * Public API                                                              *
   *                                                                         *
   **************************************************************************/

  public getConfiguration(): LoggerConfiguration {
    return this.configuration;
  }


  public getLogger(name: string): Logger {
    let logger = this.loggers.get(name);
    if(!logger) {
      logger = new Logger(name, this.getConfiguration());
      this.loggers.set(name, logger);
    }
    return logger;
  }
}
