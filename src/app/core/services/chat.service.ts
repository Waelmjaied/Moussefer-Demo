// Cible : src/app/core/services/chat.service.ts
// FIX double-click loading : les callbacks STOMP s'exécutent HORS NgZone.
// Sans NgZone.run(), `messageSubject.next()` ne déclenche pas la change
// detection -> le message arrive en mémoire mais le template ne re-render
// qu'au prochain évènement DOM (= ton "double click").

import { Injectable, NgZone, OnDestroy } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, Subject } from 'rxjs';
import { Client, Message } from '@stomp/stompjs';
import SockJS from 'sockjs-client';

import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';

export type MessageType = 'TEXT' | 'IMAGE' | 'VOICE' | 'SYSTEM';

export interface ChatMessage {
  id?: string;
  reservationId: string;
  senderId: string;
  content: string;
  type: MessageType;
  mediaUrl?: string;
  duration?: number;
  sentAt?: string;
}

@Injectable({ providedIn: 'root' })
export class ChatService implements OnDestroy {
  private readonly apiUrl = `${environment.apiUrl}/api/v1/chat`;
  private stompClient: Client | null = null;
  private currentSessionId: string | null = null;
  private readonly messageSubject = new Subject<ChatMessage>();

  readonly messages$ = this.messageSubject.asObservable();

  constructor(
    private http: HttpClient,
    private authService: AuthService,
    private ngZone: NgZone, // ▶︎ FIX : injection NgZone
  ) {}

  connect(sessionId: string, onConnect?: () => void, onError?: (error: string) => void): void {
    if (this.stompClient?.active && this.currentSessionId === sessionId) {
      onConnect?.();
      return;
    }

    if (this.stompClient?.active) {
      this.disconnect();
    }

    this.currentSessionId = sessionId;
    const token = this.authService.getToken?.() || '';
    const wsUrl = this.buildWebSocketUrl(token);

    this.stompClient = new Client({
      webSocketFactory: () => new SockJS(wsUrl),
      connectHeaders: {
        Authorization: token ? `Bearer ${token}` : '',
      },
      reconnectDelay: 5000,
      heartbeatIncoming: 4000,
      heartbeatOutgoing: 4000,
      // ▶︎ FIX : debug seulement en dev pour éviter les logs en prod.
      debug: environment.production ? () => {} : (str: string) => console.debug('[STOMP]', str),

      onConnect: () => {
        // ▶︎ FIX : tout ce qui touche aux subjects Angular doit tourner
        //   DANS NgZone pour que la CD se déclenche côté composants.
        this.ngZone.run(() => {
          this.stompClient?.subscribe(`/topic/chat/${sessionId}`, (message: Message) => {
            this.ngZone.run(() => {
              try {
                const msg: ChatMessage = JSON.parse(message.body);
                this.messageSubject.next(msg);
              } catch {
                // Message non parsable — on ignore silencieusement en prod.
              }
            });
          });
          onConnect?.();
        });
      },

      onStompError: (frame: any) => {
        this.ngZone.run(() => {
          const errorMsg = frame.headers?.message || 'STOMP connection error';
          onError?.(errorMsg);
        });
      },

      onWebSocketClose: () => {
        // Pas d'action côté UI : le reconnectDelay de stompjs s'en charge.
      },
    });

    this.stompClient.activate();
  }

  disconnect(): void {
    if (this.stompClient) {
      this.stompClient.deactivate();
      this.stompClient = null;
    }
    this.currentSessionId = null;
  }

  isConnected(): boolean {
    return !!this.stompClient?.active;
  }

  // ==================== MESSAGE SENDING ====================

  sendMessage(content: string): void {
    this.publishToChat({ content, type: 'TEXT' });
  }

  sendImage(imageUrl: string, caption?: string): void {
    this.publishToChat({
      content: caption || '',
      type: 'IMAGE',
      mediaUrl: imageUrl,
    });
  }

  sendVoice(voiceUrl: string, durationSeconds: number): void {
    this.publishToChat({
      content: '🎤 Message vocal',
      type: 'VOICE',
      mediaUrl: voiceUrl,
      duration: durationSeconds,
    });
  }

  // ==================== FILE UPLOAD ====================

  uploadImage(file: File): Observable<{ url: string }> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<{ url: string }>(`${this.apiUrl}/upload/image`, formData);
  }

  uploadVoice(file: File): Observable<{ url: string; duration: number }> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<{ url: string; duration: number }>(
      `${this.apiUrl}/upload/voice`,
      formData,
    );
  }

  onMessage(): Observable<ChatMessage> {
    return this.messageSubject.asObservable();
  }

  // ==================== HISTORY & SESSIONS ====================

  getHistory(sessionId: string, page = 0, size = 50): Observable<ChatMessage[]> {
    const params = new HttpParams().set('page', page).set('size', size);
    return this.http.get<ChatMessage[]>(`${this.apiUrl}/${sessionId}/history`, { params });
  }

  getMyPassengerSessions(page = 0, size = 50): Observable<ChatSessionPage> {
    const params = new HttpParams().set('page', page).set('size', size);
    return this.http.get<ChatSessionPage>(`${this.apiUrl}/passenger/sessions`, { params });
  }

  getMyOrganizerSessions(page = 0, size = 50): Observable<ChatSessionPage> {
    const params = new HttpParams().set('page', page).set('size', size);
    return this.http.get<ChatSessionPage>(`${this.apiUrl}/organizer/sessions`, { params });
  }

  // ==================== LIFECYCLE ====================

  ngOnDestroy(): void {
    this.disconnect();
  }

  // ==================== PRIVATE METHODS ====================

  private buildWebSocketUrl(token: string): string {
    let wsUrl = environment.wsUrl || 'http://localhost:8080/ws';
    wsUrl = wsUrl.replace(/^ws(s)?:\/\//, (_, secure) => (secure ? 'https://' : 'http://'));

    if (token) {
      const separator = wsUrl.includes('?') ? '&' : '?';
      wsUrl = `${wsUrl}${separator}token=${encodeURIComponent(token)}`;
    }
    return wsUrl;
  }

  private publishToChat(message: Partial<ChatMessage>): void {
    if (!this.stompClient?.active || !this.currentSessionId) {
      return;
    }
    this.stompClient.publish({
      destination: `/app/chat/${this.currentSessionId}/send`,
      body: JSON.stringify(message),
    });
  }
  getUnreadCount(): Observable<number> {
    return this.http.get<number>(`${this.apiUrl}/unread-count`);
  }
}

// ==================== TYPES ====================

export interface ChatSessionSummary {
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

export interface ChatSessionPage {
  content: ChatSessionSummary[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
}
