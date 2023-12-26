import { SipService } from '@scalio/sip';
import { MockSipService } from 'libs/sip/src/lib/mock-sip.service';
import { Observable } from 'rxjs';
import { delay, filter, skip, take } from 'rxjs/operators';

describe('messages-fail-reload', () => {
    before(() => indexedDB.deleteDatabase('movius-db'));
    before(() => cy.login(null, 'get_all_threads-2'));

    beforeEach(() => {
        cy.readFile('src/fixtures/get_all_threads-2.json').as(
            'get_all_threads2Data'
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
            response: '@get_all_threads2Data',
            delay: 1,
        }).as('get_all_threads');
        cy.route('GET', /get_all_messages/, '@get_all_messages2Data').as(
            'get_all_messages'
        );
        cy.dataCy('messaging-nav-item').click();
        // cy.wait(['@get_all_threads', '@get_all_messages']);
        cy.url().should('include', '/messaging');
        cy.dataCy('message-list-item').should('have.length', 1);
        cy.dataCy('message-chat-item').should('have.length', 1);
    });

    describe('sending new message with reject', () => {
        before(() => {
            cy.getMockSipService()
                .then((ss: MockSipService) =>
                    ss.user.userAgentEvents$
                        .pipe(
                            filter(
                                (f) =>
                                    f.kind === 'UserAgentOutgoingActionEvent' &&
                                    f.action.kind ===
                                        'UserAgentOutgoingMessageAction'
                            ),
                            take(1)
                        )
                        .subscribe((x: any) => {
                            ss.user.mockRejectMessage(x.action.message);
                        })
                )
                .dataCy('send-message-input')
                .type('lol')
                .dataCy('send-message-button')
                .click();
        });

        it('message should have be displayed in error state', () => {
            cy.dataCy('message-chat-item').should('have.length', 2);
            cy.dataCy('error-message').should('have.length', 1);
        });

        describe.skip('resend messages on reload should work', () => {
            before(() => {
                cy.readFile('src/fixtures/get_all_messages-3.json').as(
                    'get_all_messages3Data'
                );
                cy.server();
                cy.route(
                    'GET',
                    /get_all_messages/,
                    '@get_all_messages3Data'
                ).as('get_all_messages');
                return cy
                    .reload()
                    .get('movius-web-main-layout')
                    .should('exist')
                    .wait('@get_all_messages');
            });

            it('message no longer is in error state', () => {
                cy.dataCy('message-chat-item').should('have.length', 2);
                cy.dataCy('error-message').should('have.length', 0);
            });
        });
    });
});
