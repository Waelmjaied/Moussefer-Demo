import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { PaymentResponse, PromoCodeValidationResponse } from '../models/payment.model';
import { Page } from '../models/page.model';

@Injectable({ providedIn: 'root' })
export class PaymentService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  /**
   * Initiate a payment. Backend supports two providers — STRIPE (international
   * cards) and KONNECT (Tunisian cards via SMT, e-DINAR / Poste D17, Flouci
   * wallet). The amount is resolved server-side from the reservation (security:
   * clients must never set the price). Loyalty points must be redeemed BEFORE
   * payment via POST /api/v1/loyalty/redeem.
   *
   * <p>Response shape depends on the provider:
   * <ul>
   *   <li>STRIPE → {@code clientSecret} set, {@code payUrl} null. Frontend
   *       mounts the Stripe card form and finalizes with confirmCardPayment.</li>
   *   <li>KONNECT → {@code payUrl} set, {@code clientSecret} null. Frontend
   *       redirects to the Konnect hosted page via window.location.assign.</li>
   * </ul>
   * For idempotent retries on an already-paid reservation, both are null and
   * {@code status} is "SUCCEEDED" — the frontend should jump to confirmation.
   */
  initiatePayment(request: {
    reservationId: string;
    driverId?: string;
    organizerId?: string;
    successUrl: string;
    cancelUrl: string;
    promoCode?: string;
    type?: string;
    provider?: 'STRIPE' | 'KONNECT';
    /** Stripe settlement currency. Ignored for Konnect (always TND). */
    currency?: 'EUR' | 'USD' | 'GBP';
  }): Observable<PaymentResponse> {
    return this.http.post<PaymentResponse>(`${this.apiUrl}/api/v1/payments/initiate`, request);
  }

  // Validate promo code
  validatePromoCode(
    code: string,
    amount: number,
    reservationType: 'TRAJET' | 'VOYAGE' = 'TRAJET',
  ): Observable<PromoCodeValidationResponse> {
    const params = new HttpParams()
      .set('code', code)
      .set('amount', amount.toString())
      .set('reservationType', reservationType);
    return this.http.get<PromoCodeValidationResponse>(
      `${this.apiUrl}/api/v1/payments/validate-promo`,
      { params },
    );
  }

  // Get payment info by reservation ID
  getPaymentByReservation(reservationId: string): Observable<PaymentResponse> {
    return this.http.get<PaymentResponse>(
      `${this.apiUrl}/api/v1/payments/reservation/${reservationId}`,
    );
  }

  // Get my own payment history — aligned with backend Page<PaymentResponse>
  getMyPayments(page = 0, size = 10): Observable<Page<PaymentResponse>> {
    const params = new HttpParams().set('page', page.toString()).set('size', size.toString());
    return this.http.get<Page<PaymentResponse>>(`${this.apiUrl}/api/v1/payments/my`, { params });
  }

  // Download invoice PDF via backend
  downloadInvoice(reservationId: string): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/api/v1/payments/invoice/${reservationId}`, {
      responseType: 'blob',
    });
  }
}
