import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

@Component({
  selector: 'app-payment-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './payment-modal.component.html',
  styleUrls: ['./payment-modal.component.css'],
})
export class PaymentModalComponent {
  @Input() amount = 0;
  @Output() closed = new EventEmitter<void>();
  @Output() submitted = new EventEmitter<{
    currency: string;
    cardNumber: string;
    expiry: string;
    cvv: string;
  }>();

  paymentForm: FormGroup;
  processing = false;
  errorMessage = '';

  constructor(private fb: FormBuilder) {
    this.paymentForm = this.fb.group({
      currency: ['TND', Validators.required],
      cardNumber: ['', [Validators.required, Validators.minLength(12)]],
      expiry: ['', [Validators.required, Validators.pattern(/^(0[1-9]|1[0-2])\/?([0-9]{2})$/)]],
      cvv: ['', [Validators.required, Validators.pattern(/^[0-9]{3,4}$/)]],
    });
  }

  closeModal(): void {
    this.closed.emit();
  }

  onSubmit(): void {
    if (this.paymentForm.invalid) {
      this.paymentForm.markAllAsTouched();
      this.errorMessage = 'Veuillez compléter correctement les informations de paiement.';
      return;
    }
    this.errorMessage = '';
    this.processing = true;
    const payload = this.paymentForm.getRawValue();
    this.submitted.emit(payload);
    // Legacy modal flow: parent component should handle API call and close/reset modal.
    this.processing = false;
  }
}
