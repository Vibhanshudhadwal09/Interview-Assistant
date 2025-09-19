// This file is the entry point for the Electron application. It creates the main application window and handles the lifecycle events of the Electron app.

import { app, BrowserWindow } from 'electron';
import * as path from 'path';

function createWindow() {
    let mainWindow: BrowserWindow | null = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'), // Adjust if you have a preload script
            contextIsolation: true,
            enableRemoteModule: false,
            nodeIntegration: false,
        },
    });

    // Load the built Angular app
    mainWindow.loadFile(path.join(__dirname, '../angular-electron-app/index.html'));

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

app.on('ready', createWindow);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});