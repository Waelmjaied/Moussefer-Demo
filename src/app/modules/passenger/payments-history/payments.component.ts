import { Component, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { RouterModule } from '@angular/router';
import { PaymentService } from '../../../core/services/payment.service';
import { ReservationService, TicketResponse } from '../../../core/services/reservation.service';
import { ToastService } from '../../../core/services/toast.service';
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

  // Track per-row download state so we can disable the button while
  // the backend regenerates the PDF (it can take ~200-500ms cold).
  downloading = new Set<string>();

  // Per-row expand state. Click "Détails" on a row → fetch the ticket data
  // (route, invoice number, QR) and show it in an inline panel under the row.
  expandedReservationId: string | null = null;
  ticketCache = new Map<string, TicketResponse>();
  ticketLoading = new Set<string>();

  constructor(
    private paymentService: PaymentService,
    private reservationService: ReservationService,
    private toast: ToastService,
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
    if (this.downloading.has(reservationId)) return;
    this.downloading.add(reservationId);

    this.paymentService.downloadInvoice(reservationId).subscribe({
      next: (blob) => {
        this.downloading.delete(reservationId);

        // Guard against the "empty blob" failure mode that used to happen
        // when the backend returned a 302 redirect to an unreachable MinIO
        // URL: the browser would silently produce a 0-byte blob.
        if (!blob || blob.size === 0) {
          this.toast.error('La facture est vide ou indisponible. Réessaie dans un instant.');
          return;
        }
        // Sanity-check the MIME type — application/pdf is what we expect.
        // Non-PDF blobs usually mean the server returned an error page.
        const isPdf =
          blob.type === 'application/pdf' || blob.type === '' || blob.type.includes('pdf');
        if (!isPdf) {
          this.toast.error("Le serveur n'a pas renvoyé un PDF valide.");
          return;
        }

        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `facture-moussefer-${reservationId}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        // revokeObjectURL after a short delay so the download has time to start
        setTimeout(() => window.URL.revokeObjectURL(url), 1000);
        this.toast.success('Facture téléchargée');
      },
      error: (err) => {
        this.downloading.delete(reservationId);
        const status = err?.status;
        if (status === 401 || status === 403) {
          this.toast.error("Tu n'es pas autorisé à télécharger cette facture.");
        } else if (status === 404) {
          this.toast.error('Facture introuvable pour cette réservation.');
        } else {
          this.toast.error('Erreur lors du téléchargement. Réessaie.');
        }
      },
    });
  }

  // ─── Boarding pass (BILLET) download ──────────────────────────────────
  // Distinct from downloadInvoice() above. Two different PDFs serve two
  // different purposes:
  //   - Facture (downloadInvoice)  → TVA, commission, comptabilité
  //   - Billet (this method)       → route, QR, conditions d'embarquement
  // The right endpoint is chosen based on the reservation type.
  downloadTicket(row: PaymentRow): void {
    const reservationId = row.payment.reservationId;
    if (this.downloading.has(reservationId)) return;
    this.downloading.add(reservationId);

    // Detect voyage vs trajet. We use the cached ticket if expanded; otherwise
    // we fall back to the reservation.trajetId field (voyage reservations
    // don't have a trajetId on the reservation entity).
    const ticket = this.ticketCache.get(reservationId);
    const isVoyage =
      (ticket && (ticket as any).voyageId) || (row.reservation && !row.reservation.trajetId);

    const obs$ = isVoyage
      ? this.reservationService.downloadVoyageTicketPdf(reservationId)
      : this.reservationService.downloadTicketPdf(reservationId);
    const filenamePrefix = isVoyage ? 'billet-voyage' : 'billet-louage';

    obs$.subscribe({
      next: (blob) => {
        this.downloading.delete(reservationId);
        if (!blob || blob.size === 0) {
          this.toast.error('Le billet est indisponible. Réessaie dans un instant.');
          return;
        }
        const isPdf =
          blob.type === 'application/pdf' || blob.type === '' || blob.type.includes('pdf');
        if (!isPdf) {
          this.toast.error("Le serveur n'a pas renvoyé un PDF valide.");
          return;
        }
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${filenamePrefix}-moussefer-${reservationId}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => window.URL.revokeObjectURL(url), 1000);
        this.toast.success('Billet téléchargé');
      },
      error: (err) => {
        this.downloading.delete(reservationId);
        const s = err?.status;
        if (s === 401 || s === 403) {
          this.toast.error("Tu n'es pas autorisé à télécharger ce billet.");
        } else if (s === 404) {
          this.toast.error('Billet introuvable pour cette réservation.');
        } else {
          this.toast.error('Erreur lors du téléchargement du billet. Réessaie.');
        }
      },
    });
  }

  // ─── Details panel (row expand) ───────────────────────────────────────
  /**
   * Toggle the inline detail panel for a row. First click on a row fetches
   * the ticket data (route, invoice number, QR) and caches it; subsequent
   * toggles are instant.
   */
  toggleDetails(reservationId: string): void {
    if (this.expandedReservationId === reservationId) {
      this.expandedReservationId = null;
      return;
    }
    this.expandedReservationId = reservationId;
    if (!this.ticketCache.has(reservationId) && !this.ticketLoading.has(reservationId)) {
      this.ticketLoading.add(reservationId);
      this.reservationService.getTicket(reservationId).subscribe({
        next: (ticket) => {
          this.ticketCache.set(reservationId, ticket);
          this.ticketLoading.delete(reservationId);
        },
        error: () => {
          // Silent — the panel will render with whatever placeholders we have
          // (route from reservation, no QR/invoice number). The download
          // button still works because it goes through payment-service.
          this.ticketLoading.delete(reservationId);
        },
      });
    }
  }

  ticketFor(reservationId: string): TicketResponse | undefined {
    return this.ticketCache.get(reservationId);
  }

  qrDataUrl(b64: string | undefined): string {
    return b64 ? 'data:image/png;base64,' + b64 : '';
  }

  /**
   * Compose the human invoice number for display. Prefers the ticket-provided
   * one; falls back to deriving it from the payment id like the backend does
   * (MTN-yyyyMM-XXXXXX) so the table is never empty.
   */
  invoiceNumberFor(row: PaymentRow): string {
    const ticket = this.ticketCache.get(row.payment.reservationId);
    if (ticket?.invoiceNumber) return ticket.invoiceNumber;
    const created = row.payment.createdAt || row.payment.updatedAt;
    const yyyyMm = created ? created.substring(0, 7).replace('-', '') : '------';
    const tail = (row.payment.paymentId || '').replace(/-/g, '').substring(0, 6).toUpperCase();
    return `MTN-${yyyyMm}-${tail || 'XXXXXX'}`;
  }

  // ─── Client-side CSV export ───────────────────────────────────────────
  /**
   * Export the visible rows as a CSV file. Includes the most useful columns
   * for accounting: invoice number, reservation id, route (when available),
   * amount, status, date. Generated client-side to avoid an extra
   * payment-service endpoint just for export.
   */
  exportCsv(): void {
    if (this.rows.length === 0) {
      this.toast.info('Aucun paiement à exporter.');
      return;
    }
    const header = ['N° Facture', 'Réservation', 'Trajet', 'Montant', 'Devise', 'Statut', 'Date'];
    const lines: string[] = [header.join(',')];
    for (const row of this.rows) {
      const ticket = this.ticketCache.get(row.payment.reservationId);
      const route = ticket
        ? `${ticket.departureCity} → ${ticket.arrivalCity}`
        : row.reservation
          ? `${row.reservation.departureCity || ''} → ${row.reservation.arrivalCity || ''}`.trim()
          : '';
      const date = row.payment.createdAt || row.payment.updatedAt || '';
      const cells = [
        this.invoiceNumberFor(row),
        row.payment.reservationId,
        route,
        row.payment.amount.toFixed(2),
        row.payment.currency,
        this.statusLabel(row.payment.status),
        date.substring(0, 10),
      ].map((v) => this.csvEscape(String(v)));
      lines.push(cells.join(','));
    }
    const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `paiements-moussefer-${new Date().toISOString().substring(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => window.URL.revokeObjectURL(url), 1000);
    this.toast.success('Export CSV téléchargé');
  }

  private csvEscape(s: string): string {
    if (s == null) return '';
    // Quote only when needed; double internal quotes per RFC 4180.
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
  }
}
