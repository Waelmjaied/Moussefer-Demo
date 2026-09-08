// Cible : src/app/modules/admin/trajets/trajets.component.ts
// FIX #3a : viewTrajet navigue vers /admin/trajets/:id au lieu de console.log

import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AdminTrajetService } from '../../../core/services/admin-trajet.service';
import { AdminService, UserProfile } from '../../../core/services/admin.service';
import { ToastService } from '../../../core/services/toast.service';
import { PermissionService } from '../../../core/services/permission.service';
import { AdminSidebarComponent } from '../admin-sidebar/admin-sidebar.component';
import { catchError } from 'rxjs/operators';
import { of } from 'rxjs';

interface TrajetRow {
  id: string;
  displayId: string;
  driverName: string;
  route: string;
  displayDate: string;
  occupiedSeats: number;
  totalSeats: number;
  fillPercent: number;
  status: string;
  displayStatus: string;
}

@Component({
  selector: 'app-trajets',
  standalone: true,
  imports: [CommonModule, FormsModule, AdminSidebarComponent],
  templateUrl: './trajets.component.html',
  styleUrls: ['./trajets.component.css'],
})
export class TrajetsComponent implements OnInit {
  currentDate = '';

  trajets: TrajetRow[] = [];
  filteredTrajets: TrajetRow[] = [];
  loading = true;
  searchQuery = '';

  filterStatus = '';
  filterRoute = '';
  filterDate = '';
  uniqueRoutes: string[] = [];

  showCancelModal = false;
  showReassignModal = false;
  selectedTrajetId = '';
  cancelReason = '';
  notifyPassenger = true;
  submitting = false;

  drivers: UserProfile[] = [];
  selectedDriverId = '';

  constructor(
    private adminTrajetService: AdminTrajetService,
    private adminService: AdminService,
    public permissionService: PermissionService,
    private toast: ToastService,
    private router: Router, // ▶︎ FIX #3a
  ) {}

  ngOnInit(): void {
    const opts: Intl.DateTimeFormatOptions = {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    };
    this.currentDate = new Date().toLocaleDateString('fr-FR', opts);
    this.loadTrajets();
    this.loadDrivers();
  }

  loadTrajets(): void {
    this.loading = true;
    this.adminTrajetService
      .getAllTrajets()
      .pipe(catchError(() => of({ content: [] })))
      .subscribe({
        next: (page: any) => {
          const raw = page?.content ?? page ?? [];
          this.trajets = raw.map((t: any) => this.mapTrajet(t));
          this.extractRoutes();
          this.applyFilters();
          this.loading = false;
        },
        error: () => {
          this.loading = false;
          this.trajets = [];
          this.filteredTrajets = [];
        },
      });
  }

  private mapTrajet(t: any): TrajetRow {
    const total = t.totalSeats ?? t.seats ?? 5;
    const occupied = t.occupiedSeats ?? t.bookedSeats ?? 0;
    const percent = total > 0 ? Math.round((occupied / total) * 100) : 0;

    const driverFromObj = t.driver?.name ? t.driver.name : '—';

    return {
      id: t.id ?? t.trajetId ?? '',
      displayId: '#' + (t.id ?? t.trajetId ?? 'R0000'),
      driverName: t.driverName || driverFromObj,
      route: t.route || `${t.departureCity ?? '—'} → ${t.arrivalCity ?? '—'}`,
      displayDate: t.departureDate ? this.formatTrajetDate(t.departureDate) : '—',
      occupiedSeats: occupied,
      totalSeats: total,
      fillPercent: percent,
      status: t.status ?? 'ACTIVE',
      displayStatus: this.mapDisplayStatus(t.status),
    };
  }

