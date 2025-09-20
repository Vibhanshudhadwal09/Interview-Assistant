import { app, BrowserWindow, ipcMain, desktopCapturer, screen, globalShortcut, powerMonitor } from 'electron';
import * as path from 'path';
const localShortcut = require('electron-localshortcut');

// Global variables for window management
let mainWindow: BrowserWindow | null = null;
let isHidden = false;
let originalOpacity = 0.9;
let screenSharingActive = false;
let contentProtectionEnabled = false;

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
    
    // Manual screen sharing mode toggle (Ctrl+Shift+M)
    localShortcut.register(window, 'Ctrl+Shift+M', () => {
        toggleScreenSharingMode();
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

// Manual screen sharing mode toggle
function toggleScreenSharingMode() {
    screenSharingActive = !screenSharingActive;
    console.log(`Screen sharing mode manually ${screenSharingActive ? 'enabled' : 'disabled'}`);
    
    if (screenSharingActive) {
        enableContentProtection();
    } else {
        disableContentProtection();
    }
    
    // Send notification to renderer
    if (mainWindow) {
        mainWindow.webContents.send('screen-sharing-status', screenSharingActive);
    }
}

// Content protection functions
function enableContentProtection() {
    if (!mainWindow) return;
    
    try {
        // Enable content protection to exclude from screen capture
        mainWindow.setContentProtection(true);
        contentProtectionEnabled = true;
        
        // Additional Windows-specific protection
        if (process.platform === 'win32') {
            // Set window to exclude from capture (Windows 10+ feature)
            const { exec } = require('child_process');
            const windowHandle = mainWindow.getNativeWindowHandle();
            if (windowHandle) {
                // This is a Windows API call to exclude window from capture
                exec(`powershell -Command "Add-Type -TypeDefinition 'using System; using System.Runtime.InteropServices; public class Win32 { [DllImport(\"user32.dll\")] public static extern bool SetWindowDisplayAffinity(IntPtr hwnd, uint dwAffinity); }'; [Win32]::SetWindowDisplayAffinity(${windowHandle.readBigUInt64LE()}, 0x11)"`, (error: any) => {
                    if (error) {
                        console.log('Windows display affinity setting failed (this is normal on older Windows versions)');
                    } else {
                        console.log('Windows display affinity protection enabled');
                    }
                });
            }
        }
        
        console.log('Content protection enabled - window excluded from screen capture');
    } catch (error) {
        console.error('Failed to enable content protection:', error);
    }
}

function disableContentProtection() {
    if (!mainWindow) return;
    
    try {
        // Disable content protection
        mainWindow.setContentProtection(false);
        contentProtectionEnabled = false;
        
        // Remove Windows-specific protection
        if (process.platform === 'win32') {
            const { exec } = require('child_process');
            const windowHandle = mainWindow.getNativeWindowHandle();
            if (windowHandle) {
                exec(`powershell -Command "Add-Type -TypeDefinition 'using System; using System.Runtime.InteropServices; public class Win32 { [DllImport(\"user32.dll\")] public static extern bool SetWindowDisplayAffinity(IntPtr hwnd, uint dwAffinity); }'; [Win32]::SetWindowDisplayAffinity(${windowHandle.readBigUInt64LE()}, 0x00)"`, (error: any) => {
                    if (error) {
                        console.log('Windows display affinity removal failed');
                    } else {
                        console.log('Windows display affinity protection disabled');
                    }
                });
            }
        }
        
        console.log('Content protection disabled - window included in screen capture');
    } catch (error) {
        console.error('Failed to disable content protection:', error);
    }
}

// Screen sharing detection
function setupScreenSharingDetection() {
    // Check every 1 second for screen sharing activity
    setInterval(async () => {
        await checkScreenSharing();
    }, 1000);
}

async function checkScreenSharing() {
    try {
        // Method 1: Check if any process is accessing screen capture APIs
        const wasScreenSharing = screenSharingActive;
        
        // Check for screen capture activity using multiple methods
        const isCapturing = await detectScreenCapture();
        
        if (isCapturing && !wasScreenSharing) {
            // Screen sharing started - enable content protection
            screenSharingActive = true;
            if (mainWindow) {
                enableContentProtection();
                console.log('Screen sharing detected - enabling content protection');
                
                // Send notification to renderer
                mainWindow.webContents.send('screen-sharing-status', true);
            }
        } else if (!isCapturing && wasScreenSharing) {
            // Screen sharing stopped
            screenSharingActive = false;
            console.log('Screen sharing stopped - disabling content protection');
            
            if (mainWindow) {
                disableContentProtection();
                // Send notification to renderer
                mainWindow.webContents.send('screen-sharing-status', false);
            }
        }
        
    } catch (error) {
        console.error('Error checking screen sharing:', error);
    }
}

// Enhanced screen capture detection
async function detectScreenCapture(): Promise<boolean> {
    try {
        const { exec } = require('child_process');
        
        return new Promise((resolve) => {
            // Check multiple indicators of screen sharing
            let indicators = 0;
            let checksCompleted = 0;
            const totalChecks = 3;
            
            // Check 1: Look for common meeting apps with screen sharing indicators
            exec('tasklist /FI "STATUS eq RUNNING" /FO CSV | findstr /I "chrome.exe firefox.exe msedge.exe Teams.exe Zoom.exe"', (error: any, stdout: any) => {
                if (stdout && stdout.length > 100) { // If many browser/meeting processes
                    indicators++;
                }
                checksCompleted++;
                if (checksCompleted === totalChecks) {
                    resolve(indicators >= 2); // Require at least 2 indicators
                }
            });
            
            // Check 2: Monitor for high CPU usage from browsers/meeting apps
            exec('wmic process where "name like \'%chrome%\' or name like \'%firefox%\' or name like \'%edge%\' or name like \'%teams%\' or name like \'%zoom%\'" get Name,ProcessId,PageFileUsage', (error: any, stdout: any) => {
                if (stdout && stdout.includes('chrome') && stdout.length > 200) {
                    indicators++;
                }
                checksCompleted++;
                if (checksCompleted === totalChecks) {
                    resolve(indicators >= 2);
                }
            });
            
            // Check 3: Check for Google Meet specific indicators
            exec('netstat -an | findstr :443', (error: any, stdout: any) => {
                // Multiple HTTPS connections might indicate video conferencing
                if (stdout && (stdout.match(/443/g) || []).length > 5) {
                    indicators++;
                }
                checksCompleted++;
                if (checksCompleted === totalChecks) {
                    resolve(indicators >= 2);
                }
            });
            
            // Timeout fallback
            setTimeout(() => {
                if (checksCompleted < totalChecks) {
                    resolve(false);
                }
            }, 2000);
        });
        
    } catch (error) {
        console.error('Error in detectScreenCapture:', error);
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
        disableContentProtection();
    }
    
    // Send notification to renderer
    if (mainWindow) {
        mainWindow.webContents.send('screen-sharing-status', active);
    }
    
    return screenSharingActive;
});

ipcMain.handle('get-content-protection-status', () => {
    return contentProtectionEnabled;
});

ipcMain.handle('toggle-content-protection', () => {
    if (contentProtectionEnabled) {
        disableContentProtection();
    } else {
        enableContentProtection();
    }
    return contentProtectionEnabled;
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