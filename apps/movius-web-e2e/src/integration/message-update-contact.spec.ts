import { Observable } from 'rxjs';
import { take } from 'rxjs/operators';

describe('message-update-contact', () => {
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

    beforeEach(() => {
        cy.readFile('src/fixtures/get_all_threads.json').as(
            'get_all_threadsData'
        );
        cy.readFile('src/fixtures/get_all_messages-1.json').as(
            'get_all_messagesData'
        );
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
            cy.dataCy('phone').eq(0).type('14156789019');
            cy.dataCy('apply-button').click();
        });

        it('contact should be created', () => {
            cy.dataCy('contact-item').should('have.length', 1);
        });

        it('message contacts should be empty', () => {
            cy.dataCy('messaging-nav-item').click();
            cy.dataCy('message-list-item').should('not.exist');
        });

        describe('send message', () => {
            before(() => {
                cy.dataCy('messaging-nav-item').click();
                return cy
                    .dataCy('new-message-button')
                    .click()
                    .dataCy('message-new-number-input')
                    .type(peerNumber)
                    .dataCy('send-message-input')
                    .type('msg-1', { force: true })
                    .dataCy('send-message-button')
                    .click();
            });

            it('after sending message we should have new contact in left panel', () => {
                cy.dataCy('message-list-item').should('have.length', 1);
                cy.get('.messages__hstName')
                    .eq(0)
                    .should('contain.text', peerNumber);
            });

            describe('update contact', () => {
                before(() => cy.dataCy('contacts-nav-item').click());
                before(() =>
                    cy
                        .dataCy('contact-item')
                        .eq(0)
                        .click()
                        .dataCy('edit-button')
                        .click()
                );

                it('update contact should be success', () => {
                    cy.dataCy('phone').eq(0).clear().type(peerNumber);
                    cy.dataCy('apply-button').click();
                });

                it('contact should be updated', () => {
                    cy.dataCy('contact-item').should('have.length', 1);
                });

                it('message contacts should be updated', () => {
                    cy.dataCy('messaging-nav-item').click();
                    cy.dataCy('message-list-item').should('have.length', 1);
                    cy.get('.messages__hstName')
                        .eq(0)
                        .should('contain.text', 'max putilov');
                });
            });

            describe('delete contact phone number', () => {
                before(() => cy.dataCy('contacts-nav-item').click());
                before(() =>
                    cy
                        .dataCy('contact-item')
                        .eq(0)
                        .click()
                        .dataCy('edit-button')
                        .click()
                );

                it('update contact should be success', () => {
                    cy.dataCy('remove-phone-button').click({ force: true });
                    cy.dataCy('apply-button').click();
                });

                it('contact should be updated', () => {
                    cy.dataCy('contact-item').should('have.length', 1);
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
});
