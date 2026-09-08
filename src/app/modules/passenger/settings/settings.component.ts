import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { finalize } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { UserService, UserProfile } from '../../../core/services/user.service';
import { FormsModule } from '@angular/forms';

type ConfirmAction = 'email' | 'push' | 'deactivate' | 'logout' | null;

@Component({
  selector: 'app-passenger-settings',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.css'],
})
export class PassengerSettingsComponent implements OnInit {
  userEmail: string = '';
  userProfile: UserProfile | null = null;

  // Notification states
  emailNotificationsEnabled = true;
  pushNotificationsEnabled = true;

  // Pending states (before confirmation)
  pendingEmailState = true;
  pendingPushState = true;

  // UI states
  isLoading = false;
  isDeactivating = false;
  isProcessing = false;

  // Confirmation modal
  showConfirmModal = false;
  confirmAction: ConfirmAction = null;
  confirmTitle = '';
  confirmMessage = '';
  confirmWarning = '';
  confirmButtonText = '';
  confirmButtonClass = '';
  confirmInputRequired = false;
  confirmInputValue = '';
  confirmInputPlaceholder = '';

  constructor(
    private authService: AuthService,
    private userService: UserService,
    private router: Router,
  ) {
    this.userEmail = this.authService.getUserEmail() || '';
  }

  ngOnInit(): void {
    this.loadUserProfile();
  }

  private loadUserProfile(): void {
    this.isLoading = true;
    this.userService
      .getMyProfile()
      .pipe(finalize(() => (this.isLoading = false)))
      .subscribe({
        next: (profile) => {
          this.userProfile = profile;
        },
        error: (err) => {
          console.error('Failed to load profile', err);
        },
      });
  }

  // ─── Toggle Handlers ───

  onEmailToggle(event: Event): void {
    const checkbox = event.target as HTMLInputElement;
    const newState = checkbox.checked;

    if (newState === this.emailNotificationsEnabled) return;

    this.pendingEmailState = newState;
    this.openConfirmModal({
      action: 'email',
      title: newState
        ? 'Activer les notifications email ?'
        : 'Désactiver les notifications email ?',
      message: newState
        ? 'Vous recevrez des emails concernant vos trajets, promotions et mises à jour importantes.'
        : "Vous ne recevrez plus d'emails. Certaines informations importantes pourraient vous manquer.",
      warning: !newState ? 'Cette action réduit la sécurité de votre compte.' : undefined,
      buttonText: newState ? 'Oui, activer' : 'Oui, désactiver',
      buttonClass: newState ? 'btn-success' : 'btn-warning',
      inputRequired: !newState,
      inputPlaceholder: !newState ? 'Tapez DESACTIVER pour confirmer' : undefined,
    });
  }

  onPushToggle(event: Event): void {
    const checkbox = event.target as HTMLInputElement;
    const newState = checkbox.checked;

    if (newState === this.pushNotificationsEnabled) return;

    this.pendingPushState = newState;
    this.openConfirmModal({
      action: 'push',
      title: newState ? 'Activer les notifications push ?' : 'Désactiver les notifications push ?',
      message: newState
        ? 'Vous recevrez des alertes en temps réel sur votre téléphone.'
        : "Vous ne recevrez plus d'alertes instantanées. Vous devrez ouvrir l'application pour voir les mises à jour.",
      warning: !newState ? 'Vous pourriez manquer des alertes de trajet urgentes.' : undefined,
      buttonText: newState ? 'Oui, activer' : 'Oui, désactiver',
      buttonClass: newState ? 'btn-success' : 'btn-warning',
      inputRequired: !newState,
      inputPlaceholder: !newState ? 'Tapez DESACTIVER pour confirmer' : undefined,
    });
  }

  // ─── Account Actions ───

  onDeactivateAccount(): void {
    this.openConfirmModal({
      action: 'deactivate',
      title: 'Désactiver votre compte ?',
      message:
        'Votre compte sera désactivé et vous ne pourrez plus vous connecter. Vos données seront conservées pendant 30 jours avant suppression définitive.',
      warning: 'Cette action est irréversible après 30 jours.',
      buttonText: 'Désactiver mon compte',
      buttonClass: 'btn-danger',
      inputRequired: true,
      inputPlaceholder: 'Tapez DESACTIVER pour confirmer',
    });
  }

  onLogout(): void {
    this.openConfirmModal({
      action: 'logout',
      title: 'Se déconnecter ?',
      message: 'Vous devrez saisir vos identifiants lors de votre prochaine connexion.',
      buttonText: 'Se déconnecter',
      buttonClass: 'btn-outline-dark',
    });
  }

  // ─── Confirmation Modal Logic ───

  private openConfirmModal(config: {
    action: ConfirmAction;
    title: string;
    message: string;
    warning?: string;
    buttonText: string;
    buttonClass: string;
    inputRequired?: boolean;
    inputPlaceholder?: string;
  }): void {
    this.confirmAction = config.action;
    this.confirmTitle = config.title;
    this.confirmMessage = config.message;
    this.confirmWarning = config.warning || '';
    this.confirmButtonText = config.buttonText;
    this.confirmButtonClass = config.buttonClass;
    this.confirmInputRequired = config.inputRequired || false;
    this.confirmInputPlaceholder = config.inputPlaceholder || '';
    this.confirmInputValue = '';
    this.showConfirmModal = true;
  }

  closeConfirmModal(): void {
    this.showConfirmModal = false;
    this.confirmAction = null;
    this.confirmInputValue = '';

    // Reset checkboxes to actual state if cancelled
    this.pendingEmailState = this.emailNotificationsEnabled;
    this.pendingPushState = this.pushNotificationsEnabled;
  }

  isConfirmButtonDisabled(): boolean {
    if (this.isProcessing) return true;
    if (!this.confirmInputRequired) return false;
    return this.confirmInputValue.trim().toUpperCase() !== 'DESACTIVER';
  }

  executeConfirmedAction(): void {
    if (this.isConfirmButtonDisabled()) return;

    this.isProcessing = true;

    switch (this.confirmAction) {
      case 'email':
        this.emailNotificationsEnabled = this.pendingEmailState;
        this.showConfirmModal = false;
        this.isProcessing = false;
        // TODO: API call
        break;

      case 'push':
        this.pushNotificationsEnabled = this.pendingPushState;
        this.showConfirmModal = false;
        this.isProcessing = false;
        // TODO: API call
        break;

      case 'deactivate':
        this.userService
          .deactivateMyAccount()
          .pipe(
            finalize(() => {
              this.isProcessing = false;
              this.isDeactivating = false;
            }),
          )
          .subscribe({
            next: () => {
              this.showConfirmModal = false;
              this.authService.logout();
              this.router.navigate(['/auth/login']);
            },
            error: (err) => {
              alert('Erreur lors de la désactivation. Veuillez réessayer.');
              console.error(err);
            },
          });
        break;

      case 'logout':
        this.showConfirmModal = false;
        this.isProcessing = false;
        this.authService.logout();
        this.router.navigate(['/auth/login']);
        break;
    }
  }
}
