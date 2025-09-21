import { app, BrowserWindow, ipcMain, desktopCapturer, screen, globalShortcut, Tray, Menu, nativeImage } from 'electron';
import * as path from 'path';
const localShortcut = require('electron-localshortcut');

// Global variables for window management
let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let originalOpacity = 0.9;
let screenSharingActive = false;
let contentProtectionEnabled = false;
let isQuitting = false;

function createWindow() {
    mainWindow = new BrowserWindow({
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
        //icon: getAppIcon(),
        icon:  path.join(__dirname, '../angular-electron-app/browser/assets/icon.png'),
        show: false,
        opacity: originalOpacity
    });

    // Load the built Angular app
    const indexPath = path.join(__dirname, '../angular-electron-app/browser/index.html');
    console.log('Loading app from:', indexPath);
    mainWindow.loadFile(indexPath);

    // Handle loading errors
    mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
        console.error('Failed to load app:', errorCode, errorDescription);
    });

    // Show window when ready
    mainWindow.once('ready-to-show', () => {
        console.log('App ready to show');
        mainWindow?.show();
        if (mainWindow) mainWindow.focus();
    });

    // DevTools - Enable with F12 or Ctrl+Shift+I in any environment
    mainWindow.webContents.on('before-input-event', (event, input) => {
        if (input.key === 'F12' || (input.control && input.shift && input.key.toLowerCase() === 'i')) {
            mainWindow?.webContents.toggleDevTools();
        }
    });

    // DevTools will only open when manually triggered via shortcuts or tray menu

    // 👇 Apply content protection IMMEDIATELY
    enableContentProtection();

    // 👇 Re-apply display affinity every time window is shown (critical for Windows)
    mainWindow.on('show', () => {
        if (process.platform === 'win32') {
            setWindowDisplayAffinity(mainWindow!, 0x11); // WDA_EXCLUDEFROMCAPTURE
        }
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
    });

    // Handle minimize to tray instead of taskbar
    mainWindow.on('minimize', (event: any) => {
        event.preventDefault();
        mainWindow?.hide();
        // Set skipTaskbar to true when minimized to tray
        if (mainWindow) {
            mainWindow.setSkipTaskbar(true);
        }
        if (tray) {
            tray.displayBalloon({
                iconType: 'info',
                title: 'Interview Assistant',
                content: 'Application was minimized to tray'
            });
        }
    });

    // Handle close button - should terminate the application
    mainWindow.on('close', (event: any) => {
        // Don't prevent close, let it terminate the application
        isQuitting = true;
        app.quit();
    });

    // Register shortcuts
    registerLocalShortcuts(mainWindow);
    setupScreenSharingDetection();
    createTray();

    return mainWindow;
}

// Create system tray
function createTray() {
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
    
    tray = new Tray(trayIcon);
    
    // Set tooltip
    tray.setToolTip('Interview Assistant');
    
    // Create context menu
    const contextMenu = Menu.buildFromTemplate([
        {
            label: 'Show App',
            click: () => {
                if (mainWindow) {
                    mainWindow.show();
                    mainWindow.focus();
                    // Show in taskbar when restored from tray
                    mainWindow.setSkipTaskbar(false);
                }
            }
        },
        {
            label: 'Hide App',
            click: () => {
                if (mainWindow) {
                    mainWindow.hide();
                    // Hide from taskbar when manually hidden
                    mainWindow.setSkipTaskbar(true);
                }
            }
        },
        { type: 'separator' },
        {
            label: 'Toggle DevTools',
            click: () => {
                if (mainWindow) {
                    mainWindow.webContents.toggleDevTools();
                }
            }
        },
        {
            label: 'Reset Position',
            click: resetWindowPosition
        },
        { type: 'separator' },
        {
            label: 'Quit',
            click: () => {
                isQuitting = true;
                app.quit();
            }
        }
    ]);
    
    tray.setContextMenu(contextMenu);
    
    // Double click to show/hide
    tray.on('double-click', () => {
        if (mainWindow) {
            if (mainWindow.isVisible()) {
                mainWindow.hide();
                mainWindow.setSkipTaskbar(true);
            } else {
                mainWindow.show();
                mainWindow.focus();
                mainWindow.setSkipTaskbar(false);
            }
        }
    });
}

// 👇 Helper: Set Windows Display Affinity (robust 32/64-bit handle support)
function setWindowDisplayAffinity(window: BrowserWindow, affinity: number) {
    if (process.platform !== 'win32') return;

    try {
        const handle = window.getNativeWindowHandle();
        if (!handle) return;

        // Handle both 32-bit and 64-bit window handles
        const hwnd = handle.readBigUInt64LE ? handle.readBigUInt64LE() : handle.readUInt32LE();

        const psScript = `
            Add-Type -TypeDefinition @"
            using System;
            using System.Runtime.InteropServices;
            public class Win32 {
                [DllImport("user32.dll")]
                public static extern bool SetWindowDisplayAffinity(IntPtr hwnd, uint dwAffinity);
            }
            "@
            [Win32]::SetWindowDisplayAffinity((IntPtr)${hwnd}, ${affinity})
        `;

        require('child_process').exec(
            `powershell -Command "${psScript.replace(/"/g, '\\"')} "`,
            (error: any) => {
                if (error) {
                    console.warn('⚠️ SetWindowDisplayAffinity failed (normal on older Windows)');
                } else {
                    console.log(`✅ Display affinity set to ${affinity}`);
                }
            }
        );
    } catch (err) {
        console.error('SetWindowDisplayAffinity error:', err);
    }
}

