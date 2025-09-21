import { app, globalShortcut } from 'electron';
import { WindowManager } from './window-manager';
import { TrayManager } from './tray-manager';
import { ScreenProtectionManager } from './screen-protection';
import { IpcHandlers } from './ipc-handlers';

// Global managers
let windowManager: WindowManager;
let trayManager: TrayManager;
let screenProtection: ScreenProtectionManager;
let ipcHandlers: IpcHandlers;

function initializeApp() {
    // Create window manager and main window
    windowManager = new WindowManager();
    const mainWindow = windowManager.createWindow();

    // Initialize screen protection
    screenProtection = new ScreenProtectionManager(mainWindow);
    screenProtection.enableContentProtection();
    screenProtection.setupScreenSharingDetection();

    // Apply display affinity when window is shown (Windows only)
    mainWindow.on('show', () => {
        if (process.platform === 'win32') {
            screenProtection.enableContentProtection();
        }
    });

    // Initialize tray manager
    trayManager = new TrayManager(mainWindow);
    trayManager.createTray();

    // Initialize IPC handlers
    ipcHandlers = new IpcHandlers(mainWindow, screenProtection);

    // Register shortcuts
    windowManager.registerLocalShortcuts(
        () => windowManager.toggleWindowVisibility(),
        () => windowManager.toggleTransparency(),
        () => windowManager.resetWindowPosition(),
        () => screenProtection.toggleScreenSharingMode()
    );

    windowManager.registerGlobalShortcuts(
        () => windowManager.toggleWindowVisibility()
    );

    return mainWindow;
}

// APP LIFECYCLE
app.on('ready', () => {
    initializeApp();
});

app.on('window-all-closed', () => {
    globalShortcut.unregisterAll();
    // Clean up screen protection
    if (screenProtection) {
        screenProtection.cleanup();
    }
    // Quit the app when all windows are closed
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('before-quit', () => {
    if (windowManager) {
        windowManager.setIsQuitting(true);
    }
    // Clean up resources
    if (screenProtection) {
        screenProtection.cleanup();
    }
});

app.on('activate', () => {
    const { BrowserWindow } = require('electron');
    if (BrowserWindow.getAllWindows().length === 0) {
        initializeApp();
    }
});