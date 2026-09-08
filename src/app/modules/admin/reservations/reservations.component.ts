// Cible : src/app/modules/admin/reservations/reservations.component.ts
// FIX #3a : viewReservation navigue vers /admin/reservations/:id au lieu de console.log

import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AdminService } from '../../../core/services/admin.service';
import { PermissionService } from '../../../core/services/permission.service';
import { ToastService } from '../../../core/services/toast.service';
import { AdminSidebarComponent } from '../admin-sidebar/admin-sidebar.component';
import { catchError } from 'rxjs/operators';
import { forkJoin, of } from 'rxjs';

interface ReservationRow {
  id: string;
  displayId: string;
  passengerName: string;
  route: string;
  displayDate: string;
  amount: number;
  status: string;
  displayStatus: string;
  type?: string;
  passengerId?: string;
  trajetId?: string;
}

@Component({
  selector: 'app-admin-reservations',
  standalone: true,
  imports: [CommonModule, FormsModule, AdminSidebarComponent],
  templateUrl: './reservations.component.html',
  styleUrls: ['./reservations.component.css'],
})
export class ReservationsComponent implements OnInit {
  currentDate = '';

  // KPIs
  totalRevenue = 0;
  revenueIncrease = 0;
  openLitiges = 0;
  litigesIncrease = 0;
  pendingRefunds = 0;
  pendingRefundsAmount = 0;

  reservations: ReservationRow[] = [];
  filteredReservations: ReservationRow[] = [];
  loading = true;
  searchQuery = '';

  statusFilter = 'ALL';
  typeFilter = 'ALL';

  constructor(
    private adminService: AdminService,
    public permissionService: PermissionService,
    private toast: ToastService,
    private router: Router, // ▶︎ FIX #3a
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

  loadData(): void {
    this.loading = true;
    // ▶︎ FIX #2 : 'OPEN' au lieu de 'PENDING' (l'enum backend DisputeStatus n'a pas PENDING)
    forkJoin({
      reservations: this.adminService.getAllReservations(0, 200).pipe(catchError(() => of([]))),
      stats: this.adminService.getReservationsStats().pipe(catchError(() => of(null))),
      litiges: this.adminService.getLitiges('OPEN').pipe(catchError(() => of([]))),
    }).subscribe({
      next: ({ reservations, stats, litiges }) => {
        this.mapKPIs(stats, litiges);
        this.mapReservations(reservations);
        this.applyFilters();
        this.loading = false;
      },
      error: () => {
        this.loading = false;
        this.reservations = [];
        this.filteredReservations = [];
      },
    });
  }

  private mapKPIs(stats: any, litiges: any[]): void {
    if (stats) {
      this.totalRevenue = stats.totalRevenueToday ?? stats.todayRevenue ?? 0;
      this.revenueIncrease = stats.revenueIncrease ?? stats.revenueGrowth ?? 18;
      this.pendingRefunds = stats.pendingRefunds ?? stats.refundRequests ?? 0;
      this.pendingRefundsAmount = stats.pendingRefundsAmount ?? stats.refundTotal ?? 0;
    }
    this.openLitiges = Array.isArray(litiges) ? litiges.length : 0;
    this.litigesIncrease = 2;
  }

  private mapReservations(data: any[]): void {
    const raw = Array.isArray(data) ? data : [];
    this.reservations = raw.map((r: any) => {
      const status = r.status ?? 'PENDING';
      return {
        id: r.id ?? r.reservationId ?? '',
        displayId: '#' + (r.id ?? r.reservationId ?? 'R0000'),
        passengerName:
          r.passengerName ||
          (r.passenger?.firstName && r.passenger?.lastName
            ? `${r.passenger.firstName} ${r.passenger.lastName}`
            : '—'),
        route: r.route ?? r.tripRoute ?? `${r.departureCity ?? '—'} → ${r.arrivalCity ?? '—'}`,
        displayDate: r.reservationDate
          ? this.formatDate(r.reservationDate)
          : r.departureDate
            ? this.formatDate(r.departureDate)
            : '—',
        amount: r.amount ?? r.price ?? r.totalAmount ?? 0,
        status: this.normalizeStatus(status),
        displayStatus: this.mapDisplayStatus(status),
        type: r.type ?? 'TRAJET',
        passengerId: r.passengerId ?? r.passenger?.id,
        trajetId: r.trajetId ?? r.tripId,
      };
    });
  }

  private normalizeStatus(status: string): string {
    const map: Record<string, string> = {
      PENDING: 'PENDING',
      CONFIRMED: 'CONFIRMED',
      CANCELLED: 'CANCELLED',
      COMPLETED: 'COMPLETED',
      LITIGE: 'LITIGE',
      DISPUTE: 'LITIGE',
      REFUND_PENDING: 'REFUND_PENDING',
      REFUND_REQUESTED: 'REFUND_PENDING',
    };
    return map[status] ?? status;
  }

  private mapDisplayStatus(status?: string): string {
    const map: Record<string, string> = {
      PENDING: 'En attente',
      CONFIRMED: 'Confirmé',
      CANCELLED: 'Annulé',
      COMPLETED: 'Terminé',
      LITIGE: 'Litige',
      REFUND_PENDING: 'Remboursement',
    };
    return map[status ?? ''] ?? status ?? 'En attente';
  }

  private formatDate(dateStr: string): string {
    const d = new Date(dateStr);
    return (
      d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) +
      ' · ' +
      d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
    );
  }

