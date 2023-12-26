import { Observable } from 'rxjs';
import { take } from 'rxjs/operators';

describe('send-message-new-number', () => {
    const peerNumber = '14156789022';

    before(() => indexedDB.deleteDatabase('movius-db'));
    before(() => cy.login(false, 'get_all_threads-empty'));
    before(() => cy.dataCy('messaging-nav-item').click());

    it('contacts workspace should be open', () => {
        cy.url().should('include', 'messaging');
    });

    describe('send message to new number', () => {
        before(() => {
            cy.dataCy('messaging-nav-item').click();
        });

        it('no additional network calls for this thread', () => {
            cy.server();
            cy.route('GET', /get_all_messages/, {}).as('get_all_messages');
            cy.route('GET', /set_read_status_message/, {}).as(
                'set_read_status_message'
            );
            cy.dataCy('new-message-button')
                .click()
                .dataCy('message-new-number-input')
                .type(peerNumber)
                .dataCy('send-message-input')
                .type('msg-1', { force: true })
                .dataCy('send-message-button')
                .click();

            // https://github.com/cypress-io/cypress/issues/6630
            cy.wait(100)
                .get('@get_all_messages')
                .should((res) => expect(res).to.be.null)
                .get('@set_read_status_message')
                .should((res) => expect(res).to.be.null);
        });

        it('message should be sent', () => {
            cy.dataCy('message-list-item').should('have.length', 1);
        });
    });
});
