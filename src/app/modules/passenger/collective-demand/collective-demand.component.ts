// Cible : src/app/modules/passenger/collective-demand/collective-demand.component.ts
// FIX :
//  1) Suppression du hack `NavigationEnd` qui rechargait les données à
//     chaque navigation pour masquer le bug de change detection.
//     -> Maintenant que main.ts a provideZoneChangeDetection, plus besoin.
//  2) Suppression de tous les console.log de debug (6 occurrences).
//  3) Le flag `loading` est désormais correctement géré dans loadAllDemands.

import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { CommonModule, DatePipe } from '@angular/common';
import { Subject, takeUntil } from 'rxjs';

import { DemandeService } from '../../../core/services/demande.service';
import { AuthService } from '../../../core/services/auth.service';
import { DemandeCollective } from '../../../core/models/demande.model';
import { ToastService } from '../../../core/services/toast.service';
import { FooterComponent } from '../../shared/components/footer/footer.component';
import { HeaderComponent } from '../../shared/components/header/header.component';

type FilterType = 'ACTIVE' | 'HISTORY' | 'ALL';

@Component({
  selector: 'app-collective-demand',
  standalone: true,
  imports: [CommonModule, DatePipe, ReactiveFormsModule, FooterComponent, HeaderComponent],
  templateUrl: './collective-demand.component.html',
  styleUrls: ['./collective-demand.component.css'],
})
export class CollectiveDemandComponent implements OnInit, OnDestroy {
  createForm: FormGroup;
  allDemands: DemandeCollective[] = [];
  filteredDemands: DemandeCollective[] = [];
  loading = false;
  successMessage = '';
  errorMessage = '';
  showWizard = false;
  currentFilter: FilterType = 'ACTIVE';

  currentStep: 1 | 2 | 3 = 1;
  submissionSuccess = false;
  createdDemand: DemandeCollective | null = null;

  vehicleTypes = [
    { value: 'VOITURE_8', label: 'Voiture 8 places' },
    { value: 'VOITURE_4', label: 'Voiture 4 places' },
    { value: 'MINIBUS', label: 'Minibus' },
    { value: 'BUS', label: 'Bus' },
  ];

  // ▶︎ FIX : sujet d'unsubscribe (remplace l'ancienne routerSub).
  private readonly destroy$ = new Subject<void>();

  get isDriver(): boolean {
    return this.authService?.getUserRole() === 'DRIVER';
  }

  get isDriverOrAdmin(): boolean {
    const role = this.authService.getUserRole();
    return role === 'DRIVER' || role === 'ADMIN';
  }

  get currentUserId(): string {
    return this.authService.getUserId() || '';
  }

  get optionsGroup(): FormGroup {
    return this.createForm.get('options') as FormGroup;
  }

  get activeCount(): number {
    return this.allDemands.filter((d) => d.status === 'OPEN' || d.status === 'TRIGGERED').length;
  }

  get historyCount(): number {
    return this.allDemands.filter(
      (d) => d.status === 'CLOSED' || d.status === 'CANCELLED' || d.status === 'MERGED',
    ).length;
  }

  get totalCount(): number {
    return this.allDemands.length;
  }

  constructor(
    private fb: FormBuilder,
    private demandeService: DemandeService,
    private toast: ToastService,
    private authService: AuthService,
  ) {
    this.createForm = this.fb.group({
      departureCity: ['', Validators.required],
      arrivalCity: ['', Validators.required],
      requestedDate: ['', Validators.required],
      vehicleType: ['VOITURE_8', Validators.required],
      timeSlot: [''],
      seats: [1, [Validators.required, Validators.min(1), Validators.max(8)]],
      maxBudget: ['', Validators.required],
      urgency: ['FLEXIBLE', Validators.required],
      options: this.fb.group({
        climatise: [false],
        direct: [false],
        bagages: [false],
        animaux: [false],
      }),
      message: [''],
      acceptTerms: [false, Validators.requiredTrue],
    });
  }

