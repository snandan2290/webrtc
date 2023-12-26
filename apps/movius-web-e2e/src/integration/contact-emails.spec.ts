/*
const addAndType = (
    cy: Cypress.Chainable<JQuery<HTMLElement>>,
    name: string,
    text: string
) =>
    cy
        .dataCy('add-more-button')
        .click()
        .dataCy('name-submenu')
        .click()
        .dataCy(`${name}-submenu-item`)
        .click()
        .dataCy(name)
        .type(text);
*/
describe('contact-emails', () => {
    const createContactButtonName = 'add-contact-button';//'create-local-button'
    const addEmail = (cy: Cypress.Chainable<JQuery<HTMLElement>>) =>
        cy
            .dataCy('add-more-button')
            .click()
            .dataCy('name-submenu')
            .click()
            .dataCy(`email-menu-item`)
            .click({force: true});

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

            addEmail(cy);
            cy.dataCy('email').eq(0).type('email1@gmail.com');
            addEmail(cy);
            cy.dataCy('email').eq(1).type('email2@gmail.com');
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
                cy.dataCy('email')
                    .eq(0)
                    .should('have.value', 'email1@gmail.com');
                cy.dataCy('email')
                    .eq(1)
                    .should('have.value', 'email2@gmail.com');
            });

            it('update emails should succeed', () => {
                cy.dataCy('email').eq(1).clear().type('email3@gmail.com');
                cy.dataCy('remove-email-button').eq(0).click({ force: true });
                cy.dataCy('apply-button').click();
            });

            describe('another update', () => {
                before(() => cy.dataCy('edit-button').click());

                it('contact fields should be filled', () => {
                    cy.dataCy('first-name').should('have.value', 'max');
                    cy.dataCy('last-name').should('have.value', 'putilov');
                    cy.dataCy('email')
                        .eq(0)
                        .should('have.value', 'email3@gmail.com');
                });
            });
        });
    });
});
