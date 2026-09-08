import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Subject, of } from 'rxjs';
import {
  debounceTime,
  distinctUntilChanged,
  switchMap,
  takeUntil,
  catchError,
  finalize,
} from 'rxjs/operators';
import { TrajetService, RegulatedFare } from '../../../core/services/trajet.service';
import { DriverSidebarComponent } from '../driver-sidebar/driver-sidebar.component';

/** Spring Data Page wrapper (si le backend renvoie une Page) */
interface Page<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
}

@Component({
  selector: 'app-publish-trajet',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, DriverSidebarComponent],
  templateUrl: './publish-trajet.component.html',
  styleUrls: ['./publish-trajet.component.css'],
})
export class PublishTrajetComponent implements OnInit, OnDestroy {
  trajetForm: FormGroup;
  loading = false;
  successMessage = '';
  errorMessage = '';

  regulatedFare: number | null = null;
  fareLoading = false;
  fareError = '';

  allFares: RegulatedFare[] = [];
  citiesLoading = false;
  citiesError = '';

  departureCities: string[] = [];
  arrivalCities: string[] = [];

  private fareLookup$ = new Subject<{ dep: string; arr: string }>();
  private destroy$ = new Subject<void>();

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private trajetService: TrajetService,
  ) {
    this.trajetForm = this.fb.group({
      departureCity: ['', Validators.required],
      arrivalCity: ['', Validators.required],
      departureDate: ['', Validators.required],
      acceptsPets: [false],
      allowsLargeBags: [false],
      airConditioned: [false],
      hasIntermediateStops: [false],
      notes: [''],
    });
  }

  ngOnInit(): void {
    this.loadRegulatedFares();

    this.fareLookup$
      .pipe(
        debounceTime(350),
        distinctUntilChanged((a, b) => a.dep === b.dep && a.arr === b.arr),
        switchMap(({ dep, arr }) => {
          this.fareLoading = true;
          this.fareError = '';
          return this.trajetService.lookupFare(dep, arr).pipe(
            catchError((err) => {
              const msg = err?.error?.message || 'Aucun tarif réglementé pour cet itinéraire';
              this.fareError = msg;
              this.fareLoading = false;
              this.regulatedFare = null;
              return of(null);
            }),
          );
        }),
        takeUntil(this.destroy$),
      )
      .subscribe((fare) => {
        this.fareLoading = false;
        if (fare && typeof fare.pricePerSeat === 'number') {
          this.regulatedFare = fare.pricePerSeat;
          this.fareError = '';
        } else if (fare) {
          this.regulatedFare = null;
          this.fareError = this.fareError || 'Tarif indisponible';
        }
      });

    this.trajetForm.valueChanges.pipe(takeUntil(this.destroy$)).subscribe((v) => {
      const dep = (v.departureCity || '').trim();
      const arr = (v.arrivalCity || '').trim();
      if (dep && arr) {
        this.fareLookup$.next({ dep, arr });
      } else {
        this.regulatedFare = null;
        this.fareError = '';
        this.fareLoading = false;
      }
    });
  }

  private loadRegulatedFares(): void {
    this.citiesLoading = true;
    this.citiesError = '';
    console.log('[PublishTrajet] Chargement des villes depuis /api/v1/fares...');

    this.trajetService
      .getAllRegulatedFares()
      .pipe(
        takeUntil(this.destroy$),
        catchError((err) => {
          console.error('[PublishTrajet] ERREUR chargement villes:', err);
          this.citiesError =
            err?.error?.message || err?.message || 'Impossible de charger les villes';
          this.citiesLoading = false;
          return of([]);
        }),
        finalize(() => {
          this.citiesLoading = false;
        }),
      )
      .subscribe((response: RegulatedFare[] | Page<RegulatedFare>) => {
        const fares: RegulatedFare[] = Array.isArray(response)
          ? response
          : (response as Page<RegulatedFare>)?.content || [];

        console.log('[PublishTrajet] Tarifs reçus:', fares.length);
        this.allFares = fares;

        // 🔑 UNION complète : toutes les villes du réseau
        //    (celles qui apparaissent au moins une fois comme départ OU arrivée)
        const allCities = new Set<string>();
        fares.forEach((f) => {
          allCities.add(f.departureCity);
          allCities.add(f.arrivalCity);
        });

        this.departureCities = [...allCities].sort();
        console.log('[PublishTrajet] Villes disponibles:', this.departureCities);

        if (this.departureCities.length === 0 && !this.citiesError) {
          this.citiesError = "Aucun tarif disponible. Contactez l'administrateur.";
        }
      });
  }

  onDepartureChange(): void {
    const selectedDep = this.trajetForm.get('departureCity')?.value;
    this.trajetForm.get('arrivalCity')?.setValue('');

    if (!selectedDep) {
      this.arrivalCities = [];
      return;
    }

    // Filtrage : seules les villes d'arrivée réellement connectées à la ville de départ choisie
    this.arrivalCities = [
      ...new Set(
        this.allFares.filter((f) => f.departureCity === selectedDep).map((f) => f.arrivalCity),
      ),
    ].sort();
    console.log('[PublishTrajet] Arrivées pour', selectedDep, ':', this.arrivalCities);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onSubmit(): void {
    if (this.trajetForm.invalid) return;

    this.loading = true;
    this.errorMessage = '';
    this.successMessage = '';

    const raw = this.trajetForm.value;

    const payload = {
      departureCity: raw.departureCity,
      arrivalCity: raw.arrivalCity,
      departureDate: raw.departureDate,
      pricePerSeat: this.regulatedFare ?? 0,
      acceptsPets: raw.acceptsPets ?? false,
      allowsLargeBags: raw.allowsLargeBags ?? false,
      airConditioned: raw.airConditioned ?? false,
      hasIntermediateStops: raw.hasIntermediateStops ?? false,
      notes: raw.notes || '',
    };

    this.trajetService.publishTrajet(payload).subscribe({
      next: () => {
        this.successMessage = 'Trajet publié avec succès !';
        this.loading = false;
        setTimeout(() => this.router.navigate(['/driver/my-trajets']), 1500);
      },
      error: (err) => {
        const springMsg =
          err.error?.errors?.[0]?.message ||
          err.error?.message ||
          err.error?.error ||
          'Erreur lors de la publication';
        this.errorMessage = springMsg;
        this.loading = false;
      },
    });
  }
}
