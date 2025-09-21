import { BrowserWindow, globalShortcut, screen } from 'electron';
import * as path from 'path';

const localShortcut = require('electron-localshortcut');

export class WindowManager {
    private mainWindow: BrowserWindow | null = null;
    private originalOpacity = 0.9;
    private isQuitting = false;

    public createWindow(): BrowserWindow {
        this.mainWindow = new BrowserWindow({
            width: 400,
            height: 600,
            minWidth: 350,
            minHeight: 400,
            transparent: true,
            frame: false,
            alwaysOnTop: true,
            skipTaskbar: false,
            resizable: true,
            movable: true,
            webPreferences: {
                contextIsolation: false,
                enableRemoteModule: true,
                nodeIntegration: true,
                webSecurity: false
            },
            icon: path.join(__dirname, '../angular-electron-app/browser/assets/icon.png'),
            show: false,
            opacity: this.originalOpacity
        });

        // Load the built Angular app
        const indexPath = path.join(__dirname, '../angular-electron-app/browser/index.html');
        console.log('Loading app from:', indexPath);
        this.mainWindow.loadFile(indexPath);

        // Handle loading errors
        this.mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
            console.error('Failed to load app:', errorCode, errorDescription);
        });

        // Show window when ready
        this.mainWindow.once('ready-to-show', () => {
            console.log('App ready to show');
            this.mainWindow?.show();
            if (this.mainWindow) this.mainWindow.focus();
        });

        // DevTools - Enable with F12 or Ctrl+Shift+I in any environment
        this.mainWindow.webContents.on('before-input-event', (event, input) => {
            if (input.key === 'F12' || (input.control && input.shift && input.key.toLowerCase() === 'i')) {
                this.mainWindow?.webContents.toggleDevTools();
            }
        });

        this.mainWindow.on('closed', () => {
            this.mainWindow = null;
        });

        // Handle minimize to tray instead of taskbar
        this.mainWindow.on('minimize', (event: any) => {
            event.preventDefault();
            this.mainWindow?.hide();
            // Set skipTaskbar to true when minimized to tray
            if (this.mainWindow) {
                this.mainWindow.setSkipTaskbar(true);
            }
        });

        // Handle close button - should terminate the application
        this.mainWindow.on('close', (event: any) => {
            // Set quitting flag and quit the app
            this.isQuitting = true;
            const { app } = require('electron');
            app.quit();
        });

        return this.mainWindow;
    }

    public registerLocalShortcuts(
        toggleWindowVisibility: () => void,
        toggleTransparency: () => void,
        resetWindowPosition: () => void,
        toggleScreenSharingMode: () => void
    ) {
        if (!this.mainWindow) return;

        localShortcut.register(this.mainWindow, 'Ctrl+Shift+H', toggleWindowVisibility);
        localShortcut.register(this.mainWindow, 'Ctrl+Shift+T', toggleTransparency);
        localShortcut.register(this.mainWindow, 'Ctrl+Shift+S', () => {
            if (this.mainWindow) this.mainWindow.webContents.send('trigger-screenshot');
        });
        localShortcut.register(this.mainWindow, 'Ctrl+Shift+R', resetWindowPosition);
        localShortcut.register(this.mainWindow, 'Ctrl+Shift+M', toggleScreenSharingMode);
        
        // Add debugging shortcuts
        localShortcut.register(this.mainWindow, 'F12', () => {
            if (this.mainWindow) this.mainWindow.webContents.toggleDevTools();
        });
        localShortcut.register(this.mainWindow, 'Ctrl+Shift+I', () => {
            if (this.mainWindow) this.mainWindow.webContents.toggleDevTools();
        });
        localShortcut.register(this.mainWindow, 'Ctrl+Shift+D', () => {
            if (this.mainWindow) this.mainWindow.webContents.toggleDevTools();
        });
    }

    public registerGlobalShortcuts(
        toggleWindowVisibility: () => void
    ) {
        globalShortcut.register('Ctrl+Alt+M', toggleWindowVisibility);
        globalShortcut.register('Ctrl+Alt+H', () => {
            if (this.mainWindow) {
                this.mainWindow.hide();
                this.mainWindow.setSkipTaskbar(true);
            }
        });
        globalShortcut.register('Ctrl+Alt+D', () => {
            if (this.mainWindow) {
                this.mainWindow.webContents.toggleDevTools();
                if (!this.mainWindow.isVisible()) {
                    this.mainWindow.show();
                    this.mainWindow.focus();
                }
            }
        });
    }

    public toggleWindowVisibility() {
        if (!this.mainWindow) return;
        if (this.mainWindow.isVisible()) {
            this.mainWindow.hide();
            this.mainWindow.setSkipTaskbar(true);
        } else {
            this.mainWindow.show();
            this.mainWindow.focus();
            this.mainWindow.setSkipTaskbar(false);
        }
    }

    public toggleTransparency() {
        if (!this.mainWindow) return;
        const currentOpacity = this.mainWindow.getOpacity();
        const newOpacity = currentOpacity > 0.5 ? 0.3 : this.originalOpacity;
        this.mainWindow.setOpacity(newOpacity);
    }

    public resetWindowPosition() {
        if (!this.mainWindow) return;
        const { width, height } = screen.getPrimaryDisplay().workAreaSize;
        this.mainWindow.setBounds({
            x: width - 450,
            y: 50,
            width: 400,
            height: 600
        });
    }

    public getMainWindow(): BrowserWindow | null {
        return this.mainWindow;
    }

    public setIsQuitting(quitting: boolean) {
        this.isQuitting = quitting;
    }

    public getIsQuitting(): boolean {
        return this.isQuitting;
    }
}