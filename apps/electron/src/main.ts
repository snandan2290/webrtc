// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License

import { app, BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';
import { PublicClientApplication } from './msal-electron-poc';
import { AuthOptions } from './msal-electron-poc/AppConfig/AuthOptions';

export default class Main {
    static application: Electron.App;
    static mainWindow: Electron.BrowserWindow;
    static msalApp: PublicClientApplication;
    static accessToken: string;

    static main(): void {
        Main.application = app;
        Main.application.on('window-all-closed', Main.onWindowAllClosed);
        Main.application.on('ready', Main.onReady);
    }

    private static onWindowAllClosed(): void {
        Main.application.quit();
    }

    private static onClose(): void {
        Main.mainWindow = null;
    }

    private static onReady(): void {
        Main.createMainWindow();

        Main.mainWindow.loadFile(
            path.join(__dirname, '../movius-web/index.html')
        );

        Main.mainWindow.on('closed', Main.onClose);

        Main.mainWindow.setMenu(null);

        // Main.mainWindow.webContents.openDevTools();

        // Listen for AcquireToken button call
        Main.listenForAcquireToken();
    }

    // Creates main application window
    private static createMainWindow(): void {
        this.mainWindow = new BrowserWindow({
            width: 800,
            height: 600,
            webPreferences: {
                nodeIntegration: true,
            },
        });
    }

    // This is where MSAL set up and configuration happens.
    private static configureAuthentication(config: any): void {
        const msalAuthConfig: AuthOptions = {
            clientId: config.clientId,
            redirectUri: 'http://localhost',
        };
        this.msalApp = new PublicClientApplication(msalAuthConfig);
    }

    // Sets a listener for the AcquireToken event that when triggered
    // performs the authorization code grant flow
    private static listenForAcquireToken(): void {
        ipcMain.handle('login', (_, config) => {
            if (!Main.msalApp) {
                Main.configureAuthentication(config);
            }
            Main.getAccessToken(config.scopes);
        });
    }

    // Uses MSAL PublicClientApplication object to obtain an access
    // token for Microsoft Graph API access
    private static async getAccessToken(scopes: string[]): Promise<void> {
        const tokenRequest = {
            scopes,
        };
        try {
            Main.accessToken = await this.msalApp.acquireToken(tokenRequest);
            this.mainWindow.webContents.send('loginSuccess', Main.accessToken);
        } catch (error) {
            console.error(error);
            this.mainWindow.webContents.send('loginError', error);
        }
    }
}
