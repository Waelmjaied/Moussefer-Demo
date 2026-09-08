import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive, Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { UserService } from '../../../core/services/user.service';
import { ReservationService } from '../../../core/services/reservation.service';
import { LoyaltyPointsService } from '../../../core/services/loyalty-points.service';
import { ChatService } from '../../../core/services/chat.service';
import { DemandeService } from '../../../core/services/demande.service';

@Component({
  selector: 'app-passenger-sidebar',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  templateUrl: './passenger-sidebar.component.html',
  styleUrls: ['./passenger-sidebar.component.css'],
})
export class PassengerSidebarComponent implements OnInit {
  fullName = '';
  email = '';
  initials = '?';
  totalTrips = 0;
  avgRating: string = '0';
  totalSpent = 0;
  pendingCount = 0;
  unreadMessages = 0;
  activeDemandes = 0;
  loyaltyPoints = 0;

  constructor(
    private authService: AuthService,
    private userService: UserService,
    private reservationService: ReservationService,
    private loyaltyService: LoyaltyPointsService,
    private chatService: ChatService,
    private demandeService: DemandeService,
    private router: Router,
  ) {}

  ngOnInit(): void {
    // ─── Profile + rating ─
    this.userService.getMyProfile().subscribe({
      next: (u) => {
        this.fullName = `${u.name || ''} `.trim();
        this.email = u.email || '';
        const parts = this.fullName.split(' ');
        this.initials =
          parts
            .map((p) => p[0]?.toUpperCase())
            .join('')
            .slice(0, 2) || '?';
        this.avgRating = u.averageRating ? u.averageRating.toFixed(1) : '0';
      },
      error: () => {},
    });

    // ─── Reservations: trips, pending, spent ─
    this.reservationService.getMyReservations().subscribe({
      next: (res: any) => {
        const list: any[] = Array.isArray(res)
          ? res
          : res && Array.isArray(res.content)
            ? res.content
            : [];
        this.totalTrips = list.length;
        this.pendingCount = list.filter((r) => r.status === 'PENDING_DRIVER').length;
        const rawSpent = list
          .filter((r) => r.status === 'CONFIRMED')
          .reduce((s, r) => s + (r.totalPrice || 0), 0);
        this.totalSpent = Math.round(rawSpent * 100) / 100;
      },
      error: () => {},
    });

    // ─── Unread messages — count sessions with recent activity as proxy ─
    this.chatService.getMyPassengerSessions(0, 50).subscribe({
      next: (page) => {
        const sessions = page?.content || [];
        this.unreadMessages = sessions.length;
      },
      error: () => (this.unreadMessages = 0),
    });

    // ─── Active collective demands — filter active ones from my demandes ─
    this.demandeService.getMyDemandes().subscribe({
      next: (list) => {
        this.activeDemandes =
          list?.filter((d: any) => d.status === 'ACTIVE' || d.status === 'OPEN').length ?? 0;
      },
      error: () => (this.activeDemandes = 0),
    });

    // ─── Loyalty points ─
    this.loyaltyService.getMyPoints().subscribe({
      next: (acc) => (this.loyaltyPoints = acc?.points ?? 0),
      error: () => (this.loyaltyPoints = 0),
    });
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/auth/login']);
  }

  sidebarOpen = false;

  navigateAndClose(route: string): void {
    this.sidebarOpen = false;
    this.router.navigate([route]);
  }
}
