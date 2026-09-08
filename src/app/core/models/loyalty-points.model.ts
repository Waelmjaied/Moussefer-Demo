// Loyalty domain — aligned with loyalty-service DTOs.
// Backend: loyalty-service/src/main/java/com/moussefer/loyalty/...

export type LoyaltyTier = 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM';

/**
 * Aligned with backend LoyaltyAccountResponse.java.
 *
 * Returned by:
 *   - GET  /api/v1/loyalty/me
 *   - POST /api/v1/loyalty/redeem  (same shape — see {@link RedeemPointsResponse})
 */
export interface LoyaltyPoints {
  id: string;
  userId: string;
  points: number;
  totalEarned: number;
  totalRedeemed: number;
  tier?: LoyaltyTier;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Aligned with backend RedeemRequest.java
 *   - points : @NotNull @Min(1)
 *   - referenceId : optional (id of the reservation the redemption is for)
 */
export interface RedeemPointsRequest {
  points: number;
  referenceId?: string;
}

/**
 * POST /api/v1/loyalty/redeem returns the updated LoyaltyAccountResponse —
 * NOT a (discountAmount, newBalance) pair. We expose this as a type alias
 * to keep call-sites readable.
 *
 * The caller can derive its own "discount" amount client-side using the
 * known conversion rate (1 point = 0.01 DT by default — confirm with
 * payment-service).
 */
export type RedeemPointsResponse = LoyaltyPoints;

/**
 * Each entry of GET /api/v1/loyalty/history (paginated).
 * Aligned with backend PointTransactionResponse.java.
 */
export interface PointTransaction {
  id: string;
  userId: string;
  points: number; // positive for earn, negative for redeem
  type: 'EARN' | 'REDEEM' | 'EXPIRE' | 'ADJUSTMENT';
  referenceId?: string;
  description?: string;
  createdAt: string;
}
