import { Component, OnInit } from '@angular/core';
import { AdminService, DashboardStats } from '../../../core/services/admin.service';
import { DecimalPipe, NgIf } from '@angular/common';
import { PermissionService } from '../../../core/services/permission.service';
import { AdminSidebarComponent } from '../admin-sidebar/admin-sidebar.component';

@Component({
  standalone: true,
  selector: 'app-statistics',
  templateUrl: './statistics.component.html',
  styleUrls: ['./statistics.component.css'],
  imports: [DecimalPipe, NgIf, AdminSidebarComponent],
})
export class StatisticsComponent implements OnInit {
  loading = true;
  stats: DashboardStats = {
    totalDrivers: 0,
    totalReservations: 0,
    totalRevenue: 0,
    drivers: 0,
    reservations: 0,
    totalUsers: 0,
    activeTrips: 0,
    completedTrips: 0,
    revenue: 0,
    avgRating: 0,
    reservationsThisMonth: 0,
  };

  constructor(
    private adminService: AdminService,
    public permissionService: PermissionService,
  ) {}

  ngOnInit(): void {
    this.loadStatistics();
  }

  loadStatistics(): void {
    this.adminService.getDashboardStats().subscribe({
      next: (data) => {
        this.stats = data;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      },
    });
  }

  exportToCSV(): void {
    const rows = [
      ['Indicateur', 'Valeur'],
      ['Utilisateurs totaux', this.stats.totalUsers],
      ['Trajets actifs', this.stats.activeTrips],
      ['Trajets terminés', this.stats.completedTrips],
      ["Chiffre d'affaires (DT)", this.stats.totalRevenue],
      ['Réservations ce mois', this.stats.reservationsThisMonth],
      ['Note moyenne', this.stats.avgRating],
    ];

    const csvContent = rows.map((row) => row.join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.setAttribute('download', `statistiques_${new Date().toISOString().slice(0, 19)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}
