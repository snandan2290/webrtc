describe('contact-work', () => {
    const createContactButtonName = 'add-contact-button';//'create-local-button'
    const addAndType = (
        cy: Cypress.Chainable<JQuery<HTMLElement>>,
        name: string,
        text: string
    ) =>
        cy
            .dataCy('add-more-button')
            .click()
            .dataCy('add-work-submenu')
            .click()
            .dataCy(`add-${name}-menu-item`)
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
                .type('putilov')
                .dataCy('email')
                .type('maxp@scal.io');
            cy.dataCy('company').type('coca-cola');
            addAndType(cy, 'job-title', 'ceo');
            addAndType(cy, 'yomi-company', 'abcd');
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
                cy.dataCy('first-name').should('have.value', 'max');
                cy.dataCy('last-name').should('have.value', 'putilov');
                cy.dataCy('company').should('have.value', 'coca-cola');
                cy.dataCy('job-title').should('have.value', 'ceo');
                cy.dataCy('yomi-company').should('have.value', 'abcd');
            });

            it('update field should succeed', () => {
                cy.dataCy('company').clear().type('pepsi');
                cy.dataCy('apply-button').click();
            });

            describe('another update', () => {
                before(() => cy.dataCy('edit-button').click());

                it('contact fields should be filled', () => {
                    cy.dataCy('first-name').should('have.value', 'max');
                    cy.dataCy('last-name').should('have.value', 'putilov');
                    cy.dataCy('company').should('have.value', 'pepsi');
                    cy.dataCy('job-title').should('have.value', 'ceo');
                    cy.dataCy('yomi-company').should('have.value', 'abcd');
                });
            });
        });
    });
});
