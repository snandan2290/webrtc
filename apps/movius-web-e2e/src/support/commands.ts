// ***********************************************
// This example commands.js shows you how to
// create various custom commands and overwrite
// existing commands.
//
// For more comprehensive examples of custom
// commands please read more here:
// https://on.cypress.io/custom-commands
// ***********************************************

// eslint-disable-next-line @typescript-eslint/no-namespace
declare namespace Cypress {
    interface Chainable<Subject> {
        login(isNotFirstTime?: boolean, threadsFileName?: string): void;
        getMockSipService(): Chainable<any>;
        tick(): Chainable<any>;
        dispatchAction(action: any): Chainable<any>;
    }
}
//
// -- This is a parent command --
Cypress.Commands.add(
    'login',
    (isNotFirstTime?: boolean, threadsFileName = 'get_all_threads') => {
        cy.readFile('src/fixtures/login-confirm.xml').as('loginConfirmData');
        cy.readFile('src/fixtures/adduserdevice.xml').as('adduserdeviceData');
        cy.readFile('src/fixtures/get_user_info-2.xml').as('get_user_infoData');
        cy.readFile('src/fixtures/get_calls.json').as('get_callsData');
        cy.readFile(`src/fixtures/${threadsFileName}.json`).as(
            'get_all_threadsData'
        );
        cy.readFile('src/fixtures/get_status_e911-1.xml').as(
            'get_status_e911Data'
        );
        cy.readFile('src/fixtures/lookup_e911_subscriber.xml').as(
            'lookup_e911_subscriberData'
        );

        cy.visit('/auth/login');
        cy.server();
        cy.route('POST', /login/, '@loginConfirmData').as('loginConfirm');
        cy.route('GET', /adduserdevice/, '@adduserdeviceData').as(
            'adduserdevice'
        );
        cy.route('GET', /get_user_info/, '@get_user_infoData').as(
            'get_user_info'
        );
        cy.route('GET', /get_calls/, '@get_callsData').as('get_calls');
        cy.route('GET', /get_all_threads/, '@get_all_threadsData').as(
            'get_all_threads'
        );
        cy.dataCy('email-input')
            .type('maxp@scal.io{enter}')
            .dataCy('password-input')
            .type('Password123!')
            .dataCy('signin-button')
            .click()
            .wait([
                '@loginConfirm',
                '@adduserdevice',
                '@get_user_info',
                '@get_calls',
                '@get_all_threads',
            ])
            .url()
            .should('include', '/calling');

        if (!isNotFirstTime) {
            cy.dataCy('later-button').click().dataCy('continue-button').click();
        }
    }
);
Cypress.Commands.add('dataCy', (value, selector = '') => {
    return cy.get(`[data-cy=${value}]${selector}`);
});

Cypress.Commands.add('getMockSipService', () => {
    return cy.window().then((x) => x['mockSipService']);
});

Cypress.Commands.add('tick', () => {
    return cy.window().then((x) => x['appRef'].tick());
});

Cypress.Commands.add('dispatchAction', (action) => {
    return cy.window().then((x) => x['appStore'].dispatch(action));
});

//
// -- This is a child command --
// Cypress.Commands.add("drag", { prevSubject: 'element'}, (subject, options) => { ... })
//
//
// -- This is a dual command --
// Cypress.Commands.add("dismiss", { prevSubject: 'optional'}, (subject, options) => { ... })
//
//
// -- This will overwrite an existing command --
// Cypress.Commands.overwrite("visit", (originalFn, url, options) => { ... })
