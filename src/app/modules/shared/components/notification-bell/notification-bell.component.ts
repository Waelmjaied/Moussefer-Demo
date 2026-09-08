import {
  Component,
  OnInit,
  OnDestroy,
  HostListener,
  AfterViewInit,
  ElementRef,
  Renderer2,
  ViewChild,
} from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';

import { NotificationService } from '../../../../core/services/notification.service';
import { AuthService } from '../../../../core/services/auth.service';
import { Notification } from '../../../../core/models/notification.model';

/**
 * Notification dropdown in the global header.
 *
 * State is sourced from {@link NotificationService} which polls every 30 s
 * and exposes two BehaviorSubjects ({@code notifications$},
 * {@code unreadCount$}). Mutations (mark-read, delete) are routed through
 * the service so the subjects stay in sync — the component never mutates
 * its own array directly.
 *
 * Lifecycle:
 *   - ngOnInit  → subscribe (only if authenticated); call startPolling
 *   - ngOnDestroy → unsubscribe; the polling itself is left running
 *                   because the service is application-singleton; call
 *                   notificationService.stopPolling() from your logout
 *                   handler to free it on sign-out.
 */
@Component({
  selector: 'app-notification-bell',
  standalone: true,
  imports: [CommonModule, DatePipe],
  templateUrl: './notification-bell.component.html',
  styleUrls: ['./notification-bell.component.css'],
})
export class NotificationBellComponent implements OnInit, OnDestroy, AfterViewInit {
  isOpen = false;
  notifications: Notification[] = [];
  unreadCount = 0;

  @ViewChild('dropdownRef', { static: false }) dropdownRef!: ElementRef;

  private subs = new Subscription();

  constructor(
    private notificationService: NotificationService,
    private authService: AuthService,
    private router: Router,
    private renderer: Renderer2,
  ) {}

  ngOnInit(): void {
    if (!this.authService.isAuthenticated()) return;

    this.subs.add(
      this.notificationService.notifications$.subscribe((n) => (this.notifications = n)),
    );
    this.subs.add(this.notificationService.unreadCount$.subscribe((c) => (this.unreadCount = c)));

    this.notificationService.startPolling(30_000);
  }

  ngAfterViewInit(): void {
    // Move dropdown to body to escape parent containers (overflow:hidden).
    if (this.dropdownRef) {
      this.renderer.appendChild(document.body, this.dropdownRef.nativeElement);
    }
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
    if (this.dropdownRef) {
      const dropdown = this.dropdownRef.nativeElement;
      if (document.body.contains(dropdown)) {
        this.renderer.removeChild(document.body, dropdown);
      }
    }
  }

  // ─── UI handlers ─────────────────────────────────────────────────

  toggleDropdown(): void {
    this.isOpen = !this.isOpen;
    if (this.isOpen) this.positionDropdown();
  }

  /**
   * Click on a notification row:
   *   1. Mark it read (no-op if already read)
   *   2. Deep-link to the referenced screen if applicable
   */
  onNotificationClick(notif: Notification): void {
    if (!notif.read) {
      this.notificationService.markAsRead(notif.id).subscribe();
    }
    const target = this.notificationService.deepLinkFor(notif);
    if (target) {
      this.isOpen = false;
      this.router.navigate(target);
    }
  }

  markAsRead(id: string, event?: Event): void {
    event?.stopPropagation();
    this.notificationService.markAsRead(id).subscribe();
  }

  markAllAsRead(): void {
    this.notificationService.markAllAsRead().subscribe();
  }

  deleteOne(id: string, event: Event): void {
    event.stopPropagation();
    this.notificationService.deleteNotification(id).subscribe();
  }

  clearAll(): void {
    this.notificationService.deleteAllNotifications().subscribe();
    this.isOpen = false;
  }

  // ─── Dropdown positioning ────────────────────────────────────────

  private positionDropdown(): void {
    const dropdown = this.dropdownRef?.nativeElement;
    const bell = document.querySelector('.bell-container') as HTMLElement;
    if (!dropdown || !bell) return;

    const rect = bell.getBoundingClientRect();
    const dropdownWidth = 360;
    const viewportWidth = window.innerWidth;

    let left = rect.left + rect.width / 2 - dropdownWidth / 2;
    const top = rect.bottom + 8;

    if (left < 12) left = 12;
    if (left + dropdownWidth > viewportWidth - 12) {
      left = viewportWidth - dropdownWidth - 12;
    }
    if (viewportWidth < 768) {
      left = (viewportWidth - Math.min(dropdownWidth, viewportWidth - 24)) / 2;
    }

    dropdown.style.position = 'fixed';
    dropdown.style.top = `${top}px`;
    dropdown.style.left = `${left}px`;
    dropdown.style.right = 'auto';
    dropdown.style.transform = 'none';
    dropdown.style.zIndex = '999999';
    dropdown.style.width = viewportWidth < 420 ? 'auto' : `${dropdownWidth}px`;
    dropdown.style.maxWidth =
      viewportWidth < 420 ? 'none' : `${Math.min(dropdownWidth, viewportWidth - 24)}px`;
    dropdown.style.margin = '0';
  }

  @HostListener('document:click', ['$event'])
  closeDropdown(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (
      this.isOpen &&
      !target.closest('.bell-container') &&
      !target.closest('.notification-dropdown')
    ) {
      this.isOpen = false;
    }
  }

  @HostListener('window:resize')
  onResize(): void {
    if (this.isOpen) this.positionDropdown();
  }
}
