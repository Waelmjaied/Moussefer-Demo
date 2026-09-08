// Cible : src/app/modules/admin/trajet-detail/trajet-detail.component.ts
// FIX #3a : nouveau composant pour la route /admin/trajets/:id
// Affiche le détail complet d'un trajet et expose les actions admin
// (annuler, réassigner chauffeur, changer statut).

import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, forkJoin, of, takeUntil } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { TrajetService } from '../../../core/services/trajet.service';
import { AdminTrajetService } from '../../../core/services/admin-trajet.service';
import { AdminService, UserProfile } from '../../../core/services/admin.service';
import { PermissionService } from '../../../core/services/permission.service';
import { ToastService } from '../../../core/services/toast.service';
import { AdminSidebarComponent } from '../admin-sidebar/admin-sidebar.component';
import { Trajet } from '../../../core/models/trajet.model';

@Component({
  selector: 'app-admin-trajet-detail',
  standalone: true,
  imports: [CommonModule, DatePipe, FormsModule,AdminSidebarComponent],
  templateUrl: './trajet-detail.component.html',
  styleUrls: ['./trajet-detail.component.css'],
})
export class AdminTrajetDetailComponent implements OnInit, OnDestroy {
  trajet: Trajet | null = null;
  drivers: UserProfile[] = [];
  loading = true;
  error: string | null = null;
  trajetId = '';

  // Cancel modal
  showCancelModal = false;
  cancelReason = '';
  notifyPassenger = true;
  cancelling = false;

  // Reassign modal
  showReassignModal = false;
  selectedDriverId = '';
  reassigning = false;

  private readonly destroy$ = new Subject<void>();

  readonly statusLabels: Record<string, string> = {
    ACTIVE: 'Actif',
    LOCKED: 'En attente (priorité)',
    FULL: 'Complet',
    DEPARTED: 'Parti',
    CANCELLED: 'Annulé',
  };

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private trajetService: TrajetService,
    private adminTrajetService: AdminTrajetService,
    private adminService: AdminService,
    public permissionService: PermissionService,
    private toast: ToastService,
  ) {}

  ngOnInit(): void {
    // FIX #1 : paramMap (et pas snapshot) pour supporter la navigation
    // entre 2 trajets sans démontage du composant.
    this.route.paramMap.pipe(takeUntil(this.destroy$)).subscribe((params) => {
      const id = params.get('id');
      if (!id) {
        this.error = 'ID de trajet manquant';
        this.loading = false;
        return;
      }
      this.trajetId = id;
      this.loadData();
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadData(): void {
    this.loading = true;
    this.error = null;
    forkJoin({
      trajet: this.trajetService.getTrajetById(this.trajetId).pipe(catchError((err) => of({ __err: err }))),
      drivers: this.adminService.getAllDrivers().pipe(catchError(() => of([]))),
    })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: ({ trajet, drivers }) => {
          if ((trajet as any).__err) {
            this.error =
              (trajet as any).__err?.error?.message ||
              `Trajet ${this.trajetId} introuvable.`;
            this.loading = false;
            return;
          }
          this.trajet = trajet as Trajet;
          this.drivers = Array.isArray(drivers) ? drivers : [];
          this.loading = false;
        },
        error: (err) => {
          this.loading = false;
          this.error = err.error?.message || 'Erreur lors du chargement.';
        },
      });
  }

  /* ═══════════════════════ HELPERS ═══════════════════════════════════ */

  getStatusLabel(status?: string): string {
    return (status && this.statusLabels[status]) || status || '—';
  }

  getStatusClass(status?: string): string {
    if (!status) return '';
    const map: Record<string, string> = {
      ACTIVE: 'badge-success',
      LOCKED: 'badge-warning',
      FULL: 'badge-info',
      DEPARTED: 'badge-default',
      CANCELLED: 'badge-danger',
    };
    return map[status] || 'badge-default';
  }

  get fillPercent(): number {
    if (!this.trajet || !this.trajet.totalSeats) return 0;
    const occupied = this.trajet.totalSeats - this.trajet.availableSeats;
    return Math.round((occupied / this.trajet.totalSeats) * 100);
  }

  get occupiedSeats(): number {
    if (!this.trajet) return 0;
    return this.trajet.totalSeats - this.trajet.availableSeats;
  }

  /* ═══════════════════════ NAVIGATION ════════════════════════════════ */

  goBack(): void {
    this.router.navigate(['/admin/trajets']);
  }

  /* ═══════════════════════ CANCEL ════════════════════════════════════ */

  openCancelModal(): void {
    this.cancelReason = '';
    this.notifyPassenger = true;
    this.showCancelModal = true;
  }

  closeCancelModal(event?: MouseEvent): void {
    if (event && (event.target as HTMLElement).classList.contains('modal-dialog')) return;
    this.showCancelModal = false;
  }

  confirmCancel(): void {
    if (!this.cancelReason.trim()) {
      this.toast.error("Le motif d'annulation est obligatoire.");
      return;
    }
    this.cancelling = true;
    this.adminTrajetService
      .cancelTrajet(this.trajetId, this.cancelReason.trim(), this.notifyPassenger)
      .subscribe({
        next: () => {
          this.toast.success('Trajet annulé.');
          this.cancelling = false;
          this.showCancelModal = false;
          this.loadData();
        },
        error: (err) => {
          this.cancelling = false;
          this.toast.error(err.error?.message || "Erreur lors de l'annulation.");
        },
      });
  }

  /* ═══════════════════════ REASSIGN ══════════════════════════════════ */

  openReassignModal(): void {
    this.selectedDriverId = '';
    this.showReassignModal = true;
  }

  closeReassignModal(event?: MouseEvent): void {
    if (event && (event.target as HTMLElement).classList.contains('modal-dialog')) return;
    this.showReassignModal = false;
  }

  confirmReassign(): void {
    if (!this.selectedDriverId) {
      this.toast.error('Sélectionne un chauffeur.');
      return;
    }
    this.reassigning = true;
    this.adminTrajetService.reassignTrajet(this.trajetId, this.selectedDriverId).subscribe({
      next: () => {
        this.toast.success('Trajet réassigné.');
        this.reassigning = false;
        this.showReassignModal = false;
        this.loadData();
      },
      error: (err) => {
        this.reassigning = false;
        this.toast.error(err.error?.message || 'Erreur lors de la réassignation.');
      },
    });
  }

  /* ═══════════════════════ PERMISSIONS UI ════════════════════════════ */

  get canCancel(): boolean {
    if (!this.trajet) return false;
    return (
      ['ACTIVE', 'LOCKED', 'FULL'].includes(this.trajet.status) &&
      (this.permissionService.isSuperAdmin() || this.permissionService.isOperationalAdmin?.())
    );
  }

  get canReassign(): boolean {
    if (!this.trajet) return false;
    return (
      ['ACTIVE', 'LOCKED'].includes(this.trajet.status) &&
      this.permissionService.isSuperAdmin()
    );
  }
}