// Register local shortcuts
function registerLocalShortcuts(window: BrowserWindow) {
    localShortcut.register(window, 'Ctrl+Shift+H', toggleWindowVisibility);
    localShortcut.register(window, 'Ctrl+Shift+T', toggleTransparency);
    localShortcut.register(window, 'Ctrl+Shift+S', () => {
        if (mainWindow) mainWindow.webContents.send('trigger-screenshot');
    });
    localShortcut.register(window, 'Ctrl+Shift+R', resetWindowPosition);
    localShortcut.register(window, 'Ctrl+Shift+M', toggleScreenSharingMode);
    // Add debugging shortcuts
    localShortcut.register(window, 'F12', () => {
        if (mainWindow) mainWindow.webContents.toggleDevTools();
    });
    localShortcut.register(window, 'Ctrl+Shift+I', () => {
        if (mainWindow) mainWindow.webContents.toggleDevTools();
    });
    localShortcut.register(window, 'Ctrl+Shift+D', () => {
        if (mainWindow) mainWindow.webContents.toggleDevTools();
    });
}

// Register global shortcuts
function registerGlobalShortcuts() {
    globalShortcut.register('Ctrl+Alt+M', toggleWindowVisibility);
    globalShortcut.register('Ctrl+Alt+H', () => {
        if (mainWindow) {
            mainWindow.hide(); // Only manual hide via global shortcut
            mainWindow.setSkipTaskbar(true);
        }
    });
    globalShortcut.register('Ctrl+Alt+D', () => {
        if (mainWindow) {
            mainWindow.webContents.toggleDevTools();
            if (!mainWindow.isVisible()) {
                mainWindow.show();
                mainWindow.focus();
            }
        }
    });
}

// Window visibility functions
function toggleWindowVisibility() {
    if (!mainWindow) return;
    if (mainWindow.isVisible()) {
        mainWindow.hide();
        mainWindow.setSkipTaskbar(true);
    } else {
        mainWindow.show();
        mainWindow.focus();
        mainWindow.setSkipTaskbar(false);
    }
}

function toggleTransparency() {
    if (!mainWindow) return;
    const currentOpacity = mainWindow.getOpacity();
    const newOpacity = currentOpacity > 0.5 ? 0.3 : originalOpacity;
    mainWindow.setOpacity(newOpacity);
}

function resetWindowPosition() {
    if (!mainWindow) return;
    const { width, height } = screen.getPrimaryDisplay().workAreaSize;
    mainWindow.setBounds({
        x: width - 450,
        y: 50,
        width: 400,
        height: 600
    });
}

// Manual screen sharing mode toggle (for testing/UI)
function toggleScreenSharingMode() {
    screenSharingActive = !screenSharingActive;
    console.log(`🖥️ Screen sharing mode manually ${screenSharingActive ? 'enabled' : 'disabled'}`);

    if (screenSharingActive) {
        enableContentProtection();
    } else {
        // Optional: disable protection — but better to leave it on
        // disableContentProtection();
    }

    mainWindow?.webContents.send('screen-sharing-status', screenSharingActive);
}

// 👇 Content Protection — Enable once and keep enabled
function enableContentProtection() {
    if (!mainWindow || contentProtectionEnabled) return; // Avoid redundant calls

    try {
        mainWindow.setContentProtection(true);
        contentProtectionEnabled = true;

        if (process.platform === 'win32') {
            setWindowDisplayAffinity(mainWindow, 0x11);
        }

        console.log('🛡️ Content protection ENABLED — window excluded from modern screen capture');
    } catch (error) {
        console.error('Failed to enable content protection:', error);
    }
}

// 👇 Only disable if explicitly needed (e.g., user toggle)
function disableContentProtection() {
    if (!mainWindow || !contentProtectionEnabled) return;

    try {
        mainWindow.setContentProtection(false);
        contentProtectionEnabled = false;

        if (process.platform === 'win32') {
            setWindowDisplayAffinity(mainWindow, 0x00);
        }

        console.log('🔓 Content protection DISABLED');
    } catch (error) {
        console.error('Failed to disable content protection:', error);
    }
}

// 👇 SCREEN SHARING DETECTION — for UI feedback only, does NOT hide window
function setupScreenSharingDetection() {
    setInterval(async () => {
        await checkScreenSharing();
    }, 2000); // Check every 2 seconds
}

