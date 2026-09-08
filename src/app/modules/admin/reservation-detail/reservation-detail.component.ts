// Cible : src/app/modules/admin/reservation-detail/reservation-detail.component.ts
// FIX #3a : nouveau composant pour la route /admin/reservations/:id
// Affiche le détail complet d'une réservation et expose les actions
// admin (refund, change status, voir trajet, voir passager).

import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';

import { AdminService } from '../../../core/services/admin.service';
import { PermissionService } from '../../../core/services/permission.service';
import { ToastService } from '../../../core/services/toast.service';
import { AdminSidebarComponent } from '../admin-sidebar/admin-sidebar.component';

@Component({
  selector: 'app-admin-reservation-detail',
  standalone: true,
  imports: [CommonModule, DatePipe, FormsModule, RouterLink, AdminSidebarComponent],
  templateUrl: './reservation-detail.component.html',
  styleUrls: ['./reservation-detail.component.css'],
})
export class AdminReservationDetailComponent implements OnInit, OnDestroy {
  reservation: any | null = null;
  loading = true;
  error: string | null = null;
  reservationId = '';

  // Actions en cours (anti double-click)
  processingRefund = false;
  processingStatus = false;

  // Refund modal
  showRefundModal = false;
  refundAmount = 0;
  refundReason = '';

  // Status change modal
  showStatusModal = false;
  newStatus: 'CONFIRMED' | 'CANCELLED' | 'REFUSED' | 'ESCALATED' | '' = '';
  statusReason = '';

  private readonly destroy$ = new Subject<void>();

  readonly statusLabels: Record<string, string> = {
    PENDING_DRIVER: 'En attente chauffeur',
    ACCEPTED: 'Acceptée',
    REFUSED: 'Refusée',
    PAYMENT_PENDING: 'Paiement en attente',
    CONFIRMED: 'Confirmée',
    CANCELLED: 'Annulée',
    ESCALATED: 'Escaladée',
  };

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private adminService: AdminService,
    public permissionService: PermissionService,
    private toast: ToastService,
  ) {}

  ngOnInit(): void {
    // FIX #1 : on s'abonne à paramMap (et pas snapshot) pour supporter la
    // navigation /admin/reservations/A → /admin/reservations/B sans démontage.
    this.route.paramMap.pipe(takeUntil(this.destroy$)).subscribe((params) => {
      const id = params.get('id');
      if (!id) {
        this.error = 'ID de réservation manquant';
        this.loading = false;
        return;
      }
      this.reservationId = id;
      this.loadReservation();
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadReservation(): void {
    this.loading = true;
    this.error = null;
    this.adminService
      .getReservationDetail(this.reservationId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          this.reservation = data;
          // Initialise le montant remboursable par défaut
          this.refundAmount = data?.totalPrice ?? data?.amount ?? 0;
          this.loading = false;
        },
        error: (err) => {
          this.loading = false;
          this.error = err.error?.message || `Réservation ${this.reservationId} introuvable.`;
        },
      });
  }

  /* ═══════════════════════ STATUS LABEL HELPERS ══════════════════════ */

  getStatusLabel(status?: string): string {
    return (status && this.statusLabels[status]) || status || '—';
  }

  getStatusClass(status?: string): string {
    if (!status) return '';
    const map: Record<string, string> = {
      CONFIRMED: 'badge-success',
      ACCEPTED: 'badge-info',
      PENDING_DRIVER: 'badge-warning',
      PAYMENT_PENDING: 'badge-warning',
      CANCELLED: 'badge-danger',
      REFUSED: 'badge-danger',
      ESCALATED: 'badge-danger',
    };
    return map[status] || 'badge-default';
  }

  /* ═══════════════════════ NAVIGATION ════════════════════════════════ */

  goToTrajet(): void {
    if (this.reservation?.trajetId) {
      this.router.navigate(['/admin/trajets', this.reservation.trajetId]);
    }
  }

  goToPassenger(): void {
    if (this.reservation?.passengerId) {
      // Pas de route /admin/users/:id ; on revient à la liste pour l'instant.
      this.router.navigate(['/admin/users']);
    }
  }

  goBack(): void {
    this.router.navigate(['/admin/reservations']);
  }

  /* ═══════════════════════ ACTIONS — REFUND ══════════════════════════ */

  openRefundModal(): void {
    this.refundAmount = this.reservation?.totalPrice ?? 0;
    this.refundReason = '';
    this.showRefundModal = true;
  }

  closeRefundModal(event?: MouseEvent): void {
    if (event && (event.target as HTMLElement).classList.contains('modal-dialog')) return;
    this.showRefundModal = false;
  }

  confirmRefund(): void {
    if (!this.refundReason.trim()) {
      this.toast.error('Le motif du remboursement est obligatoire.');
      return;
    }
    if (this.refundAmount <= 0) {
      this.toast.error('Le montant doit être positif.');
      return;
    }
    this.processingRefund = true;
    this.adminService
      .refundReservation(this.reservationId, this.refundAmount, this.refundReason.trim())
      .subscribe({
        next: () => {
          this.toast.success('Remboursement effectué.');
          this.processingRefund = false;
          this.showRefundModal = false;
          this.loadReservation();
        },
        error: (err) => {
          this.processingRefund = false;
          this.toast.error(err.error?.message || 'Erreur lors du remboursement.');
        },
      });
  }

  /* ═══════════════════════ ACTIONS — STATUS CHANGE ═══════════════════ */

  openStatusModal(status: typeof this.newStatus): void {
    this.newStatus = status;
    this.statusReason = '';
    this.showStatusModal = true;
  }

  closeStatusModal(event?: MouseEvent): void {
    if (event && (event.target as HTMLElement).classList.contains('modal-dialog')) return;
    this.showStatusModal = false;
  }

  confirmStatusChange(): void {
    if (!this.newStatus) return;
    this.processingStatus = true;
    this.adminService.updateReservationStatus(this.reservationId, this.newStatus).subscribe({
      next: () => {
        this.toast.success(`Statut mis à jour : ${this.getStatusLabel(this.newStatus)}.`);
        this.processingStatus = false;
        this.showStatusModal = false;
        this.loadReservation();
      },
      error: (err) => {
        this.processingStatus = false;
        this.toast.error(err.error?.message || 'Erreur lors du changement de statut.');
      },
    });
  }

  /* ═══════════════════════ PERMISSIONS UI ════════════════════════════ */

  get canRefund(): boolean {
    return (
      this.permissionService.isSuperAdmin() ||
      this.permissionService.isFinancialAdmin?.() ||
      false
    );
  }

  get canChangeStatus(): boolean {
    return this.permissionService.isSuperAdmin();
  }
}
