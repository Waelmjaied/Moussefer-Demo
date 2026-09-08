import { Component, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { DriverSidebarComponent } from '../driver-sidebar/driver-sidebar.component';
import { DemandeService } from '../../../core/services/demande.service';
import { DemandeCollective } from '../../../core/models/demande.model';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-driver-collective-requests',
  standalone: true,
  imports: [CommonModule, DatePipe, FormsModule, RouterModule, DriverSidebarComponent],
  templateUrl: './collective-requests.component.html',
  styleUrls: ['./collective-requests.component.css'],
})
export class DriverCollectiveRequestsComponent implements OnInit {
  loading = true;
  demandes: DemandeCollective[] = [];

  constructor(
    private demandeService: DemandeService,
    private toast: ToastService,
    private router: Router,
  ) {}

  ngOnInit(): void {
    this.demandeService.getOpenDemandes().subscribe({
      next: (data) => {
        this.demandes = data;
        this.loading = false;
      },
      error: () => (this.loading = false),
    });
  }

  isUrgent(d: DemandeCollective): boolean {
    if (!d.requestedDate) return false;
    const diff = new Date(d.requestedDate).getTime() - Date.now();
    return diff < 24 * 60 * 60 * 1000 && diff > 0;
  }

  acceptDemande(d: DemandeCollective): void {
    // Navigate to publish-trajet pre-filled with demande info
    this.router.navigate(['/driver/publish'], {
      queryParams: {
        departureCity: d.departureCity,
        arrivalCity: d.arrivalCity,
        date: d.requestedDate,
        seats: d.totalCapacity || 8,
      },
    });
  }
  getBudgetDisplay(d: DemandeCollective): number {
    const budget = d.totalBudget;
    const price = d.pricePerSeat ?? 0;
    const seats = d.totalSeatsReserved ?? 0;
    return (budget ?? price * seats) || 0;
  }
}
