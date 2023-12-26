describe('messages-load-more', () => {
    before(() => indexedDB.deleteDatabase('movius-db'));
    before(() => cy.login(null, 'get_all_threads-e99-a'));

    beforeEach(() => {
        cy.readFile('src/fixtures/get_all_messages-e99-a-20.json').as(
            'get_all_messagesA20Data'
        );
        cy.readFile('src/fixtures/get_all_messages-e99-a-7.json').as(
            'get_all_messagesA7Data'
        );
        cy.readFile('src/fixtures/get_all_messages-2.json').as(
            'get_all_messagesB1Data'
        );
    });

    it('after messages displayed set_read_status_message should be made', () => {
        cy.server();
        cy.route('GET', /get_all_messages/, '@get_all_messagesA20Data').as(
            'get_all_messages_20'
        );
        cy.route('GET', /set_read_status_message/, {}).as(
            'set_read_status_message'
        );
        // https://github.com/cypress-io/cypress/issues/6630
        cy.dataCy('messaging-nav-item').click();
        // cy.wait(['@get_all_threads', '@get_all_messages_20']);
        cy.url().should('include', '/messaging');
        cy.dataCy('message-list-item').should('have.length', 1);
        cy.dataCy('message-chat-item').should('have.length', 20);
        cy.wait(10);
        cy.dataCy('message-chat-item').eq(19).should('be.visible');
    });

    it('when scroll to 3d item from the top additional 7 messages should be loaded', () => {
        cy.server();
        cy.route('GET', /get_all_messages/, '@get_all_messagesA7Data').as(
            'get_all_messages_7'
        );
        cy.route('GET', /set_read_status_message/, {}).as(
            'set_read_status_message'
        );
        //cy.get('div.pane__body').eq(1).scrollTo('top');
        cy.dataCy('message-chat-item').eq(10).scrollIntoView(); //.scrollTo('top');
        cy.wait(['@get_all_messages_7']);
        cy.dataCy('message-chat-item').should('have.length', 27);
    });

    it.skip('switching to next thread should work', () => {
        cy.server();
        cy.route('GET', /get_all_messages/, '@get_all_messagesB1Data').as(
            'get_all_messages'
        );
        // https://github.com/cypress-io/cypress/issues/6630
        cy.dataCy('message-list-item').eq(1).click().wait('@get_all_messages');
    });

    it.skip('switching back should auto scroll to bottom', () => {
        cy.server();
        cy.route('GET', /get_all_messages/, '@get_all_messagesA20Data').as(
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
            .get('@get_all_messages')
            .should((res) => expect(res).to.be.null)
            .get('@set_read_status_message')
            .should((res) => expect(res).to.be.null);

        cy.wait(10);
        cy.dataCy('message-chat-item').eq(26).should('be.visible');
    });
});
