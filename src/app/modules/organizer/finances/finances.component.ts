import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

import { OrganizerSidebarComponent } from '../organizer-sidebar/organizer-sidebar.component';
import { VoyageService } from '../../../core/services/voyage.service';
import {
  MonthlyRevenue,
  OrganizerFinancesResponse,
  RecentInvoice,
} from '../../../core/models/voyage.model';

interface MonthlyData {
  label: string;
  confirmed: number;
  potential: number;
  confirmedPercent: number;
  potentialPercent: number;
  isMax: boolean;
}

/**
 * Display shape used by the invoices list. The template binds to
 * `r.id` and `r.totalPrice` directly, so we expose those field names
 * here without modifying the template.
 */
interface InvoiceRow {
  id: string;             // = backend reservationId
  voyageId: string;
  passengerName: string;
  totalPrice: number;     // = backend amount
  status: string;
  invoiceUrl?: string;
  bookingSource: string;
  date: string;
}

/**
 * "Finances et factures" page.
 *
 * Backend mapping: single call to GET /api/v1/voyages/organizer/finances —
 * the service computes KPIs, monthly chart, and the 10 most recent
 * invoices. The old N+1 loop (list voyages, then reservations per voyage)
 * is no longer needed.
 */
@Component({
  selector: 'app-organizer-finances',
  standalone: true,
  imports: [CommonModule, OrganizerSidebarComponent, RouterLink],
  templateUrl: './finances.component.html',
  styleUrls: ['./finances.component.css'],
})
export class OrganizerFinancesComponent implements OnInit {
  loading = true;

  // ---- KPIs ------------------------------------------------------------
  totalRevenue = 0;        // = backend.paid          (Payés)
  pendingRevenue = 0;      // = backend.notCollected  (Non encaissé)
  acompteRevenue = 0;      // = backend.depositsReceived (Acomptes reçus)
  totalRevenueAll = 0;     // = backend.revenueTotal

  revenueTrend: number | null = null;

  monthlyData: MonthlyData[] = [];

  // ---- Tables ----------------------------------------------------------
  rows: InvoiceRow[] = [];            // all invoices (used by footer count)
  recentRows: InvoiceRow[] = [];      // top 5 most recent shown in card

  currentDate = '';
  agencyName = 'Bonjour Tunisia Tours';

  constructor(private voyageService: VoyageService) {}

  ngOnInit(): void {
    this.setCurrentDate();
    this.loadFinances();
  }

  private setCurrentDate(): void {
    this.currentDate = new Date().toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  }

  loadFinances(): void {
    this.loading = true;
    this.voyageService.getOrganizerFinances().subscribe({
      next: (data) => {
        this.applyFinances(data);
        this.loading = false;
      },
      error: () => {
        this.resetEmpty();
        this.loading = false;
      },
    });
  }

  private applyFinances(data: OrganizerFinancesResponse): void {
    this.totalRevenue = data.paid ?? 0;
    this.pendingRevenue = data.notCollected ?? 0;
    this.acompteRevenue = data.depositsReceived ?? 0;
    this.totalRevenueAll = data.revenueTotal ?? 0;

    this.monthlyData = this.buildMonthlyData(data.monthlyRevenue ?? []);

    const invoices = (data.recentInvoices ?? []).map(this.toInvoiceRow);
    this.rows = invoices;
    this.recentRows = invoices.slice(0, 5);
  }

  private resetEmpty(): void {
    this.totalRevenue = 0;
    this.pendingRevenue = 0;
    this.acompteRevenue = 0;
    this.totalRevenueAll = 0;
    this.monthlyData = [];
    this.rows = [];
    this.recentRows = [];
  }

  private readonly toInvoiceRow = (r: RecentInvoice): InvoiceRow => ({
    id: r.reservationId,
    voyageId: r.voyageId,
    passengerName: r.passengerName,
    totalPrice: r.amount,
    status: r.status,
    invoiceUrl: r.invoiceUrl,
    bookingSource: r.bookingSource,
    date: r.date,
  });

  /**
   * Build the bar chart from the backend's 12-month series. Only one value
   * per month is provided (the total revenue), so the visual stack always
   * renders that as "confirmed". The dual-bar structure is kept so the
   * existing template renders unchanged.
   */
  private buildMonthlyData(rows: MonthlyRevenue[]): MonthlyData[] {
    if (rows.length === 0) return [];
    const maxRevenue = Math.max(...rows.map((r) => r.revenue), 1);
    return rows.slice(-8).map((r) => {
      const percent = Math.round((r.revenue / maxRevenue) * 100);
      return {
        label: r.month,
        confirmed: r.revenue,
        potential: 0,
        confirmedPercent: percent,
        potentialPercent: 0,
        isMax: r.revenue === maxRevenue && r.revenue > 0,
      };
    });
  }

  // ---- KPI percentages ----------------------------------------------

  get paidPercent(): number {
    return this.totalRevenueAll > 0
      ? Math.round((this.totalRevenue / this.totalRevenueAll) * 100)
      : 0;
  }

  get acomptePercent(): number {
    return this.totalRevenueAll > 0
      ? Math.round((this.acompteRevenue / this.totalRevenueAll) * 100)
      : 0;
  }

  get pendingPercent(): number {
    return this.totalRevenueAll > 0
      ? Math.round((this.pendingRevenue / this.totalRevenueAll) * 100)
      : 0;
  }

  // ---- Row template helpers -----------------------------------------

  getPassengerName(r: InvoiceRow): string {
    return r.passengerName?.startsWith('manual_') ? 'Passager Moussefer' : r.passengerName || '—';
  }

  getVoyageName(r: InvoiceRow): string {
    return 'Voyage #' + r.voyageId.slice(0, 8);
  }

  getInvoiceStatus(r: InvoiceRow): string {
    return r.status === 'CONFIRMED' ? 'PAYE' : 'NON_PAYE';
  }

  getInvoiceStatusLabel(r: InvoiceRow): string {
    return (
      ({ PAYE: 'Payé', ACOMPTE: 'Acompte', NON_PAYE: 'Non payé' } as Record<string, string>)[
        this.getInvoiceStatus(r)
      ] || '—'
    );
  }

  statusLabel(s: string): string {
    return (
      ({ CONFIRMED: 'Payé', PENDING_PAYMENT: 'À payer', PENDING_ORGANIZER: 'En attente' } as Record<
        string,
        string
      >)[s] || s
    );
  }

  generateInvoice(): void {
    // Invoices are produced automatically by the voyage-service when a
    // payment is captured (cf. InvoiceService.java). No dashboard call.
  }
}
