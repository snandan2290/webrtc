import { MSGraphAuthService, MSGraphService } from '@movius/msgraph';

describe('sync-graph-contacts-create', () => {
    const createContactButton ='add-contact-button';// 'create-local-button';
    const addAndType = (
        cy: Cypress.Chainable<JQuery<HTMLElement>>,
        name: string,
        text: string,
        menuItem?: string
    ) =>
        cy
            .dataCy('add-more-button')
            .click()
            .dataCy('name-submenu')
            .click()
            .dataCy(`${menuItem || name}-submenu-item`)
            .click()
            .dataCy(name)
            .type(text);

    let msGraphService: MSGraphService;
    let msGraphAuthService: MSGraphAuthService;
    const setupSyncDI = (): Cypress.Chainable<any> =>
        cy.window().then((win) => {
            msGraphService = win['msGraphService'];
            msGraphAuthService = win['msGraphAuthService'];
            msGraphAuthService.getAccessToken = () => Promise.resolve('xxx');
            msGraphAuthService.signIn = () => Promise.resolve();
            msGraphService.getContacts = () => Promise.resolve([]);
        });

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

    describe('add new contact', () => {
        describe('add new contact', () => {
            before(() => cy.dataCy(createContactButton).click());

            it('add contact should be open', () => {
                cy.url().should('include', 'contacts/add');
            });

            it('add new contact should be success', () => {
                let updateWasCalled = false;
                cy.fixture('ms-graph-put-contact').then((obj) =>
                    cy.window().then((win) => {
                        msGraphService = win['msGraphService'];
                        msGraphService.createContactAndPhoto = () => {
                            updateWasCalled = true;
                            return Promise.resolve(obj);
                        };
                    })
                );

                cy.dataCy('first-name')
                    .type('max')
                    .dataCy('last-name')
                    .type('putilov');
                addAndType(cy, 'title', 'mr');
                addAndType(cy, 'middle-name', 'xa');
                addAndType(cy, 'suffix', 'phd');
                addAndType(cy, 'nick-name', 'nick');
                addAndType(cy, 'yomi-first-name', 'yomif', 'yomi-name');
                cy.dataCy('yomi-last-name').type('yomil');
                cy.dataCy('apply-button')
                    .click()
                    .then(() => {
                        expect(updateWasCalled).eq(true);
                    });
            });

            it('contact should be created', () => {
                cy.dataCy('contact-item').should('have.length', 1);
            });
        });
    });
});
