import { Component, OnInit } from "@angular/core";
import { CommonModule, DatePipe } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { RouterModule } from "@angular/router";
import { DriverSidebarComponent } from "../driver-sidebar/driver-sidebar.component";
import { ReservationService } from "../../../core/services/reservation.service";
import { ReservationResponse } from "../../../core/models/reservation.model";

@Component({
  selector: "app-driver-passengers",
  standalone: true,
  imports: [CommonModule, DatePipe, FormsModule, RouterModule, DriverSidebarComponent],
  templateUrl: "./passengers.component.html",
  styleUrls: ["./passengers.component.css"],
})
export class DriverPassengersComponent implements OnInit {
  loading = true;
  today = new Date();
  rows: ReservationResponse[] = [];
  confirmed: ReservationResponse[] = [];

  constructor(private reservationService: ReservationService) {}

  ngOnInit(): void {
    this.reservationService.getDriverPending().subscribe({
      next: (data) => {
        this.rows = data.filter(r => r.status === "ACCEPTED" || r.status === "PAYMENT_PENDING");
        this.confirmed = data.filter(r => r.status === "CONFIRMED");
        this.loading = false;
      },
      error: () => (this.loading = false),
    });
  }
}
