import { MSGraphAuthService, MSGraphService } from '@movius/msgraph';

describe('settings-contacts-sync-manual', () => {
    let msGraphService: MSGraphService;
    let msGraphAuthService: MSGraphAuthService;
    const setupSyncDI = (): Cypress.Chainable<any> =>
        cy.fixture('ms-graph-get-contacts').then((obj) =>
            cy.window().then((win) => {
                msGraphService = win['msGraphService'];
                msGraphAuthService = win['msGraphAuthService'];
                msGraphAuthService.getAccessToken = () =>
                    Promise.resolve('xxx');
                msGraphAuthService.signIn = () => Promise.resolve();
                msGraphService.getContacts = () => Promise.resolve([]);
            })
        );

    before(() => indexedDB.deleteDatabase('movius-db'));
    before(() => cy.login(true));
    before(() => setupSyncDI());
    before(() =>
        cy
            .dataCy('sync-exchange-button')
            .click()
            .dataCy('continue-button')
            .click()
    );

    before(() => cy.dataCy('contacts-nav-item').click());

    it('contact should be imported', () => {
        cy.dataCy('contact-item').should('have.length', 0);
    });

    describe('sync manual', () => {
        before(() =>
            cy
                .dataCy('settings-nav-item')
                .click()
                .dataCy('contact-settings')
                .click()
        );

        before(() =>
            cy.fixture('ms-graph-get-contacts').then((obj) =>
                cy.window().then((win) => {
                    msGraphService = win['msGraphService'];
                    msGraphAuthService = win['msGraphAuthService'];
                    msGraphAuthService.getAccessToken = () =>
                        Promise.resolve('xxx');
                    msGraphAuthService.signIn = () => Promise.resolve();
                    msGraphService.getContacts = () =>
                        Promise.resolve(obj.value);
                })
            )
        );

        before(() => cy.dataCy('manual-sync-button').click());
        before(() => cy.dataCy('contacts-nav-item').click());

        it('contacts should be synced', () => {
            cy.dataCy('contact-item').should('have.length', 1);
        });
    });
});
