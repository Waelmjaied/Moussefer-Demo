import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminPaymentService } from '../../../core/services/admin-payment.service';
import { AdminService } from '../../../core/services/admin.service';
import { PermissionService } from '../../../core/services/permission.service';
import { ToastService } from '../../../core/services/toast.service';
import { AdminSidebarComponent } from '../admin-sidebar/admin-sidebar.component';
import { catchError } from 'rxjs/operators';
import { forkJoin, of } from 'rxjs';

interface PaymentRow {
  id: string;
  displayId: string;
  userName: string;
  route: string;
  method: string;
  methodClass: string;
  amount: number;
  commission: number;
  netDriver: number;
  status: string;
  statusClass: string;
}

@Component({
  selector: 'app-payments',
  standalone: true,
  imports: [CommonModule, FormsModule, AdminSidebarComponent],
  templateUrl: './payments.component.html',
  styleUrls: ['./payments.component.css'],
})
export class PaymentsComponent implements OnInit {
  currentDate = '';

  // KPIs
  totalRevenue = 0;
  revenueGrowth = 0;
  totalCommission = 0;
  commissionRate = 7;
  pendingRefundsAmount = 0;
  pendingRefundsCount = 0;
  totalPayouts = 0;
  pendingPayoutsCount = 0;

  payments: PaymentRow[] = [];
  filteredPayments: PaymentRow[] = [];
  loading = true;
  searchQuery = '';

  constructor(
    private paymentService: AdminPaymentService,
    private adminService: AdminService,
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
     CHARGEMENT RÉEL — forkJoin sur les endpoints
     ═════════════════════════════════════════════════════ */
  loadData(): void {
    this.loading = true;
    forkJoin({
      payments: this.paymentService.getAllPayments().pipe(catchError(() => of([]))),
      stats: this.adminService.getDashboardStats().pipe(catchError(() => of(null))),
      resStats: this.adminService.getReservationsStats().pipe(catchError(() => of(null))),
      commissions: this.paymentService.getCommissions().pipe(catchError(() => of([]))),
      payouts: this.paymentService.getDriverPayouts().pipe(catchError(() => of([]))),
    }).subscribe({
      next: ({ payments, stats, resStats, commissions, payouts }) => {
        this.mapKPIs(stats, resStats, commissions, payouts);
        this.mapPayments(payments);
        this.applyFilters();
        this.loading = false;
      },
      error: () => {
        this.loading = false;
        this.payments = [];
        this.filteredPayments = [];
      },
    });
  }

  private mapKPIs(stats: any, resStats: any, commissions: any[], payouts: any[]): void {
    const commArray = Array.isArray(commissions) ? commissions : [];
    const payoutArray = Array.isArray(payouts) ? payouts : [];

    // Revenu brut
    this.totalRevenue = stats?.totalRevenue ?? stats?.todayRevenue ?? 0;
    this.revenueGrowth = stats?.revenueGrowth ?? stats?.growth ?? 12;

    // Commission
    this.totalCommission = commArray.reduce((s, c) => s + (c.commission ?? 0), 0);
    this.commissionRate = stats?.commissionRate ?? 7;

    // Remboursements
    this.pendingRefundsCount = resStats?.pendingRefunds ?? 0;
    this.pendingRefundsAmount = resStats?.pendingRefundsAmount ?? 0;

    // Versements
    this.totalPayouts = payoutArray.reduce((s, p) => s + (p.amount ?? 0), 0);
    this.pendingPayoutsCount = payoutArray.filter((p: any) => p.status === 'PENDING').length;
  }

  private mapPayments(data: any[]): void {
    const raw = Array.isArray(data) ? data : [];
    this.payments = raw.map((p: any) => {
      const amount = p.amount ?? p.totalAmount ?? 0;
      const rate = p.commissionRate ?? this.commissionRate ?? 7;
      const commission = p.commission ?? (amount * rate) / 100;
      const net = p.netDriver ?? p.driverAmount ?? amount - commission;

      return {
        id: p.paymentId ?? p.id ?? '',
        displayId: '#' + (p.paymentId ?? p.id ?? 'R0000'),
        userName: p.passengerName ?? p.userName ?? p.customerName ?? '—',
        route: p.route ?? p.tripRoute ?? `${p.departureCity ?? '—'} → ${p.arrivalCity ?? '—'}`,
        method: this.mapMethod(p.method ?? p.paymentMethod),
        methodClass: this.getMethodClass(p.method ?? p.paymentMethod),
        amount: amount,
        commission: commission,
        netDriver: net,
        status: this.mapStatus(p.status),
        statusClass: this.getStatusClass(p.status),
      };
    });
  }

  private mapMethod(method?: string): string {
    const m = (method ?? '').toUpperCase();
    if (m.includes('CARD') || m.includes('CARTE')) return 'Carte';
    if (m.includes('MOBILE') || m.includes('WALLET') || m.includes('D17')) return 'Mobile';
    if (m.includes('PROMO') || m.includes('CODE')) return 'Promo';
    return 'Carte';
  }

  private getMethodClass(method?: string): string {
    const m = (method ?? '').toUpperCase();
    if (m.includes('CARD') || m.includes('CARTE')) return 'carte';
    if (m.includes('MOBILE') || m.includes('WALLET') || m.includes('D17')) return 'mobile';
    if (m.includes('PROMO') || m.includes('CODE')) return 'promo';
    return 'carte';
  }

  private mapStatus(status?: string): string {
    const s = (status ?? '').toUpperCase();
    if (s === 'SUCCEEDED' || s === 'PAID' || s === 'COMPLETED') return 'Payé';
    if (s === 'PENDING') return 'En attente';
    if (s === 'FAILED') return 'Échoué';
    if (s === 'REFUNDED') return 'Remboursé';
    return 'En attente';
  }

  private getStatusClass(status?: string): string {
    const s = (status ?? '').toUpperCase();
    if (s === 'SUCCEEDED' || s === 'PAID' || s === 'COMPLETED') return 'paye';
    if (s === 'PENDING') return 'attente';
    if (s === 'FAILED') return 'echoue';
    if (s === 'REFUNDED') return 'rembourse';
    return 'attente';
  }

  applyFilters(): void {
    let filtered = this.payments;

    if (this.searchQuery.trim()) {
      const q = this.searchQuery.toLowerCase();
      filtered = filtered.filter(
        (p) =>
          p.userName.toLowerCase().includes(q) ||
          p.route.toLowerCase().includes(q) ||
          p.displayId.toLowerCase().includes(q) ||
          p.method.toLowerCase().includes(q),
      );
    }

    this.filteredPayments = filtered;
  }

  updateStatus(paymentId: string, status: string): void {
    this.paymentService.updatePaymentStatus(paymentId, status).subscribe({
      next: () => {
        this.toast.success('Statut mis à jour.');
        this.loadData();
      },
      error: (err) => this.toast.error(err.error?.message || 'Erreur'),
    });
  }

  exportCsv(): void {
    this.paymentService.exportPayments('csv').subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `paiements-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      },
      error: () => this.toast.error('Export échoué'),
    });
  }
}
