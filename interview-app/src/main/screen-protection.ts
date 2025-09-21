import { BrowserWindow } from 'electron';

export class ScreenProtectionManager {
    private mainWindow: BrowserWindow | null = null;
    private screenSharingActive = false;
    private contentProtectionEnabled = false;
    private screenSharingInterval: NodeJS.Timeout | null = null;

    constructor(mainWindow: BrowserWindow) {
        this.mainWindow = mainWindow;
    }

    public enableContentProtection() {
        if (!this.mainWindow || this.contentProtectionEnabled) return; // Avoid redundant calls

        try {
            this.mainWindow.setContentProtection(true);
            this.contentProtectionEnabled = true;

            if (process.platform === 'win32') {
                this.setWindowDisplayAffinity(this.mainWindow, 0x11);
            }

            console.log('🛡️ Content protection ENABLED — window excluded from modern screen capture');
        } catch (error) {
            console.error('Failed to enable content protection:', error);
        }
    }

    public disableContentProtection() {
        if (!this.mainWindow || !this.contentProtectionEnabled) return;

        try {
            this.mainWindow.setContentProtection(false);
            this.contentProtectionEnabled = false;

            if (process.platform === 'win32') {
                this.setWindowDisplayAffinity(this.mainWindow, 0x00);
            }

            console.log('🔓 Content protection DISABLED');
        } catch (error) {
            console.error('Failed to disable content protection:', error);
        }
    }

    public toggleContentProtection(): boolean {
        if (this.contentProtectionEnabled) {
            this.disableContentProtection();
        } else {
            this.enableContentProtection();
        }
        return this.contentProtectionEnabled;
    }

    public setupScreenSharingDetection() {
        // Clear any existing interval
        if (this.screenSharingInterval) {
            clearInterval(this.screenSharingInterval);
        }
        
        this.screenSharingInterval = setInterval(async () => {
            await this.checkScreenSharing();
        }, 2000); // Check every 2 seconds
    }

    private async checkScreenSharing() {
        try {
            // Check if window is destroyed or null
            if (!this.mainWindow || this.mainWindow.isDestroyed()) {
                console.log('Main window destroyed, stopping screen sharing detection');
                this.cleanup();
                return;
            }

            const wasScreenSharing = this.screenSharingActive;
            const isCapturing = await this.detectScreenCapture();

            if (isCapturing && !wasScreenSharing) {
                this.screenSharingActive = true;
                console.log('🔴 Screen sharing detected — content protection already active');

                // Just send status to renderer (e.g., show shield icon)
                if (this.mainWindow && !this.mainWindow.isDestroyed()) {
                    this.mainWindow.webContents.send('screen-sharing-status', true);
                }
            } else if (!isCapturing && wasScreenSharing) {
                this.screenSharingActive = false;
                console.log('🟢 Screen sharing stopped');
                if (this.mainWindow && !this.mainWindow.isDestroyed()) {
                    this.mainWindow.webContents.send('screen-sharing-status', false);
                }
            }
        } catch (error) {
            console.error('Error checking screen sharing:', error);
            // If we get repeated errors, clean up to prevent spam
            if (error instanceof Error && error.message && error.message.includes('destroyed')) {
                this.cleanup();
            }
        }
    }

    private async detectScreenCapture(): Promise<boolean> {
        if (process.platform === 'win32') {
            const isGraphicsCapture = await this.checkWindowsGraphicsCapture();
            if (isGraphicsCapture) return true;
        }
        return await this.checkLegacyScreenSharing();
    }

    private async checkWindowsGraphicsCapture(): Promise<boolean> {
        return new Promise((resolve) => {
            const { exec } = require('child_process');
            exec('powershell -Command "Get-Process | Where-Object { $_.Modules.FileName -like \'*GraphicsCapture*\' }"', (error: any, stdout: any) => {
                resolve(stdout?.length > 0);
            });
        });
    }

    private async checkLegacyScreenSharing(): Promise<boolean> {
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

    private setWindowDisplayAffinity(window: BrowserWindow, affinity: number) {
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

    public toggleScreenSharingMode(): boolean {
        this.screenSharingActive = !this.screenSharingActive;
        console.log(`🖥️ Screen sharing mode manually ${this.screenSharingActive ? 'enabled' : 'disabled'}`);

        if (this.screenSharingActive) {
            this.enableContentProtection();
        }

        this.mainWindow?.webContents.send('screen-sharing-status', this.screenSharingActive);
        return this.screenSharingActive;
    }

    public setScreenSharingMode(active: boolean): boolean {
        this.screenSharingActive = active;
        console.log(`Screen sharing mode set to: ${active}`);
        if (active) {
            this.enableContentProtection();
        }
        this.mainWindow?.webContents.send('screen-sharing-status', active);
        return this.screenSharingActive;
    }

    public getScreenSharingStatus(): boolean {
        return this.screenSharingActive;
    }

    public getContentProtectionStatus(): boolean {
        return this.contentProtectionEnabled;
    }

    public updateMainWindow(mainWindow: BrowserWindow | null) {
        this.mainWindow = mainWindow;
    }

    public cleanup() {
        // Clear the screen sharing detection interval
        if (this.screenSharingInterval) {
            clearInterval(this.screenSharingInterval);
            this.screenSharingInterval = null;
        }
        console.log('ScreenProtectionManager cleanup completed');
    }
}