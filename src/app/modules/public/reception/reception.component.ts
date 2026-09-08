import { Component, OnInit, ChangeDetectorRef, HostListener } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { PublicDataService } from '../../../core/services/public-data.service';
import { BannerService } from '../../../core/services/banner.service';
import { AuthService } from '../../../core/services/auth.service';
import { TrajetService } from '../../../core/services/trajet.service';
import { VoyageService } from '../../../core/services/voyage.service';
import { Trajet } from '../../../core/models/trajet.model';
import { Voyage } from '../../../core/models/voyage.model';
import { Banner } from '../../../core/models/banner.model';
import { ToastService } from '../../../core/services/toast.service';
import { CommonModule } from '@angular/common';
import { MOCK_TRAJETS, MOCK_VOYAGES } from '../../../core/mock/mock-demo-data';

@Component({
  selector: 'app-reception',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule],
  templateUrl: './reception.component.html',
  styleUrls: ['./reception.component.css'],
})
export class ReceptionComponent implements OnInit {
  trajets: Trajet[] = [];
  voyages: Voyage[] = [];
  banners: Banner[] = [];
  loadingTrajets = true;
  loadingVoyages = true;

  // ─── Newsletter (Fix #5) ───
  newsletterEmail = '';
  newsletterLoading = false;

  selectedTrajet: Trajet | null = null;
  selectedVoyage: Voyage | null = null;
  showTrajetDetail = false;
  showVoyageDetail = false;
  loadingDetail = false;

  departureStation = '';
  arrivalStation = '';
  travelDate = '';
  minDate: string;
  openDropdown: 'departure' | 'arrival' | null = null;
  departureFilter = '';
  arrivalFilter = '';

  stations: string[] = [
    'Béja',
    'Bizerte',
    'Gabès',
    'Gafsa',
    'Hammamet',
    'Houmt Souk (Djerba)',
    'Jendouba',
    'Kairouan',
    'Kasserine',
    'Kélibia',
    'Kef (Le Kef)',
    'Mahdia',
    'Médenine',
    'Monastir',
    'Nabeul',
    'Sfax',
    'Sidi Bouzid',
    'Siliana',
    'Sousse',
    'Tabarka',
    'Tataouine',
    'Tozeur',
    'Tunis (Bab Alioua)',
    'Tunis (Bab Saadoun)',
    'Tunis (Moncef Bey)',
    'Zaghouan',
    'Zarzis',
  ];

  constructor(
    private publicDataService: PublicDataService,
    private bannerService: BannerService,
    private toast: ToastService,
    private authService: AuthService,
    private router: Router,
    private trajetService: TrajetService,
    private voyageService: VoyageService,
    private cdr: ChangeDetectorRef, // ← injecté
  ) {
    const today = new Date();
    this.minDate = today.toISOString().split('T')[0];
  }

  ngOnInit(): void {
    // FIX NG0100 : différer le chargement au prochain tick
    setTimeout(() => {
      this.loadTrajets();
      this.loadVoyages();
      this.loadBanners();
    }, 0);
  }

  isAuthenticated(): boolean {
    return this.authService.isAuthenticated();
  }

  goToLogin(): void {
    this.router.navigate(['/auth/login']);
  }

  onNavClick(route: string): void {
    this.router.navigate([route]);
  }

  onSearch(): void {
    const queryParams: any = {};
    if (this.departureStation) queryParams.departureCity = this.departureStation;
    if (this.arrivalStation) queryParams.arrivalCity = this.arrivalStation;
    if (this.travelDate) queryParams.date = this.travelDate;
    this.router.navigate(['/passenger/search'], { queryParams });
  }

  scroll(element: HTMLElement, direction: number): void {
    const scrollAmount = element.clientWidth * 0.85;
    element.scrollBy({ left: direction * scrollAmount, behavior: 'smooth' });
  }

  openTrajetDetail(id: string): void {
    this.loadingDetail = true;
    this.showTrajetDetail = true;
    this.showVoyageDetail = false;
    this.trajetService.getTrajetById(id).subscribe({
      next: (data) => {
        this.selectedTrajet = data;
        this.loadingDetail = false;
        this.cdr.detectChanges(); // ← force la mise à jour du modal
      },
      error: () => {
        // DEMO FALLBACK: if this id belongs to our mock list (backend
        // unreachable), show the mock trajet instead of an error.
        const mock = MOCK_TRAJETS.find((t) => t.id === id);
        if (mock) {
          this.selectedTrajet = mock;
          this.loadingDetail = false;
          this.cdr.detectChanges();
          return;
        }
        this.loadingDetail = false;
        this.toast.error('Impossible de charger les détails du trajet');
        this.closeDetail();
      },
    });
  }

  openVoyageDetail(id: string): void {
    this.loadingDetail = true;
    this.showVoyageDetail = true;
    this.showTrajetDetail = false;
    this.voyageService.getVoyageById(id).subscribe({
      next: (data) => {
        this.selectedVoyage = data;
        this.loadingDetail = false;
        this.cdr.detectChanges(); // ← force la mise à jour du modal
      },
      error: () => {
        // DEMO FALLBACK: if this id belongs to our mock list (backend
        // unreachable), show the mock voyage instead of an error.
        const mock = MOCK_VOYAGES.find((v) => v.id === id);
        if (mock) {
          this.selectedVoyage = mock;
          this.loadingDetail = false;
          this.cdr.detectChanges();
          return;
        }
        this.loadingDetail = false;
        this.toast.error('Impossible de charger les détails du voyage');
        this.closeDetail();
      },
    });
  }