  getStatusClass(status: string): string {
    const map: Record<string, string> = {
      CONFIRMED: 'confirme',
      LITIGE: 'litige',
      REFUND_PENDING: 'remboursement',
      CANCELLED: 'annule',
      COMPLETED: 'termine',
      PENDING: 'attente',
    };
    return map[status] ?? 'attente';
  }

  applyFilters(): void {
    let filtered = this.reservations;

    if (this.statusFilter !== 'ALL') {
      filtered = filtered.filter((r) => r.status === this.statusFilter);
    }
    if (this.typeFilter !== 'ALL') {
      filtered = filtered.filter((r) => r.type === this.typeFilter);
    }
    if (this.searchQuery.trim()) {
      const q = this.searchQuery.toLowerCase();
      filtered = filtered.filter(
        (r) =>
          r.passengerName.toLowerCase().includes(q) ||
          r.route.toLowerCase().includes(q) ||
          r.displayId.toLowerCase().includes(q),
      );
    }

    this.filteredReservations = filtered;
  }

  onStatusFilterChange(): void {
    this.applyFilters();
  }

  onTypeFilterChange(): void {
    this.applyFilters();
  }

  canRefuse(_res: ReservationRow): boolean {
    return this.permissionService.isSuperAdmin();
  }

  /** ▶︎ FIX #3a : navigation vers la nouvelle page détail */
  viewReservation(res: ReservationRow): void {
    this.router.navigate(['/admin/reservations', res.id]);
  }

  resolveLitige(res: ReservationRow): void {
    this.adminService.updateReservationStatus(res.id, 'CONFIRMED').subscribe({
      next: () => {
        this.toast.success('Litige résolu.');
        this.loadData();
      },
      error: (err) => this.toast.error(err.error?.message || 'Erreur'),
    });
  }

  refundReservation(res: ReservationRow): void {
    this.adminService.refundReservation(res.id, res.amount, 'Remboursement litige').subscribe({
      next: () => {
        this.toast.success('Remboursement effectué.');
        this.loadData();
      },
      error: (err) => this.toast.error(err.error?.message || 'Erreur'),
    });
  }

  approveRefund(res: ReservationRow): void {
    this.adminService.refundReservation(res.id, res.amount, 'Remboursement approuvé').subscribe({
      next: () => {
        this.toast.success('Remboursement validé.');
        this.loadData();
      },
      error: (err) => this.toast.error(err.error?.message || 'Erreur'),
    });
  }

  rejectRefund(res: ReservationRow): void {
    this.adminService.updateReservationStatus(res.id, 'CONFIRMED').subscribe({
      next: () => {
        this.toast.success('Remboursement refusé.');
        this.loadData();
      },
      error: (err) => this.toast.error(err.error?.message || 'Erreur'),
    });
  }

  refuseReservation(res: ReservationRow): void {
    this.adminService.updateReservationStatus(res.id, 'CANCELLED').subscribe({
      next: () => {
        this.toast.success('Réservation refusée.');
        this.loadData();
      },
      error: (err) => this.toast.error(err.error?.message || 'Erreur'),
    });
  }

  updateStatus(reservationId: string, newStatus: string): void {
    this.adminService.updateReservationStatus(reservationId, newStatus).subscribe({
      next: () => {
        this.toast.success('Statut mis à jour.');
        this.loadData();
      },
      error: (err) => this.toast.error(err.error?.message || 'Erreur'),
    });
  }
}
