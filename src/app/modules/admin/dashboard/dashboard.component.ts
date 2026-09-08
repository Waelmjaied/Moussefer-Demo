import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { AdminSidebarComponent } from '../admin-sidebar/admin-sidebar.component';
import { AdminService } from '../../../core/services/admin.service';
import { AuthService } from '../../../core/services/auth.service';

/* ═════════════════════════════════════════════════════
   INTERFACES
   ═════════════════════════════════════════════════════ */
interface TripPerDestination {
  destination: string;
  count: number;
  percentage: number;
  color: string;
}

interface DailyFee {
  date: string;
  value: number;
  percent: number;
}

interface ReservationDay {
  label: string;
  value: number;
  percent: number;
  highlight?: boolean;
}

interface ActivityLog {
  action: string;
  user: string;
  details: string;
  type?: string;
}

// ▶︎ NOUVEAU : interface pour les litiges dans le dashboard
interface MiniLitige {
  id: string;
  priority: string;
  title: string;
  timeAgo: string;
  description: string;
  route: string;
}

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink, AdminSidebarComponent],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css'],
})
export class DashboardComponent implements OnInit {
  loading = true;
  currentDate = '';
  monthName = '';

  /* ═════════════════════════════════════════════════════
     KPIs — tout initialisé à 0
     ═════════════════════════════════════════════════════ */
  todayReservations = 0;
  yesterdayReservations = 0;
  todayRevenue = 0;
  yesterdayRevenue = 0;
  activeLouages = 0;
  newSignups = 0;
  satisfactionScore = 0;
  satisfactionTotalReviews = 0;

  totalFeesMonth = 0;
  dailyFees: DailyFee[] = [];
  tripsByDestination: TripPerDestination[] = [];
  donutSegments: any[] = [];
  totalTrips = 0;

  reservationsPerDay: ReservationDay[] = [];
  fillRate = 0;
  soldVsAvailable = 0;
  revenuePerKm = 0;
  totalKm = 0;
  activeDays = 0;
  totalDaysThisMonth = 30;
  commissionRate = 0;
  commissionAmount = 0;
  activeStations = 0;

  recentActivities: ActivityLog[] = [];

  // ▶︎ NOUVEAU : propriétés litiges
  pendingLitiges = 0;
  recentLitiges: MiniLitige[] = [];
  litigeAlertText = 'Aucun litige signalé';

  constructor(
    private adminService: AdminService,
    private authService: AuthService,
    private router: Router, // ▶︎ NOUVEAU
  ) {}

  ngOnInit(): void {
    this.setDate();
    this.loadDashboard();
  }

  setDate(): void {
    const now = new Date();
    const opts: Intl.DateTimeFormatOptions = {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    };
    this.currentDate = now.toLocaleDateString('fr-FR', opts);
    this.monthName = now.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
    this.totalDaysThisMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  }

  /* ═════════════════════════════════════════════════════
     CHARGEMENT — forkJoin sur 6 endpoints (litiges ajouté)
     ═════════════════════════════════════════════════════ */
  loadDashboard(): void {
    forkJoin({
      stats: this.adminService.getDashboardStats().pipe(catchError(() => of(null))),
      charts: this.adminService.getDashboardCharts(6).pipe(catchError(() => of(null))),
      activity: this.adminService.getRecentActivity(10).pipe(catchError(() => of(null))),
      resStats: this.adminService.getReservationsStats().pipe(catchError(() => of(null))),
      userStats: this.adminService.getUsersStats().pipe(catchError(() => of(null))),
      litiges: this.adminService.getLitiges('OPEN').pipe(catchError(() => of([]))), // ▶︎ NOUVEAU
    }).subscribe({
      next: (results) => {
        this.mapRealData(results);
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      },
    });
  }

