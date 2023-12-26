import { MockSipService } from 'libs/sip/src/lib/mock-sip.service';
import { Observable } from 'rxjs';
import { delay, filter, take } from 'rxjs/operators';

const getAppRef = () => cy.window().should('have.property', 'appRef');

const getStore = () => cy.window().should('have.property', 'appStore');

const tick = () =>
    getAppRef()
        // @ts-ignore
        .invoke('tick');

const dispatchAction = (action: any) => getStore().invoke('dispatch', action);

const getSendMessage$ = (): Cypress.Chainable<Observable<any>> =>
    cy.window().then((win) => win['sendMessage$']);

describe('messages-fail-resending', () => {
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

    describe('sending new message', () => {
        before(() => {
            return cy
                .getMockSipService()
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

        describe.skip('resend messages in sending state', () => {
            before(() => {
                cy.readFile('src/fixtures/get_all_messages-2.json').as(
                    'get_all_messages2Data'
                );
                cy.server();
                cy.route(
                    'GET',
                    /get_all_messages/,
                    '@get_all_messages2Data'
                ).as('get_all_messages');

                return cy
                    .reload()
                    .get('movius-web-main-layout')
                    .should('exist')
                    .then(() =>
                        getSendMessage$().then(async (sendMessage$) => {
                            sendMessage$
                                .pipe(take(1), delay(1))
                                .subscribe((evt) => {
                                    // this message suppose to be in sending state when page was reloaded, it should be resent anyway
                                    evt.delegate.onReject({
                                        message: {
                                            statusCode: 408,
                                            reasonPhrase: 'some error',
                                        },
                                    });
                                });
                        })
                    )
                    .wait('@get_all_messages');
            });

            it('message no longer is in error state', () => {
                cy.dataCy('message-chat-item').should('have.length', 2);
                cy.dataCy('error-message').should('have.length', 1);
            });
        });
    });
});
