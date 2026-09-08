import { Component, HostListener } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../../../core/services/auth.service';
import { NotificationBellComponent } from '../notification-bell/notification-bell.component';


@Component({
  standalone: true,
  selector: 'app-header',
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.css'],
  imports: [RouterLink, NotificationBellComponent, RouterLinkActive],
})
export class HeaderComponent {
  mobileMenuOpen = false;

  constructor(
    private authService: AuthService,
    private router: Router,
  ) {}

  get userAvatar(): string {
    const stored = sessionStorage.getItem('userAvatar');
    return stored ? stored : 'assets/default-avatar.jpg';
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/auth/login']);
  }

  toggleMobileMenu(): void {
    this.mobileMenuOpen = !this.mobileMenuOpen;
  }

  @HostListener('document:click', ['$event'])
  closeMenuOnOutsideClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (
      this.mobileMenuOpen &&
      !target.closest('.mobile-toggle') &&
      !target.closest('.mobile-menu')
    ) {
      this.mobileMenuOpen = false;
    }
  }
}
