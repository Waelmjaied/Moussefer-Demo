import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivityLogService, PageResponse } from '../../../core/services/activity-log.service';
import { ActivityLog } from '../../../core/models/activity-log.model';
import { AdminSidebarComponent } from '../admin-sidebar/admin-sidebar.component';
import { catchError } from 'rxjs/operators';
import { of } from 'rxjs';

interface LogRow {
  id: string;
  displayDate: string;
  adminName: string;
  roleLabel: string;
  roleClass: string;
  actionLabel: string;
  actionClass: string;
  target: string;
  details: string;
}

@Component({
  selector: 'app-activity-log',
  standalone: true,
  imports: [CommonModule, FormsModule, AdminSidebarComponent],
  templateUrl: './activity-log.component.html',
  styleUrls: ['./activity-log.component.css'],
})
export class ActivityLogComponent implements OnInit {
  currentDate = '';

  logs: LogRow[] = [];
  filteredLogs: LogRow[] = [];
  loading = true;

  // Pagination
  currentPage = 0;
  pageSize = 20;
  totalElements = 0;
  totalPages = 0;

  // Filters
  searchQuery = '';
  filterAdmin = '';
  filterAction = '';
  filterDate = '';

  uniqueAdmins: string[] = [];
  uniqueActions: string[] = [];

  // Expose Math for template
  Math = Math;

  constructor(private logService: ActivityLogService) {}

  ngOnInit(): void {
    const opts: Intl.DateTimeFormatOptions = {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    };
    this.currentDate = new Date().toLocaleDateString('fr-FR', opts);
    this.loadLogs();
  }

  /* ═════════════════════════════════════════════════════
     CHARGEMENT RÉEL
     ═════════════════════════════════════════════════════ */
  loadLogs(): void {
    this.loading = true;
    this.logService
      .getLogs(this.currentPage, this.pageSize, {
        userEmail: this.filterAdmin || undefined,
        action: this.filterAction || undefined,
      })
      .pipe(
        catchError(() => of({ content: [], totalElements: 0, totalPages: 0, size: 20, number: 0 })),
      )
      .subscribe({
        next: (response: PageResponse<ActivityLog>) => {
          this.mapLogs(response.content ?? []);
          this.totalElements = response.totalElements ?? 0;
          this.totalPages = response.totalPages ?? 0;
          this.extractFilters();
          this.applyFilters();
          this.loading = false;
        },
        error: () => {
          this.loading = false;
          this.logs = [];
          this.filteredLogs = [];
        },
      });
  }

  private mapLogs(data: ActivityLog[]): void {
    this.logs = data.map((log: any) => {
      const role = this.mapRole(log.adminRole ?? log.role ?? 'Admin');
      const action = this.mapAction(log.action ?? 'UPDATE');

      return {
        id: log.id ?? log.logId ?? '',
        displayDate: log.createdAt ? this.formatLogDate(log.createdAt) : '—',
        adminName: log.adminName ?? log.userName ?? log.adminId ?? '—',
        roleLabel: role.label,
        roleClass: role.class,
        actionLabel: action.label,
        actionClass: action.class,
        target: (log.target ?? `${log.targetType ?? ''} ${log.targetId ?? ''}`.trim()) || '—',
        details: log.details ?? log.description ?? '—',
      };
    });
  }

  private formatLogDate(dateStr: string): string {
    const d = new Date(dateStr);
    const day = d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
    const time = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    return `${day} · ${time}`;
  }

