export const environment = {
    production: true,
    useMoviusServer: true,
    baseUrl: 'https://rnd100.moviuscorp.net:8021/adk/',
    sipTest: {
        server: 'wss://edge.sip.onsip.com',
        domain: 'sipjs.onsip.com',
    },
    sipMovius: {
        userAgentString: 'Movius WEBRTC',
    },
    msGraph: {
        clientId: 'cc0a98ce-aeae-4496-8bbe-a5c6c4605812',
        redirectUrl: 'http://localhost:4200',
        scopes: ['Contacts.ReadWrite', 'offline_access', 'People.Read'],
    },
    checkOnlineStatus: {
        checkUrl: 'https://upload.wikimedia.org/wikipedia/commons/c/ca/1x1.png',
        checkInterval: 5000,
    }
};
