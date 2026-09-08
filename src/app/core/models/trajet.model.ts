// Trajet model — mirrors trajet-service TrajetResponse.java
//
// The fields marked "UI-enriched" are NOT returned by the backend. They are
// populated client-side (driver name/photo from user-service, rating from
// avis-service) after the trajet list is fetched. Treat them as optional.

export interface Trajet {
  // ─── Wire fields (returned by backend) ────────────────────────────
  id: string;
  driverId: string;
  departureCity: string;
  arrivalCity: string;
  departureDate: string; // ISO LocalDateTime
  totalSeats: number;
  availableSeats: number;
  reservedSeats?: number; // backend computes onsite sales: total - avail - reserved
  status: 'ACTIVE' | 'LOCKED' | 'FULL' | 'DEPARTED' | 'CANCELLED';
  priorityOrder: number;
  reservable: boolean;
  acceptsPets: boolean;
  allowsLargeBags: boolean;
  airConditioned: boolean;
  hasIntermediateStops: boolean;
  directTrip?: boolean;
  pricePerSeat: number;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;

  // ─── UI-enriched (optional; populated by frontend, not backend) ───
  driverName?: string;
  driverPhoto?: string;
  vehicleName?: string;
  driverRating?: string;
  avgRating?: number;
  reviewCount?: string;
  arrivalTime?: string;
  duration?: string;
  wifi?: boolean;
  priority?: boolean;
}

// Backend: CreateTrajetRequest.java
// totalSeats removed in V24 — backend forces 8 seats (LOUAGE_SEATS constant,
// Tunisian Ministry of Transport regulation).
// pricePerSeat is sent for UX but backend may override using the regulated fare.
export interface CreateTrajetRequest {
  departureCity: string;
  arrivalCity: string;
  departureDate: string;
  pricePerSeat: number;
  acceptsPets: boolean;
  allowsLargeBags: boolean;
  airConditioned: boolean;
  hasIntermediateStops: boolean;
  directTrip?: boolean;
  notes?: string;
}

// Backend: SearchTrajetRequest.java
export interface SearchTrajetRequest {
  departureCity?: string;
  arrivalCity?: string;
  date?: string;
  timeOfDay?: 'MORNING' | 'AFTERNOON' | 'EVENING' | string;
  seatsNeeded: number;
  acceptsPets?: boolean;
  airConditioned?: boolean;
  allowsLargeBags?: boolean;
  directTrip?: boolean;
  priceMin?: number;
  priceMax?: number;
}
