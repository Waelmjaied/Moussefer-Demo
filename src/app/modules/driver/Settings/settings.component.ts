import { Component, OnInit, ViewEncapsulation } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { CommonModule, DatePipe } from '@angular/common';
import { Router } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { UserService } from '../../../core/services/user.service';
import { ToastService } from '../../../core/services/toast.service';
import {
  DriverDocumentsService,
  DriverDocument,
} from '../../../core/services/driver-documents.service';
import { DriverSidebarComponent } from '../driver-sidebar/driver-sidebar.component';

export interface ProfileDocument {
  id: string;
  documentType: string;
  name: string;
  status: 'APPROVED' | 'PENDING_REVIEW' | 'REJECTED' | 'EXPIRED';
  meta: string;
  icon: string;
}

export interface DriverProfile {
  id?: string;
  fullName?: string;
  email?: string;
  phone?: string;
  city?: string;
  role?: string;
  avatarUrl?: string;
  isOnline?: boolean;
  vehicleBrand?: string;
  vehicleModel?: string;
  vehiclePlate?: string;
  vehicleColor?: string;
  vehicleYear?: number;
  vehicleImageUrl?: string;
  vehicleCapacity?: number;
  vehicleType?: string;
  mainRoute?: string;
  pricePerSeat?: number;
  monthlyGoal?: number;
  acceptCollective?: boolean;
  autoAvailability?: boolean;
  notifications?: {
    newReservations?: boolean;
    collectiveRequests?: boolean;
    departureReminder?: boolean;
    newReviews?: boolean;
    promotions?: boolean;
  };
  documents?: ProfileDocument[];
}

const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  CIN: "Carte d'identité nationale",
  DRIVING_LICENSE_FRONT: 'Permis de conduire (recto)',
  DRIVING_LICENSE_BACK: 'Permis de conduire (verso)',
  VEHICLE_PHOTO: 'Photo du véhicule',
  INSURANCE: 'Assurance véhicule',
  TECHNICAL_VISIT: 'Visite technique',
  LOUAGE_AUTHORIZATION: 'Autorisation louage',
  OTHER: 'Autre document',
};

const DOCUMENT_TYPE_ICONS: Record<string, string> = {
  CIN: 'person-vcard',
  DRIVING_LICENSE_FRONT: 'card-image',
  DRIVING_LICENSE_BACK: 'card-image',
  VEHICLE_PHOTO: 'car-front',
  INSURANCE: 'shield-check',
  TECHNICAL_VISIT: 'tools',
  LOUAGE_AUTHORIZATION: 'file-earmark-check',
  OTHER: 'file-earmark',
};

@Component({
  selector: 'app-settings',
  standalone: true,
  encapsulation: ViewEncapsulation.None,
  imports: [CommonModule, ReactiveFormsModule, DriverSidebarComponent],
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.css'],
})
export class SettingsComponent implements OnInit {
  vehiculeForm: FormGroup;
  loading = true;
  saving = false;
  successMessage = '';
  errorMessage = '';
  currentYear = new Date().getFullYear();
  today = new Date();

  user: DriverProfile | null = null;

  toggles = {
    newReservations: true,
    collectiveRequests: true,
    departureReminder: false,
    newReviews: true,
    promotions: false,
    autoAvailability: true,
  };

  constructor(
    private fb: FormBuilder,
    private userService: UserService,
    private docService: DriverDocumentsService,
    private toast: ToastService,
    private router: Router,
  ) {
    this.vehiculeForm = this.fb.group({
      vehicleBrand: ['', Validators.required],
      vehicleModel: ['', Validators.required],
      vehiclePlate: ['', Validators.required],
      vehicleColor: [''],
      vehicleYear: [null, [Validators.min(1900), Validators.max(this.currentYear)]],
    });
  }

  ngOnInit(): void {
    this.loadProfile();
  }

  loadProfile(): void {
    this.loading = true;

    forkJoin({
      profile: this.userService.getMyProfile(),
      documents: this.docService
        .getMyDocuments()
        .pipe(catchError(() => of([] as DriverDocument[]))),
    }).subscribe({
      next: ({ profile, documents }) => {
        this.user = this.normalizeProfile(profile, documents);
        this.patchForm(this.user);
        this.syncToggles(this.user);
        this.loading = false;
      },
      error: () => {
        this.errorMessage = 'Impossible de charger les informations du profil.';
        this.loading = false;
      },
    });
  }

  private normalizeProfile(raw: any, documents: DriverDocument[]): DriverProfile {
    // ── VEHICLE PHOTO: use the latest uploaded VEHICLE_PHOTO document ──
    const vehiclePhotoDoc = documents
      ?.filter((d) => d.documentType === 'VEHICLE_PHOTO')
      .sort(
        (a, b) =>
          new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime(),
      )[0];

    const vehiclePhotoUrl = vehiclePhotoDoc?.fileUrl || raw?.vehicleImageUrl;

    return {
      id: raw?.id || '',
      fullName: raw?.fullName || raw?.name || 'Chauffeur',
      email: raw?.email || '',
      phone: raw?.phone || '',
      city: raw?.city || '',
      role: raw?.role || 'Chauffeur Partenaire',
      avatarUrl: raw?.avatarUrl,
      isOnline: raw?.isOnline ?? true,
      vehicleBrand: raw?.vehicleBrand || '',
      vehicleModel: raw?.vehicleModel || '',
      vehiclePlate: raw?.vehiclePlate || '',
      vehicleColor: raw?.vehicleColor || '',
      vehicleYear: raw?.vehicleYear || null,
      vehicleImageUrl:
        vehiclePhotoUrl ||
        'https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?w=400&h=250&fit=crop',
      vehicleCapacity: raw?.vehicleCapacity || 8,
      vehicleType: raw?.vehicleType || 'Van VIP',
      mainRoute: raw?.mainRoute || 'Tunis → Sfax',
      pricePerSeat: raw?.pricePerSeat || 18,
      monthlyGoal: raw?.monthlyGoal || 400,
      acceptCollective: raw?.acceptCollective ?? true,
      autoAvailability: raw?.autoAvailability ?? true,
      notifications: {
        newReservations: raw?.notifications?.newReservations ?? true,
        collectiveRequests: raw?.notifications?.collectiveRequests ?? true,
        departureReminder: raw?.notifications?.departureReminder ?? false,
        newReviews: raw?.notifications?.newReviews ?? true,
        promotions: raw?.notifications?.promotions ?? false,
      },
      documents: this.mapDocuments(documents),
    };
  }

