import { Injectable } from '@angular/core';
import { AuthService } from './auth.service';

@Injectable({ providedIn: 'root' })
export class PermissionService {
  constructor(private authService: AuthService) {}

  private getAdminGrade(): string | null {
    return this.authService.getStoredAdminGrade();
  }

  // Role checks
  isSuperAdmin(): boolean {
    return this.getAdminGrade() === 'SUPER_ADMIN';
  }

  isModerator(): boolean {
    const grade = this.getAdminGrade();
    return grade === 'MODERATOR' || this.isSuperAdmin();
  }

  isOperationalAdmin(): boolean {
    const grade = this.getAdminGrade();
    return grade === 'OPERATIONAL_ADMIN' || this.isSuperAdmin();
  }

  isReporter(): boolean {
    const grade = this.getAdminGrade();
    return grade === 'REPORTER' || this.isSuperAdmin();
  }

  isAuditeur(): boolean {
    const grade = this.getAdminGrade();
    return grade === 'AUDITEUR' || this.isSuperAdmin();
  }

  // V19 — Financial admin (manages regulated fares)
  isFinancialAdmin(): boolean {
    const grade = this.getAdminGrade();
    return grade === 'FINANCIAL_ADMIN' || this.isSuperAdmin();
  }

  canManageFares(): boolean {
    return this.isFinancialAdmin();
  }

  // Permission methods (used in templates)
  canViewUsers(): boolean {
    // All admin grades can list users (but some actions are restricted)
    return this.getAdminGrade() !== null;
  }

  canDeactivateUser(): boolean {
    return this.isModerator() || this.isOperationalAdmin() || this.isSuperAdmin();
  }

  canVerifyDocuments(): boolean {
    return this.isOperationalAdmin() || this.isSuperAdmin();
  }

  canSuspendUser(): boolean {
    return this.isModerator() || this.isSuperAdmin();
  }

  canAssignAdminRole(): boolean {
    return this.isSuperAdmin();
  }

  canViewStatistics(): boolean {
    return this.isReporter() || this.isSuperAdmin();
  }

  canViewActivityLog(): boolean {
    return this.isAuditeur() || this.isSuperAdmin();
  }

  // For banners, stations, promo codes, etc. – you may decide who can edit
  // Typically only SUPER_ADMIN can create/edit/delete, others can view
  canManageBanners(): boolean {
    return this.isSuperAdmin();
  }

  canManageStations(): boolean {
    return this.isSuperAdmin();
  }

  canManagePromoCodes(): boolean {
    return this.isSuperAdmin();
  }

  canManagePayments(): boolean {
    // Payment overview may be viewable by many, but modifications only SUPER_ADMIN
    return true; // all admins can view, but edit/refund can be restricted separately
  }

  canViewTrajets(): boolean {
    return true; // all admins can view trajets
  }

  canViewReservations(): boolean {
    return true; // all admins can view reservations
  }


  hasAdminRole(requiredRoles: string[]): boolean {
    const grade = this.getAdminGrade();
    if (!grade) return false;
    return requiredRoles.includes(grade);
  }

  canViewReports() {
    return this.isReporter() || this.isSuperAdmin();
  }
}
