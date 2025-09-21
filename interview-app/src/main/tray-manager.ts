import { Tray, Menu, nativeImage, BrowserWindow, app } from 'electron';
import * as path from 'path';

export class TrayManager {
    private tray: Tray | null = null;
    private mainWindow: BrowserWindow | null = null;

    constructor(mainWindow: BrowserWindow) {
        this.mainWindow = mainWindow;
    }

    public createTray(): Tray | null {
        // Create a tray icon using the PNG icon
        const iconPath = path.join(__dirname, '../angular-electron-app/browser/assets/icon.png');
        let trayIcon;
        
        try {
            trayIcon = nativeImage.createFromPath(iconPath);
            if (trayIcon.isEmpty()) {
                console.log('Icon loaded but is empty, using fallback');
                trayIcon = nativeImage.createEmpty();
            } else {
                // Resize the icon for tray (16x16 for better compatibility)
                const size = trayIcon.getSize();
                if (size.width > 32 || size.height > 32) {
                    trayIcon = trayIcon.resize({ width: 16, height: 16 });
                }
                console.log('Tray icon loaded successfully');
            }
        } catch (error) {
            console.log('Could not load tray icon, using empty icon:', error);
            trayIcon = nativeImage.createEmpty();
        }
        
        this.tray = new Tray(trayIcon);
        
        // Set tooltip
        this.tray.setToolTip('Interview Assistant');
        
        // Create context menu
        const contextMenu = Menu.buildFromTemplate([
            {
                label: 'Show App',
                click: () => {
                    if (this.mainWindow) {
                        this.mainWindow.show();
                        this.mainWindow.focus();
                        // Show in taskbar when restored from tray
                        this.mainWindow.setSkipTaskbar(false);
                    }
                }
            },
            {
                label: 'Hide App',
                click: () => {
                    if (this.mainWindow) {
                        this.mainWindow.hide();
                        // Hide from taskbar when manually hidden
                        this.mainWindow.setSkipTaskbar(true);
                    }
                }
            },
            { type: 'separator' },
            {
                label: 'Toggle DevTools',
                click: () => {
                    if (this.mainWindow) {
                        this.mainWindow.webContents.toggleDevTools();
                    }
                }
            },
            {
                label: 'Reset Position',
                click: () => this.resetWindowPosition()
            },
            { type: 'separator' },
            {
                label: 'Quit',
                click: () => {
                    app.quit();
                }
            }
        ]);
        
        this.tray.setContextMenu(contextMenu);
        
        // Double click to show/hide
        this.tray.on('double-click', () => {
            if (this.mainWindow) {
                if (this.mainWindow.isVisible()) {
                    this.mainWindow.hide();
                    this.mainWindow.setSkipTaskbar(true);
                } else {
                    this.mainWindow.show();
                    this.mainWindow.focus();
                    this.mainWindow.setSkipTaskbar(false);
                }
            }
        });

        return this.tray;
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

    public getTray(): Tray | null {
        return this.tray;
    }

    public updateMainWindow(mainWindow: BrowserWindow | null) {
        this.mainWindow = mainWindow;
    }
}