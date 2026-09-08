import {
  AfterViewChecked,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
  ChangeDetectorRef,
} from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpParams } from '@angular/common/http';

import { OrganizerSidebarComponent } from '../organizer-sidebar/organizer-sidebar.component';
import { AuthService } from '../../../core/services/auth.service';
import { UserService } from '../../../core/services/user.service';
import { environment } from '../../../../environments/environment';

interface ChatSessionSummary {
  sessionId: string;
  sessionType: 'RIDE' | 'ORGANIZED';
  active: boolean;
  departureTime?: string;
  expiresAt?: string;
  createdAt: string;
  otherParticipantId: string;
  lastMessagePreview?: string;
  lastMessageAt?: string;
}

interface ChatMessage {
  id: string;
  sessionId: string;
  senderId: string;
  content: string;
  type: 'TEXT' | 'IMAGE' | 'VOICE' | 'LOCATION' | 'SYSTEM';
  sentAt: string;
  mediaUrl?: string;
  durationSeconds?: number;
}

interface Conversation {
  id: string;
  title: string;
  passengerName: string;
  voyageTitle?: string;
  lastMessage: string;
  lastMessageTime?: string;
  isOnline: boolean;
  active: boolean;
  sessionType: 'RIDE' | 'ORGANIZED';
  departureTime?: string;
  route?: string;
  avatarColor?: string;
  avatarTextColor?: string;
  messages: ChatMessage[];
  messagesLoaded: boolean;
  tripInfo?: { from: string; to: string; departureTime: string; arrivalTime: string };
  otherParticipantId?: string;
  nameResolved?: boolean;
}

@Component({
  selector: 'app-organizer-messages',
  standalone: true,
  imports: [CommonModule, DatePipe, FormsModule, OrganizerSidebarComponent],
  templateUrl: './messages.component.html',
  styleUrls: ['./messages.component.css'],
})
export class OrganizerMessagesComponent implements OnInit, OnDestroy, AfterViewChecked {
  @ViewChild('messagesContainer') private messagesContainer?: ElementRef<HTMLElement>;

  private readonly chatBaseUrl = `${environment.apiUrl}/api/v1/chat`;

  conversations: Conversation[] = [];
  filteredSessions: Conversation[] = [];
  active: Conversation | null = null;

  searchQuery = '';
  newMessage = '';
  loading = false;
  sending = false;

  currentDate = '';
  agencyName = 'Bonjour Tunisia Tours';

  myId = '';
  myInitials = 'OR';
  myAvatarColor = '#fef3c7';
  myAvatarTextColor = '#d97706';

  private stompClient: any = null;
  private currentTopicSub: any = null;
  private shouldScrollDown = false;
  private scrollSub: MutationObserver | null = null;

