import {
  Component,
  OnInit,
  OnDestroy,
  AfterViewChecked,
  ElementRef,
  ViewChild,
  ChangeDetectorRef,
} from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ChatService, ChatMessage } from '../../../core/services/chat.service';
import { ReservationService } from '../../../core/services/reservation.service';
import { AuthService } from '../../../core/services/auth.service';
import { UserService } from '../../../core/services/user.service';
import {
  Subject,
  Subscription,
  take,
  debounceTime,
  distinctUntilChanged,
  forkJoin,
  of,
} from 'rxjs';
import { catchError } from 'rxjs/operators';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';

const AVATAR_CLASSES = ['av-green', 'av-blue', 'av-amber', 'av-purple'];

export interface ChatSession {
  reservationId: string;
  label: string;
  routeLabel: string;
  initials: string;
  avatarClass: string;
  messages: ChatMessage[];
  unread: number;
  online: boolean;
  lastMsg: string;
  lastTime: string;
  sessionType: 'RIDE' | 'ORGANIZED';
  otherParticipantId?: string;
  nameResolved?: boolean;
}

@Component({
  selector: 'app-passenger-messages',
  standalone: true,
  imports: [CommonModule, DatePipe, FormsModule],
  templateUrl: './messages.component.html',
  styleUrls: ['./messages.component.css'],
})
export class PassengerMessagesComponent implements OnInit, OnDestroy, AfterViewChecked {
  @ViewChild('scrollAnchor') private scrollContainer!: ElementRef;

  loading = false;
  sessions: ChatSession[] = [];
  filteredSessions: ChatSession[] = [];
  active: ChatSession | null = null;
  newMessage = '';
  myId = '';
  myInitials = 'P';
  searchQuery = '';

  lightboxImage: string | null = null;

  isRecording = false;
  recordingDuration = 0;
  private mediaRecorder: MediaRecorder | null = null;
  private recordingInterval: any;
  private recordedChunks: Blob[] = [];

  private sub: Subscription | null = null;
  private shouldScroll = false;
  private sessionSelect$ = new Subject<string>();
  private sessionSelectSub: Subscription | null = null;
  private scrollSub: MutationObserver | null = null;

  constructor(
    private reservationService: ReservationService,
    private chatService: ChatService,
    private authService: AuthService,
    private http: HttpClient,
    private cdr: ChangeDetectorRef,
    private userService: UserService,
  ) {}

  ngOnInit(): void {
    this.myId = this.authService.getUserId() || '';

    const name = this.authService.getUserName?.() || '';
    this.myInitials =
      name
        .split(' ')
        .map((p: string) => p[0]?.toUpperCase())
        .join('')
        .slice(0, 2) || 'P';

    this.sessionSelectSub = this.sessionSelect$
      .pipe(debounceTime(150), distinctUntilChanged())
      .subscribe((sessionId) => {
        const session = this.sessions.find((s) => s.reservationId === sessionId);
        if (session) this.doSelectSession(session);
      });

    this.loadAllSessions();
  }

