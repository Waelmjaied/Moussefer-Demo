import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { OrganizerSidebarComponent } from '../organizer-sidebar/organizer-sidebar.component';
import { VoyageService } from '../../../core/services/voyage.service';
import {
  OrganizerClientsResponse,
  OrganizerStatisticsResponse,
  TopDestination,
  WeeklyReservation,
} from '../../../core/models/voyage.model';

interface WeeklyData {
  label: string;
  confirmed: number;
  pending: number;
  confirmedPercent: number;
  pendingPercent: number;
}

interface DestinationStat {
  name: string;
  count: number;
  percent: number;
}

/**
 * "Statistiques" page.
 *
 * Backend mapping: two parallel calls,
 *  - GET /api/v1/voyages/organizer/clients     → weeklyReservations + topDestinations
 *  - GET /api/v1/voyages/organizer/statistics  → KPIs (kept for the
 *    KPI cards that may be added later — none are bound today).
 *
 * The previous implementation loaded every voyage and every reservation
 * client-side (N+1). That's redundant — the backend already computes both
 * series in a single SQL window each.
 */
@Component({
  selector: 'app-organizer-statistics',
  standalone: true,
  imports: [CommonModule, RouterLink, OrganizerSidebarComponent],
  templateUrl: './statistics.component.html',
  styleUrls: ['./statistics.component.css'],
})
export class OrganizerStatisticsComponent implements OnInit {
  loading = true;
  weeklyData: WeeklyData[] = [];
  topDestinations: DestinationStat[] = [];

  // Exposed for future KPI cards; not bound in the current template.
  statistics: OrganizerStatisticsResponse | null = null;

  currentDate = '';
  agencyName = 'Bonjour Tunisia Tours';

  constructor(private voyageService: VoyageService) {}

  ngOnInit(): void {
    this.setCurrentDate();
    this.loadStatistics();
  }

  private setCurrentDate(): void {
    this.currentDate = new Date().toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  }

  loadStatistics(): void {
    this.loading = true;
    forkJoin({
      clients: this.voyageService.getOrganizerClients().pipe(catchError(() => of(null))),
      statistics: this.voyageService.getOrganizerStatistics().pipe(catchError(() => of(null))),
    }).subscribe({
      next: ({ clients, statistics }) => {
        this.weeklyData = this.toWeeklyData(clients?.weeklyReservations ?? []);
        this.topDestinations = this.toDestinationStats(clients?.topDestinations ?? []);
        this.statistics = statistics;
        this.loading = false;
      },
      error: () => {
        this.weeklyData = [];
        this.topDestinations = [];
        this.statistics = null;
        this.loading = false;
      },
    });
  }

  /**
   * The backend returns a single `reservations` count per week. The
   * template renders two stacked bars (confirmed / pending) — we keep
   * the shape but render the whole bar as "confirmed" since the API
   * doesn't split the count. Could be expanded later if a dedicated
   * endpoint adds the breakdown.
   */
  private toWeeklyData(rows: WeeklyReservation[]): WeeklyData[] {
    if (rows.length === 0) return [];
    const max = Math.max(...rows.map((r) => r.reservations), 1);
    return rows.map((r) => ({
      label: r.weekLabel,
      confirmed: r.reservations,
      pending: 0,
      confirmedPercent: Math.round((r.reservations / max) * 100),
      pendingPercent: 0,
    }));
  }

  private toDestinationStats(rows: TopDestination[]): DestinationStat[] {
    if (rows.length === 0) return [];
    const max = Math.max(...rows.map((r) => r.seatsSold), 1);
    return rows.slice(0, 4).map((r) => ({
      name: r.destination,
      count: r.seatsSold,
      percent: Math.round((r.seatsSold / max) * 100),
    }));
  }

  viewRegionDetail(): void {
    // Hook for future deep-link to a region-level breakdown — no backend
    // endpoint yet, so this is intentionally a no-op.
  }
}
