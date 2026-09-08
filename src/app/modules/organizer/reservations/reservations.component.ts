import { Component, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';

import {
  BookingSource,
  ReservationVoyageResponse,
  Voyage,
} from '../../../core/models/voyage.model';
import { VoyageService } from '../../../core/services/voyage.service';
import { OrganizerSidebarComponent } from '../organizer-sidebar/organizer-sidebar.component';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-reservations',
  standalone: true,
  imports: [CommonModule, DatePipe, RouterLink, FormsModule, OrganizerSidebarComponent],
  templateUrl: './reservations.component.html',
  styleUrls: ['./reservations.component.css'],
})
export class ReservationsComponent implements OnInit {
  // ---- State -------------------------------------------------------------
  reservations: ReservationVoyageResponse[] = [];
  filteredReservations: ReservationVoyageResponse[] = [];
  voyageId = '';
  loading = true;
  actionLoading: string | null = null;

  showModal = false;
  saving = false;
  activeFilter: 'all' | 'moussefer' | 'hors-site' | 'en-attente' | 'confirmes' = 'all';

  currentDate = '';
  agencyName = 'Bonjour Tunisia Tours';

  voyages: Voyage[] = [];

  // ---- KPIs --------------------------------------------------------------
  totalReservations = 0;
  mousseferCount = 0;
  horsMousseferCount = 0;
  pendingCount = 0;
  mousseferPercent = 0;
  reservationsTrend: number | null = null;

  // ---- Manual booking form -----------------------------------------------
  newReservation = {
    fullName: '',
    phone: '',
    voyageId: '',
    seats: 1,
    source: 'telephone' as 'telephone' | 'agence' | 'direct',
    paymentStatus: 'non-paye' as 'paye' | 'non-paye',
    amount: 0,
  };

  constructor(
    private voyageService: VoyageService,
    private route: ActivatedRoute,
    private toast: ToastService,
  ) {}

  ngOnInit(): void {
    this.setCurrentDate();
    this.loadVoyages();
    this.route.queryParams.subscribe((params) => {
      this.voyageId = params['voyageId'] || '';
      this.loadReservations();
    });
  }

  private setCurrentDate(): void {
    this.currentDate = new Date().toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  }

  // =======================================================================
  //  LOAD DATA
  // =======================================================================

  loadReservations(): void {
    this.loading = true;

    if (this.voyageId) {
      this.voyageService.getVoyageReservations(this.voyageId, 0, 100).subscribe({
        next: (data) => this.onReservationsLoaded(data),
        error: (err) => {
          this.toast.error(err.error?.message || 'Erreur de chargement');
          this.loading = false;
        },
      });
    } else {
      this.voyageService.getAllOrganizerReservations(undefined, 0, 100).subscribe({
        next: (page) => this.onReservationsLoaded(page.content ?? []),
        error: (err) => {
          this.toast.error(err.error?.message || 'Erreur de chargement');
          this.loading = false;
        },
      });
    }
  }

  private onReservationsLoaded(data: ReservationVoyageResponse[]): void {
    this.reservations = data;
    this.applyFilter();
    this.computeKPIs();
    this.loading = false;
  }

  loadVoyages(): void {
    this.voyageService.getMyVoyages(0, 100).subscribe({
      next: (data) => (this.voyages = data),
      error: () => {},
    });
  }

  // =======================================================================
  //  KPIs + FILTERING
  // =======================================================================

  private computeKPIs(): void {
    this.totalReservations = this.reservations.length;
    this.mousseferCount = this.reservations.filter(
      (r) => r.bookingSource === BookingSource.PLATFORM,
    ).length;
    this.horsMousseferCount = this.totalReservations - this.mousseferCount;
    this.pendingCount = this.reservations.filter((r) => r.status === 'PENDING_ORGANIZER').length;
    this.mousseferPercent =
      this.totalReservations > 0
        ? Math.round((this.mousseferCount / this.totalReservations) * 100)
        : 0;
    this.reservationsTrend = null;
  }

