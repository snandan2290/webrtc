import { MockSipService } from 'libs/sip/src/lib/mock-sip.service';

describe('incoming-simultaneous-calls', () => {
    const getMockSipService = () =>
        cy.window().then((win) => win['mockSipService'] as MockSipService);

    before(() => indexedDB.deleteDatabase('movius-db'));
    before(() => cy.login());

    before(() => {
        getMockSipService().then((x) => {
            x.user.mockIncomingCall('+77777777');
            x.user.mockIncomingCall('+88888888');
        });
    });

    it('active outgoing call should be displayed', () => {
        cy.get('movius-web-popover-incoming-call').should('be.visible');
    });

    describe('accept first call must change second call view', () => {
        before(() => {
            cy.dataCy('accept-call-btn').eq(0).click();
            cy.dataCy('accept-call-btn').eq(0).click();
        });

        it('active outgoing call should be displayed', () => {
            cy.get('movius-web-on-hold-call')
                .should('be.visible')
                .should('contain.text', '8888');
            cy.get('movius-web-popover-ongoing-call')
                .should('be.visible')
                .should('contain.text', '7777');
        });

        describe('when swap calls', () => {
            before(() => {
                cy.dataCy('call-swap-btn').click();
            });

            it('calls should be swapped', () => {
                cy.get('movius-web-on-hold-call')
                    .should('be.visible')
                    .should('contain.text', '7777');
                cy.get('movius-web-popover-ongoing-call')
                    .should('be.visible')
                    .should('contain.text', '8888');
            });
        });
    });
});
