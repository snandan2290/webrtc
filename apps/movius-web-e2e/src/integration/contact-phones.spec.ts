describe('contact-phones', () => {
    const createContactButtonName = 'add-contact-button';//'create-local-button'
    const addPhone = (
        cy: Cypress.Chainable<JQuery<HTMLElement>>,
        type: string,
        isOtherItem = false
    ) => {
        cy.dataCy('add-more-button')
            .click()
            .dataCy('add-phone-submenu')
            .click();
        if (isOtherItem) {
            cy.dataCy('add-other-phone-submenu').click();
        }
        cy.dataCy(`add-${type}-phone-menu-item`).click();
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
                .type('putilov')
                .dataCy('email')
                .type('maxp@scal.io');

            addPhone(cy, 'business');
            cy.dataCy('phone').eq(0).type('+19772773751');
            addPhone(cy, 'mobile');
            cy.dataCy('phone').eq(1).type('+19772773752');
            addPhone(cy, 'home');
            cy.dataCy('phone').eq(2).type('+19772773753');
            cy.dataCy('apply-button').click();
        });

        it('contact should be created', () => {
            cy.dataCy('contact-item').should('have.length', 1);
        });

        describe('update contact', () => {
            const comparePhone = (i: number, phone: string) =>
                cy.dataCy('phone').eq(i).should('have.value', phone);

            before(() => cy.dataCy('edit-button').click());

            it('add contact should be open', () => {
                cy.url().should('include', 'edit');
            });

            it('contact fields should be filled', () => {
                cy.dataCy('first-name').should('have.value', 'max');
                cy.dataCy('last-name').should('have.value', 'putilov');
                comparePhone(0, '+19772773751');
                comparePhone(1, '+19772773752');
                comparePhone(2, '+19772773753');
            });

            it('update emails should succeed', () => {
                cy.dataCy('phone').eq(1).clear().type('+19772773761');
                cy.dataCy('remove-phone-button').eq(0).click({ force: true });
                cy.dataCy('apply-button').click();
            });

            describe('another update', () => {
                before(() => cy.dataCy('edit-button').click());

                it('contact fields should be filled', () => {
                    cy.dataCy('first-name').should('have.value', 'max');
                    cy.dataCy('last-name').should('have.value', 'putilov');
                    comparePhone(0, '+19772773761');
                    comparePhone(1, '+19772773753');
                    });
            });
        });
    });
});
