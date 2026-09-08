import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  DisputeService,
  Dispute,
  DisputeCategory,
  DisputeStatus,
} from '../../../core/services/dispute.service';
import { ReservationService } from '../../../core/services/reservation.service';
import { ToastService } from '../../../core/services/toast.service';
import { extractErrorMessage } from '../../../core/utils/error.utils';

/**
 * UI-side category options. The values map 1:1 onto the backend
 * canonical {@code DisputeCategory} enum (PAYMENT, BEHAVIOR,
 * NO_SHOW, VEHICLE_CONDITION, OTHER).
 */
const CATEGORY_MAP: Record<string, DisputeCategory> = {
  DRIVER_NO_SHOW: 'NO_SHOW',
  PAYMENT_ISSUE: 'PAYMENT',
  VEHICLE_CONDITION: 'VEHICLE_CONDITION',
  SAFETY_CONCERN: 'BEHAVIOR',
  OVERCHARGE: 'PAYMENT',
  OTHER: 'OTHER',
};

/** Statuts considérés "actifs" côté passager. */
const ACTIVE_STATUSES: DisputeStatus[] = ['OPEN', 'IN_PROGRESS'];

/** Statuts considérés "terminés" (clôturés d'une façon ou d'une autre). */
const TERMINAL_STATUSES: DisputeStatus[] = ['RESOLVED', 'REJECTED', 'CLOSED'];

@Component({
  selector: 'app-disputes',
  standalone: true,
  imports: [CommonModule, DatePipe, FormsModule],
  templateUrl: './disputes.component.html',
  styleUrls: ['./disputes.component.css'],
})
export class DisputesComponent implements OnInit {
  disputes: Dispute[] = [];
  loading = true;
  submitting = false;
  showForm = signal(false);

  newReservationId = '';
  newReason = '';
  newDescription = '';

  // ▶︎ F3 — counts now include IN_PROGRESS and REJECTED, aligned
  //    with the actual backend enum (W1).
  readonly openCount = computed(
    () => this.disputes.filter((d) => ACTIVE_STATUSES.includes(d.status)).length,
  );
  readonly resolvedCount = computed(
    () => this.disputes.filter((d) => TERMINAL_STATUSES.includes(d.status)).length,
  );

  constructor(
    private disputeService: DisputeService,
    private reservationService: ReservationService,
    private toast: ToastService,
  ) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading = true;
    this.disputeService.getMyDisputes().subscribe({
      next: (d) => {
        this.disputes = d;
        this.loading = false;
      },
      error: () => (this.loading = false),
    });
  }

  toggleForm(): void {
    this.showForm.update((v) => !v);
    if (!this.showForm()) {
      this.newReservationId = '';
      this.newReason = '';
      this.newDescription = '';
    }
  }

  /**
   * Two-step submit:
   *   1. Fetch the reservation to discover the other party.
   *      Le passager rapporte TOUJOURS le chauffeur (driverId), donc
   *      reportedUserId = reservation.driverId — la coherence est
   *      désormais validée côté backend (DisputeService.createDispute).
   *   2. Open the dispute via JSON body (la signature du service a
   *      basculé sur application/json — voir DisputeService).
   */
  submit(): void {
    if (!this.newReservationId || !this.newReason) {
      this.toast.warning('ID réservation et motif requis');
      return;
    }
    if (!this.newDescription || this.newDescription.trim().length < 10) {
      this.toast.warning('Description requise (≥ 10 caractères)');
      return;
    }
    this.submitting = true;

    this.reservationService.getReservationById(this.newReservationId).subscribe({
      next: (reservation) => {
        const reportedUserId = reservation.driverId;
        if (!reportedUserId) {
          this.toast.error('Réservation incomplète — chauffeur introuvable');
          this.submitting = false;
          return;
        }
        const category: DisputeCategory = CATEGORY_MAP[this.newReason] ?? 'OTHER';

        this.disputeService
          .openDispute(this.newReservationId, category, this.newDescription.trim(), reportedUserId)
          .subscribe({
            next: () => {
              this.showForm.set(false);
              this.newReservationId = '';
              this.newReason = '';
              this.newDescription = '';
              this.toast.success('Litige ouvert — notre équipe vous contactera sous 48h');
              this.submitting = false;
              this.load();
            },
            error: (err) => {
              this.toast.error(extractErrorMessage(err, 'Erreur ouverture litige'));
              this.submitting = false;
            },
          });
      },
      error: (err) => {
        this.toast.error(
          err.status === 404
            ? "Réservation introuvable. Vérifiez l'ID."
            : extractErrorMessage(err, 'Erreur — réservation inaccessible'),
        );
        this.submitting = false;
      },
    });
  }

  // ════════════════════════════════════════════════════════════════
  //  Template helpers (added with W1 — backend enum alignment)
  // ════════════════════════════════════════════════════════════════

  /** French label for a status. */
  statusLabel(s: DisputeStatus): string {
    const map: Record<DisputeStatus, string> = {
      OPEN: 'Ouvert',
      IN_PROGRESS: 'En cours',
      RESOLVED: 'Résolu',
      REJECTED: 'Rejeté',
      CLOSED: 'Clôturé',
    };
    return map[s] ?? s;
  }

  /** French label for a category. */
  categoryLabel(c: string): string {
    const map: Record<string, string> = {
      PAYMENT: 'Paiement',
      BEHAVIOR: 'Comportement',
      NO_SHOW: 'Absence',
      VEHICLE_CONDITION: 'État du véhicule',
      OTHER: 'Autre',
    };
    return map[c] ?? c;
  }

  /** True if the dispute is still being worked on. */
  isActive(d: Dispute): boolean {
    return ACTIVE_STATUSES.includes(d.status);
  }

  /** True if the dispute has reached a terminal state. */
  isDone(d: Dispute): boolean {
    return TERMINAL_STATUSES.includes(d.status);
  }
}