  private mapRole(role?: string): { label: string; class: string } {
    const r = (role ?? '').toUpperCase().replace(/[_\s]/g, '');
    const map: Record<string, { label: string; class: string }> = {
      SUPERADMIN: { label: 'Super Admin', class: 'superadmin' },
      SUPER_ADMIN: { label: 'Super Admin', class: 'superadmin' },
      OPERATIONALADMIN: { label: 'Admin Op.', class: 'adminop' },
      OPERATIONAL_ADMIN: { label: 'Admin Op.', class: 'adminop' },
      ADMINOP: { label: 'Admin Op.', class: 'adminop' },
      FINANCIALADMIN: { label: 'Admin Fin.', class: 'adminfin' },
      FINANCIAL_ADMIN: { label: 'Admin Fin.', class: 'adminfin' },
      ADMINFIN: { label: 'Admin Fin.', class: 'adminfin' },
      MODERATOR: { label: 'Modérateur', class: 'moderateur' },
      MODERATEUR: { label: 'Modérateur', class: 'moderateur' },
      REPORTER: { label: 'Reporter', class: 'reporter' },
      AUDITEUR: { label: 'Auditeur', class: 'auditeur' },
      AUDITOR: { label: 'Auditeur', class: 'auditeur' },
    };
    return map[r] ?? { label: role ?? 'Admin', class: 'admin' };
  }

  private mapAction(action?: string): { label: string; class: string } {
    const a = (action ?? '').toUpperCase().replace(/[_\s]/g, '');
    const map: Record<string, { label: string; class: string }> = {
      BLOCK: { label: 'Blocage', class: 'blocage' },
      BLOCAGE: { label: 'Blocage', class: 'blocage' },
      SUSPEND: { label: 'Blocage', class: 'blocage' },
      UPDATE: { label: 'Modif.', class: 'modif' },
      MODIFY: { label: 'Modif.', class: 'modif' },
      MODIF: { label: 'Modif.', class: 'modif' },
      EDIT: { label: 'Modif.', class: 'modif' },
      EXPORT: { label: 'Export', class: 'export' },
      DELETE: { label: 'Suppression', class: 'suppression' },
      REMOVE: { label: 'Suppression', class: 'suppression' },
      CREATE: { label: 'Création', class: 'creation' },
      CREER: { label: 'Création', class: 'creation' },
      VERIFY: { label: 'Vérification', class: 'verif' },
      REFUND: { label: 'Remboursement', class: 'remboursement' },
      CANCEL: { label: 'Annulation', class: 'annulation' },
      LOGIN: { label: 'Connexion', class: 'connexion' },
      LOGOUT: { label: 'Déconnexion', class: 'deconnexion' },
    };
    return map[a] ?? { label: action ?? 'Action', class: 'default' };
  }

  private extractFilters(): void {
    const admins = new Set(this.logs.map((l) => l.adminName).filter((a) => a !== '—'));
    this.uniqueAdmins = Array.from(admins).sort();
    const actions = new Set(this.logs.map((l) => l.actionLabel));
    this.uniqueActions = Array.from(actions).sort();
  }

  applyFilters(): void {
    let filtered = this.logs;

    if (this.filterAdmin) {
      filtered = filtered.filter((l) => l.adminName === this.filterAdmin);
    }
    if (this.filterAction) {
      filtered = filtered.filter((l) => l.actionLabel === this.filterAction);
    }
    if (this.filterDate) {
      filtered = filtered.filter((l) => l.displayDate.includes(this.filterDate));
    }
    if (this.searchQuery.trim()) {
      const q = this.searchQuery.toLowerCase();
      filtered = filtered.filter(
        (l) =>
          l.adminName.toLowerCase().includes(q) ||
          l.target.toLowerCase().includes(q) ||
          l.details.toLowerCase().includes(q),
      );
    }

    this.filteredLogs = filtered;
  }

  goToPage(page: number): void {
    if (page >= 0 && page < this.totalPages) {
      this.currentPage = page;
      this.loadLogs();
    }
  }

  exportLogs(): void {
    const csv = [
      ['Date / Heure', 'Administrateur', 'Rôle', 'Action', 'Cible', 'Détails'].join(';'),
      ...this.filteredLogs.map((l) =>
        [l.displayDate, l.adminName, l.roleLabel, l.actionLabel, l.target, l.details].join(';'),
      ),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `journal-activite-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }
}
