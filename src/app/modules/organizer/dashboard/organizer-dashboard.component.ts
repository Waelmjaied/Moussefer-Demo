import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { VoyageService } from '../../../core/services/voyage.service';
import { OrganizerSidebarComponent } from '../organizer-sidebar/organizer-sidebar.component';
import {
  MonthlyRevenue,
  OrganizerFinancesResponse,
  OrganizerOverviewResponse,
  OrganizerStatisticsResponse,
} from '../../../core/models/voyage.model';

/**
 * Shape consumed directly by the dashboard HTML. The backend's overview
 * payload uses field names tuned to its domain model — this interface
 * adapts them to the names already bound in the template, plus a few
 * derived counts that the API doesn't expose yet (pendingReservations,
 * fullVoyages, ratings…). Missing values default to 0 so the existing
 * template renders without modification.
 */
interface DashboardOverview {
  dateLabel: string;
  agencyName: string;

  totalReservations: number;
  confirmedReservations: number;
  pendingReservations: number;
  reservationsTrend: number | null;

  totalVoyages: number;
  activeVoyages: number;
  fullVoyages: number;
  ongoingVoyages: number;

  monthRevenue: number;
  revenueTrend: number | null;

  averageRating: number;
  totalReviews: number;
}

/**
 * "Vue d'ensemble" — main dashboard landing page.
 *
 * Backend mapping (3 parallel calls, all degrade gracefully):
 *  - GET /api/v1/voyages/organizer/overview     → totals, KPIs
 *  - GET /api/v1/voyages/organizer/finances     → monthly chart, paid breakdown
 *  - GET /api/v1/voyages/organizer/statistics   → booking source split, refusals
 *
 * `pendingReservations` is computed by issuing one extra call to the
 * /organizer/reservations endpoint (no dedicated counter today). If you
 * later add a `pendingThisMonth` field to the overview payload, drop the
 * extra call.
 */
@Component({
  selector: 'app-organizer-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink, OrganizerSidebarComponent],
  templateUrl: './organizer-dashboard.component.html',
  styleUrls: ['./organizer-dashboard.component.css'],
})
export class OrganizerDashboardComponent implements OnInit {
  overview: DashboardOverview | null = null;
  finances: OrganizerFinancesResponse | null = null;
  statistics: OrganizerStatisticsResponse | null = null;
  loading = true;
  error = false;

  revenueChartData: { label: string; current: number; previous: number }[] = [];
  fillRateVoyages: { name: string; reserved: number; total: number; percent: number }[] = [];
  sourceBreakdown: { name: string; count: number; percent: number }[] = [];

  constructor(private voyageService: VoyageService) {}

  ngOnInit(): void {
    this.loadDashboardData();
  }

  loadDashboardData(): void {
    this.loading = true;
    this.error = false;

    forkJoin({
      overview: this.voyageService.getOrganizerOverview().pipe(catchError(() => of(null))),
      finances: this.voyageService.getOrganizerFinances().pipe(catchError(() => of(null))),
      statistics: this.voyageService.getOrganizerStatistics().pipe(catchError(() => of(null))),
      pending: this.voyageService
        .getAllOrganizerReservations()
        .pipe(catchError(() => of(null))),
    }).subscribe({
      next: ({ overview, finances, statistics, pending }) => {
        const pendingCount =
          pending?.content?.filter((r) => r.status === 'PENDING_ORGANIZER').length ?? 0;

        this.overview = this.toDashboardOverview(overview, statistics, pendingCount);
        this.finances = finances;
        this.statistics = statistics;

        this.prepareRevenueChart(finances?.monthlyRevenue ?? []);
        this.prepareSourceBreakdown(statistics?.bookingsBySource ?? {});

        this.loading = false;
      },
      error: () => {
        this.loading = false;
        this.error = true;
      },
    });
  }

  /** Adapt the backend overview payload to the shape the template binds to. */
  private toDashboardOverview(
    raw: OrganizerOverviewResponse | null,
    stats: OrganizerStatisticsResponse | null,
    pendingCount: number,
  ): DashboardOverview {
    return {
      dateLabel: new Date().toLocaleDateString('fr-FR', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      }),
      agencyName: 'Bonjour Tunisia Tours',
      totalReservations: stats?.totalReservationsThisYear ?? 0,
      confirmedReservations:
        raw?.confirmedReservationsThisMonth ?? stats?.confirmed ?? 0,
      pendingReservations: pendingCount,
      reservationsTrend: null,
      totalVoyages: raw?.totalVoyages ?? 0,
      activeVoyages: raw?.activeVoyages ?? 0,
      fullVoyages: 0,           // not exposed by the API today
      ongoingVoyages: 0,        // not exposed by the API today
      monthRevenue: raw?.revenueThisMonth ?? 0,
      revenueTrend: null,
      averageRating: 0,         // avis-service — not wired in this scope
      totalReviews: 0,
    };
  }

  private prepareRevenueChart(monthlyData: MonthlyRevenue[]): void {
    if (!monthlyData.length) {
      this.revenueChartData = [];
      return;
    }
    // Map the most recent 7 months. We don't have a year-over-year comparison
    // available, so "previous" is set to the prior month for a directional cue.
    const recent = monthlyData.slice(-7);
    this.revenueChartData = recent.map((m, i) => ({
      label: m.month,
      current: m.revenue,
      previous: i > 0 ? recent[i - 1].revenue : 0,
    }));
  }

  private prepareSourceBreakdown(bookingsBySource: Record<string, number>): void {
    const total = Object.values(bookingsBySource).reduce((a, b) => a + b, 0);
    if (total === 0) {
      this.sourceBreakdown = [];
      return;
    }

    const labels: Record<string, string> = {
      PLATFORM: 'Via Moussefer',
      PHONE: 'Via téléphone',
      AGENCY: 'Agence physique',
      DIRECT: 'Direct',
    };

    this.sourceBreakdown = Object.entries(bookingsBySource)
      .map(([key, count]) => ({
        name: labels[key] || key,
        count,
        percent: Math.round((count / total) * 100),
      }))
      .sort((a, b) => b.count - a.count);
  }

  get pendingReservationsCount(): number {
    return this.overview?.pendingReservations ?? 0;
  }
}
