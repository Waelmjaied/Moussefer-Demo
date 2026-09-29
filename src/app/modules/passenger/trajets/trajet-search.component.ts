import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { CommonModule, DatePipe } from '@angular/common';
import { AuthService } from '../../../core/services/auth.service';
import { Trajet } from '../../../core/models/trajet.model';
import { MOCK_TRAJETS } from '../../../core/mock/mock-demo-data';
import { TrajetService } from '../../../core/services/trajet.service';
import { ToastService } from '../../../core/services/toast.service';
import { NotificationService } from '../../../core/services/notification.service';
import { AvisService } from '../../../core/services/avis.service';
import { Avis } from '../../../core/models/avis.model';
import { HeaderComponent } from '../../shared/components/header/header.component';
import { FooterComponent } from '../../shared/components/footer/footer.component';

@Component({
  selector: 'app-trajet-trajets',
  standalone: true,
  imports: [
    CommonModule,
    DatePipe,
    ReactiveFormsModule,
    FormsModule,
    HeaderComponent,
    FooterComponent,
  ],
  templateUrl: './trajet-search.component.html',
  styleUrls: ['./trajet-search.component.css'],
})
export class TrajetSearchComponent implements OnInit {
  searchForm: FormGroup;
  trajets: Trajet[] = [];
  filteredTrajetList: Trajet[] = [];
  loading = false;
  noTrajetFound = false;
  showNoTrajetPopup = false;
  noTrajetPopupMessage = '';

  // ─── Mobile filters panel toggle ───
  showMobileFilters = false;

  // Flat filters
  filterMorning = false;
  filterAfternoon = false;
  filterEvening = false;
  filterAirCond = false;
  filterBags = false;
  filterPets = false;
  filterDirect = false;
  filterMinSeats = '';

  // ─── Driver reviews modal (Fix #3) ───
  showReviewsModal = false;
  selectedTrajetForReviews: Trajet | null = null;
  driverReviews: Avis[] = [];
  loadingReviews = false;

  constructor(
    private fb: FormBuilder,
    private trajetService: TrajetService,
    private authService: AuthService,
    private router: Router,
    private toast: ToastService,
    private notificationService: NotificationService,
    private avisService: AvisService,
  ) {
    this.searchForm = this.fb.group({
      departureCity: [''],
      arrivalCity: [''],
      date: [''],
      timeOfDay: [''],
      seatsNeeded: [1],
      maxPrice: [''],
      organizer: [''],
    });
  }

  ngOnInit(): void {
    this.onSearch();
  }

  getInitial(id: string): string {
    return (id?.[0] || 'C').toUpperCase();
  }

  // ─── Mobile filters panel toggle ───
  toggleMobileFilters(): void {
    this.showMobileFilters = !this.showMobileFilters;
  }

  applyFilters(): void {
    let list = this.trajets || [];
    if (this.filterMorning)
      list = list.filter((t) => {
        const h = new Date(t.departureDate).getHours();
        return h >= 6 && h < 12;
      });
    if (this.filterAfternoon)
      list = list.filter((t) => {
        const h = new Date(t.departureDate).getHours();
        return h >= 12 && h < 18;
      });
    if (this.filterEvening)
      list = list.filter((t) => {
        const h = new Date(t.departureDate).getHours();
        return h >= 18;
      });
    if (this.filterAirCond) list = list.filter((t) => (t as any).airConditioned);
    if (this.filterBags) list = list.filter((t) => (t as any).allowsLargeBags);
    if (this.filterPets) list = list.filter((t) => (t as any).acceptsPets);
    if (this.filterDirect) list = list.filter((t) => !(t as any).hasIntermediateStops);
    if (this.filterMinSeats) list = list.filter((t) => t.availableSeats >= +this.filterMinSeats);
    this.filteredTrajetList = list;

    // Mobile UX: collapse the panel after a filter is applied so the user
    // immediately sees the updated results instead of scrolling past the panel.
    if (window.innerWidth <= 768) {
      this.showMobileFilters = false;
    }
  }

  resetFilters(): void {
    this.filterMorning = this.filterAfternoon = this.filterEvening = false;
    this.filterAirCond = this.filterBags = this.filterPets = this.filterDirect = false;
    this.filterMinSeats = '';
    this.filteredTrajetList = [...(this.trajets || [])];
  }

  onSearch(): void {
    this.loading = true;
    this.noTrajetFound = false;
    this.showNoTrajetPopup = false;
    const params = this.searchForm.value;
    if (!params.seatsNeeded || params.seatsNeeded < 1) params.seatsNeeded = 1;

    this.trajetService.searchTrajets(params).subscribe({
      next: (data) => {
        this.trajets = data;
        this.filteredTrajetList = [...data];
        this.noTrajetFound = data.length === 0;

        if (this.noTrajetFound && (params.date || params.timeOfDay)) {
          this.noTrajetPopupMessage =
            'Aucun louage ne correspond à votre date/heure demandée. Vous pouvez créer une demande collective et être notifié dès qu’un trajet est publié.';
          this.showNoTrajetPopup = true;
        }
        this.loading = false;
      },
      error: () => {
        this.trajets = MOCK_TRAJETS;
        this.filteredTrajetList = [...MOCK_TRAJETS];
        this.noTrajetFound = false;
        this.loading = false;
      },
    });
  }

  reserveTrajet(trajet: Trajet): void {
    if (!trajet.reservable) {
      if (trajet.status === 'LOCKED') {
        this.toast.info(
          "Ce chauffeur est en file d'attente. Il deviendra réservable quand le louage actuel sera parti.",
        );
      } else if (trajet.status === 'FULL') {
        this.toast.info('Ce trajet est complet.');
      } else {
        this.toast.info("Ce trajet n'est pas réservable.");
      }
      return;
    }
    this.router.navigate(['/passenger/reservation', trajet.id], {
      queryParams: { type: 'trajet' },
    });
  }

  goToCollectiveDemand(): void {
    this.closeNoTrajetPopup();
    this.router.navigate(['/passenger/collective-demand']);
  }

  closeNoTrajetPopup(): void {
    this.showNoTrajetPopup = false;
  }

  // ─── Driver reviews modal methods (Fix #3) ───
  viewDriverReviews(trajet: Trajet): void {
    if (!trajet.driverId) {
      this.toast.info('Avis indisponibles pour ce chauffeur.');
      return;
    }
    this.selectedTrajetForReviews = trajet;
    this.showReviewsModal = true;
    this.loadingReviews = true;
    this.driverReviews = [];
    this.avisService.getAvisForDriver(trajet.driverId).subscribe({
      next: (reviews: Avis[]) => {
        this.driverReviews = (reviews || []).sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        );
        this.loadingReviews = false;
      },
      error: () => {
        this.loadingReviews = false;
        this.toast.error('Impossible de charger les avis.');
      },
    });
  }

  closeReviewsModal(): void {
    this.showReviewsModal = false;
    this.selectedTrajetForReviews = null;
    this.driverReviews = [];
  }

  notifyMe(): void {
    const v = this.searchForm.value;
    if (!v.departureCity || !v.arrivalCity) {
      this.toast.info("Remplissez le départ et l'arrivée pour activer l'alerte.");
      return;
    }
    this.notificationService
      .subscribeToAlert({
        departureCity: v.departureCity,
        arrivalCity: v.arrivalCity,
        date: v.date,
      })
      .subscribe({
        next: () =>
          this.toast.success("Alerte activée ! Vous serez notifié dès qu'un trajet est publié."),
        error: () =>
          this.toast.info("Vous serez notifié dès qu'un trajet correspondant est disponible !"),
      });
  }
}
