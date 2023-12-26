describe('message-create-contact', () => {
    const createContactButton = 'add-contact-button'; // 'create-local-button';

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
    before(() => cy.login(false, 'get_all_threads-empty'));

    const peerNumber = '14156789020';

    before(() => {
        cy.dataCy('messaging-nav-item').click();
        return cy
            .dataCy('new-message-button')
            .click()
            .dataCy('message-new-number-input')
            .type(peerNumber)
            .dataCy('send-message-input')
            .type('msg-1')
            .dataCy('send-message-button')
            .click();
    });

    it('after sending message we should have new contact in left panel', () => {
        cy.dataCy('message-list-item').should('have.length', 1);
        cy.get('.messages__hstName').eq(0).should('contain.text', peerNumber);
    });

    describe('create new contact', () => {
        before(() => cy.dataCy('contacts-nav-item').click());
        before(() => cy.dataCy(createContactButton).click());

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
            cy.dataCy('phone').eq(0).type(peerNumber);
            cy.dataCy('apply-button').click();
        });

        it('contact should be created', () => {
            cy.dataCy('contact-item').should('have.length', 1);
        });

        it('message contacts should be updated', () => {
            cy.dataCy('messaging-nav-item').click();
            cy.dataCy('message-list-item').should('have.length', 1);
            cy.get('.messages__hstName')
                .eq(0)
                .should('contain.text', 'max putilov');
        });

        describe('remove contact should not remove message item', () => {
            before(() =>
                cy
                    .dataCy('contacts-nav-item')
                    .click()
                    .dataCy('delete-button')
                    .click()
                    .get('button.ant-btn-primary')
                    .click()
            );

            it('contact should be removed', () => {
                cy.dataCy('contact-item').should('have.length', 0);
            });

            it('message contacts should be updated', () => {
                cy.dataCy('messaging-nav-item').click();
                cy.dataCy('message-list-item').should('have.length', 1);
                cy.get('.messages__hstName')
                    .eq(0)
                    .should('contain.text', peerNumber);
            });
        });
    });
});
