import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { UserService } from '../../../core/services/user.service';
import { ReservationService } from '../../../core/services/reservation.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-driver-sidebar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './driver-sidebar.component.html',
  styleUrls: ['./driver-sidebar.component.css'],
})
export class DriverSidebarComponent implements OnInit, OnDestroy {
  driverName = 'Chauffeur';
  initials = 'C';
  pendingCount = 0;
  unreadMessages = 0;

  /* ========== Mobile sidebar state ========== */
  isMobileOpen = false;

  constructor(
    private authService: AuthService,
    private userService: UserService,
    private reservationService: ReservationService,
    private router: Router,
  ) {}

  ngOnInit(): void {
    this.userService.getMyProfile().subscribe({
      next: (u) => {
        this.driverName = `${u.name || ''} `.trim();
        this.initials =
          [u.name]
            .map((p) => p?.[0]?.toUpperCase())
            .filter(Boolean)
            .join('') || 'C';
      },
      error: () => {},
    });
    this.reservationService.getDriverPending().subscribe({
      next: (res) => {
        this.pendingCount = res.length;
      },
      error: () => {},
    });
  }

  ngOnDestroy(): void {
    this.closeSidebar(); // reset body overflow if component is destroyed while open
  }

  /* ========== Mobile helpers ========== */
  toggleSidebar(): void {
    this.isMobileOpen = !this.isMobileOpen;
    this.updateBodyScroll();
  }

  closeSidebar(): void {
    this.isMobileOpen = false;
    this.updateBodyScroll();
  }

  private updateBodyScroll(): void {
    document.body.style.overflow = this.isMobileOpen ? 'hidden' : '';
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.closeSidebar();
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/auth/login']);
  }
}
