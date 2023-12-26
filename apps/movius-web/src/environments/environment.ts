// This file can be replaced during build by using the `fileReplacements` array.
// `ng build --prod` replaces `environment.ts` with `environment.prod.ts`.
// The list of file replacements can be found in `angular.json`.

export const environment = {
    production: false,
    useMoviusServer: true,
    baseUrl: 'https://rnd100.moviuscorp.net:8021/adk/',
    sipMovius: {
        userAgentString: 'Movius WEBRTC',
        registererExpiresTimeout: 5,
        iceGatheringTimeout: 10,
    },
    sipTest: {
        server: 'wss://edge.sip.onsip.com',
        domain: 'sipjs.onsip.com',
    },
    msGraph: {
        clientId: '0400edd7-775c-428d-95e4-ccf098aa6ee2',
        redirectUrl: 'http://localhost:4200',
        scopes: [
            'Contacts.ReadWrite',
            'Contacts.Read.Shared',
            'People.Read',
            'offline_access',
        ],
    },
    checkOnlineStatus: {
        checkUrl: 'https://upload.wikimedia.org/wikipedia/commons/c/ca/1x1.png',
        checkInterval: 5000,
    }
};

/*
 * For easier debugging in development mode, you can import the following file
 * to ignore zone related error stack frames such as `zone.run`, `zoneDelegate.invokeTask`.
 *
 * This import should be commented out in production mode because it will have a negative impact
 * on performance if an error is thrown.
 */
// import 'zone.js/dist/zone-error';  // Included with Angular CLI.
