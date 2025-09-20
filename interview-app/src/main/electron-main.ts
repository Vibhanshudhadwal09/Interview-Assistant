import { app, BrowserWindow, ipcMain, desktopCapturer, screen, globalShortcut, powerMonitor } from 'electron';
import * as path from 'path';
const localShortcut = require('electron-localshortcut');

// Global variables for window management
let mainWindow: BrowserWindow | null = null;
let isHidden = false;
let originalOpacity = 0.9;
let screenSharingActive = false;

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
        icon: path.join(__dirname, '../assets/icon.png'), // Add app icon if available
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

    // Register local shortcuts for the window
    registerLocalShortcuts(mainWindow);
    
    // Setup screen sharing detection
    setupScreenSharingDetection();

    return mainWindow;
}

// Register local hotkeys
function registerLocalShortcuts(window: BrowserWindow) {
    // Toggle window visibility (Ctrl+Shift+H)
    localShortcut.register(window, 'Ctrl+Shift+H', () => {
        toggleWindowVisibility();
    });
    
    // Toggle transparency (Ctrl+Shift+T)
    localShortcut.register(window, 'Ctrl+Shift+T', () => {
        toggleTransparency();
    });
    
    // Quick screenshot (Ctrl+Shift+S)
    localShortcut.register(window, 'Ctrl+Shift+S', () => {
        if (mainWindow) {
            mainWindow.webContents.send('trigger-screenshot');
        }
    });
    
    // Reset position (Ctrl+Shift+R)
    localShortcut.register(window, 'Ctrl+Shift+R', () => {
        resetWindowPosition();
    });
}

// Register global shortcuts
function registerGlobalShortcuts() {
    // Global toggle (Ctrl+Alt+M for Meeting Assistant)
    globalShortcut.register('Ctrl+Alt+M', () => {
        toggleWindowVisibility();
    });
    
    // Global emergency hide (Ctrl+Alt+H)
    globalShortcut.register('Ctrl+Alt+H', () => {
        hideWindow();
    });
}

// Window visibility functions
function toggleWindowVisibility() {
    if (!mainWindow) return;
    
    if (mainWindow.isVisible()) {
        hideWindow();
    } else {
        showWindow();
    }
}

function showWindow() {
    if (!mainWindow) return;

    if (screenSharingActive) {
        console.log('Cannot show window - screen sharing is active');
        return;
    }

    // Ensure it's allowed to show in taskbar
    mainWindow.setSkipTaskbar(false);

    // Bring back from hidden state
    mainWindow.show();
    mainWindow.focus();
    mainWindow.setOpacity(originalOpacity);

    isHidden = false;
    console.log('Window shown');
}

function hideWindow() {
    if (!mainWindow) return;

    mainWindow.hide();
    mainWindow.setSkipTaskbar(true); // fully remove from taskbar
    isHidden = true;
    console.log('Window hidden');
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

// Screen sharing detection
function setupScreenSharingDetection() {
    // Check every 2 seconds for screen sharing
    setInterval(async () => {
        await checkScreenSharing();
    }, 2000);
}

async function checkScreenSharing() {
    try {
        const sources = await desktopCapturer.getSources({
            types: ['screen'],
            thumbnailSize: { width: 150, height: 150 }
        });
        
        // Simple heuristic: if we can't get screen sources or there are unusual patterns,
        // assume screen sharing might be active
        const wasScreenSharing = screenSharingActive;
        
        // Check if any apps that commonly indicate screen sharing are running
        // This is a basic check - in a real app you'd want more sophisticated detection
        screenSharingActive = await detectScreenSharingApps();
        
        if (screenSharingActive && !wasScreenSharing) {
            // Screen sharing started - hide window
            if (mainWindow && mainWindow.isVisible()) {
                hideWindow();
                console.log('Screen sharing detected - hiding window');
            }
        } else if (!screenSharingActive && wasScreenSharing) {
            // Screen sharing stopped - restore window if it was visible before
            console.log('Screen sharing stopped');
            // Don't auto-show, user can manually show with hotkey
        }
        
    } catch (error) {
        console.error('Error checking screen sharing:', error);
    }
}

// Detect screen sharing applications (basic implementation)
async function detectScreenSharingApps(): Promise<boolean> {
    try {
        // This is a simplified detection - in a real app you'd want to:
        // 1. Check running processes for screen sharing apps
        // 2. Monitor system APIs for screen capture
        // 3. Check for screen recording indicators
        
        // For now, we'll check if there are any capturing processes
        const { exec } = require('child_process');
        
        return new Promise((resolve) => {
            // Check for common screen sharing processes on Windows
            exec('tasklist /FI "IMAGENAME eq Teams.exe" /FI "STATUS eq RUNNING" | find /I "Teams.exe"', (error: any, stdout: any) => {
                if (stdout && stdout.includes('Teams.exe')) {
                    // Additional check would be needed to see if Teams is actually sharing
                    resolve(false); // For now, just return false
                } else {
                    resolve(false);
                }
            });
        });
    } catch (error) {
        return false;
    }
}

// IPC handlers for screenshot and window controls
ipcMain.handle('take-screenshot', async () => {
    try {
        const sources = await desktopCapturer.getSources({
            types: ['screen'],
            thumbnailSize: { width: 1920, height: 1080 }
        });
        
        if (sources.length > 0) {
            return sources[0].thumbnail.toDataURL();
        }
        return null;
    } catch (error) {
        console.error('Screenshot error:', error);
        return null;
    }
});

ipcMain.handle('minimize-window', () => {
    const focusedWindow = BrowserWindow.getFocusedWindow();
    if (focusedWindow) {
        focusedWindow.minimize();
    }
});

ipcMain.handle('close-window', () => {
    const focusedWindow = BrowserWindow.getFocusedWindow();
    if (focusedWindow) {
        focusedWindow.close();
    }
});

ipcMain.handle('set-opacity', (event, opacity) => {
    const focusedWindow = BrowserWindow.getFocusedWindow();
    if (focusedWindow) {
        focusedWindow.setOpacity(parseFloat(opacity));
    }
});

ipcMain.handle('toggle-always-on-top', (event, alwaysOnTop) => {
    const focusedWindow = BrowserWindow.getFocusedWindow();
    if (focusedWindow) {
        focusedWindow.setAlwaysOnTop(alwaysOnTop);
    }
});

// New IPC handlers
ipcMain.handle('hide-window', () => {
    hideWindow();
});

ipcMain.handle('show-window', () => {
    showWindow();
});

ipcMain.handle('toggle-window', () => {
    toggleWindowVisibility();
});

ipcMain.handle('reset-position', () => {
    resetWindowPosition();
});

ipcMain.handle('get-hotkeys', () => {
    return {
        toggleVisibility: 'Ctrl+Shift+H',
        toggleTransparency: 'Ctrl+Shift+T',
        quickScreenshot: 'Ctrl+Shift+S',
        resetPosition: 'Ctrl+Shift+R',
        globalToggle: 'Ctrl+Alt+M',
        globalHide: 'Ctrl+Alt+H'
    };
});

ipcMain.handle('get-screen-sharing-status', () => {
    return screenSharingActive;
});

app.on('ready', () => {
    createWindow();
    registerGlobalShortcuts();
});

app.on('window-all-closed', () => {
    // Unregister all shortcuts
    globalShortcut.unregisterAll();
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});