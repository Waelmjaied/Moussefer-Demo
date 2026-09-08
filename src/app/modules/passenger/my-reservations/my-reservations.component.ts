import { Component, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { ReservationService } from '../../../core/services/reservation.service';
import { VoyageService } from '../../../core/services/voyage.service';
import { ReservationResponse } from '../../../core/models/reservation.model';
import {
  ReservationVoyageResponse,
  ReservationVoyageStatus,
} from '../../../core/models/voyage.model';
import { ToastService } from '../../../core/services/toast.service';
import { AvisModalComponent } from '../avis-modal/avis-modal.component';
import { AvisService } from '../../../core/services/avis.service';

type UnifiedStatus = 'PENDING' | 'ACCEPTED' | 'PAID' | 'PAY_PENDING' | 'REFUSED' | 'CANCELLED';

interface UnifiedRow {
  id: string;
  type: 'trajet' | 'voyage';
  status: UnifiedStatus;
  rawStatus: string;
  seatsReserved: number;
  totalPrice: number;
  createdAt: string;
  routeOrTitle: string;
  refusalReason?: string;
  navigateId: string;
  raw?: ReservationResponse;
}

@Component({
  selector: 'app-my-reservations',
  standalone: true,
  imports: [CommonModule, DatePipe, RouterLink, FormsModule, AvisModalComponent],
  templateUrl: './my-reservations.component.html',
  styleUrls: ['./my-reservations.component.css'],
})
export class MyReservationsComponent implements OnInit {
  loading = true;
  reservations: UnifiedRow[] = [];
  filtered: UnifiedRow[] = [];

  avisOpen = false;
  avisReservation: ReservationResponse | null = null;
  reviewedIds = new Set<string>();

  filterTab = 'all';

  constructor(
    private reservationService: ReservationService,
    private voyageService: VoyageService,
    private toast: ToastService,
    private router: Router,
    private avisService: AvisService,
  ) {}

  ngOnInit(): void {
    this.loadAll();
  }

  private loadAll(): void {
    this.loading = true;
    forkJoin({
      trajets: this.reservationService.getMyReservations().pipe(catchError(() => of([]))),
      voyages: this.voyageService.getMyVoyageReservations().pipe(catchError(() => of([]))),
    }).subscribe({
      next: ({ trajets, voyages }) => {
        const t = Array.isArray(trajets) ? trajets : [];
        const v = Array.isArray(voyages) ? voyages : [];
        const trajetRows = t.map((r) => this.fromTrajet(r));
        const voyageRows = v.map((r) => this.fromVoyage(r));
        this.reservations = [...trajetRows, ...voyageRows].sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        );
        this.loading = false;
        this.applyFilter();
        this.hydrateReviewedFlags();
      },
      error: () => {
        this.loading = false;
      },
    });
  }

  applyFilter(): void {
    let result = Array.isArray(this.reservations) ? [...this.reservations] : [];
    switch (this.filterTab) {
      case 'upcoming':
        result = result.filter((r) => r.status === 'ACCEPTED' || r.status === 'PENDING');
        break;
      case 'pending':
        result = result.filter((r) => r.status === 'PENDING' || r.status === 'PAY_PENDING');
        break;
      case 'completed':
        result = result.filter((r) => r.status === 'PAID');
        break;
      case 'cancelled':
        result = result.filter((r) => r.status === 'CANCELLED' || r.status === 'REFUSED');
        break;
      default:
        break;
    }
    this.filtered = result;
  }

  private fromTrajet(r: ReservationResponse): UnifiedRow {
    return {
      id: r.id,
      type: 'trajet',
      status: this.mapTrajetStatus(r.status),
      rawStatus: r.status,
      seatsReserved: r.seatsReserved,
      totalPrice: r.totalPrice,
      createdAt: r.createdAt,
      routeOrTitle:
        r.departureCity && r.arrivalCity
          ? `${r.departureCity} → ${r.arrivalCity}`
          : `Trajet #${r.trajetId.slice(0, 6)}`,
      refusalReason: r.refusalReason,
      navigateId: r.trajetId,
      raw: r,
    };
  }

  private fromVoyage(r: ReservationVoyageResponse): UnifiedRow {
    return {
      id: r.id,
      type: 'voyage',
      status: this.mapVoyageStatus(r.status),
      rawStatus: r.status,
      seatsReserved: r.seatsReserved,
      totalPrice: r.totalPrice,
      createdAt: r.createdAt,
      routeOrTitle: `Voyage #${r.voyageId.slice(0, 6)}`,
      navigateId: r.voyageId,
    };
  }

  private mapTrajetStatus(s: string): UnifiedStatus {
    switch (s) {
      case 'PENDING_DRIVER':
        return 'PENDING';
      case 'ACCEPTED':
        return 'ACCEPTED';
      case 'CONFIRMED':
        return 'PAID';
      case 'PAYMENT_PENDING':
        return 'PAY_PENDING';
      case 'REFUSED':
      case 'ESCALATED':
        return 'REFUSED';
      case 'CANCELLED':
        return 'CANCELLED';
      default:
        return 'PENDING';
    }
  }

  private mapVoyageStatus(s: ReservationVoyageStatus): UnifiedStatus {
    switch (s) {
      case 'PENDING_ORGANIZER':
        return 'PENDING';
      case 'PENDING_PAYMENT':
        return 'ACCEPTED';
      case 'CONFIRMED':
        return 'PAID';
      case 'CANCELLED':
        return 'CANCELLED';
      default:
        return 'PENDING';
    }
  }

  setFilterTab(tab: string): void {
    this.filterTab = tab;
    this.applyFilter();
  }

  statusLabel(s: UnifiedStatus | string): string {
    return (
      (
        {
          PENDING: 'En attente',
          ACCEPTED: 'Accepté',
          PAID: 'Payé',
          PAY_PENDING: 'Paiement att.',
          REFUSED: 'Refusé',
          CANCELLED: 'Annulé',
        } as Record<string, string>
      )[s] || s
    );
  }

  statusClass(s: UnifiedStatus | string): string {
    return (
      (
        {
          PENDING: 's-pending',
          ACCEPTED: 's-accepted',
          PAID: 's-confirmed',
          PAY_PENDING: 's-pending',
          REFUSED: 's-refused',
          CANCELLED: 's-cancelled',
        } as Record<string, string>
      )[s] || ''
    );
  }

  cancelReservation(id: string): void {
    const row = this.reservations.find((r) => r.id === id);
    if (!row) return;
    if (!confirm('Annuler cette réservation ?')) return;

    if (row.type === 'voyage') {
      this.toast.info("Pour annuler un voyage, contactez l'organisateur via Messages.");
      return;
    }

    this.reservationService.cancelReservation(row.id).subscribe({
      next: () => {
        this.toast.success('Réservation annulée');
        this.loadAll();
      },
      error: (e) => this.toast.error(e.error?.message || 'Erreur'),
    });
  }

  goToPay(row: UnifiedRow): void {
    this.router.navigate(['/passenger/reservation', row.navigateId], {
      queryParams: { type: row.type, step: 'pay', reservationId: row.id },
    });
  }

  openMessage(_: UnifiedRow): void {
    this.router.navigate(['/passenger/messages']);
  }

  openAvis(row: UnifiedRow): void {
    if (row.type !== 'trajet' || !row.raw) {
      this.toast.error('Les avis sur voyages organisés ne sont pas encore disponibles');
      return;
    }
    if (this.reviewedIds.has(row.id)) {
      this.toast.info('Tu as déjà laissé un avis pour ce trajet');
      return;
    }
    this.avisReservation = row.raw;
    this.avisOpen = true;
  }

  onAvisClosed(): void {
    this.avisOpen = false;
    this.avisReservation = null;
  }

  onAvisSubmitted(): void {
    if (this.avisReservation) {
      this.reviewedIds.add(this.avisReservation.id);
    }
    this.toast.success('Merci pour ton avis !');
    this.avisOpen = false;
    this.avisReservation = null;
  }

  private hydrateReviewedFlags(): void {
    const paidTrajets = this.reservations.filter((r) => r.type === 'trajet' && r.status === 'PAID');
    paidTrajets.forEach((row) => {
      this.avisService
        .getAvisForReservation(row.id)
        .pipe(catchError(() => of(null)))
        .subscribe((a) => {
          if (a && (a as any).id) {
            this.reviewedIds.add(row.id);
          }
        });
    });
  }
}