  private formatTrajetDate(dateStr: string): string {
    const d = new Date(dateStr);
    return (
      d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) +
      ' · ' +
      d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
    );
  }

  private mapDisplayStatus(status?: string): string {
    const map: Record<string, string> = {
      ACTIVE: 'En cours',
      PUBLISHED: 'Publié',
      CONFIRMED: 'Confirmé',
      COMPLETED: 'Complet',
      FINISHED: 'Terminé',
      CANCELLED: 'Annulé',
    };
    return map[status ?? ''] ?? status ?? 'En cours';
  }

  private extractRoutes(): void {
    const routes = new Set(this.trajets.map((t) => t.route));
    this.uniqueRoutes = Array.from(routes).sort();
  }

  applyFilters(): void {
    let filtered = this.trajets;

    if (this.filterStatus) filtered = filtered.filter((t) => t.status === this.filterStatus);
    if (this.filterRoute) filtered = filtered.filter((t) => t.route === this.filterRoute);
    if (this.filterDate) filtered = filtered.filter((t) => t.displayDate.includes(this.filterDate));

    if (this.searchQuery.trim()) {
      const q = this.searchQuery.toLowerCase();
      filtered = filtered.filter(
        (t) =>
          t.driverName.toLowerCase().includes(q) ||
          t.route.toLowerCase().includes(q) ||
          t.displayId.toLowerCase().includes(q),
      );
    }

    this.filteredTrajets = filtered;
  }

  getStatusClass(status: string): string {
    const map: Record<string, string> = {
      ACTIVE: 'encours',
      PUBLISHED: 'publie',
      CONFIRMED: 'confirme',
      COMPLETED: 'complet',
      FINISHED: 'termine',
      CANCELLED: 'annule',
    };
    return map[status] ?? 'encours';
  }

  canEdit(status: string): boolean {
    return ['ACTIVE', 'PUBLISHED', 'CONFIRMED'].includes(status);
  }

  canCancel(status: string): boolean {
    return ['ACTIVE', 'PUBLISHED', 'CONFIRMED', 'COMPLETED'].includes(status);
  }

  /** ▶︎ FIX #3a : navigation vers la nouvelle page détail */
  viewTrajet(t: TrajetRow): void {
    this.router.navigate(['/admin/trajets', t.id]);
  }

  loadDrivers(): void {
    this.adminService
      .getAllDrivers()
      .pipe(catchError(() => of([])))
      .subscribe({
        next: (data) => {
          this.drivers = Array.isArray(data) ? data : [];
        },
        error: () => {
          this.drivers = [];
        },
      });
  }

  openCancelModal(trajetId: string): void {
    this.selectedTrajetId = trajetId;
    this.cancelReason = '';
    this.notifyPassenger = true;
    this.showCancelModal = true;
  }

  closeCancelModal(event?: MouseEvent): void {
    if (event && event.target !== event.currentTarget) return;
    this.showCancelModal = false;
    this.selectedTrajetId = '';
    this.cancelReason = '';
    this.submitting = false;
  }

  confirmCancel(): void {
    if (!this.cancelReason.trim()) {
      this.toast.warning('Veuillez fournir une raison.');
      return;
    }
    this.submitting = true;
    this.adminTrajetService
      .cancelTrajet(this.selectedTrajetId, this.cancelReason, this.notifyPassenger)
      .subscribe({
        next: () => {
          this.toast.success('Trajet annulé.');
          this.loadTrajets();
          this.closeCancelModal();
        },
        error: (err) => {
          this.toast.error(err.error?.message || "Erreur lors de l'annulation");
          this.submitting = false;
        },
      });
  }

  openReassignModal(trajetId: string): void {
    this.selectedTrajetId = trajetId;
    this.selectedDriverId = '';
    this.showReassignModal = true;
  }

  closeReassignModal(event?: MouseEvent): void {
    if (event && event.target !== event.currentTarget) return;
    this.showReassignModal = false;
    this.selectedTrajetId = '';
    this.selectedDriverId = '';
    this.submitting = false;
  }

  confirmReassign(): void {
    if (!this.selectedDriverId) {
      this.toast.warning('Veuillez sélectionner un chauffeur.');
      return;
    }
    this.submitting = true;
    this.adminTrajetService.reassignTrajet(this.selectedTrajetId, this.selectedDriverId).subscribe({
      next: () => {
        this.toast.success('Trajet réassigné.');
        this.loadTrajets();
        this.closeReassignModal();
      },
      error: (err) => {
        this.toast.error(err.error?.message || 'Erreur lors du réassignement');
        this.submitting = false;
      },
    });
  }
}
