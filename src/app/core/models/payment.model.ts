// Payment domain — aligned with payment-service DTOs.
// Backend: payment-service/src/main/java/com/moussefer/payment/dto/

/**
 * Payload for POST /api/v1/payments/initiate
 *
 * Backend DTO: InitiatePaymentRequest
 *   - reservationId, driverId, successUrl, cancelUrl : @NotBlank
 *   - promoCode : optional
 *
 * IMPORTANT: amount and currency are resolved server-side from the reservation
 * (security: the client must never set the price). Including those fields
 * is rejected with a 400 by Spring's strict body binding.
 *
 * Loyalty points must be redeemed via POST /api/v1/loyalty/redeem BEFORE
 * initiating payment.
 */
export interface InitiatePaymentRequest {
  reservationId: string;
  driverId: string;
  successUrl: string;
  cancelUrl: string;
  promoCode?: string;
}

/**
 * Aligned with backend PaymentResponse.java.
 *
 * Type mapping rules:
 *   - BigDecimal        → number
 *   - PaymentStatus enum → string (e.g. 'SUCCEEDED', 'PENDING', 'FAILED')
 *   - LocalDateTime     → ISO 8601 string (e.g. '2026-06-01T14:30:00')
 *   - String            → string (nullable fields are optional)
 *
 * Exposes both passenger-facing fields and admin-only enriched fields when
 * served through admin endpoints.
 */
export interface PaymentResponse {
  // ─── Core payment fields (from backend PaymentResponse) ───
  paymentId: string;
  reservationId: string;
  passengerId?: string;
  driverId?: string;
  amount: number; // BigDecimal in Java
  currency: string;
  status: string; // PaymentStatus enum value as string
  clientSecret?: string; // Stripe client_secret for Elements (set for STRIPE only)
  payUrl?: string; // Hosted checkout URL (set for KONNECT and other redirect providers)
  provider?: 'STRIPE' | 'KONNECT'; // Which gateway processed this payment
  invoiceUrl?: string; // Pre-signed URL or null
  promoCode?: string;
  createdAt?: string; // LocalDateTime → ISO string
  updatedAt?: string;

  // ─── Admin enrichments (injected by admin endpoints only) ───
  passengerName?: string;
  method?: string;
}

/**
 * Aligned with backend PromoCodeValidationResponse.java.
 *
 * The backend returns {@code code} and {@code discountAmount} on success
 * (kept optional here so the same shape covers the .invalid() factory).
 */
export interface PromoCodeValidationResponse {
  valid: boolean;
  code?: string;
  discountAmount?: number;
  finalAmount?: number;
  discountType?: 'PERCENTAGE' | 'FIXED_AMOUNT';
  discountValue?: number;
  message?: string;
}
