describe('contact-name', () => {
    const createContactButtonName = 'add-contact-button';//'create-local-button'
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

    before(() => indexedDB.deleteDatabase('movius-db'));
    before(() => cy.login());
    before(() => cy.dataCy('contacts-nav-item').click());

    beforeEach(() => {
        cy.readFile('src/fixtures/get_all_threads.json').as(
            'get_all_threadsData'
        );
        cy.readFile('src/fixtures/get_all_messages-1.json').as(
            'get_all_messagesData'
        );
    });

    it('contacts workspace should be open', () => {
        cy.url().should('include', 'contacts');
    });

    describe('add new contact', () => {
        before(() => cy.dataCy(createContactButtonName).click());

        it('add contact should be open', () => {
            cy.url().should('include', 'contacts/add');
        });

        it('add new contact should be success', () => {
            cy.dataCy('first-name')
                .type('max')
                .dataCy('last-name')
                .type('putilov');
            addAndType(cy, 'title', 'mr');
            addAndType(cy, 'middle-name', 'xa');
            addAndType(cy, 'suffix', 'phd');
            addAndType(cy, 'nick-name', 'nick');
            addAndType(cy, 'yomi-first-name', 'yomif', 'yomi-name');
            cy.dataCy('yomi-last-name')
                .type('yomil')
                .dataCy('email')
                .type('maxp@scal.io');
            cy.dataCy('apply-button').click();
        });

        it('contact should be created', () => {
            cy.dataCy('contact-item').should('have.length', 1);
        });

        describe('update contact', () => {
            before(() => cy.dataCy('edit-button').click());

            it('add contact should be open', () => {
                cy.url().should('include', 'edit');
            });

            it('contact fields should be filled', () => {
                cy.dataCy('title').should('have.value', 'mr');
                cy.dataCy('first-name').should('have.value', 'max');
                cy.dataCy('last-name').should('have.value', 'putilov');
                cy.dataCy('middle-name').should('have.value', 'xa');
                cy.dataCy('suffix').should('have.value', 'phd');
                cy.dataCy('nick-name').should('have.value', 'nick');
                cy.dataCy('yomi-first-name').should('have.value', 'yomif');
                cy.dataCy('yomi-last-name').should('have.value', 'yomil');
            });

            it('update field should succeed', () => {
                cy.dataCy('title').clear().type('ms');
                cy.dataCy('apply-button').click();
            });

            describe('another update', () => {
                before(() => cy.dataCy('edit-button').click());

                it('contact fields should be filled', () => {
                    cy.dataCy('title').should('have.value', 'ms');
                    cy.dataCy('first-name').should('have.value', 'max');
                    cy.dataCy('last-name').should('have.value', 'putilov');
                    cy.dataCy('middle-name').should('have.value', 'xa');
                    cy.dataCy('suffix').should('have.value', 'phd');
                    cy.dataCy('nick-name').should('have.value', 'nick');
                    cy.dataCy('yomi-first-name').should('have.value', 'yomif');
                    cy.dataCy('yomi-last-name').should('have.value', 'yomil');
                });
            });
        });
    });
});