  private loadAllSessions(): void {
    this.loading = true;

    const rideSessions$ = this.reservationService.getMyReservations().pipe(
      catchError(() => of([])),
      take(1),
    );

    const voyageSessions$ = this.http
      .get<any>(`${environment.apiUrl}/api/v1/voyages/my-reservations?page=0&size=50`)
      .pipe(
        catchError((err) => {
          console.warn('[Chat] Failed to load voyage reservations:', err);
          return of({ content: [] });
        }),
        take(1),
      );

    forkJoin({
      rides: rideSessions$,
      voyages: voyageSessions$,
    }).subscribe({
      next: ({ rides, voyages }) => {
        const ridesList: any[] = Array.isArray(rides)
          ? rides
          : Array.isArray((rides as any)?.content)
            ? (rides as any).content
            : [];

        const rideSessions: ChatSession[] = ridesList
          .filter((r: any) => r.status === 'CONFIRMED' || r.status === 'ACCEPTED')
          .map((r: any, i: number) => ({
            reservationId: r.id,
            label: r.driverName || `Chauffeur ${i + 1}`,
            routeLabel:
              `${r.departureCity || ''} → ${r.arrivalCity || ''} ${r.createdAt ? new Date(r.createdAt).toLocaleDateString('fr') : ''}`.trim(),
            initials: this.getInitials(r.driverName || 'Chauffeur'),
            avatarClass: AVATAR_CLASSES[i % AVATAR_CLASSES.length],
            messages: [],
            unread: 0,
            online: false,
            lastMsg: '',
            lastTime: '',
            sessionType: 'RIDE' as const,
            otherParticipantId: r.driverId,
            nameResolved: !!r.driverName,
          }));

        const voyagePage = (voyages as any)?.content || voyages || [];
        const voyageSessions: ChatSession[] = (Array.isArray(voyagePage) ? voyagePage : [])
          .filter(
            (r: any) =>
              r.status === 'CONFIRMED' || r.status === 'ACCEPTED' || r.status === 'PENDING_PAYMENT',
          )
          .map((r: any, i: number) => {
            const resolvedLabel = (r.organizerName?.trim() || r.voyageTitle?.trim() || '').trim();
            const label = resolvedLabel || `Organisateur ${i + 1}`;
            return {
              reservationId: r.id,
              label,
              routeLabel:
                `${r.departureCity || ''} → ${r.arrivalCity || ''}`.trim() ||
                r.voyageTitle ||
                'Voyage organisé',
              initials: this.getInitials(label),
              avatarClass: AVATAR_CLASSES[(rideSessions.length + i) % AVATAR_CLASSES.length],
              messages: [],
              unread: 0,
              online: false,
              lastMsg: '',
              lastTime: '',
              sessionType: 'ORGANIZED' as const,
              otherParticipantId: r.organizerId,
              nameResolved: !!r.organizerName,
            };
          });

        this.sessions = [...rideSessions, ...voyageSessions];
        this.filteredSessions = [...this.sessions];
        this.cdr.detectChanges();

        this.enrichSessionNames();

        if (this.sessions.length && !this.active) {
          this.selectSession(this.sessions[0]);
        }
        this.loading = false;
      },
      error: () => {
        this.sessions = [];
        this.filteredSessions = [];
        this.loading = false;
      },
    });
  }

  private nameCache = new Map<string, string>();

  private enrichSessionNames(): void {
    const toResolve = this.sessions.filter((s) => !s.nameResolved && !!s.otherParticipantId);
    if (toResolve.length === 0) return;

    const uniqueIds = Array.from(
      new Set(toResolve.map((s) => s.otherParticipantId!).filter(Boolean)),
    );

    uniqueIds.forEach((userId) => {
      const cached = this.nameCache.get(userId);
      if (cached) {
        this.applyResolvedName(userId, cached);
        return;
      }

      this.userService.getPublicProfile(userId).subscribe({
        next: (profile) => {
          const displayName = profile.companyName?.trim() || profile.name?.trim() || '';
          if (displayName) {
            this.nameCache.set(userId, displayName);
            this.applyResolvedName(userId, displayName);
          }
        },
        error: () => {},
      });
    });
  }

  private applyResolvedName(userId: string, name: string): void {
    this.sessions.forEach((s) => {
      if (s.otherParticipantId === userId && !s.nameResolved) {
        s.label = name;
        s.initials = this.getInitials(name);
        s.nameResolved = true;
      }
    });
    this.filteredSessions = this.searchQuery
      ? this.sessions.filter((s) => s.label.toLowerCase().includes(this.searchQuery.toLowerCase()))
      : [...this.sessions];
    this.cdr.detectChanges();
  }

  private getInitials(name: string): string {
    return (
      name
        .split(' ')
        .map((p) => p[0]?.toUpperCase())
        .join('')
        .slice(0, 2) || 'C'
    );
  }

  filterSessions(): void {
    const q = this.searchQuery.toLowerCase();
    this.filteredSessions = q
      ? this.sessions.filter((s) => s.label.toLowerCase().includes(q))
      : [...this.sessions];
  }

  selectSession(s: ChatSession): void {
    this.sessionSelect$.next(s.reservationId);
  }

  private doSelectSession(s: ChatSession): void {
    if (this.active?.reservationId === s.reservationId) return;

    this.chatService.disconnect();
    this.sub?.unsubscribe();
    this.scrollSub?.disconnect();
    this.active = s;
    s.unread = 0;
    this.loading = true;

    this.chatService.getHistory(s.reservationId).subscribe({
      next: (msgs) => {
        s.messages = msgs;
        s.lastMsg = msgs[msgs.length - 1]?.content || s.lastMsg;
        this.loading = false;
        this.connectWS(s);
        this.shouldScroll = true;
        this.cdr.detectChanges();
      },
      error: () => {
        s.messages = [];
        this.loading = false;
        this.connectWS(s);
      },
    });
  }