  /* ═════════════════════════════════════════════════════
     MAPPING — données réelles
     ═════════════════════════════════════════════════════ */
  mapRealData({ stats, charts, activity, resStats, userStats, litiges }: any): void {
    // ── 1. KPI Cards ──
    if (stats) {
      this.todayReservations =
        stats.todayReservations ?? stats.reservationsToday ?? stats.reservations ?? 0;
      this.yesterdayReservations = stats.yesterdayReservations ?? stats.yesterdayTotal ?? 0;
      this.todayRevenue = stats.todayRevenue ?? stats.revenue ?? stats.totalRevenue ?? 0;
      this.yesterdayRevenue = stats.yesterdayRevenue ?? stats.yesterdayRevenueTotal ?? 0;
      this.activeLouages =
        stats.activeLouages ?? stats.activeTrips ?? stats.totalDrivers ?? stats.drivers ?? 0;
      this.satisfactionScore = stats.satisfactionScore ?? stats.avgRating ?? 0;
      this.satisfactionTotalReviews =
        stats.satisfactionTotalReviews ?? stats.totalReservations ?? 0;
      this.totalFeesMonth = stats.totalFeesMonth ?? stats.totalRevenue ?? 0;
    }

    if (userStats) {
      this.newSignups = userStats.newUsers ?? userStats.newUsersToday ?? userStats.newSignups ?? 0;
    }

    // ── 2. Charts ──
    if (charts) {
      if (charts.dailyFees || charts.fees) {
        this.dailyFees = charts.dailyFees ?? charts.fees ?? [];
      }
      if (charts.tripsByDestination || charts.destinations) {
        this.tripsByDestination = charts.tripsByDestination ?? charts.destinations ?? [];
      }
      if (charts.reservationsPerDay || charts.reservationsByDay || charts.byDay) {
        this.reservationsPerDay =
          charts.reservationsPerDay ?? charts.reservationsByDay ?? charts.byDay ?? [];
      }
    }

    // ── 3. Analyse opérationnelle ──
    const ops = stats ?? resStats;
    if (ops) {
      this.fillRate = ops.fillRate ?? ops.occupancyRate ?? 0;
      this.revenuePerKm = ops.revenuePerKm ?? 0;
      this.totalKm = ops.totalKm ?? ops.kmTraveled ?? 0;
      this.activeDays = ops.activeDays ?? 0;
      this.commissionRate = ops.commissionRate ?? 0;
      this.commissionAmount =
        ops.commissionAmount ?? (this.todayRevenue * this.commissionRate) / 100;
      this.activeStations = ops.activeStations ?? ops.stations ?? 0;
    }

    // ── 4. Journal d'activité ──
    if (activity) {
      const acts = Array.isArray(activity)
        ? activity
        : (activity.recentActivities ?? activity.activities ?? []);
      this.recentActivities = acts;
    }

    // ── 5. Recalcul donut ──
    if (this.tripsByDestination.length) {
      this.totalTrips = this.tripsByDestination.reduce((s, d) => s + d.count, 0);
      this.computeDonut();
    } else {
      this.totalTrips = 0;
      this.donutSegments = [];
    }

    // ▶︎ NOUVEAU : 6. Litiges
    this.mapLitiges(litiges);
  }

  // ▶︎ NOUVEAU : mapping des litiges
  private mapLitiges(data: any[]): void {
    if (!Array.isArray(data)) {
      this.pendingLitiges = 0;
      this.recentLitiges = [];
      return;
    }

    this.pendingLitiges = data.length;

    // Texte d'alerte dynamique
    if (data.length > 0) {
      const firstRoute = data[0]?.route ?? data[0]?.itineraire ?? '';
      this.litigeAlertText = firstRoute
        ? `des passagers signalent des problèmes sur ${firstRoute}. Intervention requise.`
        : 'des passagers signalent des problèmes. Intervention requise.';
    } else {
      this.litigeAlertText = '';
    }

    // 3 derniers pour le widget
    this.recentLitiges = data.slice(0, 3).map((item: any) => ({
      id: item.id ?? item.litigeId ?? item.disputeId ?? '#',
      priority: item.priority ?? item.urgency ?? 'OUVERT',
      title: item.title ?? item.subject ?? item.category ?? 'Litige',
      timeAgo: item.timeAgo ?? item.createdAt ?? '',
      description: item.description ?? '',
      route: item.route ?? item.itineraire ?? '',
    }));
  }

  // ▶︎ NOUVEAU : navigation vers la page litige
  goToLitige(id: string): void {
    this.router.navigate(['/admin/litige'], {
      queryParams: { highlight: id },
    });
  }

  computeDonut(): void {
    const total = this.tripsByDestination.reduce((s, d) => s + d.percentage, 0);
    let accumulated = 0;
    this.donutSegments = this.tripsByDestination.map((dest) => {
      const dashArray = `${dest.percentage} ${100 - dest.percentage}`;
      const dashOffset = -accumulated;
      accumulated += dest.percentage;
      return {
        color: dest.color,
        dashArray,
        dashOffset,
        path: 'M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831',
      };
    });
  }

  getChangePercentage(current: number, previous: number): number {
    return previous > 0 ? Math.round(((current - previous) / previous) * 100) : 0;
  }
}
