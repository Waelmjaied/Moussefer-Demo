// Cible : src/app/modules/passenger/voyages/voyage-detail.component.ts
// FIX : remplace route.snapshot.paramMap par route.paramMap.subscribe().
// Le snapshot ne s'évalue qu'à la première activation -> si l'utilisateur
// navigue de /voyages/A vers /voyages/B, Angular RÉUTILISE le composant
// (même route) et ngOnInit ne re-fire PAS. Résultat : on reste sur A
// jusqu'à ce que l'utilisateur force un refresh ou re-clique.

import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';

import { VoyageService } from '../../../core/services/voyage.service';
import { Voyage } from '../../../core/models/voyage.model';
import { HeaderComponent } from '../../shared/components/header/header.component';
import { FooterComponent } from '../../shared/components/footer/footer.component';

@Component({
  selector: 'app-voyage-detail',
  standalone: true,
  imports: [CommonModule, DatePipe, FormsModule, FooterComponent],
  templateUrl: './voyage-detail.component.html',
  styleUrls: ['./voyage-detail.component.css'],
})
export class VoyageDetailComponent implements OnInit, OnDestroy {
  voyage: Voyage | null = null;
  loading = false;
  error = false;
  isNavigating = false; // ← prevents double-click on "Réserver maintenant"

  /* ── Tabs ── */
  activeTab: 'overview' | 'program' | 'included' | 'location' | 'reviews' = 'overview';

  /* ── Description expand ── */
  descExpanded = false;

  /* ── Booking sidebar ── */
  adults = 1;
  children = 0;
  departureDate = '';
  returnDate = '';

  /* ── Reviews ── */
  reviews: any[] = [];

  // ▶︎ FIX : sujet pour unsubscribe propre dans ngOnDestroy.
  private readonly destroy$ = new Subject<void>();

  constructor(
    private route: ActivatedRoute,
    public router: Router,
    private voyageService: VoyageService,
  ) {}

