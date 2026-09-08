import { Component, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { DriverSidebarComponent } from '../driver-sidebar/driver-sidebar.component';
import { TrajetService } from '../../../core/services/trajet.service';
import { Trajet } from '../../../core/models/trajet.model';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-driver-revenues',
  standalone: true,
  imports: [CommonModule, DatePipe, FormsModule, RouterModule, DriverSidebarComponent],
  templateUrl: './revenues.component.html',
  styleUrls: ['./revenues.component.css'],
})
export class DriverRevenuesComponent implements OnInit {
  loading = true;
  today = new Date();

  // ── Real computed values ──
  stats: any = null;
  revenueThisMonth = 0;
  totalRevenue = 0;
  avgPerTrip = 0;
  total2025 = 0;
  prevRevenue = 0;
  prevTrajets = 0;
  prevPassengers = 0;
  fillRate = 0;
  revPerKm = 0;
  activeDays = 0;
  txFilter = 'all';

  chartBars: any[] = [];
  revenueByRoute: any[] = [];
  revenueByDay: any[] = [];
  perfIndicators: any[] = [];
  monthlySummary: any[] = [];
  transactions: any[] = [];

  constructor(
    private trajetService: TrajetService,
    private authService: AuthService,
  ) {}

  ngOnInit(): void {
    this.trajetService.getMyTrajets().subscribe({
      next: (data) => {
        const departed = data.filter((t) => t.status === 'DEPARTED');
        this.computeStats(departed);
        this.computeChartBars(departed, 14); // last 14 days
        this.computeRevenueByRoute(departed);
        this.computeRevenueByDay(departed);
        this.computePerfIndicators(departed);
        this.computeMonthlySummary(departed);
        this.computeTransactions(departed);
        this.loading = false;
      },
      error: () => (this.loading = false),
    });
  }

  // ── Helper to count passengers and revenue per trajet ──
  private passengers(t: Trajet): number {
    return t.totalSeats - t.availableSeats;
  }
  private revenue(t: Trajet): number {
    return this.passengers(t) * t.pricePerSeat;
  }

  // ── Main aggregated stats ──
  private computeStats(trajets: Trajet[]): void {
    const now = new Date();
    const thisMonth = trajets.filter(
      (t) =>
        new Date(t.departureDate).getMonth() === now.getMonth() &&
        new Date(t.departureDate).getFullYear() === now.getFullYear(),
    );

    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevMonthTrajets = trajets.filter((t) => {
      const d = new Date(t.departureDate);
      return d >= lastMonth && d < new Date(now.getFullYear(), now.getMonth(), 1);
    });

    // Totals
    this.revenueThisMonth = thisMonth.reduce((s, t) => s + this.revenue(t), 0);
    this.totalRevenue = trajets.reduce((s, t) => s + this.revenue(t), 0);
    this.avgPerTrip = trajets.length ? Math.round(this.totalRevenue / trajets.length) : 0;

    // Year 2025
    this.total2025 = trajets
      .filter((t) => new Date(t.departureDate).getFullYear() === 2025)
      .reduce((s, t) => s + this.revenue(t), 0);

    // Previous period comparison (for the green/red arrow)
    this.prevRevenue = prevMonthTrajets.reduce((s, t) => s + this.revenue(t), 0);
    this.prevTrajets = prevMonthTrajets.length;
    this.prevPassengers = prevMonthTrajets.reduce((s, t) => s + this.passengers(t), 0);

    // Fill rate (overall)
    const totalSeats = trajets.reduce((s, t) => s + t.totalSeats, 0);
    const usedSeats = trajets.reduce((s, t) => s + this.passengers(t), 0);
    this.fillRate = totalSeats ? Math.round((usedSeats / totalSeats) * 100) : 0;

    // Active days this month
    const uniqueDays = new Set(thisMonth.map((t) => new Date(t.departureDate).toDateString()));
    this.activeDays = uniqueDays.size;
  }

  // ── Chart bars (last N days) ──
  private computeChartBars(trajets: Trajet[], days: number): void {
    interface DayData { revenue: number; label: string; highlight: boolean; pct: number; }
    const today = new Date();
    const dayArray: DayData[] = [];


    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().substring(0, 10);
      const dayTrajets = trajets.filter((t) => t.departureDate.substring(0, 10) === dateStr);
      const dayRev = dayTrajets.reduce((s, t) => s + this.revenue(t), 0);
      const highlight = i === 0; // today highlighted
      dayArray.push({
        pct: 0, // will compute relative to max
        revenue: dayRev,
        label: d.toLocaleDateString('fr-FR', { weekday: 'short' }),
        highlight,
      });
    }

