# ts-logger

This library was generated with [Nx](https://nx.dev).

## Running unit tests

Run `nx test ts-logger` to execute the unit tests.

## using ts-logger in other component

syntax :
import {LoggerFactory} from '@movius/ts-logger';
const logger = LoggerFactory.getLogger("")

method(){
    logger.debug("log content")
    logger.info("log content")
    logger.trace("log content")
    logger.error("log content")
    logger.warn("log content")
}

## posting the logs to external ELK server
NOTE: 
1) this is possible only when ELK details are available in the API response
2) suggested location support-workspace-component.ts in movius-web directory.

syntax:
import {LoggerFactory} from '@movius/ts-logger';
const logger = LoggerFactory.getLogger("")
onEmailClick(){
    if(NOTE "1" is true)
        logger.sendPOSTlog("emailSupportClick")
}
