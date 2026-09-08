import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { CommonModule, DatePipe } from '@angular/common';
import { VoyageService } from '../../../core/services/voyage.service';
import { Voyage } from '../../../core/models/voyage.model';
import { HeaderComponent } from '../../shared/components/header/header.component';
import { FooterComponent } from '../../shared/components/footer/footer.component';

@Component({
  selector: 'app-voyage-search',
  standalone: true,
  imports: [
    CommonModule,
    DatePipe,
    ReactiveFormsModule,
    FormsModule,
    HeaderComponent,
    FooterComponent,
  ],
  templateUrl: './voyage-search.component.html',
  styleUrls: ['./voyage-search.component.css'],
})
export class VoyageSearchComponent implements OnInit {
  searchForm: FormGroup;
  voyages: Voyage[] = [];
  filteredVoyageList: Voyage[] = [];
  loading = false;
  noVoyageFound = false;

  /* ── Sort & client-side pagination ── */
  sortBy = 'popular';
  currentPage = 0;
  pageSize = 6;
  totalPages = 0;
  pages: number[] = [];

  /* ── Special offer banner ── */
  priorityVoyage: Voyage | null = null;

  constructor(
    private fb: FormBuilder,
    private voyageService: VoyageService,
    private router: Router,
  ) {
    this.searchForm = this.fb.group({
      departureCity: [''],
      arrivalCity: [''],
      date: [''],
      maxPrice: [400],
      organizer: [''],
    });
  }

  ngOnInit(): void {
    this.loadVoyages();
  }

  /* ═══════════════════════════════════════
     REAL DATA COMPUTED PROPERTIES
     ═══════════════════════════════════════ */

  /** Hero stat #1: count of OPEN voyages */
  get activeVoyagesCount(): number {
    return this.voyages.filter((v: Voyage) => v.status === 'OPEN').length;
  }

  /** Hero stat #2: total seats across all voyages (represents adventurers) */
  get totalAdventurers(): number {
    return this.voyages.reduce((sum: number, v: Voyage) => sum + (v.totalSeats || 0), 0);
  }

  /** Hero stat #3: average rating from all voyages that have ratings */
  get averageRating(): string {
    const rated = this.voyages.filter((v: Voyage) => !!v.rating);
    if (rated.length === 0) return '4.8';
    const avg = rated.reduce((sum: number, v: Voyage) => sum + (v.rating || 0), 0) / rated.length;
    return avg.toFixed(1);
  }

  /** Hero stat #4: percentage of voyages with organizerName (verified) */
  get verifiedPercent(): number {
    if (this.voyages.length === 0) return 100;
    const withOrganizer = this.voyages.filter(
      (v: Voyage) => v.organizerName && v.organizerName.trim() !== '',
    ).length;
    return Math.round((withOrganizer / this.voyages.length) * 100);
  }

  /** Hero stats array for template */
  get stats(): { value: string; label: string }[] {
    return [
      { value: `${this.activeVoyagesCount}+`, label: 'Voyages actifs' },
      { value: `${this.totalAdventurers}+`, label: 'Aventuriers' },
      { value: `${this.averageRating} ★`, label: 'Note moyenne' },
      { value: `${this.verifiedPercent}%`, label: 'Vérifié' },
    ];
  }

  /** Categories extracted from real voyage data */
  get categories(): string[] {
    const cats = new Set<string>();
    cats.add('Tous');
    this.voyages.forEach((v: Voyage) => {
      const cat = v.category || v.type;
      if (cat && typeof cat === 'string') cats.add(cat);
    });
    // Fallback if no categories found
    if (cats.size === 1) {
      return ['Tous', 'Mer & Plages', 'Désert & Sud', 'Culture', 'Nature', 'Week-ends'];
    }
    return Array.from(cats);
  }
  selectedCategory = 'Tous';

  /** Durations extracted from real voyage data */
  get durations(): string[] {
    const durs = new Set<string>();
    this.voyages.forEach((v: Voyage) => {
      const dur = v.duration;
      if (dur && typeof dur === 'string') durs.add(dur);
    });
    // Fallback if no durations found
    if (durs.size === 0) {
      return ['1 jour', '2j', '3j', '4+j'];
    }
    return Array.from(durs);
  }
  selectedDuration = '';

  /** Departure cities extracted from real voyage data */
  get departureCities(): string[] {
    const cities = new Set<string>();
    this.voyages.forEach((v: Voyage) => {
      if (v.departureCity) cities.add(v.departureCity);
    });
    // Fallback if no cities found
    if (cities.size === 0) {
      return ['Tunis', 'Sfax', 'Sousse'];
    }
    return Array.from(cities);
  }
  selectedDepartureCities: string[] = [];

  /* ─────────────── Search & Load ─────────────── */

  onSearch(): void {
    this.loading = true;
    this.noVoyageFound = false;
    this.currentPage = 0;
    const params = this.searchForm.value;

    if (params.arrivalCity || params.departureCity || params.date) {
      // Service signature: searchVoyages(departure, arrival, date?, organizerId?, minPrice?, maxPrice?)
      // BUG FIX: the previous call passed `params.maxPrice` as the 5th argument
      // (which is actually `minPrice`), so all results were silently filtered
      // out. We now pass `undefined` for minPrice and the value as maxPrice.
      this.voyageService
        .searchVoyages(
          params.departureCity,
          params.arrivalCity,
          params.date,
          undefined,
          undefined,
          params.maxPrice || undefined,
        )
        .subscribe({
          next: (data: Voyage[]) => {
            let list = data;
            if (params.organizer) {
              const needle = String(params.organizer).toLowerCase().trim();
              list = list.filter((v: Voyage) =>
                (v.organizerName || '').toLowerCase().includes(needle),
              );
            }
            this.voyages = list;
            this.setPriorityVoyage();
            this.applyFilters();
            this.loading = false;
          },
          error: () => {
            this.voyages = [];
            this.applyFilters();
            this.loading = false;
          },
        });
    } else {
      this.loadVoyages();
    }
  }

