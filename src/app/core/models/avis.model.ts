export interface Avis {
  id: string;
  reservationId?: string;
  passengerId: string;
  driverId: string;
  rating: number;
  comment?: string;
  createdAt: string;
}

export interface CreateAvisRequest {
  driverId: string;
  trajetId: string;
  reservationId?: string; // FIX 12: added — optional, links review to a reservation
  rating: number;
  comment?: string;
}
