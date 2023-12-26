export const environment = {
    production: false,
    useMoviusServer: true,
    baseUrl: 'https://rnd100.moviuscorp.net:8021/adk/',
    sipTest: {
        server: 'wss://edge.sip.onsip.com',
        domain: 'sipjs.onsip.com',
    },
    sipMovius: {
        userAgentString: 'Movius WEBRTC',
        iceGatheringTimeout: 10,
        registererExpiresTimeout: 5
    },
    msGraph: {
        clientId: '0400edd7-775c-428d-95e4-ccf098aa6ee2',
        redirectUrl: 'https://movius.stage.scaliolabs.com',
        scopes: [
            'Contacts.ReadWrite',
            'Contacts.Read.Shared',
            'People.Read',
            'offline_access',
        ],
    },
    checkOnlineStatus: {
        checkUrl: 'https://upload.wikimedia.org/wikipedia/commons/c/ca/1x1.png',
        checkInterval: 5000
    }
};
