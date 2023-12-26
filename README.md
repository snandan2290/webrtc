# Movius Client Application by Scalio.

## Development

+ Navigate to the solution folder
+ Run `yarn install`
+ Run `yarn start`

`yarn start` is alias for `ng serve` command more on `ng serve` [here](https://angular.io/cli/serve).

## Build (stage)

Build environment

```
node v12.7.0
npm v6.10.0
```

+ Navigate to the solution folder
+ Run `yarn install`
+ Ensure `apps\movius-web\src\environments\environment.stg.ts` contains correct configuration
+ Run `yarn build --configuration staging`

`yarn build` is alias for `ng build` command more on `ng build` [here](https://angular.io/cli/build).

## Test

Project includes integration tests with [cypress](https://www.cypress.io/)

+ Navigate to the solution folder
+ Run `yarn install`
+ Run `yarn e2e:ci` - it will run tests in console (suits for CI)

If you wont to run your tests locally with watch mode and UI to debug, run `yarn e2e --watch`

The `yarn e2e:ci` is alias for `nx e2e` more on it [here](https://nx.dev/latest/angular/cli/e2e)

## Local data encryption

For local storage app uses IndexedDb
All sensitive data is encrypted with [AES-GCM](https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/encrypt)

TBD Backend:
TODO : It's already implemented

we need API to get `secret key` and `iv` from backend for every user
These params should be created like this and encoded as a string  
```
const secretKey = window.crypto.getRandomValues(new Uint8Array(16));
const iv = window.crypto.getRandomValues(new Uint8Array(12));
``` 
It is important these params have the same size as in example.

## MS Graph API Authorization

In order to retrieve outlook contacts from MS Graph API, first we need to authorize API.

The overall documentation on authorization flows is [here](https://docs.microsoft.com/en-us/azure/active-directory/develop/authentication-flows-app-scenarios)


### MS Graph API Authorization (SPA)
The web application (SPA) is using [MSAL.js](https://www.npmjs.com/package/msal) library to authorize user to request contacts data.

SPA using [Authorization code flow with PKCE](https://docs.microsoft.com/en-us/azure/active-directory/develop/authentication-flows-app-scenarios#single-page-application)

Basically the flow works like this:

+ Admin register application on azure portal 
    - Azure Active Directory / App Registrations / New Registration
    - Register new Web application
    - Add redirect url to the host which could be able authorize users in MS (for example `https://movius.stage.scaliolabs.com`)
    - Under `Implicit grant` check `Access tokens` and `ID tokens`
    - Toggle `Allow public client flows` to `Yes`
    - In `API permissions` page following [permissions](https://docs.microsoft.com/en-us/azure/active-directory/develop/v2-permissions-and-consent) should be added for the application `Contacts.Read`, `Contacts.Read.Shared`, `User.Read`

+ When user try to sync outlook contacts from MS Graph API it should give [consent](https://docs.microsoft.com/en-us/azure/active-directory/develop/v2-permissions-and-consent) to read his contacts in `Microsoft Authorization Screen Popup` (standard oauth2 / oidc flow)

+ After user gives consent he will be authorized in MS Graph API and application will e


### MS Graph API Authorization (Electron)
The Electron application is using source code from [here](https://github.com/AzureAD/microsoft-authentication-library-for-js)
```
git clone git@github.com:AzureAD/microsoft-authentication-library-for-js.git
git checkout f54d8797f34005147528e28314fce700d22b4b2a
cd experimental\msal-electron-proof-of-concept
```

#### What MSAL Electron does

MSAL Electron allows Electron applications to authenticate users and acquire access tokens for AAD and MSA accounts. Once a user has been authenticated and an access token has been requested and received, the client application can use said access token to make authorized requests to Microsoft resources such as MS Graph.

#### OAuth 2.0 and the Authorization Code Flow

MSAL Electron implements the [Authorization Code Grant Flow](https://docs.microsoft.com/en-us/azure/active-directory/develop/v2-oauth2-auth-code-flow), as defined by the OAuth 2.0 protocol and is [OpenID](https://docs.microsoft.com/en-us/azure/active-directory/develop/v2-protocols-oidc) compliant.

Although our goal is to abstract enough of the protocol away so that you can get 'plug and play' authentication, it is important to know and understand the auth code flow from a security perspective in order to use this library.

The auth code flow runs in the context of a native client (a client running directly on a user's device), which falls under the definition of a public client in the OAuth 2.0 spec.

As opposed to confidential clients, public clients cannot guarantee the confidentiality of their credentials given the environment they operate in. In short, the auth code grant is designed as a specific solution to more secure authentication for this specific class of applications.

For more information on the concepts related to the Auth Code Grant flow, refer to the [official RFC on OAuth 2.0](https://tools.ietf.org/html/rfc6749#section-1.3.1).

