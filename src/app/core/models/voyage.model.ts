// ============================================================================
//  voyage.model.ts
//  Front-end DTOs — aligned 1:1 with the backend voyage-service.
//  See: backend-MoUSSEFER-reserve-main/voyage-service/src/main/java/com/moussefer/voyage/dto/*
// ============================================================================

// ---------- Enums identiques au backend Java ---------------------------------

export type VoyageStatus = 'OPEN' | 'FULL' | 'DEPARTED' | 'CANCELLED';

export type ReservationVoyageStatus =
  | 'PENDING_ORGANIZER'
  | 'PENDING_PAYMENT' // accepté par l'organisateur, en attente du paiement Stripe
  | 'CONFIRMED'
  | 'CANCELLED';

/**
 * BookingSource — aligné avec com.moussefer.voyage.entity.BookingSource
 *   PLATFORM = réservation via l'app Moussefer (parcours normal)
 *   PHONE / AGENCY / DIRECT = "Hors Moussefer" (réservation manuelle)
 */
export enum BookingSource {
  PLATFORM = 'PLATFORM',
  PHONE = 'PHONE',
  AGENCY = 'AGENCY',
  DIRECT = 'DIRECT',
}

/** État de paiement pour les bookings manuels (champ paymentState côté backend). */
export type PaymentState = 'UNPAID' | 'DEPOSIT' | 'PAID';

// ---------- Entités principales ---------------------------------------------

export interface Voyage {
  id: string;
  title: string;
  description?: string;
  organizerId: string;
  departureCity: string;
  arrivalCity: string;
  departureDate: string; // ISO LocalDateTime
  returnDate?: string; // ISO LocalDateTime — optionnel
  totalSeats: number;
  availableSeats: number;
  pricePerSeat: number;
  currency?: 'TND'; // toujours TND côté backend
  imageUrl?: string;
  status: VoyageStatus;
  createdAt?: string;

  // ---- Champs locaux purement UI (jamais envoyés au backend) -----------
  organizerName?: string;
  isPriority?: boolean;
  isCompleted?: boolean;

  // ---- Champs d'enrichissement / affichage (optionnels selon endpoint) ---
  rating?: number;
  reviewCount?: number;
  category?: string;
  type?: string;
  duration?: string;
  coverImage?: string;
  features?: string;
  guide?: string;
  tags?: string[];
}

// ---------- Requêtes (Create / Update / AddSeats) ---------------------------

export interface CreateVoyageRequest {
  title: string;
  description?: string;
  departureCity: string;
  arrivalCity: string;
  departureDate: string; // ISO LocalDateTime — doit être dans le futur
  returnDate?: string;
  pricePerSeat: number;
  totalSeats: number;
  imageUrl?: string;
}

export interface UpdateVoyageRequest {
  title?: string;
  description?: string;
  departureCity?: string;
  arrivalCity?: string;
  departureDate?: string;
  returnDate?: string;
  pricePerSeat?: number;
  totalSeats?: number;
  imageUrl?: string;
}

export interface AddSeatsRequest {
  additionalSeats: number; // Min 1
}

// ---------- Passager : réserver / payer -------------------------------------

/**
 * Aligné avec ReserveVoyageRequest.java :
 *   private String voyageId;
 *   private Integer seats;       <-- nom exact côté backend
 */
export interface ReserveVoyageRequest {
  voyageId: string;
  seats: number;
}

// ---------- Organisateur : accepter / réservation manuelle ------------------

export interface AcceptReservationRequest {
  reservationId: string;
}

/**
 * Aligné avec OrganizerManualBookingRequest.java.
 *   - bookingSource doit être PHONE, AGENCY ou DIRECT (PLATFORM est interdit ici)
 *   - depositAmount est optionnel
 *       null/0     → paymentState = UNPAID
 *       >= total   → paymentState = PAID
 *       > 0        → paymentState = DEPOSIT
 */
export interface OrganizerManualBookingRequest {
  voyageId: string;
  seatsReserved: number; // 1..20
  passengerName: string; // 2..100 chars
  passengerPhone: string; // Regex backend: ^\+?[1-9]\d{7,14}$
  bookingSource: BookingSource; // PHONE | AGENCY | DIRECT
  depositAmount?: number;
}

// ---------- Réponses ---------------------------------------------------------

export interface ReservationVoyageResponse {
  id: string;
  voyageId: string;
  passengerId: string;
  seatsReserved: number;
  totalPrice: number;
  currency: 'TND';
  status: ReservationVoyageStatus;
  invoiceUrl?: string;

  acceptedAt?: string; // PENDING_ORGANIZER → PENDING_PAYMENT
  confirmedAt?: string; // → CONFIRMED
  paidAt?: string; // capture Stripe (null pour booking manuel non payé)
  createdAt: string;

  // V21 — champs Hors Moussefer
  bookingSource: BookingSource;
  manualBooking: boolean;
  manualPassengerName?: string;
  manualPassengerPhone?: string;
  paymentState?: PaymentState;
  depositAmount?: number;
}

/**
 * Aligné avec PaymentInitiationResponse.java
 *   currency est renvoyée en minuscules par Stripe ("tnd").
 */
export interface PaymentInitiationResponse {
  paymentId: string; // Stripe PaymentIntent id
  clientSecret: string;
  amount: number; // millimes (minor unit)
  currency: string; // "tnd"
}

// ---------- Dashboard organisateur (Map<String,Object> côté backend) --------

export interface OrganizerOverviewResponse {
  organizerId: string;
  totalVoyages: number;
  activeVoyages: number;
  confirmedReservationsThisMonth: number;
  revenueThisMonth: number;
  seatsSoldThisMonth: number;
  quickActions: string[];
}

export interface MonthlyRevenue {
  month: string; // ex: "janv.", "févr." (FR short)
  year: number;
  revenue: number;
}

export interface RecentInvoice {
  reservationId: string;
  voyageId: string;
  passengerName: string;
  amount: number;
  date: string;
  status: string;
  invoiceUrl?: string;
  bookingSource: string;
}

export interface OrganizerFinancesResponse {
  organizerId: string;
  revenueTotal: number;
  paid: number;
  depositsReceived: number;
  notCollected: number;
  paidPercentage: number;
  depositsPercentage: number;
  notCollectedPercentage: number;
  monthlyRevenue: MonthlyRevenue[];
  recentInvoices: RecentInvoice[];
}

export interface WeeklyReservation {
  weekLabel: string; // "S-7" ... "S-0"
  reservations: number;
}

export interface TopDestination {
  destination: string;
  seatsSold: number;
}

export interface OrganizerClientsResponse {
  organizerId: string;
  uniqueClientsLast8Weeks: number;
  totalReservationsLast8Weeks: number;
  weeklyReservations: WeeklyReservation[];
  topDestinations: TopDestination[];
}

export interface OrganizerStatisticsResponse {
  organizerId: string;
  totalReservationsThisYear: number;
  confirmed: number;
  cancelled: number;
  refused: number;
  conversionRate: number;
  averageRevenue: number;
  bookingsBySource: Record<string, number>; // clés = BookingSource.name()
}
