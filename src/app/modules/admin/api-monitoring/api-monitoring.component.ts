import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminService } from '../../../core/services/admin.service';
import { ToastService } from '../../../core/services/toast.service';
import { AdminSidebarComponent } from '../admin-sidebar/admin-sidebar.component';

interface DashboardCard {
  role: string;
  label: string;
  icon: string;
  color: string;
  loading: boolean;
  data: any;
  error?: string;
}

/**
 * V24 — API Monitoring Dashboard
 *
 * Consumes the 6 specialized admin dashboards + activity logs + users stats
 * + reservations stats + banner performance, all in one page.
 *
 * Purpose: demonstrate the full backend admin surface area in a single screen
 * for the PFE jury. Each card is a live call to a backend endpoint.
 */
@Component({
  selector: 'app-api-monitoring',
  standalone: true,
  imports: [CommonModule, FormsModule, AdminSidebarComponent],
  templateUrl: './api-monitoring.component.html',
  styleUrls: ['./api-monitoring.component.css'],
})
export class ApiMonitoringComponent implements OnInit {
  dashboards: DashboardCard[] = [
    { role: 'super-admin',  label: 'Super-Admin',  icon: 'bi-shield-check',     color: '#1E2A5E', loading: true, data: null },
    { role: 'operational',  label: 'Opérationnel', icon: 'bi-gear-fill',        color: '#3FB174', loading: true, data: null },
    { role: 'financial',    label: 'Financier',    icon: 'bi-cash-coin',        color: '#DAA520', loading: true, data: null },
    { role: 'moderator',    label: 'Modérateur',   icon: 'bi-person-check',     color: '#E67E22', loading: true, data: null },
    { role: 'reporter',     label: 'Reporter',     icon: 'bi-graph-up',         color: '#2E86DE', loading: true, data: null },
    { role: 'auditor',      label: 'Auditeur',     icon: 'bi-clipboard-data',   color: '#C0392B', loading: true, data: null },
  ];

  // Aggregate KPIs
  usersStats: any = null;
  reservationsStats: any = null;
  bannerPerformance: any = null;
  activityLogs: any[] = [];

  loadingAggregate = true;

  constructor(
    private adminService: AdminService,
    private toast: ToastService,
  ) {}

  ngOnInit(): void {
    this.loadAllDashboards();
    this.loadAggregateStats();
  }

  /**
   * Load each of the 6 specialized dashboards in parallel.
   * Each call hits a different backend endpoint — perfect demo of the V18
   * specialized dashboards architecture.
   */
  loadAllDashboards(): void {
    this.dashboards.forEach((card) => {
      let stream;
      switch (card.role) {
        case 'super-admin':  stream = this.adminService.getSuperAdminDashboard();  break;
        case 'operational':  stream = this.adminService.getOperationalDashboard(); break;
        case 'financial':    stream = this.adminService.getFinancialDashboard();   break;
        case 'moderator':    stream = this.adminService.getModeratorDashboard();   break;
        case 'reporter':     stream = this.adminService.getReporterDashboard();    break;
        case 'auditor':      stream = this.adminService.getAuditorDashboard();     break;
        default: return;
      }
      stream.subscribe({
        next: (data) => { card.data = data; card.loading = false; },
        error: (err) => {
          card.loading = false;
          card.error = err?.error?.message || 'Accès refusé ou endpoint indisponible';
        }
      });
    });
  }

  /**
   * Load aggregate stats (users, reservations, banners, activity logs).
   */
  loadAggregateStats(): void {
    this.loadingAggregate = true;

    this.adminService.getUsersStats().subscribe({
      next: (data) => this.usersStats = data,
      error: () => {},
    });

    this.adminService.getReservationsStats().subscribe({
      next: (data) => this.reservationsStats = data,
      error: () => {},
    });

    this.adminService.getBannerPerformance().subscribe({
      next: (data) => this.bannerPerformance = data,
      error: () => {},
    });

    this.adminService.getActivityLogs(0, 10).subscribe({
      next: (page: any) => this.activityLogs = page?.content || page || [],
      error: () => {},
      complete: () => this.loadingAggregate = false,
    });
  }

  /**
   * Format a value for display, handling nulls and various data types.
   */
  formatValue(value: any): string {
    if (value === null || value === undefined) return '—';
    if (typeof value === 'number') {
      // Currency-looking number: 2 decimals
      return value % 1 === 0 ? value.toString() : value.toFixed(2);
    }
    if (typeof value === 'boolean') return value ? 'Oui' : 'Non';
    if (typeof value === 'object') return JSON.stringify(value).substring(0, 80);
    return String(value);
  }

  /**
   * Extract main KPIs from the dashboard data (defensive — backend shapes vary by role).
   */
  getKPIs(card: DashboardCard): { label: string; value: any }[] {
    if (!card.data) return [];
    const data = card.data.stats || card.data;
    const kpis: { label: string; value: any }[] = [];
    const keys = ['totalRevenue', 'totalReservations', 'activeTrips', 'totalUsers',
                  'pendingKyc', 'pendingDisputes', 'totalCommissions', 'auditEvents'];
    keys.forEach((key) => {
      if (data[key] !== undefined) {
        kpis.push({ label: this.humanize(key), value: data[key] });
      }
    });
    // If no known keys, show first 4 properties
    if (kpis.length === 0) {
      Object.keys(data).slice(0, 4).forEach((k) => {
        if (typeof data[k] !== 'object') {
          kpis.push({ label: this.humanize(k), value: data[k] });
        }
      });
    }
    return kpis.slice(0, 4);
  }

  private humanize(key: string): string {
    return key
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, (s) => s.toUpperCase())
      .trim();
  }

  refresh(): void {
    this.dashboards.forEach((c) => { c.loading = true; c.data = null; c.error = undefined; });
    this.loadAllDashboards();
    this.loadAggregateStats();
    this.toast.success('Données actualisées');
  }
}