  private mapDocuments(docs: DriverDocument[]): ProfileDocument[] {
    if (!docs?.length) return [];

    return docs
      .filter((d) => !!d?.documentType)
      .map((d) => ({
        id: d.id,
        documentType: d.documentType,
        name: DOCUMENT_TYPE_LABELS[d.documentType] ?? d.documentType,
        status: d.status as ProfileDocument['status'],
        meta: this.buildMeta(d),
        icon: DOCUMENT_TYPE_ICONS[d.documentType] ?? 'file-earmark',
      }));
  }

  private buildMeta(d: DriverDocument): string {
    const uploadedAt = d.uploadedAt ? this.formatDate(d.uploadedAt) : null;
    const expiryDate = d.expiryDate ? this.formatDate(d.expiryDate) : null;

    switch (d.status) {
      case 'APPROVED':
        return expiryDate ? `Valide jusqu'au ${expiryDate}` : "Validé par l'administration";
      case 'PENDING_REVIEW':
        return uploadedAt
          ? `Soumis le ${uploadedAt} — en attente de validation`
          : 'En attente de validation';
      case 'REJECTED':
        return d.rejectionReason ? `Motif : ${d.rejectionReason}` : 'Document refusé';
      case 'EXPIRED':
        return expiryDate ? `Expiré le ${expiryDate}` : 'Document expiré';
      default:
        return '';
    }
  }

  private formatDate(iso: string): string {
    try {
      return new DatePipe('fr-FR').transform(iso, 'd MMM y') ?? iso;
    } catch {
      return iso;
    }
  }

  private patchForm(user: DriverProfile): void {
    this.vehiculeForm.patchValue({
      vehicleBrand: user.vehicleBrand || '',
      vehicleModel: user.vehicleModel || '',
      vehiclePlate: user.vehiclePlate || '',
      vehicleColor: user.vehicleColor || '',
      vehicleYear: user.vehicleYear || null,
    });
  }

  private syncToggles(user: DriverProfile): void {
    if (user.notifications) {
      this.toggles.newReservations = user.notifications.newReservations ?? true;
      this.toggles.collectiveRequests = user.notifications.collectiveRequests ?? true;
      this.toggles.departureReminder = user.notifications.departureReminder ?? false;
      this.toggles.newReviews = user.notifications.newReviews ?? true;
      this.toggles.promotions = user.notifications.promotions ?? false;
    }
    this.toggles.autoAvailability = user.autoAvailability ?? true;
  }

  onSubmit(): void {
    if (this.vehiculeForm.invalid) return;
    this.saving = true;
    this.errorMessage = '';
    this.successMessage = '';

    this.userService.updateMyProfile(this.vehiculeForm.value).subscribe({
      next: () => {
        this.successMessage = 'Véhicule enregistré avec succès !';
        this.saving = false;
        setTimeout(() => (this.successMessage = ''), 3000);
      },
      error: (err) => {
        this.errorMessage = err.error?.message || "Erreur lors de l'enregistrement.";
        this.saving = false;
      },
    });
  }

  updateToggle(key: keyof typeof this.toggles, value: boolean): void {
    this.toggles[key] = value;
  }

  getInitials(name?: string): string {
    if (!name) return 'C';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  }

  getDocStatusClass(status: string): string {
    switch (status) {
      case 'APPROVED':
        return 'valid';
      case 'PENDING_REVIEW':
        return 'warning';
      case 'EXPIRED':
        return 'warning';
      case 'REJECTED':
        return 'danger';
      default:
        return '';
    }
  }

  getDocStatusLabel(status: string): string {
    switch (status) {
      case 'APPROVED':
        return 'Validé';
      case 'PENDING_REVIEW':
        return 'En attente';
      case 'REJECTED':
        return 'Refusé';
      case 'EXPIRED':
        return 'Expiré';
      default:
        return status;
    }
  }

  getDocActionLabel(status: string): string {
    if (status === 'EXPIRED') return 'Renouveler';
    return 'Modifier';
  }

  canModifyDocument(status: string): boolean {
    return status === 'REJECTED' || status === 'EXPIRED';
  }

  modifyDocument(_doc?: ProfileDocument): void {
    void this.router.navigate(['/driver/documents']);
  }

  publishTrip(): void {
    this.toast.info('Publication de trajet - à implémenter');
  }

  shareProfile(): void {
    this.toast.info('Partage de profil - à implémenter');
  }

  editProfile(): void {
    this.toast.info('Modification du profil - à implémenter');
  }

  editRoute(): void {
    this.toast.info('Modification de la ligne - à implémenter');
  }

  changePassword(): void {
    this.toast.info('Changement de mot de passe - à implémenter');
  }

  deactivateAccount(): void {
    this.toast.info('Désactivation du compte - à implémenter');
  }

  deleteAccount(): void {
    this.toast.info('Suppression du compte - à implémenter');
  }
}
