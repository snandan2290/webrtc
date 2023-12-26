import { ApplicationRef, InjectFlags, Injector } from '@angular/core';
import { MSGraphAuthService, MSGraphService } from '@movius/msgraph';
import { AppComponent } from 'apps/movius-web/src/app/app.component';

describe.skip('sync-graph-contacts-delayed', () => {
    let msGraphService: MSGraphService;
    let msGraphAuthService: MSGraphAuthService;
    const setupSyncDI = (): Cypress.Chainable<any> =>
        cy.fixture('ms-graph-get-contacts.json').then((obj) =>
            cy.window().then((win) => {
                msGraphService = win['msGraphService'];
                msGraphAuthService = win['msGraphAuthService'];

                msGraphAuthService.signIn = () => Promise.resolve();
                msGraphService.getContacts = () =>
                    new Promise((resolve) =>
                        setTimeout(() => resolve(obj.value), 100)
                    );
            })
        );

    before(() => indexedDB.deleteDatabase('movius-db'));
    before(() => cy.login());

    before(() => cy.dataCy('contacts-nav-item').click());

    it('contact should be imported', () => {
        cy.dataCy('sync-contacts').should('exist');
    });

    describe('sync contacts', () => {
        before(() => setupSyncDI());
        before(() => cy.dataCy('sync-button').click());
        it('syncing should be displayed', () => {
            cy.get('movius-web-contact-sync-gain').should('exist');
        });

        it('contact should be imported', () => {
            cy.dataCy('contact-item').should('have.length', 1);
        });

        describe('open edit contact', () => {
            before(() => cy.dataCy('edit-button').click());

            it('imported contact should have correct data', () => {
                cy.dataCy('title').should('have.value', 'dr');
                cy.dataCy('first-name').should('have.value', 'fake');
                cy.dataCy('last-name').should('have.value', 'one');
                cy.dataCy('middle-name').should('have.value', 'c');
                cy.dataCy('suffix').should('have.value', 'mr');
                cy.dataCy('nick-name').should('have.value', 'xxx');
                cy.dataCy('yomi-first-name').should('have.value', 'yominamef');
                cy.dataCy('yomi-last-name').should('have.value', 'yominamel');
                cy.dataCy('significant-other').should('have.value', 'marry n');
                cy.dataCy('chat').should('have.value', '111111');
                cy.dataCy('note').should('have.value', 'note');
                cy.dataCy('phone').eq(0).should('have.value', '+79772753412');
                cy.dataCy('phone').eq(1).should('have.value', '+79772753413');
                cy.dataCy('phone').eq(2).should('have.value', '+79772753415');
                cy.dataCy('phone').eq(3).should('have.value', '+79772753416');
                cy.dataCy('phone').eq(4).should('have.value', '+79772753411');
                cy.dataCy('email').eq(0).should('have.value', 'max@google.com');
                cy.dataCy('company').should('have.value', 'coca-cola');
                cy.dataCy('job-title').should('have.value', 'ceo');
                cy.dataCy('yomi-company').should('have.value', 'yomicompany');
                cy.dataCy('street')
                    .eq(0)
                    .should('have.value', 'helm')
                    .dataCy('city')
                    .eq(0)
                    .should('have.value', 'moscow')
                    .dataCy('state')
                    .eq(0)
                    .should('have.value', 'ms')
                    .dataCy('postal')
                    .eq(0)
                    .should('have.value', '115522')
                    .dataCy('country')
                    .eq(0)
                    .should('have.value', 'usa');
            });
        });
    });
});
