// This file is the entry point for the Electron application. It creates the main application window and handles the lifecycle events of the Electron app.

import { app, BrowserWindow } from 'electron';
import * as path from 'path';

function createWindow() {
    let mainWindow: BrowserWindow | null = new BrowserWindow({
        width: 1000,
        height: 700,
        minWidth: 800,
        minHeight: 600,
        webPreferences: {
            // Remove preload script reference since we don't have one
            contextIsolation: true,
            enableRemoteModule: false,
            nodeIntegration: false,
        },
        icon: path.join(__dirname, '../assets/icon.png'), // Add app icon if available
        titleBarStyle: 'default',
        show: false, // Don't show until ready
    });

    // Load the built Angular app
    const indexPath = path.join(__dirname, '../angular-electron-app/browser/index.html');
    console.log('Loading app from:', indexPath);
    mainWindow.loadFile(indexPath);

    // Handle loading errors
    mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
        console.error('Failed to load app:', errorCode, errorDescription);
    });

    // Show window when ready to prevent visual flash
    mainWindow.once('ready-to-show', () => {
        console.log('App ready to show');
        mainWindow?.show();
        
        // Focus the window
        if (mainWindow) {
            mainWindow.focus();
        }
    });

    // Open DevTools in development
    if (process.env.NODE_ENV === 'development') {
        mainWindow.webContents.openDevTools();
    }

    mainWindow.on('closed', () => {
        mainWindow = null;
    });

    return mainWindow;
}

app.on('ready', () => {
    createWindow();
});

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