describe('call-unknown', () => {
    before(() => indexedDB.deleteDatabase('movius-db'));
    before(() => cy.login());

    before(() =>
        cy
            .dataCy('call-number-button')
            .click()
            .dataCy('message-new-number-input')
            .type('7777777')
            .dataCy('make-call-button')
            .click()
            // TODO : Constantine, check why double click needed here ?
            .click()
    );

    it('active outgoing call should be displayed', () => {
        cy.get('movius-web-active-outgoing-call').should('be.visible');
    });

    it('hangup call should work', () => {
        cy.dataCy('hang-up-button')
            .click()
            .get('movius-web-inactive-call')
            .should('exist');
    });
});
