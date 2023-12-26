describe('contact-addresses', () => {
    const createContactButtonName = 'add-contact-button';//'create-local-button'
    const addAddress = (
        cy: Cypress.Chainable<JQuery<HTMLElement>>,
        type: string
    ) => {
        cy.dataCy('add-more-button')
            .click()
            .dataCy('add-address-submenu')
            .click()
            .dataCy(`add-${type}-address-menu-item`)
            .click();
    };

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

            addAddress(cy, 'business');

            cy.dataCy('street')
                .eq(0)
                .type('seasam')
                .dataCy('city')
                .eq(0)
                .type('moscow')
                .dataCy('state')
                .eq(0)
                .type('GA')
                .dataCy('postal')
                .eq(0)
                .type('115522')
                .dataCy('country')
                .eq(0)
                .type('USA');

            addAddress(cy, 'home');

            cy.dataCy('street')
                .eq(1)
                .type('lenina')
                .dataCy('city')
                .eq(1)
                .type('chel')
                .dataCy('state')
                .eq(1)
                .type('NY')
                .dataCy('postal')
                .eq(1)
                .type('338877')
                .dataCy('country')
                .eq(1)
                .type('USA');

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
                cy.dataCy('street')
                    .eq(0)
                    .should('have.value', 'seasam')
                    .dataCy('city')
                    .eq(0)
                    .should('have.value', 'moscow')
                    .dataCy('state')
                    .eq(0)
                    .should('have.value', 'GA')
                    .dataCy('postal')
                    .eq(0)
                    .should('have.value', '115522')
                    .dataCy('country')
                    .eq(0)
                    .type('USA');

                cy.dataCy('street')
                    .eq(1)
                    .should('have.value', 'lenina')
                    .dataCy('city')
                    .eq(1)
                    .should('have.value', 'chel')
                    .dataCy('state')
                    .eq(1)
                    .should('have.value', 'NY')
                    .dataCy('postal')
                    .eq(1)
                    .should('have.value', '338877')
                    .dataCy('country')
                    .eq(1)
                    .should('have.value', 'USA');
            });

            it('update address should succeed', () => {
                cy.dataCy('street').eq(1).clear().type('marksa');
                cy.dataCy('remove-address-button').eq(0).click({ force: true });
                cy.dataCy('apply-button').click();
            });

            describe('another update', () => {
                before(() => cy.dataCy('edit-button').click());

                it('contact fields should be filled', () => {
                    cy.dataCy('first-name').should('have.value', 'max');
                    cy.dataCy('last-name').should('have.value', 'putilov');
                    cy.dataCy('street')
                        .eq(0)
                        .should('have.value', 'marksa')
                        .dataCy('city')
                        .eq(0)
                        .should('have.value', 'chel')
                        .dataCy('state')
                        .eq(0)
                        .should('have.value', 'NY')
                        .dataCy('postal')
                        .eq(0)
                        .should('have.value', '338877')
                        .dataCy('country')
                        .eq(0)
                        .should('have.value', 'USA');
                });
            });
        });
    });
});