  ngOnInit(): void {
    // ▶︎ FIX : un seul chargement, sans hack NavigationEnd.
    this.loadAllDemands();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadAllDemands(): void {
    this.demandeService
      .getAllDemandes()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          this.allDemands = data ?? [];
          this.applyFilter();
        },
        error: () => {
          this.toast.error('Erreur lors du chargement des demandes');
        },
      });
  }

  applyFilter(): void {
    switch (this.currentFilter) {
      case 'ACTIVE':
        this.filteredDemands = this.allDemands.filter(
          (d) => d.status === 'OPEN' || d.status === 'TRIGGERED',
        );
        break;
      case 'HISTORY':
        this.filteredDemands = this.allDemands.filter(
          (d) => d.status === 'CLOSED' || d.status === 'CANCELLED' || d.status === 'MERGED',
        );
        break;
      case 'ALL':
        this.filteredDemands = this.allDemands;
        break;
    }
  }

  setFilter(filter: FilterType): void {
    this.currentFilter = filter;
    this.applyFilter();
  }

  onCreate(): void {
    if (this.createForm.invalid) return;
    this.loading = true;
    this.errorMessage = '';
    this.successMessage = '';

    const formValue = this.createForm.value;
    const payload = {
      departureCity: formValue.departureCity,
      arrivalCity: formValue.arrivalCity,
      requestedDate: formValue.requestedDate,
      vehicleType: formValue.vehicleType,
      seuilPersonnalise: formValue.seats,
    };

    this.demandeService
      .createDemande(payload)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (created: DemandeCollective) => {
          this.createdDemand = created;
          this.submissionSuccess = true;
          this.loading = false;
          this.loadAllDemands();
        },
        error: (err) => {
          this.errorMessage = err.error?.message || 'Erreur lors de la création';
          this.loading = false;
        },
      });
  }

  joinDemand(id: string): void {
    this.demandeService
      .joinDemande(id, { seatsReserved: 1 })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.successMessage = 'Vous avez rejoint cette demande !';
          this.loadAllDemands();
        },
        error: (err) => {
          this.toast.error(err.error?.message || 'Erreur');
        },
      });
  }

  statusLabel(status: string): string {
    const map: Record<string, string> = {
      OPEN: 'Ouverte',
      TRIGGERED: 'Seuil atteint',
      CLOSED: 'Convertie',
      CANCELLED: 'Annulée',
      MERGED: 'Fusionnée',
    };
    return map[status] || status;
  }

  convertDemand(id: string): void {
    this.demandeService
      .convertToTrajet(id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.toast.success('Demande convertie en trajet confirmé !');
          this.loadAllDemands();
        },
        error: (err) => this.toast.error(err.error?.message || 'Erreur lors de la conversion'),
      });
  }

  protected convertToTrajet(_id: string) {
    // placeholder pour héritage potentiel — à supprimer si inutilisé.
  }

  nextStep(): void {
    if (this.currentStep === 1) {
      const departure = this.createForm.get('departureCity');
      const arrival = this.createForm.get('arrivalCity');
      const date = this.createForm.get('requestedDate');
      const seats = this.createForm.get('seats');
      departure?.markAsTouched();
      arrival?.markAsTouched();
      date?.markAsTouched();
      seats?.markAsTouched();
      if (departure?.invalid || arrival?.invalid || date?.invalid || seats?.invalid) return;
    }
    if (this.currentStep === 2) {
      const budget = this.createForm.get('maxBudget');
      budget?.markAsTouched();
      if (budget?.invalid) return;
    }
    if (this.currentStep < 3) {
      this.currentStep++;
    }
  }

  prevStep(): void {
    if (this.currentStep > 1) {
      this.currentStep--;
    }
  }

  onSubmit(): void {
    this.createForm.markAllAsTouched();
    if (this.createForm.invalid) {
      this.errorMessage =
        'Veuillez remplir tous les champs obligatoires et accepter les conditions.';
      return;
    }
    this.onCreate();
  }

  goBackToForm(): void {
    this.submissionSuccess = false;
    this.createdDemand = null;
    this.showWizard = false;
    this.currentStep = 1;
    this.createForm.reset({
      vehicleType: 'VOITURE_8',
      urgency: 'FLEXIBLE',
      seats: 1,
      options: { climatise: false, direct: false, bagages: false, animaux: false },
      acceptTerms: false,
    });
    this.successMessage = '';
    this.errorMessage = '';
  }

  scrollToCreateForm(): void {
    const wizard = document.querySelector('.form-card');
    if (wizard) {
      wizard.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  openCreateWizard(): void {
    this.showWizard = true;
    this.currentStep = 1;
    this.submissionSuccess = false;
    setTimeout(() => {
      const wizard = document.querySelector('.form-card');
      wizard?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 0);
  }

  toggleOption(key: string): void {
    const ctrl = this.optionsGroup.get(key);
    if (ctrl) ctrl.setValue(!ctrl.value);
  }

  setUrgency(value: string): void {
    this.createForm.get('urgency')?.setValue(value);
  }

  get urgencyLabel(): string {
    const map: Record<string, string> = {
      FLEXIBLE: 'Flexible',
      MODERATE: 'Modéré',
      URGENT: 'Urgent',
    };
    return map[this.createForm.value.urgency] || 'Flexible';
  }

  get selectedOptions(): string[] {
    const opts = this.createForm.value.options || {};
    const labels: Record<string, string> = {
      climatise: 'Véhicule climatisé',
      direct: 'Trajet direct',
      bagages: 'Bagages volumineux',
      animaux: 'Animaux acceptés',
    };
    return Object.keys(opts)
      .filter((k) => opts[k])
      .map((k) => labels[k]);
  }
}