  private connectWS(s: ChatSession): void {
    this.chatService.connect(s.reservationId);
    this.sub = this.chatService.onMessage().subscribe((msg) => {
      s.messages.push(msg);
      s.lastMsg = msg.content;
      s.lastTime = new Date(msg.sentAt || '').toLocaleTimeString('fr', {
        hour: '2-digit',
        minute: '2-digit',
      });
      if (this.active?.reservationId !== s.reservationId) s.unread++;
      this.cdr.detectChanges();
    });

    // Auto-scroll via MutationObserver for WebSocket messages
    setTimeout(() => {
      if (!this.scrollContainer) return;
      this.scrollSub = new MutationObserver(() => this.scrollToBottom());
      this.scrollSub.observe(this.scrollContainer.nativeElement, { childList: true, subtree: true });
      this.scrollToBottom();
    }, 300);
  }

  send(): void {
    if (!this.newMessage.trim() || !this.active) return;
    this.chatService.sendMessage(this.newMessage.trim());
    this.newMessage = '';
    this.shouldScroll = true;
    this.cdr.detectChanges();
  }

  openImage(url: string): void {
    this.lightboxImage = url;
  }

  closeLightbox(): void {
    this.lightboxImage = null;
  }

  onImageSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file || !this.active) return;

    this.chatService.uploadImage(file).subscribe({
      next: (res) => {
        this.chatService.sendImage(res.url, this.newMessage || undefined);
        this.newMessage = '';
        this.shouldScroll = true;
        this.cdr.detectChanges();
      },
      error: () => alert("Erreur lors de l'envoi de l'image"),
    });
    input.value = '';
  }

  async startRecording(): Promise<void> {
    if (!this.active) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.mediaRecorder = new MediaRecorder(stream);
      this.recordedChunks = [];

      this.mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) this.recordedChunks.push(e.data);
      };

      this.mediaRecorder.onstop = () => {
        const blob = new Blob(this.recordedChunks, { type: 'audio/webm' });
        this.uploadVoice(blob);
        stream.getTracks().forEach((t) => t.stop());
      };

      this.mediaRecorder.start();
      this.isRecording = true;
      this.recordingDuration = 0;
      this.recordingInterval = setInterval(() => this.recordingDuration++, 1000);
    } catch (err) {
      console.error('Microphone access denied', err);
      alert("Veuillez autoriser l'accès au microphone");
    }
  }

  stopRecording(): void {
    if (!this.isRecording || !this.mediaRecorder) return;

    clearInterval(this.recordingInterval);
    this.mediaRecorder.stop();
    this.isRecording = false;
  }

  private uploadVoice(blob: Blob): void {
    const file = new File([blob], `voice-${Date.now()}.webm`, { type: 'audio/webm' });
    this.chatService.uploadVoice(file).subscribe({
      next: (res) => {
        this.chatService.sendVoice(res.url, res.duration);
        this.shouldScroll = true;
        this.cdr.detectChanges();
      },
      error: () => alert("Erreur lors de l'envoi du message vocal"),
    });
  }

  toggleAudio(event: Event): void {
    const btn = event.currentTarget as HTMLButtonElement;
    const audio = btn.parentElement?.querySelector('audio') as HTMLAudioElement;
    const icon = btn.querySelector('i');

    if (!audio) return;

    if (audio.paused) {
      audio.play();
      icon?.classList.remove('bi-play-fill');
      icon?.classList.add('bi-pause-fill');
    } else {
      audio.pause();
      icon?.classList.remove('bi-pause-fill');
      icon?.classList.add('bi-play-fill');
    }

    audio.onended = () => {
      icon?.classList.remove('bi-pause-fill');
      icon?.classList.add('bi-play-fill');
    };
  }

  ngAfterViewChecked(): void {
    if (this.shouldScroll && this.scrollContainer) {
      setTimeout(() => this.scrollToBottom(), 0);
      this.shouldScroll = false;
    }
  }

  private scrollToBottom(): void {
    if (!this.scrollContainer) return;
    const el = this.scrollContainer.nativeElement;
    el.scrollTop = el.scrollHeight;
  }

  ngOnDestroy(): void {
    this.chatService.disconnect();
    this.sub?.unsubscribe();
    this.sessionSelectSub?.unsubscribe();
    this.scrollSub?.disconnect();
    if (this.isRecording) this.stopRecording();
  }
}
