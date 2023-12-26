describe.skip('messages', () => {
    before(() => indexedDB.deleteDatabase('movius-db'));
    before(() => cy.login());

    beforeEach(() => {
        cy.readFile('src/fixtures/get_all_threads.json').as(
            'get_all_threadsData'
        );
        cy.readFile('src/fixtures/get_all_messages-1.json').as(
            'get_all_messagesData'
        );
        cy.readFile('src/fixtures/get_all_messages-2.json').as(
            'get_all_messages2Data'
        );
    });

    it('after login should display correct messages list', () => {
        cy.server();
        cy.route({
            method: 'GET',
            url: /get_all_threads/,
            response: '@get_all_threadsData',
            delay: 100,
        }).as('get_all_threads');
        cy.route('GET', /get_all_messages/, '@get_all_messagesData').as(
            'get_all_messages'
        );
        cy.dataCy('messaging-nav-item').click();
        cy.wait(['@get_all_messages']);
        cy.url().should('include', '/messaging');
        cy.dataCy('message-list-item').should('have.length', 1);
        cy.dataCy('message-chat-item').should('have.length', 8);

        // only visible messages excluded
        // cy.dataCy('new-messages-count').eq(0).should('not.be.visible');
        cy.dataCy('new-messages-count')
            .eq(1)
            .should('be.visible')
            .should('include.text', '1');
    });

    it.skip('open next chat should reset unread messages count', () => {
        cy.server();
        cy.route('GET', /get_all_messages/, '@get_all_messages2Data').as(
            'get_all_messages'
        );
        cy.dataCy('message-list-item')
            .eq(1)
            .click()
            .wait('@get_all_messages')
            .dataCy('new-messages-count')
            .eq(1)
            .should('not.be.visible')
            // Since we use same stub data for any peer message, as soon peer messages loaded
            // message will jump to first position
            .url()
            .should('include', '14847951879');

        // give time display message to be stored in local db
        cy.wait(500);
    });

    it('after messages reload messages should stay read', () => {
        cy.login(true);
        cy.server();
        cy.route('GET', /get_all_messages/, '@get_all_messagesData').as(
            'get_all_messages'
        );
        cy.dataCy('messaging-nav-item')
            .click()
            .wait('@get_all_messages')
            .url()
            .should('include', 'messaging')
            // only visible messages excluded
            //.dataCy('new-messages-count')
            //.eq(0)
            //.should('not.be.visible')
            .dataCy('new-messages-count')
            .eq(1)
            .should('not.be.visible');
    });

    it('user should be able remove message', () => {
        cy.dataCy('chat-item-dropdown')
            .last()
            .click({ force: true })
            .dataCy('chat-item-remove-message')
            .click()
            .dataCy('message-chat-item')
            .should('have.length', 7);
    });

    it.skip('user should be able remove message', () => {
        // TODO click confirm button 
        cy.dataCy('chat-menu-dropdown')
            .click()
            .dataCy('chat-remove-messages')
            .click()
            .dataCy('message-chat-item')
            .should('have.length', 0);
    });
});