  loadVoyages(): void {
    this.loading = true;
    this.voyageService.getVoyages(0, 100).subscribe({
      next: (data: Voyage[]) => {
        let list = data;

        const maxPrice = this.searchForm.value.maxPrice;
        const organizer = (this.searchForm.value.organizer || '').toLowerCase().trim();
        if (maxPrice) list = list.filter((v: Voyage) => v.pricePerSeat <= Number(maxPrice));
        if (organizer)
          list = list.filter((v: Voyage) =>
            (v.organizerName || '').toLowerCase().includes(organizer),
          );

        this.voyages = list;
        this.setPriorityVoyage();
        this.applyFilters();
        this.loading = false;
      },
      error: () => {
        this.voyages = [];
        this.applyFilters();
        this.loading = false;
      },
    });
  }

  /* ─────────────── Filtering ─────────────── */

  applyFilters(): void {
    let list = [...(this.voyages || [])];

    // Category
    if (this.selectedCategory && this.selectedCategory !== 'Tous') {
      list = list.filter((v: Voyage) => {
        const cat = v.category || v.type || '';
        return cat === this.selectedCategory;
      });
    }

    // Duration
    if (this.selectedDuration) {
      list = list.filter((v: Voyage) => {
        const dur = String(v.duration || '').toLowerCase();
        return dur.includes(this.selectedDuration.toLowerCase());
      });
    }

    // Departure cities
    if (this.selectedDepartureCities.length > 0) {
      list = list.filter((v: Voyage) => this.selectedDepartureCities.includes(v.departureCity));
    }

    // Max price from slider
    const maxPrice = this.searchForm.value.maxPrice;
    if (maxPrice) {
      list = list.filter((v: Voyage) => v.pricePerSeat <= Number(maxPrice));
    }

    // Sorting
    if (this.sortBy === 'price-asc') {
      list.sort((a: Voyage, b: Voyage) => a.pricePerSeat - b.pricePerSeat);
    } else if (this.sortBy === 'price-desc') {
      list.sort((a: Voyage, b: Voyage) => b.pricePerSeat - a.pricePerSeat);
    } else if (this.sortBy === 'popular') {
      list.sort((a: Voyage, b: Voyage) => (b.reviewCount || 0) - (a.reviewCount || 0));
    }

    this.filteredVoyageList = list;
    this.noVoyageFound = list.length === 0;
    this.buildPagination();
  }

  resetFilters(): void {
    this.selectedCategory = 'Tous';
    this.selectedDuration = '';
    this.selectedDepartureCities = [];
    this.sortBy = 'popular';
    this.currentPage = 0;
    this.searchForm.reset({
      maxPrice: 400,
      departureCity: '',
      arrivalCity: '',
      date: '',
      organizer: '',
    });
    this.loadVoyages();
  }

  /* ─────────────── UI Handlers ─────────────── */

  selectCategory(cat: string): void {
    this.selectedCategory = cat;
    this.applyFilters();
  }

  selectDuration(d: string): void {
    this.selectedDuration = this.selectedDuration === d ? '' : d;
    this.applyFilters();
  }

  toggleDepartureCity(city: string): void {
    const idx = this.selectedDepartureCities.indexOf(city);
    if (idx > -1) this.selectedDepartureCities.splice(idx, 1);
    else this.selectedDepartureCities.push(city);
    this.applyFilters();
  }

  sortVoyages(): void {
    this.applyFilters();
  }

  /* ─────────────── Pagination ─────────────── */

  buildPagination(): void {
    this.totalPages = Math.ceil(this.filteredVoyageList.length / this.pageSize) || 1;
    this.pages = Array.from({ length: this.totalPages }, (_, i) => i);
  }

  goToPage(p: number): void {
    if (p < 0 || p >= this.totalPages) return;
    this.currentPage = p;
  }

  nextPage(): void {
    this.goToPage(this.currentPage + 1);
  }

  get displayedVoyages(): Voyage[] {
    const start = this.currentPage * this.pageSize;
    return this.filteredVoyageList.slice(start, start + this.pageSize);
  }

  /* ─────────────── Priority / Special ─────────────── */

  setPriorityVoyage(): void {
    const groups = new Map<string, Voyage[]>();
    this.voyages.forEach((v: Voyage) => {
      const key = `${v.departureCity}-${v.arrivalCity}-${v.departureDate}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(v);
    });

    this.voyages.forEach((v: Voyage) => (v.isPriority = false));
    groups.forEach((group) => {
      const available = group
        // ✅ FIX: use real backend status instead of frontend-only isCompleted
        .filter((v: Voyage) => v.availableSeats > 0 && v.status === 'OPEN')
        .sort(
          (a: Voyage, b: Voyage) =>
            new Date(a.departureDate).getTime() - new Date(b.departureDate).getTime(),
        );
      if (available.length > 0) available[0].isPriority = true;
    });

    this.priorityVoyage = this.voyages.find((v: Voyage) => v.isPriority) || null;
  }

  /* ─────────────── Navigation ─────────────── */

  reserveVoyage(voyageId: string): void {
    void this.router.navigate(['/passenger/voyages', voyageId]);
  }

  trackByVoyageId(index: number, voyage: Voyage): string {
    return voyage.id;
  }
}
