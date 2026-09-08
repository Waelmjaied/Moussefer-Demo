import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AdminSidebarComponent } from '../admin-sidebar/admin-sidebar.component';
import { AdminService } from '../../../core/services/admin.service';
import { catchError } from 'rxjs/operators';
import { forkJoin, of } from 'rxjs';

interface CancellationCause {
  name: string;
  percent: number;
  color: string;
}

interface HourlyDistribution {
  hour: string;
  todayPercent: number;
  avgPercent: number;
}

interface CancellationRow {
  id: string;
  passenger: string;
  driver: string;
  scheduledTime: string;
  cancelledBy: string;
  cause: string;
  refunded: boolean;
}

@Component({
  selector: 'app-annulations',
  standalone: true,
  imports: [CommonModule, AdminSidebarComponent],
  templateUrl: './annulations.component.html',
  styleUrls: ['./annulations.component.css'],
})
export class AnnulationsComponent implements OnInit {
  currentDate = '';
  loading = true;

  // Alert
  showAlert = false;
  alertMessage = '';
  alertPercentage = 0;

  // KPIs
  todayCancellations = 0;
  cancellationIncrease = 0;
  driverCancellations = 0;
  driverPercent = 0;
  peakHour = '--:--';
  peakWindow = '--h- --h';
  impactedAmount = 0;

  // Charts
  causes: CancellationCause[] = [];
  recommendation = '';
  hourlyDistribution: HourlyDistribution[] = [];

  // Table
  cancellationRows: CancellationRow[] = [];

  constructor(private adminService: AdminService) {}

  ngOnInit(): void {
    this.setDate();
    this.loadData();
  }

  setDate(): void {
    const opts: Intl.DateTimeFormatOptions = {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    };
    this.currentDate = new Date().toLocaleDateString('fr-FR', opts);
  }

  /* ═════════════════════════════════════════════════════
     CHARGEMENT RÉEL — forkJoin sur les endpoints
     ═════════════════════════════════════════════════════ */
  loadData(): void {
    forkJoin({
      stats: this.adminService.getDashboardStats().pipe(catchError(() => of(null))),
      charts: this.adminService.getDashboardCharts(1).pipe(catchError(() => of(null))),
      cancellations: this.adminService.getAllReservations(0, 50).pipe(catchError(() => of([]))),
    }).subscribe({
      next: (results) => {
        this.mapData(results);
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      },
    });
  }

  mapData({ stats, charts, cancellations }: any): void {
    // ── Alert & KPIs ──
    if (stats) {
      this.todayCancellations = stats.todayCancellations ?? stats.cancellationsToday ?? 0;
      this.cancellationIncrease = stats.cancellationIncrease ?? stats.cancellationRate ?? 0;
      this.driverCancellations = stats.driverCancellations ?? 0;
      this.driverPercent = stats.driverPercent ?? 0;
      this.peakHour = stats.peakHour ?? '--:--';
      this.peakWindow = stats.peakWindow ?? '--h- --h';
      this.impactedAmount = stats.impactedAmount ?? stats.lostRevenue ?? 0;

      // Alert
      const alert = stats.cancellationAlert;
      if (alert) {
        this.showAlert = true;
        this.alertMessage = alert.message ?? `Pic d'annulation ${alert.route ?? 'Tunis-Sousse'}`;
        this.alertPercentage = alert.percentage ?? this.cancellationIncrease;
      } else if (this.cancellationIncrease > 20) {
        this.showAlert = true;
        this.alertMessage = `Pic d'annulation Tunis-Sousse`;
        this.alertPercentage = this.cancellationIncrease;
      }
    }

    // ── Charts ──
    if (charts) {
      this.causes = charts.cancellationCauses ?? charts.causes ?? [];
      this.recommendation = charts.recommendation ?? charts.iaRecommendation ?? '';
      this.hourlyDistribution = charts.hourlyDistribution ?? charts.hourly ?? [];
    }

    // ── Tableau ──
    const rows = Array.isArray(cancellations) ? cancellations : [];
    this.cancellationRows = rows
      .filter((r: any) => r.status === 'CANCELLED' || r.cancelled)
      .map((r: any) => ({
        id: r.reservationId ?? r.id ?? '#R0000',
        passenger: r.passengerName ?? r.passenger ?? '-',
        driver: r.driverName ?? r.driver ?? '-',
        scheduledTime: r.scheduledTime ?? r.departureTime ?? '--:--',
        cancelledBy: r.cancelledBy ?? r.cancelledByRole ?? 'Inconnu',
        cause: r.cancellationCause ?? r.cause ?? 'Non connecté',
        refunded: r.refunded ?? r.isRefunded ?? false,
      }));
  }

  dismissAlert(): void {
    this.showAlert = false;
  }

  viewAlertDetails(): void {
    console.log('Voir détails alerte');
    // TODO: router.navigate(['/admin/annulations/details']) ou modal
  }
}
