import {
  Component,
  OnInit,
  OnDestroy,
  AfterViewChecked,
  ElementRef,
  ViewChild,
} from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { DriverSidebarComponent } from '../driver-sidebar/driver-sidebar.component';
import { ChatService, ChatMessage } from '../../../core/services/chat.service';
import { ReservationService } from '../../../core/services/reservation.service';
import { AuthService } from '../../../core/services/auth.service';
import { UserService } from '../../../core/services/user.service';
import { Subject, Subscription, take, debounceTime, distinctUntilChanged } from 'rxjs';

const AV_CLASSES = ['av-rb', 'av-kt', 'av-lm', 'av-ob', 'av-fm', 'av-sa'];

export interface ChatSession {
  reservationId: string;
  label: string;
  routeLabel: string;
  departTime: string;
  arriveTime: string;
  initials: string;
  cls: string;
  messages: ChatMessage[];
  unread: number;
  online: boolean;
  lastMsg: string;
  lastTime: string;
  isActive: boolean;
  otherParticipantId?: string; // ← UUID du passager (pour enrichir le label)
  nameResolved?: boolean; // ← true si label = vrai nom
}

@Component({
  selector: 'app-driver-messages',
  standalone: true,
  imports: [CommonModule, DatePipe, FormsModule, RouterModule, DriverSidebarComponent],
  templateUrl: './messages.component.html',
  styleUrls: ['./messages.component.css'],
})
export class DriverMessagesComponent implements OnInit, OnDestroy, AfterViewChecked {
  @ViewChild('scrollAnchor') private scrollEl!: ElementRef;

  loading = false;
  sessions: ChatSession[] = [];
  filteredActive: ChatSession[] = [];
  filteredUpcoming: ChatSession[] = [];
  active: ChatSession | null = null;
  newMessage = '';
  myId = '';
  myInitials = 'D';
  searchQuery = '';
  activeTripRoute = 'Tunis → Sfax';
  unreadCount = 0;

  /* ========== Mobile sessions drawer ========== */
  showSessionsDrawer = false;

  // Voice recording
  isRecording = false;
  recordingDuration = 0;
  private mediaRecorder: MediaRecorder | null = null;
  private recordingInterval: any;
  private recordedChunks: Blob[] = [];

  private sub: Subscription | null = null;
  private shouldScroll = false;
  private sessionSelect$ = new Subject<string>();
  private sessionSelectSub: Subscription | null = null;

  constructor(
    private reservationService: ReservationService,
    private chatService: ChatService,
    private authService: AuthService,
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
        .slice(0, 2) || 'D';

    // Debounce rapid session switches to prevent connect/disconnect loops
    this.sessionSelectSub = this.sessionSelect$
      .pipe(debounceTime(150), distinctUntilChanged())
      .subscribe((sessionId) => {
        const session = this.sessions.find((s) => s.reservationId === sessionId);
        if (session) this.doSelectSession(session);
      });

    // Use getDriverActive to get ACCEPTED + CONFIRMED reservations
    this.reservationService
      .getDriverActive()
      .pipe(take(1))
      .subscribe({
        next: (res) => {
          this.sessions = res.map((r, i) => ({
            reservationId: r.id,
            label: r.passengerName || `Passager ${i + 1}`,
            routeLabel: `${r.departureCity || ''} → ${r.arrivalCity || ''}`,
            departTime: '07:30',
            arriveTime: '11:00',
            initials: this.getInitials(r.passengerName || 'Passager'),
            cls: AV_CLASSES[i % AV_CLASSES.length],
            messages: [],
            unread: i < 2 ? 1 : 0,
            online: i < 3,
            lastMsg: '',
            lastTime: i === 0 ? '09:14' : i === 1 ? '08:55' : '07:30',
            isActive: r.status === 'ACCEPTED' || r.status === 'CONFIRMED',
            otherParticipantId: r.passengerId, // ← stocke l'ID passager
            nameResolved: !!r.passengerName,
          }));
          this.unreadCount = this.sessions.reduce((s, ses) => s + ses.unread, 0);
          this.filteredActive = this.sessions.filter((s) => s.isActive);
          this.filteredUpcoming = this.sessions.filter((s) => !s.isActive);
          if (this.sessions.length && !this.active) {
            this.selectSession(this.sessions[0]);
          } else {
            this.loading = false;
          }
          // 🔧 Enrichit avec les vrais noms passagers
          this.enrichSessionNames();
        },
        error: () => (this.loading = false),
      });
  }

