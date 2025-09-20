import { Component, ViewChild, ElementRef, AfterViewChecked } from '@angular/core';

declare const window: any;

interface ChatMessage {
  text: string;
  isUser: boolean;
  timestamp: Date;
}

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
  standalone: false
})
export class AppComponent implements AfterViewChecked {
  @ViewChild('chatMessages') private chatMessagesContainer!: ElementRef;
  @ViewChild('messageInput') private messageInput!: ElementRef;
  
  title = 'AI Meeting Assistant';
  currentMessage: string = '';
  messages: ChatMessage[] = [];
  isTyping: boolean = false;
  private typingTimer: any;
  
  // New properties for meeting assistant
  currentView: 'chat' | 'screenshot' | 'settings' = 'chat';
  screenshots: string[] = [];
  opacity: number = 0.9;
  alwaysOnTop: boolean = true;
  isMinimized: boolean = false;
  hotkeys: any = {};
  screenSharingActive: boolean = false;

  constructor() {
    // Add a welcome message
    this.messages.push({
      text: 'Welcome to AI Meeting Assistant! I can help you during meetings and interviews. Switch to Screenshot mode to capture your screen.',
      isUser: false,
      timestamp: new Date()
    });
    
    // Load hotkeys and setup listeners
    this.loadHotkeys();
    this.setupElectronListeners();
    this.checkScreenSharingStatus();
  }

  ngAfterViewChecked() {
    this.scrollToBottom();
  }

  onInput() {
    this.isTyping = true;
    
    // Clear existing timer
    if (this.typingTimer) {
      clearTimeout(this.typingTimer);
    }
    
    // Set timer to hide typing indicator after 1 second of no typing
    this.typingTimer = setTimeout(() => {
      this.isTyping = false;
    }, 1000);
  }

  onKeyDown(event: KeyboardEvent) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
  }

  sendMessage() {
    if (this.currentMessage.trim()) {
      // Add user message
      this.messages.push({
        text: this.currentMessage.trim(),
        isUser: true,
        timestamp: new Date()
      });
      
      // Clear input and typing indicator
      this.currentMessage = '';
      this.isTyping = false;
      
      // Simulate bot response after a short delay
      setTimeout(() => {
        this.simulateBotResponse();
      }, 1000);
      
      // Focus back to input
      setTimeout(() => {
        this.messageInput.nativeElement.focus();
      }, 100);
    }
  }

  private simulateBotResponse() {
    const responses = [
      'That\'s an interesting question. Can you tell me more about your experience?',
      'I understand. What would you like to discuss further?',
      'Great! Let\'s explore this topic together.',
      'Thank you for sharing. What are your thoughts on this?',
      'I\'m here to help you prepare. What specific area would you like to focus on?'
    ];
    
    const randomResponse = responses[Math.floor(Math.random() * responses.length)];
    
    this.messages.push({
      text: randomResponse,
      isUser: false,
      timestamp: new Date()
    });
  }

  private scrollToBottom(): void {
    try {
      if (this.chatMessagesContainer) {
        this.chatMessagesContainer.nativeElement.scrollTop = 
          this.chatMessagesContainer.nativeElement.scrollHeight;
      }
    } catch (err) {
      console.error('Error scrolling to bottom:', err);
    }
  }

  // New methods for meeting assistant functionality
  switchView(view: 'chat' | 'screenshot' | 'settings') {
    this.currentView = view;
  }
  
  async loadHotkeys() {
    try {
      if (window.require) {
        const { ipcRenderer } = window.require('electron');
        this.hotkeys = await ipcRenderer.invoke('get-hotkeys');
      }
    } catch (error) {
      console.error('Failed to load hotkeys:', error);
    }
  }
  
  setupElectronListeners() {
    try {
      if (window.require) {
        const { ipcRenderer } = window.require('electron');
        
        // Listen for screenshot trigger from hotkey
        ipcRenderer.on('trigger-screenshot', () => {
          this.takeScreenshot();
        });
      }
    } catch (error) {
      console.error('Failed to setup listeners:', error);
    }
  }
  
  async checkScreenSharingStatus() {
    try {
      if (window.require) {
        const { ipcRenderer } = window.require('electron');
        this.screenSharingActive = await ipcRenderer.invoke('get-screen-sharing-status');
      }
    } catch (error) {
      console.error('Failed to check screen sharing status:', error);
    }
  }

  async takeScreenshot() {
    try {
      if (window.require) {
        const { ipcRenderer } = window.require('electron');
        const screenshot = await ipcRenderer.invoke('take-screenshot');
        if (screenshot) {
          this.screenshots.unshift(screenshot);
          // Keep only last 5 screenshots to save memory
          if (this.screenshots.length > 5) {
            this.screenshots = this.screenshots.slice(0, 5);
          }
        }
      }
    } catch (error) {
      console.error('Failed to take screenshot:', error);
    }
  }

  deleteScreenshot(index: number) {
    this.screenshots.splice(index, 1);
  }

  downloadScreenshot(screenshot: string, index: number) {
    const link = document.createElement('a');
    link.download = `screenshot-${Date.now()}.png`;
    link.href = screenshot;
    link.click();
  }

  async minimizeWindow() {
    try {
      if (window.require) {
        const { ipcRenderer } = window.require('electron');
        await ipcRenderer.invoke('minimize-window');
      }
    } catch (error) {
      console.error('Failed to minimize window:', error);
    }
  }

  async closeWindow() {
    try {
      if (window.require) {
        const { ipcRenderer } = window.require('electron');
        await ipcRenderer.invoke('close-window');
      }
    } catch (error) {
      console.error('Failed to close window:', error);
    }
  }

  async updateOpacity(event: any) {
    this.opacity = parseFloat(event.target.value);
    try {
      if (window.require) {
        const { ipcRenderer } = window.require('electron');
        await ipcRenderer.invoke('set-opacity', this.opacity);
      }
    } catch (error) {
      console.error('Failed to update opacity:', error);
    }
  }

  async toggleAlwaysOnTop() {
    this.alwaysOnTop = !this.alwaysOnTop;
    try {
      if (window.require) {
        const { ipcRenderer } = window.require('electron');
        await ipcRenderer.invoke('toggle-always-on-top', this.alwaysOnTop);
      }
    } catch (error) {
      console.error('Failed to toggle always on top:', error);
    }
  }
  
  // Additional window controls
  async hideWindow() {
    try {
      if (window.require) {
        const { ipcRenderer } = window.require('electron');
        await ipcRenderer.invoke('hide-window');
      }
    } catch (error) {
      console.error('Failed to hide window:', error);
    }
  }
  
  async resetPosition() {
    try {
      if (window.require) {
        const { ipcRenderer } = window.require('electron');
        await ipcRenderer.invoke('reset-position');
      }
    } catch (error) {
      console.error('Failed to reset position:', error);
    }
  }
  
  // Get hotkey display text
  getHotkeyText(action: string): string {
    return this.hotkeys[action] || 'Not set';
  }
}