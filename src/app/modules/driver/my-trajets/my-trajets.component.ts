import { Component, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DriverSidebarComponent } from '../driver-sidebar/driver-sidebar.component';
import { TrajetService } from '../../../core/services/trajet.service';
import { AuthService } from '../../../core/services/auth.service';
import { UserService } from '../../../core/services/user.service';
import { Trajet } from '../../../core/models/trajet.model';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-my-trajets',
  standalone: true,
  imports: [CommonModule, DatePipe, RouterModule, DriverSidebarComponent, FormsModule],
  templateUrl: './my-trajets.component.html',
  styleUrls: ['./my-trajets.component.css'],
})
export class MyTrajetsComponent implements OnInit {
  loading = true;
  today = new Date();
  driverName = '';
  trajets: Trajet[] = [];
  active: Trajet[] = [];
  locked: Trajet[] = [];
  scheduled: Trajet[] = [];
  done: Trajet[] = [];
  kpiTotal = 0;
  kpiActive = 0;
  kpiLocked = 0;
  kpiScheduled = 0;
  kpiDone = 0;

  // ─── Seat editing state ─────────────────────────────────────────────
  editingSeats: { [id: string]: boolean } = {};
  newSeatCount: { [id: string]: number } = {};

  constructor(
    private trajetService: TrajetService,
    private authService: AuthService,
    private userService: UserService,
    private toast: ToastService,
  ) {}

  ngOnInit(): void {
    this.userService.getMyProfile().subscribe({
      next: (u) => (this.driverName = u.name || ''),
      error: () => {},
    });
    this.trajetService.getMyTrajets().subscribe({
      next: (data) => {
        this.trajets = data;
        this.active = data.filter((t) => t.status === 'ACTIVE');
        this.locked = data.filter((t) => t.status === 'LOCKED');
        this.scheduled = data.filter((t) => t.status === 'FULL');
        this.done = data.filter((t) => t.status === 'DEPARTED' || t.status === 'CANCELLED');
        this.kpiTotal = data.length;
        this.kpiActive = this.active.length;
        this.kpiLocked = this.locked.length;
        this.kpiScheduled = this.scheduled.length;
        this.kpiDone = this.done.length;
        this.loading = false;
      },
      error: () => (this.loading = false),
    });
  }

  // ─── Seat editing helpers ───────────────────────────────────────────
  startEditSeats(t: Trajet): void {
    this.editingSeats[t.id] = true;
    this.newSeatCount[t.id] = t.availableSeats;
  }

  cancelEditSeats(id: string): void {
    this.editingSeats[id] = false;
    delete this.newSeatCount[id];
  }

  saveSeats(id: string): void {
    const newCount = this.newSeatCount[id];
    const trajet = this.trajets.find((t) => t.id === id);
    if (!trajet || newCount === undefined || newCount === null) return;

    if (newCount > trajet.availableSeats) {
      this.toast.error(
        `Vous ne pouvez que diminuer les places. Actuel: ${trajet.availableSeats}, Demandé: ${newCount}`,
      );
      return;
    }
    if (newCount < 0) {
      this.toast.error('Le nombre de places ne peut pas être négatif');
      return;
    }
    if (newCount === trajet.availableSeats) {
      this.cancelEditSeats(id);
      return;
    }

    this.trajetService.updateAvailableSeats(id, newCount).subscribe({
      next: () => {
        this.toast.success(`Places mises à jour: ${newCount} disponible(s)`);
        this.cancelEditSeats(id);
        this.ngOnInit();
      },
      error: (e) => {
        this.toast.error(e.error?.message || 'Erreur lors de la mise à jour des places');
      },
    });
  }

  // ─── Existing actions ───────────────────────────────────────────────
  markDeparted(id: string): void {
    this.trajetService.markDeparted(id).subscribe({
      next: () => {
        this.toast.success('Trajet marqué comme parti');
        this.ngOnInit();
      },
      error: (e) => this.toast.error(e.error?.message || 'Erreur'),
    });
  }

  cancelTrajet(id: string): void {
    if (!confirm('Annuler ce trajet ? Cette action est définitive.')) return;
    this.trajetService.cancelTrajet(id).subscribe({
      next: () => {
        this.toast.success('Trajet annulé');
        this.ngOnInit();
      },
      error: (e) => this.toast.error(e.error?.message || "Erreur lors de l'annulation"),
    });
  }
}
