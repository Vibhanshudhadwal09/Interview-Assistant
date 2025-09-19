import { Component, ViewChild, ElementRef, AfterViewChecked } from '@angular/core';

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
  
  title = 'angular-electron-app';
  currentMessage: string = '';
  messages: ChatMessage[] = [];
  isTyping: boolean = false;
  private typingTimer: any;

  constructor() {
    // Add a welcome message
    this.messages.push({
      text: 'Welcome to Interview Assistant! How can I help you today?',
      isUser: false,
      timestamp: new Date()
    });
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
}