  ngOnInit(): void {
    // ▶︎ FIX : on s'abonne à paramMap au lieu d'utiliser snapshot.
    //   Ainsi, chaque changement d'ID dans l'URL recharge le voyage
    //   correspondant — même si le composant est réutilisé.
    this.route.paramMap.pipe(takeUntil(this.destroy$)).subscribe((params) => {
      const id = params.get('id');
      if (id) {
        this.loadVoyage(id);
      } else {
        this.error = true;
      }
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadVoyage(id: string): void {
    this.loading = true;
    this.error = false;
    this.voyage = null;

    this.voyageService
      .getVoyageById(id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data: Voyage) => {
          this.voyage = data;
          this.departureDate = this.formatDateInput(data.departureDate);
          const dur = Number((data as any).durationDays || 3);
          const ret = new Date(new Date(data.departureDate).getTime() + dur * 86400000);
          this.returnDate = this.formatDateInput(ret.toISOString());
          this.loading = false;
        },
        error: () => {
          this.error = true;
          this.loading = false;
        },
      });
  }

  private formatDateInput(iso: string): string {
    const d = new Date(iso);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  /* ── Tab switching ── */
  setTab(tab: string): void {
    const valid = ['overview', 'program', 'included', 'location', 'reviews'] as const;
    if (valid.includes(tab as any)) {
      this.activeTab = tab as typeof this.activeTab;
    }
  }

  /* ── Booking math ── */
  get basePrice(): number {
    return (this.voyage?.pricePerSeat || 0) * this.adults;
  }

  get childDiscount(): number {
    const childPrice = (this.voyage?.pricePerSeat || 0) * 0.8;
    return Math.round(childPrice * this.children);
  }

  get discount(): number {
    return 30;
  }

  get totalPrice(): number {
    const childTotal = this.childDiscount;
    const adultTotal = this.basePrice;
    return adultTotal + childTotal - this.discount;
  }

  /* ── Counters ── */
  changeAdults(delta: number): void {
    const next = this.adults + delta;
    if (next >= 1 && next <= ((this.voyage as any)?.maxPeople || 12)) {
      this.adults = next;
    }
  }

  changeChildren(delta: number): void {
    const next = this.children + delta;
    if (next >= 0 && next <= 6) this.children = next;
  }

  /* ── Reserve ── */
  reserveNow(): void {
    // 🔒 Triple guard pour empêcher tout double-click :
    //   1. Pas de voyage chargé → no-op (silently)
    //   2. Navigation en cours → no-op (évite race)
    //   3. Loading initial → no-op
    if (!this.voyage || this.isNavigating || this.loading) return;
    this.isNavigating = true;
    void this.router
      .navigate(['/passenger/reservation', this.voyage.id], {
        queryParams: {
          type: 'voyage',
          adults: this.adults,
          children: this.children,
          departure: this.departureDate,
          return: this.returnDate,
        },
      })
      .then(() => {
        // Reset le flag après navigation (au cas où l'user revient via back button)
        this.isNavigating = false;
      });
  }

  /* ── Open map fallback ── */
  openMap(): void {
    const dest = this.voyage?.arrivalCity || 'Tunisie';
    window.open(
      `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(dest)}`,
      '_blank',
    );
  }

  /* ── Real data helpers for hero ── */
  get durationText(): string {
    if (!this.voyage) return '';
    const dep = new Date(this.voyage.departureDate);
    const ret = this.voyage.returnDate ? new Date(this.voyage.returnDate) : null;
    if (!ret) return '';
    const diffMs = ret.getTime() - dep.getTime();
    const days = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    if (days <= 1) return '1 jour';
    return `${days} jours`;
  }

  get dateRangeText(): string {
    if (!this.voyage) return '';
    const dep = new Date(this.voyage.departureDate);
    const ret = this.voyage.returnDate ? new Date(this.voyage.returnDate) : null;
    const fmt = (d: Date) =>
      `${String(d.getDate()).padStart(2, '0')} ${d.toLocaleDateString('fr-FR', { month: 'short' })}`;
    if (!ret) return fmt(dep);
    return `${fmt(dep)} - ${fmt(ret)}`;
  }

  /* ── Helpers for template ── */
  get ratingBreakdown(): { label: string; score: number }[] {
    const v = this.voyage as any;
    return [
      { label: 'Propreté', score: v?.ratingCleanliness || 4.9 },
      { label: 'Emplacement', score: v?.ratingLocation || 4.7 },
      { label: 'Service', score: v?.ratingService || 5.0 },
    ];
  }

  get features(): { icon: string; label: string }[] {
    const v = this.voyage as any;
    const raw = v?.features || ['Plage', 'Médina', 'Excursion mer', 'Gastronomie'];
    const iconMap: Record<string, string> = {
      Plage: 'M2 12h20M2 12c0-3 4-6 10-6s10 3 10 6M6 16v4M12 14v6M18 16v4',
      Médina: 'M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6',
      'Excursion mer': 'M2 12h20M2 12c0-3 4-6 10-6s10 3 10 6',
      Gastronomie: 'M6 2v20M18 2v20M6 8h12M6 14h12M3 2h18M3 22h18',
    };
    return raw.map((f: string) => ({ icon: iconMap[f] || iconMap['Plage'], label: f }));
  }

  get inclusions(): string[] {
    const v = this.voyage as any;
    return (
      v?.inclusions || [
        'Transport Tunis-Djerba-Tunis (Bus Confort)',
        "Hébergement en chambre double (Maison d'hôtes)",
        'Pension complète (Boissons non alcoolisées incluses)',
        'Toutes les activités et excursions mentionnées',
      ]
    );
  }

  get exclusions(): string[] {
    const v = this.voyage as any;
    return (
      v?.exclusions || [
        'Dépenses personnelles et souvenirs',
        'Activités optionnelles non mentionnées',
        'Assurance voyage personnelle',
      ]
    );
  }

  get galleryImages(): string[] {
    const v = this.voyage as any;
    return v?.galleryImages || [v?.imageUrl || v?.coverImage || 'assets/images/voyage-default.jpg'];
  }

  get organizer(): any {
    return (
      (this.voyage as any)?.organizer || {
        name: (this.voyage as any)?.organizerName || 'Organisateur',
        avatar: 'assets/default-avatar.jpg',
        verified: true,
      }
    );
  }
}
