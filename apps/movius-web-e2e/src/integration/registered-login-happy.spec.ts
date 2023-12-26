describe('registered login happy', () => {
    before(() => indexedDB.deleteDatabase('movius-db'));
    before(() => cy.visit('/auth/login'));

    beforeEach(() => {
        cy.readFile('src/fixtures/login.xml').as('loginData');
        cy.readFile('src/fixtures/login-confirm.xml').as('loginConfirmData');
        cy.readFile('src/fixtures/getnumbers.xml').as('getnumbersData');
        cy.readFile('src/fixtures/activate.xml').as('activateData');
        cy.readFile('src/fixtures/verifypin.xml').as('verifypinData');
        cy.readFile('src/fixtures/adduserdevice.xml').as('adduserdeviceData');
        cy.readFile('src/fixtures/get_user_info-2.xml').as('get_user_infoData');
        cy.readFile('src/fixtures/modify_password.xml').as(
            'modify_passwordData'
        );
        cy.readFile('src/fixtures/get_calls.json').as('get_callsData');
        cy.readFile('src/fixtures/get_all_threads.json').as(
            'get_all_threadsData'
        );
    });

    it('registered login should success', () => {
        cy.server();
        cy.route({
            method: 'POST',
            url: /login/,
            response: '@loginConfirmData',
            delay: 500,
        }).as('loginConfirm');
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

        cy.dataCy('email-input')
            .type('maxp@scal.io{enter}')
            .dataCy('password-input')
            .type('Password123!')
            .dataCy('signin-button')
            .click();
        cy.dataCy('signin-button').should('be.disabled');
        cy.wait([
            '@loginConfirm',
            '@adduserdevice',
            '@get_user_info',
            '@get_calls',
            '@get_all_threads',
        ])
            .url()
            .should('include', '/calling');
    });
});