async function checkScreenSharing() {
    try {
        const wasScreenSharing = screenSharingActive;
        const isCapturing = await detectScreenCapture();

        if (isCapturing && !wasScreenSharing) {
            screenSharingActive = true;
            console.log('🔴 Screen sharing detected — content protection already active');

            // Just send status to renderer (e.g., show shield icon)
            mainWindow?.webContents.send('screen-sharing-status', true);
        } else if (!isCapturing && wasScreenSharing) {
            screenSharingActive = false;
            console.log('🟢 Screen sharing stopped');
            mainWindow?.webContents.send('screen-sharing-status', false);
        }
    } catch (error) {
        console.error('Error checking screen sharing:', error);
    }
}

// 👇 SCREEN CAPTURE DETECTION (for UI only)
async function detectScreenCapture(): Promise<boolean> {
    if (process.platform === 'win32') {
        const isGraphicsCapture = await checkWindowsGraphicsCapture();
        if (isGraphicsCapture) return true;
    }
    return await checkLegacyScreenSharing();
}

async function checkWindowsGraphicsCapture(): Promise<boolean> {
    return new Promise((resolve) => {
        const { exec } = require('child_process');
        exec('powershell -Command "Get-Process | Where-Object { $_.Modules.FileName -like \'*GraphicsCapture*\' }"', (error: any, stdout: any) => {
            resolve(stdout?.length > 0);
        });
    });
}

async function checkLegacyScreenSharing(): Promise<boolean> {
    return new Promise((resolve) => {
        let indicators = 0;
        let completed = 0;
        const total = 3;

        const checkDone = () => {
            completed++;
            if (completed === total) {
                resolve(indicators >= 2);
            }
        };

        const { exec } = require('child_process');

        exec('tasklist /FI "STATUS eq RUNNING" /FO CSV | findstr /I "chrome.exe firefox.exe msedge.exe Teams.exe Zoom.exe"', (error: any, stdout: any) => {
            if (stdout && stdout.length > 100) indicators++;
            checkDone();
        });

        exec('wmic process where "name like \'%chrome%\' or name like \'%firefox%\' or name like \'%edge%\' or name like \'%teams%\' or name like \'%zoom%\'" get Name,PageFileUsage', (error: any, stdout: any) => {
            if (stdout && stdout.includes('chrome') && stdout.length > 200) indicators++;
            checkDone();
        });

        exec('netstat -an | findstr :443', (error: any, stdout: any) => {
            if (stdout && (stdout.match(/443/g) || []).length > 5) indicators++;
            checkDone();
        });

        setTimeout(() => {
            if (completed < total) resolve(false);
        }, 3000);
    });
}

// IPC HANDLERS
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

ipcMain.handle('hide-window', () => {
    if (mainWindow) {
        mainWindow.hide();
        mainWindow.setSkipTaskbar(true);
    }
});

ipcMain.handle('show-window', () => {
    if (mainWindow) {
        mainWindow.show();
        mainWindow.focus();
        mainWindow.setSkipTaskbar(false);
    }
});

ipcMain.handle('toggle-window', toggleWindowVisibility);
ipcMain.handle('reset-position', resetWindowPosition);

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

ipcMain.handle('get-screen-sharing-status', () => screenSharingActive);
ipcMain.handle('toggle-screen-sharing-mode', () => {
    toggleScreenSharingMode();
    return screenSharingActive;
});

ipcMain.handle('set-screen-sharing-mode', (event, active) => {
    screenSharingActive = active;
    console.log(`Screen sharing mode set to: ${active}`);
    if (active) {
        enableContentProtection();
    } else {
        // disableContentProtection(); // Optional
    }
    mainWindow?.webContents.send('screen-sharing-status', active);
    return screenSharingActive;
});

ipcMain.handle('get-content-protection-status', () => contentProtectionEnabled);
ipcMain.handle('toggle-content-protection', () => {
    if (contentProtectionEnabled) {
        disableContentProtection();
    } else {
        enableContentProtection();
    }
    return contentProtectionEnabled;
});

// Add debugging IPC handlers
ipcMain.handle('toggle-dev-tools', () => {
    if (mainWindow) {
        mainWindow.webContents.toggleDevTools();
        return mainWindow.webContents.isDevToolsOpened();
    }
    return false;
});

ipcMain.handle('show-from-tray', () => {
    if (mainWindow) {
        mainWindow.show();
        mainWindow.focus();
        mainWindow.setSkipTaskbar(false);
        return true;
    }
    return false;
});

ipcMain.handle('hide-to-tray', () => {
    if (mainWindow) {
        mainWindow.hide();
        mainWindow.setSkipTaskbar(true);
        return true;
    }
    return false;
});

// APP LIFECYCLE
app.on('ready', () => {
    createWindow();
    registerGlobalShortcuts();
});
app.on('window-all-closed', () => {
    globalShortcut.unregisterAll();
    // Don't quit on window close, keep running in tray
    // Uncomment the lines below if you want the app to quit when all windows are closed
    // if (process.platform !== 'darwin') {
    //     app.quit();
    // }
});

app.on('before-quit', () => {
    isQuitting = true;
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});