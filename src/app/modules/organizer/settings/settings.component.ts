import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import {
  ReactiveFormsModule,
  FormBuilder,
  FormGroup,
  Validators,
  FormsModule,
} from '@angular/forms';
import { HttpClient } from '@angular/common/http';

import { OrganizerSidebarComponent } from '../organizer-sidebar/organizer-sidebar.component';
import { AuthService } from '../../../core/services/auth.service';
import { ToastService } from '../../../core/services/toast.service';
import { environment } from '../../../../environments/environment';

interface Preference {
  key: string;
  label: string;
  description: string;
  icon: string;
  iconBg: string;
  iconColor: string;
  enabled: boolean;
}

/**
 * Shape of the JSON returned by GET /api/v1/users/me (user-service).
 * Only the fields the settings page uses are typed here.
 */
interface UserProfileResponse {
  userId: string;
  email: string;
  name: string;
  phoneNumber?: string;
  profilePictureUrl?: string;
  companyName?: string;
  companyRegistration?: string;
  verifiedOrganizer?: boolean;
}

/**
 * Shape of the JSON sent to PUT /api/v1/users/me. Only fields the
 * settings UI exposes are included; the user-service merges the
 * partial update.
 */
interface UpdateProfileRequest {
  name?: string;
  phoneNumber?: string;
  companyName?: string;
  companyRegistration?: string;
}

/**
 * Organizer "Paramètres" page.
 *
 * Backend mapping:
 *  - GET /api/v1/users/me        → load profile (companyName / companyRegistration)
 *  - PUT /api/v1/users/me        → save profile
 *  - POST /api/v1/auth/logout    → already wired in AuthService
 *
 * Notification preferences are persisted in {@code localStorage} for now.
 * They will move to a dedicated backend endpoint once user-service exposes
 * one — the storage key {@code organizer.notification-prefs} is stable.
 */
@Component({
  selector: 'app-organizer-settings',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    ReactiveFormsModule,
    FormsModule,
    OrganizerSidebarComponent,
  ],
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.css'],
})
export class OrganizerSettingsComponent implements OnInit {
  private static readonly PREFS_STORAGE_KEY = 'organizer.notification-prefs';

  userEmail: string;
  currentDate = '';
  agencyName = 'Bonjour Tunisia Tours';
  loading = true;
  savingProfile = false;
  savingPrefs = false;

  profileForm: FormGroup;

  preferences: Preference[] = [
    {
      key: 'new_reservation',
      label: 'Nouvelle réservation',
      description: 'Recevoir une alerte pour chaque commande',
      icon: 'bi-plus-circle',
      iconBg: '#f0fdf4',
      iconColor: '#16a34a',
      enabled: true,
    },
    {
      key: 'payment_reminder',
      label: 'Rappel paiement',
      description: 'Notifications pour factures impayées',
      icon: 'bi-credit-card',
      iconBg: '#eff6ff',
      iconColor: '#3b82f6',
      enabled: true,
    },
    {
      key: 'auto_confirm',
      label: 'Confirmation automatique',
      description: 'Valider les trajets sans intervention',
      icon: 'bi-gear',
      iconBg: '#f1f5f9',
      iconColor: '#64748b',
      enabled: false,
    },
    {
      key: 'sms_alerts',
      label: 'Alertes SMS',
      description: 'Messages critiques sur mobile',
      icon: 'bi-chat-dots',
      iconBg: '#fef3c7',
      iconColor: '#d97706',
      enabled: true,
    },
    {
      key: 'weekly_report',
      label: 'Rapport hebdomadaire',
      description: 'Résumé des activités par e-mail',
      icon: 'bi-bar-chart',
      iconBg: '#f3e8ff',
      iconColor: '#7c3aed',
      enabled: true,
    },
  ];

  constructor(
    private authService: AuthService,
    private router: Router,
    private fb: FormBuilder,
    private http: HttpClient,
    private toast: ToastService,
  ) {
    this.userEmail = this.authService.getUserEmail() || '';

    this.profileForm = this.fb.group({
      organizationName: ['', [Validators.required, Validators.maxLength(150)]],
      email: [{ value: this.userEmail, disabled: true }, [Validators.required, Validators.email]],
      phone: ['', [Validators.pattern(/^\+?[1-9]\d{7,14}$/)]],
      website: [''],                               // UI-only, not persisted today
      description: ['', Validators.maxLength(500)],// UI-only, not persisted today
      companyRegistration: ['', Validators.maxLength(80)],
    });
  }

  ngOnInit(): void {
    this.setCurrentDate();
    this.loadProfile();
    this.loadPreferencesFromStorage();
  }

  private setCurrentDate(): void {
    this.currentDate = new Date().toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  }

  loadProfile(): void {
    this.loading = true;
    this.http.get<UserProfileResponse>(`${environment.apiUrl}/api/v1/users/me`).subscribe({
      next: (profile) => {
        this.profileForm.patchValue({
          organizationName: profile.companyName || '',
          email: profile.email || this.userEmail,
          phone: profile.phoneNumber || '',
          companyRegistration: profile.companyRegistration || '',
        });
        if (profile.email) this.userEmail = profile.email;
        this.loading = false;
      },
      error: () => {
        // Non-blocking — the form stays editable with defaults.
        this.loading = false;
      },
    });
  }

  saveProfile(): void {
    if (this.profileForm.invalid) {
      this.profileForm.markAllAsTouched();
      this.toast.warning('Veuillez corriger les champs invalides');
      return;
    }
    this.savingProfile = true;

    const v = this.profileForm.value;
    const payload: UpdateProfileRequest = {
      name: v.organizationName,                    // re-uses the `name` field on UserProfile
      phoneNumber: v.phone || undefined,
      companyName: v.organizationName,
      companyRegistration: v.companyRegistration || undefined,
    };

    this.http
      .put<UserProfileResponse>(`${environment.apiUrl}/api/v1/users/me`, payload)
      .subscribe({
        next: () => {
          this.toast.success('Profil mis à jour');
          this.savingProfile = false;
        },
        error: (err) => {
          this.toast.error(err.error?.message || 'Erreur lors de la sauvegarde');
          this.savingProfile = false;
        },
      });
  }

  resetProfile(): void {
    this.loadProfile();
  }

  onPreferenceChange(_: Preference): void {
    // No-op — the user clicks "Enregistrer" to commit.
  }

  // ---- Notification preferences (localStorage until backend support) ---

  savePreferences(): void {
    this.savingPrefs = true;
    try {
      const payload = this.preferences.map((p) => ({ key: p.key, enabled: p.enabled }));
      localStorage.setItem(
        OrganizerSettingsComponent.PREFS_STORAGE_KEY,
        JSON.stringify(payload),
      );
      this.toast.success('Préférences enregistrées');
    } catch {
      this.toast.error('Impossible d\'enregistrer les préférences');
    } finally {
      this.savingPrefs = false;
    }
  }

  private loadPreferencesFromStorage(): void {
    try {
      const raw = localStorage.getItem(OrganizerSettingsComponent.PREFS_STORAGE_KEY);
      if (!raw) return;
      const stored: { key: string; enabled: boolean }[] = JSON.parse(raw);
      for (const item of stored) {
        const pref = this.preferences.find((p) => p.key === item.key);
        if (pref) pref.enabled = !!item.enabled;
      }
    } catch {
      // Ignore corrupted storage — defaults kick in.
    }
  }

  changePassword(): void {
    this.router.navigate(['/auth/forgot-password']);
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/auth/login']);
  }
}
