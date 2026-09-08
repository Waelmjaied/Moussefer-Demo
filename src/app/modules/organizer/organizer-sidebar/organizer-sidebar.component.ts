import { Component, OnInit } from '@angular/core';
import { CommonModule, NgOptimizedImage } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';

import { AuthService } from '../../../core/services/auth.service';
import { VoyageService } from '../../../core/services/voyage.service';

@Component({
  selector: 'app-organizer-sidebar',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  templateUrl: './organizer-sidebar.component.html',
  styleUrls: ['./organizer-sidebar.component.css'],
})
export class OrganizerSidebarComponent implements OnInit {
  organizerName = 'Tunisia Tours';
  organizerRole = 'Agence de voyage';
  organizerInitials = 'TT';
  reservationCount = 0;
  sidebarOpen = false;

  constructor(
    private authService: AuthService,
    private voyageService: VoyageService,
  ) {}

  ngOnInit(): void {
    this.loadOrganizerInfo();
    this.loadPendingBadge();
  }

  private loadOrganizerInfo(): void {
    const email = this.authService.getUserEmail();
    const role = this.authService.getUserRole();

    if (email) {
      this.organizerName = email.split('@')[0];
      this.organizerInitials = this.getInitials(this.organizerName);
    }
    if (role) {
      this.organizerRole = role === 'ORGANIZER' ? 'Agence de voyage' : role;
    }
  }

  private loadPendingBadge(): void {
    this.voyageService.getAllOrganizerReservations().subscribe({
      next: (page) => {
        this.reservationCount =
          page.content?.filter((r) => r.status === 'PENDING_ORGANIZER').length ?? 0;
      },
      error: () => {
        this.reservationCount = 0;
      },
    });
  }

  getInitials(name: string): string {
    if (!name) return 'TT';
    return name
      .split(/[\s._-]+/)
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }

  toggleSidebar(): void {
    this.sidebarOpen = !this.sidebarOpen;
  }

  closeSidebar(): void {
    this.sidebarOpen = false;
  }

  logout(): void {
    this.authService.logout();
    window.location.href = '/auth/login';
  }
}
