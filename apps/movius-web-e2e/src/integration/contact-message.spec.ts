import { MockSipService, MockSipUser } from 'libs/sip/src/lib/mock-sip.service';
import { Observable } from 'rxjs';
import { take } from 'rxjs/operators';

describe('contact-message', () => {
    const createContactButtonName = 'add-contact-button'; //'create-local-button'

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

    const peerNumber = '14156789020';

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

    describe('create new contact', () => {
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
            cy.dataCy('phone').eq(0).type(peerNumber);
            cy.dataCy('apply-button').click();
        });

        it('contact should be created', () => {
            cy.dataCy('contact-item').should('have.length', 1);
        });

        describe('send message from existent contact, should display message as sent from the contact', () => {
            before(() => {
                cy.dataCy('messaging-nav-item')
                    .click()
                    .dataCy('new-message-button')
                    .click()
                    .dataCy('message-new-number-input')
                    .type(peerNumber)
                    .dataCy('send-message-input')
                    .type('msg-1', { force: true })
                    .dataCy('send-message-button')
                    .click({ force: true });
            });

            it('after login should display correct messages list', () => {
                cy.get('.messages__hstName')
                    .eq(0)
                    .should('contain.text', 'max putilov');
            });
        });
    });
});
