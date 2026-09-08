import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminService } from '../../../core/services/admin.service';
import { PermissionService } from '../../../core/services/permission.service';
import { ToastService } from '../../../core/services/toast.service';
import { AdminSidebarComponent } from '../admin-sidebar/admin-sidebar.component';
import { catchError } from 'rxjs/operators';
import { forkJoin, of } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';

interface AdminRow {
  id: string;
  name: string;
  email: string;
  initials: string;
  avatarColor: string;
  roleLabel: string;
  roleClass: string;
  isMe: boolean;
}

interface SystemSettings {
  autoNotifications: boolean;
  weeklyReport: boolean;
  maintenanceMode: boolean;
  extendedLogs: boolean;
  commissionRate: number;
}

@Component({
  standalone: true,
  selector: 'app-settings',
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.css'],
  imports: [CommonModule, FormsModule, AdminSidebarComponent],
})
export class SettingsComponent implements OnInit {
  currentDate = '';

  admins: AdminRow[] = [];
  loading = true;

  settings: SystemSettings = {
    autoNotifications: false,
    weeklyReport: false,
    maintenanceMode: false,
    extendedLogs: false,
    commissionRate: 7,
  };

  saving = false;

  private avatarColors = ['#dbeafe', '#dcfce7', '#fef3c7', '#fce7f3', '#f3e8ff', '#ffedd5'];

  constructor(
    private adminService: AdminService,
    private authService: AuthService,
    public permissionService: PermissionService,
    private toast: ToastService,
  ) {}

  ngOnInit(): void {
    const opts: Intl.DateTimeFormatOptions = {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    };
    this.currentDate = new Date().toLocaleDateString('fr-FR', opts);
    this.loadData();
  }

  /* ═════════════════════════════════════════════════════
     CHARGEMENT RÉEL
     ═════════════════════════════════════════════════════ */
  loadData(): void {
    this.loading = true;
    forkJoin({
      users: this.adminService.listAllUsers(0, 200).pipe(catchError(() => of([]))),
      stats: this.adminService.getDashboardStats().pipe(catchError(() => of(null))),
    }).subscribe({
      next: ({ users, stats }) => {
        this.mapAdmins(users);
        this.mapSettings(stats);
        this.loading = false;
      },
      error: () => {
        this.loading = false;
        this.admins = [];
      },
    });
  }

  private mapAdmins(data: any[]): void {
    const raw = Array.isArray(data) ? data : [];
    const currentUserId = this.authService.getUserId() ?? '';

    this.admins = raw
      .filter((u: any) => {
        const role = u.adminRole ?? u.role ?? '';
        return role && role !== 'NONE' && role !== 'PASSENGER' && role !== 'DRIVER';
      })
      .map((u: any) => {
        const firstName = u.firstName ?? u.prenom ?? '';
        const lastName = u.lastName ?? u.nom ?? '';
        const fullName = `${firstName} ${lastName}`.trim() || u.email?.split('@')[0] || 'Admin';
        const initials = this.getInitials(firstName, lastName);
        const role = u.adminRole ?? u.role ?? 'ADMIN';
        const mappedRole = this.mapRole(role);

        return {
          id: u.id ?? u.userId ?? '',
          name: fullName,
          email: u.email ?? '',
          initials,
          avatarColor: this.getAvatarColor(fullName),
          roleLabel: mappedRole.label,
          roleClass: mappedRole.class,
          isMe: (u.id ?? u.userId ?? '') === currentUserId,
        };
      });
  }

  private mapRole(role: string): { label: string; class: string } {
    const r = (role ?? '').toUpperCase().replace(/[_\s]/g, '');
    const map: Record<string, { label: string; class: string }> = {
      SUPERADMIN: { label: 'Super Admin', class: 'superadmin' },
      SUPER_ADMIN: { label: 'Super Admin', class: 'superadmin' },
      OPERATIONALADMIN: { label: 'Admin Op.', class: 'adminop' },
      OPERATIONAL_ADMIN: { label: 'Admin Op.', class: 'adminop' },
      FINANCIALADMIN: { label: 'Admin Fin.', class: 'adminfin' },
      FINANCIAL_ADMIN: { label: 'Admin Fin.', class: 'adminfin' },
      MODERATOR: { label: 'Modérateur', class: 'moderateur' },
      AUDITEUR: { label: 'Auditeur', class: 'auditeur' },
      REPORTER: { label: 'Reporter', class: 'reporter' },
    };
    return map[r] ?? { label: role, class: 'default' };
  }

  private getInitials(first?: string, last?: string): string {
    return ((first?.[0] || '') + (last?.[0] || '')).toUpperCase();
  }

  private getAvatarColor(name: string): string {
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return this.avatarColors[Math.abs(hash) % this.avatarColors.length];
  }

  private mapSettings(stats: any): void {
    if (!stats) return;
    this.settings.autoNotifications = stats.autoNotifications ?? false;
    this.settings.weeklyReport = stats.weeklyReport ?? false;
    this.settings.maintenanceMode = stats.maintenanceMode ?? false;
    this.settings.extendedLogs = stats.extendedLogs ?? false;
    this.settings.commissionRate = stats.commissionRate ?? stats.commission ?? 7;
  }

  /* ═════════════════════════════════════════════════════
     ACTIONS
     ═════════════════════════════════════════════════════ */
  toggleSetting(key: keyof SystemSettings): void {
    // Optionnel : persistance immédiate par setting
    // this.adminService.updateSetting(key, this.settings[key]).subscribe(...)
  }

  saveSettings(): void {
    this.saving = true;
    // TODO: remplacer par vrai endpoint quand disponible
    // this.adminService.updateSystemSettings(this.settings).subscribe(...)
    setTimeout(() => {
      this.saving = false;
      this.toast.success('Paramètres enregistrés.');
    }, 600);
  }

  revokeAdmin(admin: AdminRow): void {
    if (!confirm(`Révoquer les droits admin de ${admin.name} ?`)) return;
    this.adminService.deactivateUser(admin.id).subscribe({
      next: () => {
        this.toast.success(`${admin.name} a été révoqué.`);
        this.loadData();
      },
      error: (err) => this.toast.error(err.error?.message || 'Erreur'),
    });
  }
}
