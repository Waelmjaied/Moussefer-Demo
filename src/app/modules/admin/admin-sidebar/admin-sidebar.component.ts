import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { PermissionService } from '../../../core/services/permission.service';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-admin-sidebar',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  templateUrl: './admin-sidebar.component.html',
  styleUrls: ['./admin-sidebar.component.css'],
})
export class AdminSidebarComponent implements OnInit {
  adminEmail: string = '';
  isOpen = false;

  constructor(
    public permissionService: PermissionService,
    private authService: AuthService,
  ) {}

  ngOnInit(): void {
    this.adminEmail = this.authService.getUserEmail() || '';
    this.authService.adminGrade$.subscribe(() => {
      // keeps grade up-to-date
    });
  }

  get adminGrade(): string | null {
    return this.authService.getStoredAdminGrade();
  }

  get adminRoleLabel(): string {
    const grade = this.adminGrade;
    switch (grade) {
      case 'SUPER_ADMIN':
        return 'Super admin';
      case 'OPERATIONAL_ADMIN':
        return 'Admin Opérationnel';
      case 'MODERATOR':
        return 'Modérateur';
      case 'REPORTER':
        return 'Reporter';
      case 'AUDITEUR':
        return 'Auditeur';
      default:
        return grade || '';
    }
  }

  toggleSidebar(): void {
    this.isOpen = !this.isOpen;
    this.toggleBodyScroll();
  }

  closeSidebar(): void {
    this.isOpen = false;
    this.toggleBodyScroll();
  }

  private toggleBodyScroll(): void {
    if (this.isOpen) {
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.width = '100%';
      document.body.style.height = '100%';
    } else {
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
      document.body.style.height = '';
    }
  }

  protected logout() {
    this.authService.logout();
    window.location.href = '/auth/login';
  }
}
