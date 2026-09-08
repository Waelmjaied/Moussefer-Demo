// Reservation domain — mirrors reservation-service ReservationResponse.java exactly.
// Champs marqués "UI-enriched" : NON renvoyés par le backend ; le frontend les
// peuple après coup (user-service pour le nom/téléphone passager, avis-service
// pour la note, trajet-service pour départ/arrivée). Tous optionnels.

export type ReservationStatus =
  | 'PENDING_DRIVER'
  | 'ACCEPTED'
  | 'REFUSED'
  | 'PAYMENT_PENDING'
  | 'CONFIRMED'
  | 'CANCELLED'
  | 'ESCALATED';

export interface CreateReservationRequest {
  trajetId: string;
  seatsReserved: number;
  totalPrice?: number;
}

export interface ReservationResponse {
  // ─── Wire fields (backend ReservationResponse.java) ────────────────
  id: string;
  trajetId: string;
  passengerId: string;
  driverId: string;
  seatsReserved: number;
  totalPrice: number;
  status: ReservationStatus;
  refusalReason?: string;
  driverResponseDeadline?: string;
  confirmedAt?: string;
  paidAt?: string;
  createdAt: string;
  driverName?: string; // ← ADD

  // ─── UI-enriched (optional; populated by the frontend after fetch) ─
  passengerName?: string;
  passengerPhone?: string;
  departureCity?: string;
  arrivalCity?: string;
  rating?: string;
  totalTrips?: number;
  totalReviews?: number;
}

export interface ReservationPricingResponse {
  reservationId: string;
  passengerId: string;
  status: string;
  totalPrice: number;
}



