import { Component, OnInit } from "@angular/core";
import { CommonModule, DatePipe } from "@angular/common";
import { RouterModule } from "@angular/router";
import { forkJoin } from "rxjs";
import { DriverSidebarComponent } from "../driver-sidebar/driver-sidebar.component";
import { TrajetService } from "../../../core/services/trajet.service";
import { ReservationService } from "../../../core/services/reservation.service";
import { AvisService } from "../../../core/services/avis.service";
import { AuthService } from "../../../core/services/auth.service";
import { UserService } from "../../../core/services/user.service";
import { ReservationResponse } from "../../../core/models/reservation.model";
import { Trajet } from "../../../core/models/trajet.model";

@Component({
  selector: "app-driver-dashboard",
  standalone: true,
  imports: [CommonModule, DatePipe, RouterModule, DriverSidebarComponent],
  templateUrl: "./driver-dashboard.component.html",
  styleUrls: ["./driver-dashboard.component.css"],
})
export class DriverDashboardComponent implements OnInit {
  loading = true;
  today = new Date();
  driverName = "";
  activeTrip: any = null;
  pendingReservations: ReservationResponse[] = [];
  stats: any = {
    trajetsThisMonth: 0,
    revenueThisMonth: 0,
    averageRating: 0,
    totalAvis: 0,
  };

  constructor(
    private trajetService: TrajetService,
    private reservationService: ReservationService,
    private avisService: AvisService,
    private authService: AuthService,
    private userService: UserService,
  ) {}

  ngOnInit(): void {
    this.userService.getMyProfile().subscribe({
      next: (u) => (this.driverName = u.name || ""),
      error: () => {},
    });

    const driverId = this.authService.getUserId() || "";

    forkJoin({
      trajets: this.trajetService.getMyTrajets(),
      reservations: this.reservationService.getDriverPending(),
      avis: this.avisService.getAvisForDriver(driverId),
    }).subscribe({
      next: ({ trajets, reservations, avis }) => {
        // Active trip
        const activeTrajets = trajets.filter(t => t.status === "ACTIVE" || t.status === "LOCKED");
        if (activeTrajets.length) {
          this.activeTrip = { ...activeTrajets[0], confirmedSeats: activeTrajets[0].totalSeats - activeTrajets[0].availableSeats };
        }

        // Pending reservations
        this.pendingReservations = reservations.filter(r => r.status === "PENDING_DRIVER");

        // Stats
        const now = new Date();
        const doneThisMonth = trajets.filter(t => {
          const d = new Date(t.departureDate);
          return t.status === "DEPARTED" && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
        });
        this.stats = {
          trajetsThisMonth: doneThisMonth.length,
          revenueThisMonth: doneThisMonth.reduce((s, t) => s + (t.totalSeats - t.availableSeats) * t.pricePerSeat, 0),
          averageRating: avis.length ? avis.reduce((s: number, a: any) => s + a.rating, 0) / avis.length : 0,
          totalAvis: avis.length,
        };

        this.loading = false;
      },
      error: () => (this.loading = false),
    });
  }

  acceptReservation(id: string): void {
    this.reservationService.acceptReservation(id).subscribe({
      next: () => this.ngOnInit(),
      error: () => {},
    });
  }

  refuseReservation(id: string): void {
    this.reservationService.refuseReservation(id, "Refusé par le chauffeur").subscribe({
      next: () => this.ngOnInit(),
      error: () => {},
    });
  }

  markDeparted(): void {
    if (!this.activeTrip) return;
    this.trajetService.markDeparted(this.activeTrip.id).subscribe({
      next: () => this.ngOnInit(),
      error: () => {},
    });
  }
}
