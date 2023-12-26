import { MSGraphAuthService, MSGraphService } from '@movius/msgraph';

describe.skip('sync-graph-contacts-update', () => {
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
                msGraphService.getContacts = () => Promise.resolve(obj.value);
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
        cy.dataCy('contact-item').should('have.length', 1);
    });

    describe('open edit contact', () => {
        before(() => cy.dataCy('edit-button').click());

        it('msgraph API should be called on update', () => {
            let updateWasCalled = false;
            cy.fixture('ms-graph-put-contact').then((obj) =>
                cy.window().then((win) => {
                    msGraphService = win['msGraphService'];
                    msGraphService.updateContactAndPhoto = () => {
                        updateWasCalled = true;
                        return Promise.resolve(obj);
                    };
                })
            );

            cy.dataCy('title')
                .clear()
                .type('sir')
                .dataCy('apply-button')
                .click()
                .then(() => {
                    expect(updateWasCalled).eq(true);
                });
        });

        it('contact edit should be closed', () => {
            cy.url().should('include', '/contacts/');
        });
    });
});
