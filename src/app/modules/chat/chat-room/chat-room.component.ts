import { Component, OnInit, OnDestroy, AfterViewChecked, ElementRef, ViewChild } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { ChatService, ChatMessage } from '../../../core/services/chat.service';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-chat-room',
  standalone: true,
  imports: [CommonModule, DatePipe, FormsModule, RouterLink],
  templateUrl: './chat-room.component.html',
  styleUrls: ['./chat-room.component.css'],
})
export class ChatRoomComponent implements OnInit, OnDestroy, AfterViewChecked {
  reservationId: string = '';
  messages: ChatMessage[] = [];
  newMessage = '';
  currentUserId: string = '';
  loading = true;
  connected = false;
  private msgSub: Subscription | null = null;

  @ViewChild('messageContainer') private messageContainer!: ElementRef;

  constructor(
    private route: ActivatedRoute,
    private chatService: ChatService,
    private authService: AuthService,
  ) {}

  ngOnInit(): void {
    this.currentUserId = this.authService.getUserId() || '';
    this.reservationId = this.route.snapshot.params['reservationId'] || '';

    if (!this.reservationId) { this.loading = false; return; }

    // Load history first
    this.chatService.getHistory(this.reservationId).subscribe({
      next: (history) => {
        this.messages = history;
        this.loading = false;
      },
      error: () => (this.loading = false),
    });

    // Connect WebSocket
    this.chatService.connect(this.reservationId, () => {
      this.connected = true;
    });

    // Subscribe to incoming messages
    this.msgSub = this.chatService.onMessage().subscribe((msg) => {
      this.messages = [...this.messages, msg];
    });
  }

  ngOnDestroy(): void {
    this.msgSub?.unsubscribe();
    this.chatService.disconnect();
  }

  ngAfterViewChecked(): void {
    this.scrollToBottom();
  }

  sendMessage(): void {
    if (!this.newMessage.trim() || !this.connected) return;
    this.chatService.sendMessage(this.newMessage.trim());
    this.newMessage = '';
  }

  isMine(msg: ChatMessage): boolean {
    return msg.senderId === this.currentUserId;
  }

  private scrollToBottom(): void {
    try {
      this.messageContainer.nativeElement.scrollTop = this.messageContainer.nativeElement.scrollHeight;
    } catch {}
  }
}
