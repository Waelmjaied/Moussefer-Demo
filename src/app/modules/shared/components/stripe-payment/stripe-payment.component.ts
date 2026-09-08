import { Component, Input, Output, EventEmitter, OnDestroy, AfterViewInit, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { loadStripe, Stripe, StripeElements, StripePaymentElement } from '@stripe/stripe-js';
import { PaymentService } from '../../../../core/services/payment.service';
import { environment } from '../../../../../environments/environment';
import { firstValueFrom } from 'rxjs';
import { PaymentResponse } from '../../../../core/models/payment.model';

@Component({
  selector: 'app-stripe-payment',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (visible) {
      <div class="modal-overlay" (click)="onOverlayClick($event)">
        <div class="modal-content">
          <div class="modal-header">
            <h3><i class="bi bi-shield-lock me-2"></i>Paiement sécurisé</h3>
            <button class="btn-close" (click)="close()">×</button>
          </div>
          <div class="modal-body">
            <div class="amount-badge">
              <span class="label">Montant à payer</span>
              <span class="value">{{ amount | number:'1.2-2' }} {{ currency }}</span>
            </div>

            @if (error) {
              <div class="alert alert-danger mt-3">{{ error }}</div>
            }

            <div class="stripe-element-container mt-3">
              <div #paymentElement></div>
            </div>

            <button class="btn btn-primary w-100 mt-4"
                    (click)="submitPayment()"
                    [disabled]="processing || !paymentElementReady">
              @if (processing) {
                <span class="spinner-border spinner-border-sm me-2"></span>
              }
              {{ processing ? 'Traitement...' : 'Payer ' + (amount | number:'1.2-2') + ' ' + currency }}
            </button>

            <div class="text-center mt-3">
              <small class="text-muted"><i class="bi bi-shield-check me-1"></i>Sécurisé par Stripe</small>
            </div>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 1050; }
    .modal-content { background: white; border-radius: 12px; width: 100%; max-width: 480px; margin: 1rem; box-shadow: 0 20px 40px rgba(0,0,0,0.2); }
    .modal-header { padding: 1.25rem; border-bottom: 1px solid #e9ecef; display: flex; justify-content: space-between; align-items: center; }
    .modal-header h3 { margin: 0; font-size: 1.25rem; }
    .btn-close { background: none; border: none; font-size: 1.5rem; cursor: pointer; }
    .modal-body { padding: 1.25rem; }
    .amount-badge { background: #f8f9fa; border-radius: 8px; padding: 1rem; text-align: center; }
    .amount-badge .label { display: block; color: #6c757d; font-size: 0.875rem; margin-bottom: 0.25rem; }
    .amount-badge .value { display: block; font-size: 1.5rem; font-weight: 700; color: #212529; }
    .stripe-element-container { padding: 0.5rem 0; min-height: 60px; }
  `]
})
export class StripePaymentComponent implements AfterViewInit, OnDestroy {
  @Input() visible = false;
  @Input() amount = 0;
  @Input() currency = 'TND';
  @Input() reservationId = '';
  @Input() driverId = '';
  @Input() promoCode?: string;

  @Output() closed = new EventEmitter<void>();
  @Output() success = new EventEmitter<string>();

  @ViewChild('paymentElement') paymentElementRef!: ElementRef;

  stripe: Stripe | null = null;
  elements: StripeElements | null = null;
  paymentElement: StripePaymentElement | null = null;
  clientSecret = '';
  processing = false;
  error = '';
  paymentElementReady = false;

  constructor(private paymentService: PaymentService) {}

  async ngAfterViewInit() {
    this.stripe = await loadStripe(environment.stripePublicKey);
  }

  ngOnDestroy() {
    this.paymentElement?.destroy();
  }

  async open() {
    this.visible = true;
    this.processing = true;
    this.error = '';
    this.paymentElementReady = false;
    this.paymentElement?.destroy();
    this.paymentElement = null;

    try {
      const successUrl = `${window.location.origin}/passenger/payments/success?reservation=${this.reservationId}`;
      const cancelUrl = `${window.location.origin}/passenger/payments/cancel?reservation=${this.reservationId}`;

      const response: PaymentResponse = await firstValueFrom(
        this.paymentService.initiatePayment({
          reservationId: this.reservationId,
          driverId: this.driverId,
          successUrl,
          cancelUrl,
          promoCode: this.promoCode
        })
      );

      this.clientSecret = response.clientSecret ?? '';
      this.amount = response.amount;
      this.currency = response.currency;

      if (!this.stripe) {
        this.error = 'Stripe non initialisé';
        this.processing = false;
        return;
      }

      this.elements = this.stripe.elements({
        clientSecret: this.clientSecret,
        appearance: { theme: 'stripe' }
      });

      this.paymentElement = this.elements.create('payment', {
        layout: { type: 'tabs', defaultCollapsed: false }
      });

      setTimeout(() => {
        if (this.paymentElementRef?.nativeElement) {
          this.paymentElement!.mount(this.paymentElementRef.nativeElement);
          this.paymentElementReady = true;
          this.processing = false;
        }
      }, 0);

    } catch (err: any) {
      this.error = err?.message || "Erreur lors de l'initialisation du paiement";
      this.processing = false;
    }
  }

  close() {
    this.visible = false;
    this.paymentElement?.destroy();
    this.paymentElement = null;
    this.elements = null;
    this.closed.emit();
  }

  onOverlayClick(event: MouseEvent) {
    if (event.target === event.currentTarget) this.close();
  }

  async submitPayment() {
    if (!this.stripe || !this.elements || !this.paymentElementReady) return;

    this.processing = true;
    this.error = '';

    const { error, paymentIntent } = await this.stripe.confirmPayment({
      elements: this.elements,
      confirmParams: {
        return_url: `${window.location.origin}/passenger/payments/success?reservation=${this.reservationId}`
      },
      redirect: 'if_required'
    });

    if (error) {
      this.error = error.message || 'Le paiement a échoué';
      this.processing = false;
    } else if (paymentIntent && paymentIntent.status === 'succeeded') {
      this.success.emit(paymentIntent.id);
      this.close();
    }
  }
}
