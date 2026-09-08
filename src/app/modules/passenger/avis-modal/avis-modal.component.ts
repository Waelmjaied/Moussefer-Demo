import { Component, Input, Output, EventEmitter } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { AvisService } from '../../../core/services/avis.service';
import { ReservationResponse } from '../../../core/models/reservation.model';

@Component({
  selector: 'app-avis-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './avis-modal.component.html',
  styleUrls: ['./avis-modal.component.css'],
})
export class AvisModalComponent {
  @Input() reservation!: ReservationResponse;
  @Output() close = new EventEmitter<void>();
  @Output() submitted = new EventEmitter<void>();

  avisForm: FormGroup;
  loading = false;
  errorMessage = '';
  stars = [1, 2, 3, 4, 5];

  constructor(private fb: FormBuilder, private avisService: AvisService) {
    this.avisForm = this.fb.group({
      rating:  [5, [Validators.required, Validators.min(1), Validators.max(5)]],
      comment: [''],
    });
  }

  setRating(n: number): void {
    this.avisForm.patchValue({ rating: n });
  }

  onSubmit(): void {
    if (this.avisForm.invalid || !this.reservation) return;
    this.loading = true;
    this.errorMessage = '';

    this.avisService
      .submitAvis({
        driverId: this.reservation.driverId,
        trajetId: this.reservation.trajetId,
        reservationId: this.reservation.id, // FIX 7: link avis to reservation
        rating: this.avisForm.value.rating,
        comment: this.avisForm.value.comment || undefined,
      })
      .subscribe({
        next: () => {
          this.loading = false;
          this.submitted.emit();
          this.close.emit();
        },
        error: (err) => {
          this.errorMessage = err.error?.message || 'Erreur';
          this.loading = false;
        },
      });
  }
}
