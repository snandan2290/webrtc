// detached element issue
describe('first time login happy', () => {
    before(() => indexedDB.deleteDatabase('movius-db'));
    before(() => cy.visit('/auth/login'));

    beforeEach(() => {
        cy.readFile('src/fixtures/login.xml').as('loginData');
        cy.readFile('src/fixtures/login-confirm.xml').as('loginConfirmData');
        cy.readFile('src/fixtures/getnumbers.xml').as('getnumbersData');
        cy.readFile('src/fixtures/activate.xml').as('activateData');
        cy.readFile('src/fixtures/verifypin.xml').as('verifypinData');
        cy.readFile('src/fixtures/adduserdevice.xml').as('adduserdeviceData');
        cy.readFile('src/fixtures/get_user_info.xml').as('get_user_infoData');
        cy.readFile('src/fixtures/modify_password.xml').as(
            'modify_passwordData'
        );
        cy.readFile('src/fixtures/get_calls.json').as('get_callsData');
        cy.readFile('src/fixtures/get_all_threads.json').as(
            'get_all_threadsData'
        );
        cy.readFile('src/fixtures/get_status_e911-0.xml').as(
            'get_status_e911-0Data'
        );
        cy.readFile('src/fixtures/add_e911_subscriber.xml').as(
            'add_e911_subscriberData'
        );
        cy.readFile('src/fixtures/set_status_e911.xml').as(
            'set_status_e911Data'
        );
        cy.readFile('src/fixtures/gdpr_update.xml').as('gdpr_updateData');
    });

    it('first time login should be redirected to pin', () => {
        cy.server();
        cy.route('POST', /login/, '@loginData').as('login');
        cy.route('GET', /getnumbers/, '@getnumbersData').as('getnumbers');
        return cy
            .dataCy('email-input')
            .type('maxp@scal.io{enter}')
            .dataCy('password-input')
            .type('ca88203a')
            .dataCy('signin-button')
            .click()
            // .should('be.disabled')
            .wait(['@login', '@getnumbers'])
            .url()
            .should('include', '/auth/pin');
    });

    it('pin confirm must redirect to reset password page', () => {
        cy.server();
        cy.route('GET', /verifypin/, '@verifypinData').as('verifypin');
        cy.route('GET', /activate/, '@activateData').as('activate');
        cy.dataCy('pin-num-0')
            .type('1')
            .dataCy('pin-num-1')
            .type('1')
            .dataCy('pin-num-2')
            .type('1')
            .dataCy('pin-num-3')
            .type('1')
            .dataCy('pin-num-4')
            .type('1')
            .dataCy('pin-num-5')
            .type('1')
            .dataCy('next-button')
            .click()
            //.should('be.disabled')
            .wait(['@activate', '@verifypin'])
            .url()
            .should('include', '/auth/password')
            .dataCy('password-input')
            .should('exist');
    });

    it('reset password page must redirect to login page', () => {
        cy.server();
        cy.route('POST', /login/, '@loginConfirmData').as('loginConfirm');
        cy.route('GET', /modify_password/, '@modify_passwordData').as(
            'modify_password'
        );
        cy.route('GET', /adduserdevice/, '@adduserdeviceData').as(
            'adduserdevice'
        );
        cy.route('GET', /get_user_info/, '@get_user_infoData').as(
            'get_user_info'
        );
        cy.route('GET', /get_calls/, '@get_callsData').as('get_calls');
        cy.route('GET', /get_all_threads/, '@get_all_threadsData').as(
            'get_all_threads'
        );
        cy.route('GET', /get_status_e911/, '@get_status_e911-0Data').as(
            'get_status_e911'
        );
        cy.dataCy('old-password-input')
            .type('ca88203a')
            .dataCy('password-input')
            .type('Password123!')
            .dataCy('confirm-password-input')
            .type('Password123!')
            .dataCy('save-button')
            .click()
            // .should('be.disabled')
            .wait(['@modify_password', '@loginConfirm', '@get_status_e911'])
            .url()
            .should('include', '/calling')
            .get('movius-web-onboarding')
            .should('exist');
    });

    it('fill up onboard form must work', () => {
        cy.server();
        cy.route({
            method: 'POST',
            url: /add_e911_subscriber/,
            response: '@add_e911_subscriberData',
            delay: 100,
        }).as('add_e911_subscriber');
        cy.route('GET', /set_status_e911/, '@set_status_e911Data').as(
            'set_status_e911'
        );
        cy.route('GET', /gdpr_update/, '@gdpr_updateData').as('gdpr_update');
        cy.dataCy('street')
            .type('ocean drive')
            .dataCy('street2')
            .type('building 2')
            .dataCy('city')
            .type('New York')
            .dataCy('postal')
            .type('115522')
            .dataCy('state')
            .type('NY')
            .dataCy('country')
            .type('USA')
            .dataCy('continue-button')
            .click()
            .should('be.disabled')
            .wait(['@add_e911_subscriber'])
            .dataCy('continue-button')
            .click()
            .wait(['@add_e911_subscriber', '@set_status_e911'])
            .dataCy('later-button')
            .click()
            .dataCy('continue-button')
            .click()
            .get('movius-web-onboarding')
            .should('not.exist')
            .get('.ant-modal-confirm')
            .should('exist')
            .get('.ant-modal-confirm-btns button.ant-btn-primary')
            .click()
            .wait('@gdpr_update')
            .get('.ant-modal-confirm')
            .should('not.exist');
    });
});