  setFilter(filter: ReservationsComponent['activeFilter']): void {
    this.activeFilter = filter;
    this.applyFilter();
  }

  private applyFilter(): void {
    switch (this.activeFilter) {
      case 'moussefer':
        this.filteredReservations = this.reservations.filter(
          (r) => r.bookingSource === BookingSource.PLATFORM,
        );
        break;
      case 'hors-site':
        this.filteredReservations = this.reservations.filter(
          (r) => r.bookingSource !== BookingSource.PLATFORM,
        );
        break;
      case 'en-attente':
        this.filteredReservations = this.reservations.filter(
          (r) => r.status === 'PENDING_ORGANIZER',
        );
        break;
      case 'confirmes':
        this.filteredReservations = this.reservations.filter((r) => r.status === 'CONFIRMED');
        break;
      case 'all':
      default:
        this.filteredReservations = [...this.reservations];
    }
  }

  // =======================================================================
  //  ACCEPT / REFUSE / CANCEL
  // =======================================================================

  accept(reservationId: string): void {
    this.actionLoading = reservationId;
    this.voyageService.acceptReservation(reservationId).subscribe({
      next: () => {
        this.toast.success('Réservation acceptée');
        this.actionLoading = null;
        this.loadReservations();
      },
      error: (err) => {
        this.toast.error(err.error?.message || "Impossible d'accepter");
        this.actionLoading = null;
      },
    });
  }

  refuse(reservationId: string, reason?: string): void {
    this.actionLoading = reservationId;
    this.voyageService.refuseReservation(reservationId, reason).subscribe({
      next: () => {
        this.toast.success('Réservation refusée');
        this.actionLoading = null;
        this.loadReservations();
      },
      error: (err) => {
        this.toast.error(err.error?.message || 'Impossible de refuser');
        this.actionLoading = null;
      },
    });
  }

  /** Organizer or Passenger: cancel a voyage reservation */
  cancel(reservationId: string): void {
    if (!confirm('Êtes-vous sûr de vouloir annuler cette réservation ?')) return;
    this.actionLoading = reservationId;
    this.voyageService.cancelReservation(reservationId).subscribe({
      next: () => {
        this.toast.success('Réservation annulée');
        this.actionLoading = null;
        this.loadReservations();
      },
      error: (err) => {
        this.toast.error(err.error?.message || "Impossible d'annuler la réservation");
        this.actionLoading = null;
      },
    });
  }

  // =======================================================================
  //  DISPLAY HELPERS
  // =======================================================================

  statusLabel(s: string): string {
    const m: Record<string, string> = {
      PENDING_ORGANIZER: 'En attente',
      PENDING_PAYMENT: 'À payer',
      CONFIRMED: 'Confirmée',
      CANCELLED: 'Annulée',
    };
    return m[s] || s;
  }

  getSourceType(res: ReservationVoyageResponse): string {
    switch (res.bookingSource) {
      case BookingSource.PLATFORM:
        return 'moussefer';
      case BookingSource.PHONE:
        return 'telephone';
      case BookingSource.AGENCY:
        return 'agence';
      case BookingSource.DIRECT:
        return 'direct';
      default:
        return 'moussefer';
    }
  }

  getSourceLabel(res: ReservationVoyageResponse): string {
    const labels: Record<string, string> = {
      moussefer: 'Moussefer',
      telephone: 'Tel',
      agence: 'Agence',
      direct: 'Direct',
    };
    return labels[this.getSourceType(res)] || '—';
  }

  getPaymentStatus(res: ReservationVoyageResponse): string {
    if (res.paymentState) {
      return (
        (
          {
            PAID: 'paye',
            DEPOSIT: 'acompte',
            UNPAID: 'non-paye',
          } as Record<string, string>
        )[res.paymentState] ?? 'non-paye'
      );
    }
    if (res.status === 'CONFIRMED') return 'paye';
    if (res.status === 'PENDING_PAYMENT') return 'en-attente';
    return 'non-paye';
  }

