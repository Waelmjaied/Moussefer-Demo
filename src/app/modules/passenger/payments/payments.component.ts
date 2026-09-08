import { Component, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { RouterModule } from '@angular/router';
import { PaymentService } from '../../../core/services/payment.service';
import { ReservationService } from '../../../core/services/reservation.service';
import { PaymentResponse } from '../../../core/models/payment.model';
import { ReservationResponse } from '../../../core/models/reservation.model';
import { Page } from '../../../core/models/page.model';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

interface PaymentRow {
  payment: PaymentResponse;
  reservation?: ReservationResponse;
}

@Component({
  selector: 'app-passenger-payments',
  standalone: true,
  imports: [CommonModule, DatePipe, RouterModule],
  templateUrl: './payments.component.html',
  styleUrls: ['./payments.component.css'],
})
export class PassengerPaymentsComponent implements OnInit {
  loading = true;
  rows: PaymentRow[] = [];
  totalPaid = 0;

  // Pagination
  page = 0;
  size = 10;
  totalElements = 0;
  totalPages = 0;

  constructor(
    private paymentService: PaymentService,
    private reservationService: ReservationService,
  ) {}

  ngOnInit(): void {
    this.loadPayments();
  }

  loadPayments(): void {
    this.loading = true;

    forkJoin({
      reservations: this.reservationService.getMyReservations().pipe(catchError(() => of([]))),
      paymentsPage: this.paymentService.getMyPayments(this.page, this.size).pipe(
        catchError(() =>
          of({
            content: [],
            totalElements: 0,
            totalPages: 0,
            size: 10,
            number: 0,
            first: true,
            last: true,
          } as Page<PaymentResponse>),
        ),
      ),
    }).subscribe({
      next: ({ reservations, paymentsPage }) => {
        const resMap = new Map(reservations.map((r: ReservationResponse) => [r.id, r]));

        this.rows = paymentsPage.content.map((p: PaymentResponse) => ({
          payment: p,
          reservation: resMap.get(p.reservationId),
        }));

        this.totalElements = paymentsPage.totalElements;
        this.totalPages = paymentsPage.totalPages;
        this.page = paymentsPage.number;

        this.totalPaid = this.rows
          .filter((r) => ['SUCCEEDED', 'CONFIRMED'].includes(r.payment.status))
          .reduce((sum, r) => sum + r.payment.amount, 0);

        this.loading = false;
      },
      error: () => (this.loading = false),
    });
  }

  get pages(): number[] {
    return Array.from({ length: this.totalPages }, (_, i) => i);
  }

  changePage(newPage: number): void {
    if (newPage >= 0 && newPage < this.totalPages) {
      this.page = newPage;
      this.loadPayments();
    }
  }

  statusLabel(s: string): string {
    const map: Record<string, string> = {
      SUCCEEDED: 'Payé',
      CONFIRMED: 'Payé',
      PENDING: 'En attente',
      PAYMENT_PENDING: 'En attente',
      CANCELLED: 'Annulé',
      FAILED: 'Échoué',
      REFUNDED: 'Remboursé',
      REQUIRES_ACTION: 'Authentification requise',
    };
    return map[s] || s;
  }

  statusClass(s: string): string {
    if (['SUCCEEDED', 'CONFIRMED'].includes(s)) return 's-active';
    if (['PENDING', 'PAYMENT_PENDING', 'REQUIRES_ACTION'].includes(s)) return 's-pending';
    if (s === 'REFUNDED') return 's-pending';
    return 's-cancelled';
  }

  statusIcon(s: string): string {
    if (['SUCCEEDED', 'CONFIRMED'].includes(s)) return 'bi-check-circle-fill';
    if (['PENDING', 'PAYMENT_PENDING'].includes(s)) return 'bi-hourglass-split';
    if (s === 'REFUNDED') return 'bi-arrow-counterclockwise';
    return 'bi-x-circle-fill';
  }

  downloadInvoice(reservationId: string): void {
    this.paymentService.downloadInvoice(reservationId).subscribe((blob) => {
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `facture-${reservationId}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    });
  }
}
