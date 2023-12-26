describe('contact-other', () => {
    const createContactButtonName = 'add-contact-button';//'create-local-button'
    const addAndType = (
        cy: Cypress.Chainable<JQuery<HTMLElement>>,
        name: string,
        text: string
    ) =>
        cy
            .dataCy('add-more-button')
            .click()
            .dataCy('add-other-submenu')
            .click()
            .dataCy(`add-other-${name}-menu-item`)
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

            addAndType(cy, 'personal-web-page', 'localhost');
            addAndType(cy, 'significant-other', 'marry n');
            cy.dataCy('add-more-button')
                .click()
                .dataCy('add-other-submenu')
                .click()
                .dataCy('add-chat-menu-item')
                .click({force: true})
                .dataCy('chat')
                .type('chat')
                .dataCy('note')
                .type('notes');
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
                cy.dataCy('personal-web-page').should(
                    'have.value',
                    'localhost'
                );
                cy.dataCy('significant-other').should('have.value', 'marry n');
                cy.dataCy('chat').should('have.value', 'chat');
                cy.dataCy('note').should('have.value', 'notes');
            });

            it('update field should succeed', () => {
                cy.dataCy('personal-web-page').clear().type('google.com');
                cy.dataCy('apply-button').click();
            });

            describe('another update', () => {
                before(() => cy.dataCy('edit-button').click());

                it('contact fields should be filled', () => {
                    cy.dataCy('first-name').should('have.value', 'max');
                    cy.dataCy('last-name').should('have.value', 'putilov');
                    cy.dataCy('personal-web-page').should(
                        'have.value',
                        'google.com'
                    );
                    cy.dataCy('significant-other').should(
                        'have.value',
                        'marry n'
                    );
                });
            });
        });
    });
});
