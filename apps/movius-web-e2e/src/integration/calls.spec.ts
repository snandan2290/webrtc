describe('calls', () => {
    before(() => indexedDB.deleteDatabase('movius-db'));
    before(() => cy.login());

    it('after login should display correct calls list', () => {
        cy.url()
            .should('include', '/calling')
            .dataCy('calls-list-item')
            .should('have.length', 1)
            .dataCy('call-history-item')
            .should('have.length', 3);
    });

    it('history item could be deleted', () => {
        cy.dataCy('call-history-item')
            .eq(0)
            .click()
            .dataCy('remove-history-item')
            .eq(0)
            .click()
            .dataCy('call-history-item')
            .should('have.length', 2);
    });

    it('all history could be deleted', () => {
        cy.dataCy('remove-all-history')
            .click()
            .dataCy('call-history-item')
            .should('not.exist');
    });

    describe('when calling', () => {
        it('active outgoing call should be displayed', () => {
            cy.dataCy('call-button')
                .click()
                .get('movius-web-active-outgoing-call')
                .should('exist');
        });
    });
});
