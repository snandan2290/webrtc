import { MSGraphAuthService, MSGraphService } from '@movius/msgraph';

describe('settings-contacts-sync-error', () => {
    let msGraphService: MSGraphService;
    let msGraphAuthService: MSGraphAuthService;
    const setupSyncDI = (
        failOn: 'sign-in' | 'get-contacts'
    ): Cypress.Chainable<any> =>
        cy.fixture('ms-graph-get-contacts').then((obj) =>
            cy.window().then((win) => {
                msGraphService = win['msGraphService'];
                msGraphAuthService = win['msGraphAuthService'];
                msGraphAuthService.getAccessToken = () =>
                    failOn === 'sign-in'
                        ? Promise.reject(null)
                        : Promise.resolve('xxx');
                (msGraphAuthService.signIn = () =>
                    new Promise((resolve, reject) => {
                        setTimeout(() => {
                            failOn === 'sign-in'
                                ? reject(new Error('Cant connect'))
                                : resolve();
                        }, 10);
                    })),
                    (msGraphService.getContacts = () =>
                        new Promise((resolve, reject) => {
                            setTimeout(() => {
                                failOn === 'get-contacts'
                                    ? reject(
                                          new Error('Error retrieving contacts')
                                      )
                                    : resolve([]);
                            }, 10);
                        }));
            })
        );

    before(() => indexedDB.deleteDatabase('movius-db'));
    before(() => cy.login());
    before(() => setupSyncDI('sign-in'));
    before(() =>
        cy
            .dataCy('settings-nav-item')
            .click()
            .dataCy('contact-settings')
            .click()
    );
    before(() => cy.dataCy('sync-button').click());
    it('syncing should be displayed', () => {
        cy.get('movius-web-contact-sync-fail').should('exist');
    });

    describe('try again with error on get contacts', () => {
        before(() => setupSyncDI('get-contacts'));
        before(() => cy.dataCy('try-again-button').click());
        it('syncing should be displayed', () => {
            cy.get('movius-web-contact-sync-fail').should('exist');
        });
    });
});
