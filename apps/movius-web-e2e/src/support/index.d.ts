/// <reference types="cypress" />
/// <reference types="libs/sip/src/lib/mock-sip.service" />

// import { MockSipService } from 'libs/sip/src/lib/mock-sip.service';

declare namespace Cypress {
    interface Chainable {
        dataCy(
            value: string,
            selector?: string
        ): Chainable<JQuery<HTMLElement>>;
    }
}
