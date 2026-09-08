// This service is now superseded by ReservationService.
// Kept as a thin re-export for backward compatibility with existing components.
export { ReservationService as DriverReservationService } from './reservation.service';

// Legacy interface — maps backend ReservationResponse fields
export interface PendingReservation {
  id: string;
  passengerId: string;
  seatsReserved: number;
  trajetId: string;
  totalPrice: number;
  status: string;
  driverResponseDeadline?: string;
  createdAt: string;
}
