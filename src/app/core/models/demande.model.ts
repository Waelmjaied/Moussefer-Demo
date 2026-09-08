// Collective demand domain — aligned with demande-service DTOs.
// Backend: demande-service/src/main/java/com/moussefer/demande/...

/**
 * Aligned with backend DemandeStatus.java
 *   OPEN, TRIGGERED, CLOSED, CANCELLED, MERGED
 *
 * The previous {@code CONVERTED} value did not exist in the backend enum —
 * the "converted to trajet" flow transitions the demand to {@code CLOSED}
 * (see DemandeService.convertToTrajet).
 */
export type DemandeStatus = 'OPEN' | 'TRIGGERED' | 'CLOSED' | 'CANCELLED' | 'MERGED';

/**
 * Aligned with backend VehicleType.java
 *   VOITURE_4(4), VOITURE_8(8), MINIBUS(16), BUS(52)
 *
 * The previous {@code 'LOUAGE'} value did not exist — louages map to
 * {@code VOITURE_4} or {@code VOITURE_8} depending on capacity.
 */
export type VehicleType = 'VOITURE_4' | 'VOITURE_8' | 'MINIBUS' | 'BUS';

/**
 * Aligned with backend DemandeResponse.java.
 *
 * UI-only fields (initiator, minsAgo, duration, totalBudget, options,
 * notes, …) are NOT returned by the backend; they are populated by the
 * frontend or by a future endpoint extension. All are optional.
 */
export interface DemandeCollective {
  id: string;
  createurId: string;
  departureCity: string;
  arrivalCity: string;
  requestedDate: string; // ISO LocalDate ("yyyy-MM-dd")
  vehicleType: VehicleType;
  totalCapacity: number;
  totalSeatsReserved: number;
  seuilPersonnalise?: number;
  status: DemandeStatus;
  triggeredAt?: string;
  createdAt?: string;

  // ── UI-enriched / wizard local state ──
  initiator?: string;
  initiatorName?: string;
  minsAgo?: number;
  duration?: string;
  pricePerSeat?: number;
  totalBudget?: number;
  maxBudget?: any;
  seats?: number;
  options?: string;
  notes?: string;
}

export interface DemandePassager {
  id: string;
  demandeId: string;
  passengerId: string;
  seatsReserved: number;
  joinedAt: string;
}

/**
 * Aligned with backend DemandeCreationRequest.java
 *   - requestedDate, vehicleType : @NotNull
 *   - seuilPersonnalise : @Min(1) (the seat threshold)
 *   - departureCity, arrivalCity are persisted but not @NotBlank in the
 *     backend DTO; we keep them required client-side to match UX intent.
 */
export interface DemandeCreationRequest {
  departureCity: string;
  arrivalCity: string;
  requestedDate: string; // "yyyy-MM-dd"
  vehicleType: VehicleType;
  seuilPersonnalise?: number;
}

export interface JoinDemandeRequest {
  seatsReserved: number;
}