  getPaymentStatusLabel(res: ReservationVoyageResponse): string {
    const labels: Record<string, string> = {
      paye: 'Payé',
      acompte: 'Acompte',
      'non-paye': 'Non payé',
      'en-attente': 'En attente',
    };
    return labels[this.getPaymentStatus(res)] || this.getPaymentStatus(res);
  }

  getPassengerName(res: ReservationVoyageResponse): string {
    if (res.manualBooking && res.manualPassengerName) {
      return res.manualPassengerName;
    }
    if (res.manualPassengerPhone) return res.manualPassengerPhone;
    return 'Passager #' + (res.passengerId?.slice(-4) || '????');
  }

  getVoyageDisplay(res: ReservationVoyageResponse): string {
    const found = this.voyages.find((v) => v.id === res.voyageId);
    return found?.title ?? `Voyage #${res.voyageId.slice(0, 8)}`;
  }

  // =======================================================================
  //  MANUAL BOOKING MODAL
  // =======================================================================

  openModal(): void {
    this.showModal = true;
    document.body.style.overflow = 'hidden';
    this.resetForm();
  }

  closeModal(): void {
    this.showModal = false;
    document.body.style.overflow = '';
  }

  closeModalOnOverlay(event: MouseEvent): void {
    if (event.target === event.currentTarget) this.closeModal();
  }

  private resetForm(): void {
    this.newReservation = {
      fullName: '',
      phone: '',
      voyageId: this.voyageId || '',
      seats: 1,
      source: 'telephone',
      paymentStatus: 'non-paye',
      amount: 0,
    };
  }

  private mapSourceToBackend(source: string): BookingSource {
    switch (source) {
      case 'agence':
        return BookingSource.AGENCY;
      case 'direct':
        return BookingSource.DIRECT;
      case 'telephone':
      default:
        return BookingSource.PHONE;
    }
  }

  saveReservation(): void {
    if (this.saving) return;

    const name = this.newReservation.fullName.trim();
    const phone = this.newReservation.phone.trim();

    if (!this.newReservation.voyageId) {
      this.toast.warning('Veuillez sélectionner un voyage');
      return;
    }
    if (name.length < 2) {
      this.toast.warning('Le nom du passager est requis (min. 2 caractères)');
      return;
    }
    if (!/^\+?[1-9]\d{7,14}$/.test(phone.replace(/\s+/g, ''))) {
      this.toast.warning('Numéro de téléphone invalide');
      return;
    }
    if (this.newReservation.seats < 1 || this.newReservation.seats > 20) {
      this.toast.warning('Le nombre de places doit être compris entre 1 et 20');
      return;
    }

    this.saving = true;

    const selectedVoyage = this.voyages.find((v) => v.id === this.newReservation.voyageId);
    const totalPrice = selectedVoyage
      ? selectedVoyage.pricePerSeat * this.newReservation.seats
      : this.newReservation.amount;

    const depositAmount =
      this.newReservation.paymentStatus === 'paye' && totalPrice > 0 ? totalPrice : undefined;

    this.voyageService
      .organizerManualBooking({
        voyageId: this.newReservation.voyageId,
        passengerName: name,
        passengerPhone: phone.replace(/\s+/g, ''),
        seatsReserved: this.newReservation.seats,
        bookingSource: this.mapSourceToBackend(this.newReservation.source),
        depositAmount,
      })
      .subscribe({
        next: () => {
          this.toast.success('Réservation hors-plateforme enregistrée');
          this.saving = false;
          this.closeModal();
          this.loadReservations();
        },
        error: (err) => {
          this.toast.error(err.error?.message || 'Erreur lors de la création');
          this.saving = false;
        },
      });
  }
}
