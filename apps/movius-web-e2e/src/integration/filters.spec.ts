describe('filters', () => {
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

    it('calls filter should work', () => {
        cy.dataCy('search-bar-icon').click().dataCy('search-input').type('124');
        cy.dataCy('calls-list-item').should('have.length', 1);
    });

    it.skip('messages filter should work', () => {
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
        cy.dataCy('search-bar-icon').click().dataCy('search-input').type('141');
        cy.dataCy('message-list-item').should('have.length', 1);
    });

    it.skip('contacts filter should work', () => {
        cy.dataCy('contacts-nav-item').click();
        cy.dataCy('search-bar-icon').click().dataCy('search-input').type('124');
        cy.dataCy('contact-item').should('have.length', 1);
    });
});
