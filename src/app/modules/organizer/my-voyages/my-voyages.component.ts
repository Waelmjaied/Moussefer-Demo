import { Component, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { Router } from '@angular/router';
import {
  FormBuilder,
  FormGroup,
  Validators,
  ReactiveFormsModule,
  FormsModule,
  AbstractControl,
  ValidationErrors,
} from '@angular/forms';
import { VoyageService } from '../../../core/services/voyage.service';
import {
  BookingSource,
  CreateVoyageRequest,
  ReservationVoyageResponse,
  UpdateVoyageRequest,
  Voyage,
} from '../../../core/models/voyage.model';
import { ConfirmModalService } from '../../../core/services/confirm-modal.service';
import { ToastService } from '../../../core/services/toast.service';
import { OrganizerSidebarComponent } from '../organizer-sidebar/organizer-sidebar.component';

interface Passenger {
  reservationId?: string;
  name: string;
  email: string;
  phone: string;
  avatar?: string;
  seatNumber?: string;
  status?: string;
  paymentMethod?: string;
  amount?: number;
}

interface Activity {
  title: string;
  description: string;
  time: string;
  color: string;
}

type VoyageFilterTab = 'all' | 'open' | 'full' | 'departed' | 'cancelled';

@Component({
  selector: 'app-my-voyages',
  standalone: true,
  imports: [CommonModule, DatePipe, ReactiveFormsModule, FormsModule, OrganizerSidebarComponent],
  templateUrl: './my-voyages.component.html',
  styleUrls: ['./my-voyages.component.css'],
})
export class MyVoyagesComponent implements OnInit {
  voyages: Voyage[] = [];
  loading = true;
  submitting = false;
  uploading = false;
  showModal = false;
  isEditMode = false;
  selectedVoyage: Voyage | null = null;
  imageFile: File | null = null;
  imagePreview: string | null = null;

  selectedVoyageForManage: Voyage | null = null;
  reservationsForSelected: ReservationVoyageResponse[] = [];
  activeTab = 'passengers';
  passengerSearch = '';

  services = {
    transport: true,
    hebergement: false,
    petitDejeuner: false,
    guide: false,
  };

  currentDate = '';
  agencyName = 'Bonjour Tunisia Tours';

  voyageForm: FormGroup;

  filterTab: VoyageFilterTab = 'all';

  readonly filterTabs = [
    { value: 'all' as VoyageFilterTab, label: 'Tous', count: 0 },
    { value: 'open' as VoyageFilterTab, label: 'Ouverts', count: 0 },
    { value: 'full' as VoyageFilterTab, label: 'Complets', count: 0 },
    { value: 'departed' as VoyageFilterTab, label: 'Partis', count: 0 },
    { value: 'cancelled' as VoyageFilterTab, label: 'Annulés', count: 0 },
  ] as const;

  dateFrom: string = '';
  dateTo: string = '';

  manualBookingVoyageId = '';
  manualBooking: {
    passengerName: string;
    passengerPhone: string;
    seatsReserved: number;
    bookingSource: BookingSource.PHONE | BookingSource.AGENCY | BookingSource.DIRECT;
    depositAmount: number | null;
  } = {
    passengerName: '',
    passengerPhone: '',
    seatsReserved: 1,
    bookingSource: BookingSource.PHONE,
    depositAmount: null,
  };
  private manualModalInstance: any = null;

  get minDate(): string {
    const today = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
  }

  constructor(
    private voyageService: VoyageService,
    private router: Router,
    private confirmModal: ConfirmModalService,
    private toast: ToastService,
    private fb: FormBuilder,
  ) {
    this.voyageForm = this.fb.group(
      {
        title: ['', [Validators.required, Validators.maxLength(100)]],
        description: ['', Validators.maxLength(500)],
        departureCity: ['', Validators.required],
        arrivalCity: ['', Validators.required],
        departureDate: ['', [Validators.required, this.futureOrTodayValidator]],
        returnDate: [''],
        pricePerSeat: [0, [Validators.required, Validators.min(0.01)]],
        totalSeats: [1, [Validators.required, Validators.min(1), Validators.max(100)]],
        duration: [1],
      },
      { validators: this.returnAfterDepartureValidator }
    );

    this.voyageForm.get('departureDate')?.valueChanges.subscribe(() => this.calculateDuration());
    this.voyageForm.get('returnDate')?.valueChanges.subscribe(() => this.calculateDuration());
  }

  ngOnInit(): void {
    this.setCurrentDate();
    this.loadVoyages();
  }

  private setCurrentDate(): void {
    this.currentDate = new Date().toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  }

  private futureOrTodayValidator(control: AbstractControl): ValidationErrors | null {
    const value = control.value;
    if (!value) return null;
    const selected = new Date(value + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (selected < today) {
      return { pastDate: true };
    }
    return null;
  }

  private returnAfterDepartureValidator(group: AbstractControl): ValidationErrors | null {
    const departure = group.get('departureDate')?.value;
    const returnDate = group.get('returnDate')?.value;
    if (departure && returnDate) {
      const dep = new Date(departure + 'T00:00:00');
      const ret = new Date(returnDate + 'T00:00:00');
      if (ret < dep) {
        return { returnBeforeDeparture: true };
      }
    }
    return null;
  }

  private calculateDuration(): void {
    const departure = this.voyageForm.get('departureDate')?.value;
    const returnDate = this.voyageForm.get('returnDate')?.value;

    if (departure && returnDate) {
      const start = new Date(departure + 'T00:00:00');
      const end = new Date(returnDate + 'T00:00:00');
      const diffMs = end.getTime() - start.getTime();
      const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
      this.voyageForm.get('duration')?.setValue(Math.max(1, diffDays), { emitEvent: false });
    } else {
      this.voyageForm.get('duration')?.setValue(1, { emitEvent: false });
    }
  }

  get filteredVoyages(): Voyage[] {
    let result = [...this.voyages];

    switch (this.filterTab) {
      case 'open':
        result = result.filter((v) => v.status === 'OPEN');
        break;
      case 'full':
        result = result.filter((v) => v.status === 'FULL');
        break;
      case 'departed':
        result = result.filter((v) => v.status === 'DEPARTED' || this.isDeparted(v));
        break;
      case 'cancelled':
        result = result.filter((v) => v.status === 'CANCELLED');
        break;
      default:
        break;
    }

    if (this.dateFrom) {
      const fromDate = new Date(this.dateFrom);
      fromDate.setHours(0, 0, 0, 0);
      result = result.filter((v) => v.departureDate && new Date(v.departureDate) >= fromDate);
    }
    if (this.dateTo) {
      const toDate = new Date(this.dateTo);
      toDate.setHours(23, 59, 59, 999);
      result = result.filter((v) => v.departureDate && new Date(v.departureDate) <= toDate);
    }

    return result.sort((a, b) => {
      const aTime = a.createdAt ? new Date(a.createdAt).getTime() :
        a.departureDate ? new Date(a.departureDate).getTime() : 0;
      const bTime = b.createdAt ? new Date(b.createdAt).getTime() :
        b.departureDate ? new Date(b.departureDate).getTime() : 0;
      return bTime - aTime;
    });
  }

  private isDeparted(voyage: Voyage): boolean {
    if (!voyage.departureDate) return false;
    return new Date(voyage.departureDate) < new Date();
  }

  getTabCount(tab: VoyageFilterTab): number {
    switch (tab) {
      case 'open':
        return this.voyages.filter((v) => v.status === 'OPEN').length;
      case 'full':
        return this.voyages.filter((v) => v.status === 'FULL').length;
      case 'departed':
        return this.voyages.filter((v) => v.status === 'DEPARTED' || this.isDeparted(v)).length;
      case 'cancelled':
        return this.voyages.filter((v) => v.status === 'CANCELLED').length;
      default:
        return this.voyages.length;
    }
  }

  setFilterTab(tab: VoyageFilterTab): void {
    this.filterTab = tab;
  }

  clearDateFilter(): void {
    this.dateFrom = '';
    this.dateTo = '';
  }

  loadVoyages(): void {
    this.loading = true;
    this.voyageService.getMyVoyages(0, 100).subscribe({
      next: (data) => {
        this.voyages = data;
        this.loading = false;
      },
      error: (err) => {
        this.toast.error(err.error?.message || 'Erreur de chargement des voyages');
        this.loading = false;
      },
    });
  }

  getReservedSeats(voyage: Voyage): number {
    return voyage.totalSeats - voyage.availableSeats;
  }

  getFillRate(voyage: Voyage): number {
    if (voyage.totalSeats <= 0) return 0;
    return Math.round((this.getReservedSeats(voyage) / voyage.totalSeats) * 100);
  }

  getTopPassengers(_voyage: Voyage, _count: number): Passenger[] {
    return [];
  }

  getPassengerCount(voyage: Voyage): number {
    if (this.selectedVoyageForManage?.id === voyage.id) {
      return this.reservationsForSelected.length;
    }
    return this.getReservedSeats(voyage);
  }

  getPassengers(voyage: Voyage): Passenger[] {
    if (this.selectedVoyageForManage?.id !== voyage.id) return [];
    return this.reservationsForSelected.map((r) => ({
      reservationId: r.id,
      name:
        r.manualPassengerName ||
        (r.manualPassengerPhone ?? `Passager #${(r.passengerId || '').slice(-4)}`),
      email: '',
      phone: r.manualPassengerPhone || '—',
      seatNumber: `${r.seatsReserved} place(s)`,
      status: r.status,
      paymentMethod: r.manualBooking ? 'Espèces / Direct' : 'Carte bancaire',
      amount: r.totalPrice,
    }));
  }

  manageVoyage(voyage: Voyage): void {
    this.selectedVoyageForManage = voyage;
    this.activeTab = 'passengers';
    this.reservationsForSelected = [];
    this.voyageService.getVoyageReservations(voyage.id, 0, 200).subscribe({
      next: (data) => (this.reservationsForSelected = data),
      error: (err) => {
        this.toast.error(err.error?.message || 'Impossible de charger les réservations');
      },
    });
  }

  backToList(): void {
    this.selectedVoyageForManage = null;
    this.reservationsForSelected = [];
  }

  getDuration(voyage: Voyage): string {
    if (voyage.returnDate) {
      const start = new Date(voyage.departureDate);
      const end = new Date(voyage.returnDate);
      const days = Math.max(
        1,
        Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)),
      );
      return `${days} jours / ${Math.max(0, days - 1)} nuit`;
    }
    return '1 jour';
  }

  getTotalReservations(voyage: Voyage): number {
    return this.getPassengers(voyage).length;
  }

  getConfirmedCount(voyage: Voyage): number {
    return this.getPassengers(voyage).filter((p) => p.status === 'CONFIRMED').length;
  }

  getConfirmationRate(voyage: Voyage): number {
    const total = this.getTotalReservations(voyage);
    return total > 0 ? Math.round((this.getConfirmedCount(voyage) / total) * 100) : 0;
  }

  getPendingPaymentCount(voyage: Voyage): number {
    return this.getPassengers(voyage).filter(
      (p) => p.status === 'PENDING_PAYMENT' || p.status === 'PENDING_ORGANIZER',
    ).length;
  }

  getRevenue(voyage: Voyage): number {
    return this.getPassengers(voyage)
      .filter((p) => p.status === 'CONFIRMED')
      .reduce((sum, p) => sum + (p.amount ?? 0), 0);
  }

  getTargetRevenue(voyage: Voyage): number {
    return voyage.totalSeats * voyage.pricePerSeat;
  }

  getRevenuePercent(voyage: Voyage): number {
    const target = this.getTargetRevenue(voyage);
    return target > 0 ? Math.round((this.getRevenue(voyage) / target) * 100) : 0;
  }

  getAvailableSeats(voyage: Voyage): number {
    return voyage.availableSeats;
  }

  getFilteredPassengers(voyage: Voyage): Passenger[] {
    let passengers = this.getPassengers(voyage);
    const q = this.passengerSearch.trim().toLowerCase();
    if (q) {
      passengers = passengers.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.email || '').toLowerCase().includes(q) ||
          (p.phone || '').includes(q),
      );
    }
    return passengers;
  }

  getActivities(_voyage: Voyage): Activity[] {
    const activities: Activity[] = [];
    for (const r of this.reservationsForSelected) {
      if (r.status === 'CONFIRMED' && r.paidAt) {
        activities.push({
          title: 'Paiement validé',
          description: `${r.manualPassengerName || 'Un passager'} a réglé ${r.totalPrice} DT.`,
          time: this.relativeTime(r.paidAt),
          color: '#22c55e',
        });
      } else if (r.status === 'PENDING_ORGANIZER') {
        activities.push({
          title: 'Nouvelle réservation',
          description: `Demande en attente pour ${r.seatsReserved} place(s).`,
          time: this.relativeTime(r.createdAt),
          color: '#3b82f6',
        });
      }
    }
    return activities.slice(0, 6);
  }

  private relativeTime(iso: string): string {
    if (!iso) return '';
    const diffMs = Date.now() - new Date(iso).getTime();
    const minutes = Math.round(diffMs / 60000);
    if (minutes < 60) return `Il y a ${minutes} min`;
    const hours = Math.round(minutes / 60);
    if (hours < 24) return `Il y a ${hours} h`;
    const days = Math.round(hours / 24);
    return `Il y a ${days} j`;
  }

  statusLabel(s: string): string {
    const m: Record<string, string> = {
      PENDING_ORGANIZER: 'En attente',
      PENDING_PAYMENT: 'À payer',
      CONFIRMED: 'Confirmée',
      CANCELLED: 'Annulée',
    };
    return m[s] || s;
  }

  voyageStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      OPEN: 'Ouvert',
      FULL: 'Complet',
      DEPARTED: 'Parti',
      CANCELLED: 'Annulé',
      CLOSED: 'Fermé',
    };
    return labels[status] || status;
  }

  voyageStatusClass(status: string): string {
    const classes: Record<string, string> = {
      OPEN: 'status-open',
      FULL: 'status-full',
      DEPARTED: 'status-departed',
      CANCELLED: 'status-cancelled',
      CLOSED: 'status-closed',
    };
    return classes[status] || '';
  }

  openCreateModal(): void {
    this.isEditMode = false;
    this.selectedVoyage = null;
    this.voyageForm.reset({
      title: '',
      description: '',
      departureCity: '',
      arrivalCity: '',
      departureDate: '',
      returnDate: '',
      pricePerSeat: 0,
      totalSeats: 1,
      duration: 1,
    });
    this.imageFile = null;
    this.imagePreview = null;
    this.services = { transport: true, hebergement: false, petitDejeuner: false, guide: false };
    this.showModal = true;
  }

  openEditModal(voyage: Voyage): void {
    this.isEditMode = true;
    this.selectedVoyage = voyage;
    this.voyageForm.patchValue({
      title: voyage.title,
      description: voyage.description || '',
      departureCity: voyage.departureCity,
      arrivalCity: voyage.arrivalCity,
      departureDate: this.formatDateForInput(voyage.departureDate),
      returnDate: voyage.returnDate ? this.formatDateForInput(voyage.returnDate) : '',
      pricePerSeat: voyage.pricePerSeat,
      totalSeats: voyage.totalSeats,
    });
    this.calculateDuration();
    this.imageFile = null;
    this.imagePreview = voyage.imageUrl || null;
    this.showModal = true;
  }

  closeModal(): void {
    this.showModal = false;
    this.selectedVoyage = null;
    this.imageFile = null;
    this.imagePreview = null;
  }

  closeModalOnOverlay(event: MouseEvent): void {
    if (event.target === event.currentTarget) this.closeModal();
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) this.handleFile(input.files[0]);
  }

  onFileDrop(event: DragEvent): void {
    event.preventDefault();
    const f = event.dataTransfer?.files[0];
    if (f) this.handleFile(f);
  }

  handleFile(file: File): void {
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      this.toast.error('Image trop volumineuse (max 10 Mo)');
      return;
    }
    if (!['image/jpeg', 'image/png', 'image/jpg'].includes(file.type)) {
      this.toast.error('Format non supporté (JPG, PNG uniquement)');
      return;
    }
    this.imageFile = file;
    const reader = new FileReader();
    reader.onload = () => (this.imagePreview = reader.result as string);
    reader.readAsDataURL(file);
  }

  onSubmit(): void {
    if (this.voyageForm.invalid) {
      this.voyageForm.markAllAsTouched();

      if (this.voyageForm.hasError('returnBeforeDeparture')) {
        this.toast.error('La date de retour doit être après la date de départ');
        return;
      }
      if (this.voyageForm.get('departureDate')?.hasError('pastDate')) {
        this.toast.error('La date de départ ne peut pas être dans le passé');
        return;
      }

      this.toast.error('Veuillez remplir tous les champs obligatoires');
      return;
    }

    this.submitting = true;
    const formValue = this.voyageForm.value;

    const payload: CreateVoyageRequest | UpdateVoyageRequest = {
      title: formValue.title,
      description: formValue.description || undefined,
      departureCity: formValue.departureCity,
      arrivalCity: formValue.arrivalCity,
      departureDate: formValue.departureDate + 'T00:00:00',
      returnDate: formValue.returnDate ? formValue.returnDate + 'T00:00:00' : undefined,
      pricePerSeat: Number(formValue.pricePerSeat),
      totalSeats: Number(formValue.totalSeats),
    };

    if (this.isEditMode && this.selectedVoyage) {
      this.voyageService.updateVoyage(this.selectedVoyage.id, payload as UpdateVoyageRequest)
        .subscribe({
          next: (updated) => {
            this.toast.success('Voyage modifié avec succès');
            if (this.imageFile) {
              this.uploadImage(updated.id);
            } else {
              this.afterSave();
            }
          },
          error: (err) => {
            this.toast.error(err.error?.message || 'Erreur lors de la modification');
            this.submitting = false;
          },
        });
    } else {
      this.voyageService.createVoyage(payload as CreateVoyageRequest).subscribe({
        next: (created) => {
          this.toast.success('Voyage créé avec succès');
          if (this.imageFile) {
            this.uploadImage(created.id);
          } else {
            this.afterSave();
          }
        },
        error: (err) => {
          this.toast.error(err.error?.message || 'Erreur lors de la création');
          this.submitting = false;
        },
      });
    }
  }

  private uploadImage(voyageId: string): void {
    if (!this.imageFile) {
      this.afterSave();
      return;
    }
    this.uploading = true;
    this.voyageService.uploadVoyageImage(voyageId, this.imageFile).subscribe({
      next: () => {
        this.toast.success('Image téléchargée');
        this.uploading = false;
        this.afterSave();
      },
      error: (err) => {
        this.toast.error(err.error?.message || 'Erreur lors de l\'upload de l\'image');
        this.uploading = false;
        this.afterSave();
      },
    });
  }

  private afterSave(): void {
    this.submitting = false;
    this.closeModal();
    this.loadVoyages();
  }

  async deleteVoyage(id: string): Promise<void> {
    return this.cancelVoyage(id);
  }

  async cancelVoyage(id: string): Promise<void> {
    const ok = await this.confirmModal.confirm(
      'Annuler ce voyage ? Les passagers seront notifiés et le statut passera à CANCELLED.',
      'Annulation',
    );
    if (!ok) return;

    this.voyageService.cancelVoyage(id).subscribe({
      next: () => {
        this.toast.success('Voyage annulé');
        this.backToList();
        this.loadVoyages();
      },
      error: (err) => {
        this.toast.error(err.error?.message || 'Erreur lors de l\'annulation');
      },
    });
  }

  openAddPassengerModal(): void {
    if (!this.selectedVoyageForManage) return;
    this.router.navigate(['/organizer/reservations'], {
      queryParams: { voyageId: this.selectedVoyageForManage.id },
    });
  }

  private formatDateForInput(dateStr: string): string {
    if (!dateStr) return '';
    return dateStr.split('T')[0];
  }

  openManualBookingModal(voyageId: string): void {
    this.manualBookingVoyageId = voyageId;
    this.manualBooking = {
      passengerName: '',
      passengerPhone: '',
      seatsReserved: 1,
      bookingSource: BookingSource.PHONE,
      depositAmount: null,
    };
    const el = document.getElementById('orgManualBookingModal');
    const bootstrap = (window as any).bootstrap;
    if (el && bootstrap?.Modal) {
      this.manualModalInstance = new bootstrap.Modal(el);
      this.manualModalInstance.show();
    }
  }

  confirmManualBooking(): void {
    const { passengerName, passengerPhone, seatsReserved, bookingSource, depositAmount } =
      this.manualBooking;

    if (!passengerName?.trim() || !passengerPhone?.trim()) {
      this.toast.warning('Nom et téléphone sont requis');
      return;
    }
    if (!/^\+?[1-9]\d{7,14}$/.test(passengerPhone.replace(/\s+/g, ''))) {
      this.toast.warning('Numéro de téléphone invalide');
      return;
    }
    if (seatsReserved < 1 || seatsReserved > 20) {
      this.toast.warning('Le nombre de places doit être compris entre 1 et 20');
      return;
    }

    this.voyageService
      .organizerManualBooking({
        voyageId: this.manualBookingVoyageId,
        passengerName: passengerName.trim(),
        passengerPhone: passengerPhone.replace(/\s+/g, ''),
        seatsReserved,
        bookingSource,
        depositAmount: depositAmount ?? undefined,
      })
      .subscribe({
        next: () => {
          this.manualModalInstance?.hide();
          this.toast.success('Réservation hors-plateforme enregistrée');
          this.loadVoyages();
          if (this.selectedVoyageForManage?.id === this.manualBookingVoyageId) {
            this.manageVoyage(this.selectedVoyageForManage);
          }
        },
        error: (err) =>
          this.toast.error(err.error?.message || 'Erreur lors de la réservation manuelle'),
      });
  }

  // TrackBy functions
  trackByVoyageId(index: number, voyage: Voyage): string {
    return voyage.id;
  }

  trackByPassengerName(index: number, passenger: Passenger): string {
    return passenger.name + index;
  }

  trackByActivityTitle(index: number, activity: Activity): string {
    return activity.title + index;
  }
}
