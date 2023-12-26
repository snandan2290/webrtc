
describe('messages-read', () => {
    before(() => indexedDB.deleteDatabase('movius-db'));
    before(() => cy.login(null, 'get_all_threads-read'));

    beforeEach(() => {
        cy.readFile('src/fixtures/get_all_messages-e99-3.json').as(
            'get_all_messagesData'
        );
        cy.readFile('src/fixtures/get_all_messages-2.json').as(
            'get_all_messages2Data'
        );
    });

    it('after messages displayed set_read_status_message should be made', () => {
        cy.server();
        /*
        cy.route({
            method: 'GET',
            url: /get_all_threads/,
            response: '@get_all_threads-readData',
            delay: 100,
        }).as('get_all_threads');
        */
        cy.route('GET', /get_all_messages/, '@get_all_messagesData').as(
            'get_all_messages'
        );
        cy.route('GET', /set_read_status_message/, {}).as(
            'set_read_status_message'
        );
        // https://github.com/cypress-io/cypress/issues/6630
        cy.dataCy('messaging-nav-item').click();
        // cy.wait(['@get_all_threads', '@get_all_messages']);
        cy.url().should('include', '/messaging');
        cy.dataCy('message-list-item').should('have.length', 1);
        cy.dataCy('message-chat-item').should('have.length', 6);

        cy.wait('@set_read_status_message');
            // .wait('@set_read_status_message');
            // .wait('@set_read_status_message');
    });

    it.skip('switching to next thread should also call set_read_status_message', () => {
        cy.server();
        cy.route('GET', /get_all_messages/, '@get_all_messages2Data').as(
            'get_all_messages'
        );
        cy.route('GET', /set_read_status_message/, {}).as(
            'set_read_status_message'
        );
        // https://github.com/cypress-io/cypress/issues/6630
        cy.dataCy('message-list-item')
            .eq(1)
            .click()
            .wait('@get_all_messages')
            .wait('@set_read_status_message');
    });

    it.skip('switching back should NOT call set_read_status_message & set_read_status_message', () => {
        cy.server();
        cy.route('GET', /get_all_messages/, '@get_all_messages2Data').as(
            'get_all_messages'
        );
        cy.route('GET', /set_read_status_message/, {}).as(
            'set_read_status_message'
        );
        // https://github.com/cypress-io/cypress/issues/6630
        cy.dataCy('message-list-item')
            .eq(0)
            .click()
            .wait(10)
            .get('@get_all_messages').should(res => expect(res).to.be.null)
            .get('@set_read_status_message').should(res => expect(res).to.be.null);
    });

});