  constructor(
    private http: HttpClient,
    private authService: AuthService,
    private userService: UserService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.setCurrentDate();
    this.myId = this.authService.getUserId() || '';
    const email = this.authService.getUserEmail() || '';
    if (email) {
      this.myInitials = email
        .split('@')[0]
        .split(/[._-]+/)
        .map((p) => p[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
    }
    this.loadSessions();
    this.connectWebSocket();
  }

  ngOnDestroy(): void {
    this.currentTopicSub?.unsubscribe?.();
    this.stompClient?.deactivate?.();
    this.scrollSub?.disconnect();
  }

  ngAfterViewChecked(): void {
    if (this.shouldScrollDown && this.messagesContainer) {
      setTimeout(() => this.scrollToBottom(), 0);
      this.shouldScrollDown = false;
    }
  }

  private scrollToBottom(): void {
    if (!this.messagesContainer) return;
    const el = this.messagesContainer.nativeElement;
    el.scrollTop = el.scrollHeight;
  }

  private setCurrentDate(): void {
    this.currentDate = new Date().toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  }

  private loadSessions(): void {
    this.loading = true;
    const params = new HttpParams().set('size', 50);
    this.http
      .get<{ content: ChatSessionSummary[] }>(`${this.chatBaseUrl}/organizer/sessions`, { params })
      .subscribe({
        next: (page) => {
          this.conversations = (page.content ?? []).map((s) => this.toConversation(s));
          this.filteredSessions = [...this.conversations];
          this.loading = false;
          this.enrichConversationNames();
        },
        error: () => {
          this.conversations = [];
          this.filteredSessions = [];
          this.loading = false;
        },
      });
  }

  private toConversation(s: ChatSessionSummary): Conversation {
    return {
      id: s.sessionId,
      title: 'Passager #' + s.otherParticipantId.slice(-4),
      passengerName: 'Passager #' + s.otherParticipantId.slice(-4),
      lastMessage: s.lastMessagePreview ?? '',
      lastMessageTime: s.lastMessageAt ?? s.createdAt,
      isOnline: false,
      active: s.active,
      sessionType: s.sessionType,
      departureTime: s.departureTime,
      messages: [],
      messagesLoaded: false,
      otherParticipantId: s.otherParticipantId,
      nameResolved: false,
    };
  }

  private nameCache = new Map<string, string>();
  private enrichConversationNames(): void {
    const toResolve = this.conversations.filter((c) => !c.nameResolved && !!c.otherParticipantId);
    if (toResolve.length === 0) return;
    const uniqueIds = Array.from(
      new Set(toResolve.map((c) => c.otherParticipantId!).filter(Boolean)),
    );
    uniqueIds.forEach((uid) => {
      const cached = this.nameCache.get(uid);
      if (cached) {
        this.applyResolvedName(uid, cached);
        return;
      }
      this.userService.getPublicProfile(uid).subscribe({
        next: (profile) => {
          const name = profile.name?.trim() || '';
          if (name) {
            this.nameCache.set(uid, name);
            this.applyResolvedName(uid, name);
          }
        },
        error: () => {},
      });
    });
  }

  private applyResolvedName(uid: string, name: string): void {
    this.conversations.forEach((c) => {
      if (c.otherParticipantId === uid && !c.nameResolved) {
        c.passengerName = name;
        c.title = name;
        c.nameResolved = true;
      }
    });
    const q = this.searchQuery?.trim().toLowerCase() || '';
    this.filteredSessions = q
      ? this.conversations.filter(
          (c) =>
            c.passengerName.toLowerCase().includes(q) || c.lastMessage.toLowerCase().includes(q),
        )
      : [...this.conversations];
  }

  filterConversations(): void {
    const q = this.searchQuery.trim().toLowerCase();
    if (!q) {
      this.filteredSessions = [...this.conversations];
      return;
    }
    this.filteredSessions = this.conversations.filter(
      (c) => c.passengerName.toLowerCase().includes(q) || c.lastMessage.toLowerCase().includes(q),
    );
  }

  get activeTrips(): Conversation[] {
    const now = Date.now();
    return this.filteredSessions.filter((c) => {
      if (!c.departureTime) return false;
      const t = new Date(c.departureTime).getTime();
      return c.active && t <= now + 30 * 60_000 && t >= now - 6 * 3600_000;
    });
  }

  get upcomingTrips(): Conversation[] {
    const now = Date.now();
    return this.filteredSessions.filter((c) => {
      if (!c.departureTime) return false;
      return c.active && new Date(c.departureTime).getTime() > now + 30 * 60_000;
    });
  }

  get pastConversations(): Conversation[] {
    const active = new Set([...this.activeTrips, ...this.upcomingTrips].map((c) => c.id));
    return this.filteredSessions.filter((c) => !active.has(c.id));
  }

  get totalUnread(): number {
    return 0;
  }

  selectSession(conv: Conversation): void {
    this.active = conv;
    this.unsubscribeFromCurrentTopic();
    this.scrollSub?.disconnect();

    if (!conv.messagesLoaded) {
      this.http.get<ChatMessage[]>(`${this.chatBaseUrl}/${conv.id}/history`).subscribe({
        next: (history) => {
          conv.messages = [...history].reverse();
          conv.messagesLoaded = true;
          this.shouldScrollDown = true;
          this.cdr.detectChanges();
          this.setupScrollObserver();
        },
        error: () => {
          conv.messages = [];
          conv.messagesLoaded = true;
        },
      });
    } else {
      this.shouldScrollDown = true;
      this.setupScrollObserver();
    }

    this.subscribeToTopic(conv.id);
  }

  private setupScrollObserver(): void {
    setTimeout(() => {
      if (!this.messagesContainer) return;
      this.scrollSub = new MutationObserver(() => {
        requestAnimationFrame(() => this.scrollToBottom());
      });
      this.scrollSub.observe(this.messagesContainer.nativeElement, {
        childList: true,
        subtree: true,
      });
      this.scrollToBottom();
    }, 300);
  }
  send(): void {
    const text = this.newMessage.trim();
    if (!text || !this.active || this.sending) return;
    this.sending = true;

    if (this.stompClient?.connected) {
      try {
        this.stompClient.publish({
          destination: `/app/chat/${this.active.id}/send`,
          body: JSON.stringify({ content: text, type: 'TEXT' }),
        });
        this.newMessage = '';
      } catch {}
      this.sending = false;
      this.cdr.detectChanges();
      return;
    }

    const optimistic: ChatMessage = {
      id: 'local-' + Date.now(),
      sessionId: this.active.id,
      senderId: this.myId,
      content: text,
      type: 'TEXT',
      sentAt: new Date().toISOString(),
    };
    this.active.messages = [...this.active.messages, optimistic];
    this.active.lastMessage = text;
    this.active.lastMessageTime = optimistic.sentAt;
    this.shouldScrollDown = true;
    this.newMessage = '';
    this.sending = false;
    this.cdr.detectChanges();
  }

  private async connectWebSocket(): Promise<void> {
    let stompModule: any;
    let sockjsModule: any;
    try {
      stompModule = await import(/* webpackIgnore: true */ '@stomp/stompjs');
      sockjsModule = await import(/* webpackIgnore: true */ 'sockjs-client');
    } catch {
      return;
    }

    const token = this.authService.getToken();
    const Client = stompModule.Client;
    const SockJS = sockjsModule.default || sockjsModule;

    let wsUrl = environment.wsUrl || 'http://localhost:8080/ws';

    if (token) {
      const separator = wsUrl.includes('?') ? '&' : '?';
      wsUrl = `${wsUrl}${separator}token=${encodeURIComponent(token)}`;
    }

    this.stompClient = new Client({
      webSocketFactory: () => new SockJS(wsUrl),
      connectHeaders: token ? { Authorization: `Bearer ${token}` } : {},
      reconnectDelay: 5000,
    });

    this.stompClient.onConnect = () => {
      if (this.active) this.subscribeToTopic(this.active.id);
    };
    this.stompClient.activate();
  }

  private subscribeToTopic(sessionId: string): void {
    if (!this.stompClient?.connected) return;
    this.currentTopicSub?.unsubscribe?.();
    this.currentTopicSub = this.stompClient.subscribe(`/topic/chat/${sessionId}`, (frame: any) => {
      try {
        const msg: ChatMessage = JSON.parse(frame.body);
        if (this.active?.id === sessionId) {
          this.active.messages = [...this.active.messages, msg];
          this.cdr.detectChanges();
        }
        const conv = this.conversations.find((c) => c.id === sessionId);
        if (conv) {
          conv.lastMessage = msg.type === 'TEXT' ? msg.content : '📎';
          conv.lastMessageTime = msg.sentAt;
        }
      } catch {}
    });
  }

  private unsubscribeFromCurrentTopic(): void {
    this.currentTopicSub?.unsubscribe?.();
    this.currentTopicSub = null;
  }

  getInitials(name: string): string {
    if (!name) return '??';
    return name
      .split(/[\s._-]+/)
      .map((p) => p[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }

  startNewConversation(): void {}
}
