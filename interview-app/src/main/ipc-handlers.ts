import { ipcMain, BrowserWindow, desktopCapturer } from 'electron';
import { ScreenProtectionManager } from './screen-protection';

export class IpcHandlers {
    private mainWindow: BrowserWindow | null = null;
    private screenProtection: ScreenProtectionManager;

    constructor(mainWindow: BrowserWindow, screenProtection: ScreenProtectionManager) {
        this.mainWindow = mainWindow;
        this.screenProtection = screenProtection;
        this.registerHandlers();
    }

    private registerHandlers() {
        // Screenshot handler
        ipcMain.handle('take-screenshot', async () => {
            try {
                const sources = await desktopCapturer.getSources({
                    types: ['screen'],
                    thumbnailSize: { width: 1920, height: 1080 }
                });
                return sources.length > 0 ? sources[0].thumbnail.toDataURL() : null;
            } catch (error) {
                console.error('Screenshot error:', error);
                return null;
            }
        });

        // Window control handlers
        ipcMain.handle('minimize-window', () => {
            BrowserWindow.getFocusedWindow()?.minimize();
        });

        ipcMain.handle('close-window', () => {
            BrowserWindow.getFocusedWindow()?.close();
        });

        ipcMain.handle('set-opacity', (event, opacity) => {
            const win = BrowserWindow.getFocusedWindow();
            if (win) win.setOpacity(parseFloat(opacity));
        });

        ipcMain.handle('toggle-always-on-top', (event, alwaysOnTop) => {
            const win = BrowserWindow.getFocusedWindow();
            if (win) win.setAlwaysOnTop(alwaysOnTop);
        });

        // Window visibility handlers
        ipcMain.handle('hide-window', () => {
            if (this.mainWindow) {
                this.mainWindow.hide();
                this.mainWindow.setSkipTaskbar(true);
            }
        });

        ipcMain.handle('show-window', () => {
            if (this.mainWindow) {
                this.mainWindow.show();
                this.mainWindow.focus();
                this.mainWindow.setSkipTaskbar(false);
            }
        });

        ipcMain.handle('toggle-window', () => {
            this.toggleWindowVisibility();
        });

        ipcMain.handle('reset-position', () => {
            this.resetWindowPosition();
        });

        // Hotkeys information
        ipcMain.handle('get-hotkeys', () => ({
            toggleVisibility: 'Ctrl+Shift+H',
            toggleTransparency: 'Ctrl+Shift+T',
            quickScreenshot: 'Ctrl+Shift+S',
            resetPosition: 'Ctrl+Shift+R',
            globalToggle: 'Ctrl+Alt+M',
            globalHide: 'Ctrl+Alt+H',
            devTools: 'F12 / Ctrl+Shift+I / Ctrl+Shift+D',
            globalDevTools: 'Ctrl+Alt+D'
        }));

        // Screen sharing and protection handlers
        ipcMain.handle('get-screen-sharing-status', () => {
            return this.screenProtection.getScreenSharingStatus();
        });

        ipcMain.handle('toggle-screen-sharing-mode', () => {
            return this.screenProtection.toggleScreenSharingMode();
        });

        ipcMain.handle('set-screen-sharing-mode', (event, active) => {
            return this.screenProtection.setScreenSharingMode(active);
        });

        ipcMain.handle('get-content-protection-status', () => {
            return this.screenProtection.getContentProtectionStatus();
        });

        ipcMain.handle('toggle-content-protection', () => {
            return this.screenProtection.toggleContentProtection();
        });

        // Debugging handlers
        ipcMain.handle('toggle-dev-tools', () => {
            if (this.mainWindow) {
                this.mainWindow.webContents.toggleDevTools();
                return this.mainWindow.webContents.isDevToolsOpened();
            }
            return false;
        });

        // Tray handlers
        ipcMain.handle('show-from-tray', () => {
            if (this.mainWindow) {
                this.mainWindow.show();
                this.mainWindow.focus();
                this.mainWindow.setSkipTaskbar(false);
                return true;
            }
            return false;
        });

        ipcMain.handle('hide-to-tray', () => {
            if (this.mainWindow) {
                this.mainWindow.hide();
                this.mainWindow.setSkipTaskbar(true);
                return true;
            }
            return false;
        });
    }

    private toggleWindowVisibility() {
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

    private resetWindowPosition() {
        if (!this.mainWindow) return;
        const { screen } = require('electron');
        const { width, height } = screen.getPrimaryDisplay().workAreaSize;
        this.mainWindow.setBounds({
            x: width - 450,
            y: 50,
            width: 400,
            height: 600
        });
    }

    public updateMainWindow(mainWindow: BrowserWindow | null) {
        this.mainWindow = mainWindow;
    }
}