    const maxRev = Math.max(...dayArray.map((d) => d.revenue), 1);
    this.chartBars = dayArray.map((d) => ({
      ...d,
      pct: Math.round((d.revenue / maxRev) * 100),
    }));
  }

  // ── Revenue by route ──
  private computeRevenueByRoute(trajets: Trajet[]): void {
    const map = new Map<string, number>();
    trajets.forEach((t) => {
      const key = `${t.departureCity} → ${t.arrivalCity}`;
      const rev = this.revenue(t);
      map.set(key, (map.get(key) || 0) + rev);
    });
    const total = Array.from(map.values()).reduce((s, v) => s + v, 0);
    const colors = ['#12b76a', '#1e3a6b', '#f59e0b', '#6366f1']; // fallback
    let idx = 0;
    this.revenueByRoute = Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([label, rev], i) => ({
        label,
        pct: total ? Math.round((rev / total) * 100) : 0,
        amount: rev,
        // Keep same colour logic as before
        dark: i === 1,
        orange: i === 2,
      }));
  }

  // ── Revenue by day of week ──
  private computeRevenueByDay(trajets: Trajet[]): void {
    const dayNames = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
    const map = new Map<number, number>();
    trajets.forEach((t) => {
      const day = new Date(t.departureDate).getDay();
      map.set(day, (map.get(day) || 0) + this.revenue(t));
    });
    const max = Math.max(...Array.from(map.values()), 1);
    this.revenueByDay = dayNames.map((label, i) => {
      const amount = map.get(i) || 0;
      return {
        label,
        pct: Math.round((amount / max) * 100),
        amount,
      };
    });
  }

  // ── Performance indicators ──
  private computePerfIndicators(trajets: Trajet[]): void {
    // Fill rate already computed in stats.
    // Revenue per km: we don't have km data, so we use a placeholder or compute from something else.
    // Since km isn't in the Trajet model, keep a meaningful placeholder or remove. We'll keep the existing "0.14 DT" as fallback.
    // For active days, we already computed.
    this.perfIndicators = [
      {
        label: 'Taux de remplissage moyen',
        sub: 'Places vendues/places disponibles',
        value: `${this.fillRate}%`,
      },
      { label: 'Revenue par kilomètre', sub: 'Basé sur 2 340 km parcourus', value: '0.14 DT' }, // replace if you have distance
      {
        label: 'Jours actif ce mois',
        sub: 'Sur 30 jours calendaires',
        value: `${this.activeDays}/30`,
      },
    ];
  }

  // ── Monthly summary (group by date) ──
  private computeMonthlySummary(trajets: Trajet[]): void {
    const groups = new Map<string, Trajet[]>();
    trajets.forEach((t) => {
      const dateKey = new Date(t.departureDate).toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: 'short',
      });
      if (!groups.has(dateKey)) groups.set(dateKey, []);
      groups.get(dateKey)!.push(t);
    });
    this.monthlySummary = Array.from(groups.entries())
      .map(([label, trips]) => {
        const totalTrips = trips.length;
        const totalPassengers = trips.reduce((s, t) => s + this.passengers(t), 0);
        const gross = trips.reduce((s, t) => s + this.revenue(t), 0);
        // Fees: assume 7% commission as example (adjust to your real fee logic)
        const fee = Math.round(gross * 0.07);
        const net = gross - fee;
        return {
          label, // e.g., "28 juin"
          trips: totalTrips,
          passengers: totalPassengers,
          fees: `-${fee}`,
          net: `${net}`,
          prog: 100, // optional, can be based on average fill rate
        };
      })
      .sort((a, b) => new Date(b.label).getTime() - new Date(a.label).getTime()); // most recent first
  }

  // ── Transaction list (individual trajets) ──
  private computeTransactions(trajets: Trajet[]): void {
    this.transactions = trajets
      .sort((a, b) => new Date(b.departureDate).getTime() - new Date(a.departureDate).getTime())
      .slice(0, 20) // take last 20
      .map((t) => {
        const pax = this.passengers(t);
        const gross = this.revenue(t);
        const fee = Math.round(gross * 0.07); // adjust fee logic
        const net = gross - fee;
        return {
          date: new Date(t.departureDate).toLocaleDateString('fr-FR', {
            day: '2-digit',
            month: 'short',
          }),
          from: t.departureCity,
          to: t.arrivalCity,
          time: new Date(t.departureDate).toLocaleTimeString('fr-FR', {
            hour: '2-digit',
            minute: '2-digit',
          }),
          passengers: `${pax}/${t.totalSeats}`,
          fill: Math.round((pax / t.totalSeats) * 100),
          price: t.pricePerSeat,
          gross,
          fee: `-${fee}`,
          net: `${net}`,
        };
      });
  }
}