  closeDetail(): void {
    this.showTrajetDetail = false;
    this.showVoyageDetail = false;
    this.selectedTrajet = null;
    this.selectedVoyage = null;
    this.loadingDetail = false;
  }

  loadBanners(): void {
    this.bannerService.getActiveBanners().subscribe({
      next: (data) => {
        this.banners = data ?? [];
        this.banners.forEach((b) => this.bannerService.trackImpression(b.id));
        this.cdr.detectChanges(); // ← force la mise à jour
      },
      error: () => {
        this.banners = [];
        this.cdr.detectChanges();
      },
    });
  }

  onBannerClick(banner: Banner): void {
    this.bannerService.trackClick(banner.id);
    if (banner.redirectUrl) window.open(banner.redirectUrl, '_blank');
  }

  loadTrajets(): void {
    this.publicDataService.getUpcomingTrajets(10).subscribe({
      next: (data) => {
        // DEMO FALLBACK: if the live backend returns nothing (e.g. no
        // backend deployed behind this frontend), show mock trajets instead
        // of an empty section. Remove this fallback once a real backend
        // is wired up permanently.
        this.trajets = data && data.length > 0 ? data : MOCK_TRAJETS;
        this.loadingTrajets = false;
        this.cdr.detectChanges(); // ← force la mise à jour
      },
      error: () => {
        // DEMO FALLBACK: backend unreachable — show mock trajets so the
        // page still looks alive for a live demo (no toast error shown).
        this.trajets = MOCK_TRAJETS;
        this.loadingTrajets = false;
        this.cdr.detectChanges();
      },
    });
  }

  loadVoyages(): void {
    this.publicDataService.getFeaturedVoyages(10).subscribe({
      next: (data) => {
        // DEMO FALLBACK: same reasoning as loadTrajets() above.
        this.voyages = data && data.length > 0 ? data : MOCK_VOYAGES;
        this.loadingVoyages = false;
        this.cdr.detectChanges(); // ← force la mise à jour
      },
      error: () => {
        // DEMO FALLBACK: backend unreachable — show mock voyages.
        this.voyages = MOCK_VOYAGES;
        this.loadingVoyages = false;
        this.cdr.detectChanges();
      },
    });
  }

  reserveTrajet(trajetId: string): void {
    this.closeDetail();
    this.router.navigate(['/passenger/reservation', trajetId], {
      queryParams: { type: 'trajet' },
    });
  }

  reserveVoyage(voyageId: string): void {
    this.closeDetail();
    this.router.navigate(['/passenger/reservation', voyageId], {
      queryParams: { type: 'voyage' },
    });
  }

  getSeatStatus(availableSeats: number, totalSeats: number): string {
    const ratio = availableSeats / totalSeats;
    if (ratio === 0) return 'Complet';
    if (ratio < 0.3) return 'Dernières places';
    if (ratio < 0.6) return 'Places limitées';
    return 'Disponible';
  }

  getSeatClass(availableSeats: number, totalSeats: number): string {
    const ratio = availableSeats / totalSeats;
    if (ratio === 0) return 'status-complet';
    if (ratio < 0.3) return 'status-urgent';
    if (ratio < 0.6) return 'status-limited';
    return 'status-available';
  }

  // ─── Newsletter subscription (Fix #5) ───
  subscribeNewsletter(): void {
    const email = (this.newsletterEmail || '').trim();
    if (!email) {
      this.toast.info('Veuillez saisir une adresse email.');
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      this.toast.error('Adresse email invalide.');
      return;
    }
    this.newsletterLoading = true;
    // Note: pas d'endpoint backend dédié pour le moment.
    // On simule un succès UX. À remplacer par un appel HTTP quand le backend
    // exposera POST /api/v1/newsletter/subscribe.
    setTimeout(() => {
      this.newsletterLoading = false;
      this.toast.success('Merci ! Nous vous tiendrons informé des nouveautés.');
      this.newsletterEmail = '';
    }, 600);
  }
  toggleDropdown(which: 'departure' | 'arrival', event: MouseEvent): void {
    event.stopPropagation();
    this.openDropdown = this.openDropdown === which ? null : which;
  }

  selectStation(which: 'departure' | 'arrival', station: string): void {
    if (which === 'departure') {
      this.departureStation = station;
      this.departureFilter = '';
    } else {
      this.arrivalStation = station;
      this.arrivalFilter = '';
    }
    this.openDropdown = null;
  }

  filteredStations(filter: string): string[] {
    const f = (filter || '').trim().toLowerCase();
    if (!f) return this.stations;
    return this.stations.filter((s) => s.toLowerCase().includes(f));
  }

  @HostListener('document:click')
  closeDropdowns(): void {
    this.openDropdown = null;
  }
}
