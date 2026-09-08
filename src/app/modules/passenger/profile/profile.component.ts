import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import {
  UserService,
  UserProfile,
  UpdateProfileRequest,
} from '../../../core/services/user.service';
import { ReservationService } from '../../../core/services/reservation.service';
import { Location } from '@angular/common';

@Component({
  selector: 'app-passenger-profile',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.css'],
})
export class PassengerProfileComponent implements OnInit {
  loading = true;
  user: UserProfile | null = null;
  totalTrips = 0;
  joinedDate = '';
  initials = '?';

  isEditing = false;
  editForm: FormGroup;
  saving = false;

  uploadStatus: { type: 'success' | 'error'; message: string } | null = null;

  constructor(
    private userService: UserService,
    private reservationService: ReservationService,
    private location: Location,
    private fb: FormBuilder,
  ) {
    this.editForm = this.fb.group({
      name: ['', Validators.required], // ← lowercase to match UpdateProfileRequest
      phoneNumber: [''],
    });
  }

  ngOnInit(): void {
    this.loadProfile();
    this.loadReservations();
  }

  private loadProfile(): void {
    this.userService.getMyProfile().subscribe({
      next: (u) => {
        this.user = u;
        this.loading = false;
        this.joinedDate = 'janvier 2024';

        // Set initials from name
        const name = u.name || '';
        this.initials =
          name
            .split(' ')
            .map((p) => p[0]?.toUpperCase())
            .join('')
            .slice(0, 2) || '?';

        // Patch form
        this.editForm.patchValue({
          name: u.name || '', // ← lowercase
          phoneNumber: u.phoneNumber || '',
        });
      },
      error: () => {
        this.loading = false;
      },
    });
  }

  private loadReservations(): void {
    this.reservationService.getMyReservations().subscribe({
      next: (res) => {
        this.totalTrips = res.length;
      },
      error: () => {},
    });
  }

  toggleEdit(): void {
    if (this.isEditing) {
      this.saveProfile();
    } else {
      this.isEditing = true;
    }
  }

  cancelEdit(): void {
    this.isEditing = false;
    if (this.user) {
      this.editForm.patchValue({
        name: this.user.name || '', // ← lowercase
        phoneNumber: this.user.phoneNumber || '',
      });
    }
  }

  saveProfile(): void {
    if (this.editForm.invalid) return;

    this.saving = true;
    const updates: UpdateProfileRequest = this.editForm.value;

    this.userService.updateMyProfile(updates).subscribe({
      next: (updated) => {
        this.user = updated;
        this.isEditing = false;
        this.saving = false;
      },
      error: (err) => {
        this.saving = false;
        console.error('Update failed', err);
      },
    });
  }

  onPhotoSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      this.uploadStatus = { type: 'error', message: 'Veuillez sélectionner une image (JPG, PNG)' };
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      this.uploadStatus = { type: 'error', message: "L'image ne doit pas dépasser 5 Mo" };
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        if (img.width < 100 || img.height < 100) {
          this.uploadStatus = { type: 'error', message: "L'image est trop petite (min 100x100px)" };
          return;
        }
        this.uploadPhoto(file);
      };
      img.onerror = () => {
        this.uploadStatus = { type: 'error', message: "Format d'image invalide" };
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
    input.value = '';
  }

  private uploadPhoto(file: File): void {
    if (!this.user?.userId) return;

    this.uploadStatus = { type: 'success', message: 'Upload en cours...' };

    this.userService.uploadProfilePicture(file).subscribe({
      next: (res) => {
        if (this.user) {
          this.user = { ...this.user, profilePictureUrl: res.profilePictureUrl };
        }
        this.uploadStatus = { type: 'success', message: 'Photo mise à jour avec succès' };
        setTimeout(() => (this.uploadStatus = null), 3000);
      },
      error: (err) => {
        this.uploadStatus = {
          type: 'error',
          message:
            err.status === 404
              ? "Service d'upload non disponible. Contactez l'administrateur."
              : "Erreur lors de l'upload. Vérifiez que l'image est appropriée.",
        };
      },
    });
  }

  goBack(): void {
    this.location.back();
  }
}