  /**
   * Fetch les vrais noms des passagers via user-service pour remplacer
   * les labels "Passager 1", "Passager 2"...
   */
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
          const displayName = profile.name?.trim() || '';
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
    this.filteredActive = this.sessions.filter((s) => s.isActive);
    this.filteredUpcoming = this.sessions.filter((s) => !s.isActive);
  }

  private getInitials(name: string): string {
    return (
      name
        .split(' ')
        .map((p) => p[0]?.toUpperCase())
        .join('')
        .slice(0, 2) || 'P'
    );
  }

  filterSessions(): void {
    const q = this.searchQuery.toLowerCase();
    const filtered = q
      ? this.sessions.filter((s) => s.label.toLowerCase().includes(q))
      : this.sessions;
    this.filteredActive = filtered.filter((s) => s.isActive);
    this.filteredUpcoming = filtered.filter((s) => !s.isActive);
  }

  /* ========== Mobile helpers ========== */
  toggleSessions(): void {
    this.showSessionsDrawer = !this.showSessionsDrawer;
  }

  closeSessions(): void {
    this.showSessionsDrawer = false;
  }

  selectSession(s: ChatSession): void {
    // Queue the session selection through the debounced stream
    this.sessionSelect$.next(s.reservationId);
  }

  private doSelectSession(s: ChatSession): void {
    // ✅ Skip if already selected
    if (this.active?.reservationId === s.reservationId) return;

    this.chatService.disconnect();
    this.sub?.unsubscribe();
    this.active = s;
    s.unread = 0;
    this.unreadCount = this.sessions.reduce((sum, ses) => sum + ses.unread, 0);
    this.loading = true;
    this.chatService.getHistory(s.reservationId).subscribe({
      next: (msgs) => {
        s.messages = msgs;
        this.loading = false;
        this.connectWS(s);
        this.shouldScroll = true;
      },
      error: () => {
        s.messages = [];
        this.loading = false;
        this.connectWS(s);
      },
    });
    this.closeSessions(); // close drawer on mobile after selection
  }

  private connectWS(s: ChatSession): void {
    this.chatService.connect(s.reservationId);
    this.sub = this.chatService.onMessage().subscribe((msg) => {
      s.messages.push(msg);
      s.lastMsg = msg.content;
      if (this.active?.reservationId !== s.reservationId) {
        s.unread++;
        this.unreadCount++;
      }
      this.shouldScroll = true;
    });
  }

  send(): void {
    if (!this.newMessage.trim() || !this.active) return;
    this.chatService.sendMessage(this.newMessage.trim());
    this.newMessage = '';
    this.shouldScroll = true;
  }

  // ─── Image Upload ───
  onImageSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file || !this.active) return;

    this.chatService.uploadImage(file).subscribe({
      next: (res) => {
        this.chatService.sendImage(res.url, this.newMessage || undefined);
        this.newMessage = '';
        this.shouldScroll = true;
      },
      error: () => alert("Erreur lors de l'envoi de l'image"),
    });
    input.value = '';
  }

  // ─── Voice Recording ───
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
      },
      error: () => alert("Erreur lors de l'envoi du message vocal"),
    });
  }

  ngAfterViewChecked(): void {
    if (this.shouldScroll && this.scrollEl) {
      this.scrollEl.nativeElement.scrollTop = this.scrollEl.nativeElement.scrollHeight;
      this.shouldScroll = false;
    }
  }

  ngOnDestroy(): void {
    this.chatService.disconnect();
    this.sub?.unsubscribe();
    this.sessionSelectSub?.unsubscribe();
    if (this.isRecording) this.stopRecording();
  }

  lightboxImage: string | null = null;

  openImage(url: string): void {
    this.lightboxImage = url;
  }

  closeLightbox(): void {
    this.lightboxImage = null;
  }

  toggleAudio(event: Event): void {
    const btn = event.currentTarget as HTMLButtonElement;
    const audio = btn.nextElementSibling?.nextElementSibling
      ?.nextElementSibling as HTMLAudioElement;
    const icon = btn.querySelector('i');

    if (audio.paused) {
      audio.play();
      icon?.classList.replace('bi-play-fill', 'bi-pause-fill');
    } else {
      audio.pause();
      icon?.classList.replace('bi-pause-fill', 'bi-play-fill');
    }

    audio.onended = () => {
      icon?.classList.replace('bi-pause-fill', 'bi-play-fill');
    };
  }
}
