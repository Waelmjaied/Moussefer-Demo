import { Component, OnInit } from "@angular/core";
import { CommonModule, DatePipe } from "@angular/common";
import { RouterModule } from "@angular/router";
import { DriverSidebarComponent } from "../driver-sidebar/driver-sidebar.component";
import { ReservationService } from "../../../core/services/reservation.service";
import { ReservationResponse } from "../../../core/models/reservation.model";
import { ToastService } from "../../../core/services/toast.service";

@Component({
  selector: "app-driver-reservations",
  standalone: true,
  imports: [CommonModule, DatePipe, RouterModule, DriverSidebarComponent],
  templateUrl: "./reservations.component.html",
  styleUrls: ["./reservations.component.css"],
})
export class ReservationsComponent implements OnInit {
  loading = true;
  pending: ReservationResponse[] = [];

  constructor(
    private reservationService: ReservationService,
    private toast: ToastService,
  ) {}

  ngOnInit(): void {
    this.reservationService.getDriverPending().subscribe({
      next: (data) => { this.pending = data.filter(r => r.status === "PENDING_DRIVER"); this.loading = false; },
      error: () => (this.loading = false),
    });
  }

  accept(id: string): void {
    this.reservationService.acceptReservation(id).subscribe({
      next: () => { this.toast.success("Réservation acceptée"); this.ngOnInit(); },
      error: (e) => this.toast.error(e.error?.message || "Erreur"),
    });
  }

  refuse(id: string): void {
    if (!confirm("Refuser cette demande ?")) return;
    this.reservationService.refuseReservation(id, "Refusé par le chauffeur").subscribe({
      next: () => { this.toast.success("Demande refusée"); this.ngOnInit(); },
      error: (e) => this.toast.error(e.error?.message || "Erreur"),
    });
  }
}
