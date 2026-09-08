import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ReservationResponse, ReservationPricingResponse } from '../models/reservation.model';

/**
 * Front-end client for {@code ReservationController} (reservation-service).
 *
 * Aligned with backend endpoint signatures:
 *   - POST   /api/v1/reservations                               → create (passenger)
 *   - GET    /api/v1/reservations/my                            → list mine (passenger)
 *   - GET    /api/v1/reservations/{id}                          → detail
 *   - GET    /api/v1/reservations/{id}/pricing                  → final pricing
 *   - DELETE /api/v1/reservations/{id}                          → cancel (passenger)
 *   - POST   /api/v1/reservations/{id}/accept                   → driver only
 *   - POST   /api/v1/reservations/{id}/refuse?reason=...        → driver only (QUERY PARAM)
 *   - GET    /api/v1/reservations/driver/pending                → driver only
 *   - GET    /api/v1/reservations/driver/dashboard              → driver KPIs
 *   - GET    /api/v1/reservations/driver/active-trip            → driver
 *   - GET    /api/v1/reservations/driver/active-passengers      → driver
 *   - GET    /api/v1/reservations/driver/history                → driver
 *
 * Dispute endpoints have been moved to {@link DisputeService} — they live
 * under a separate controller and use query parameters, not a JSON body.
 */
@Injectable({ providedIn: 'root' })
export class ReservationService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  // ────────────────────────────────────────────────────────────────────
  //  Passenger
  // ────────────────────────────────────────────────────────────────────

  /** POST /api/v1/reservations  body { trajetId, seatsReserved } */
  createReservation(request: {
    trajetId: string;
    seatsReserved: number;
  }): Observable<ReservationResponse> {
    return this.http.post<ReservationResponse>(`${this.apiUrl}/api/v1/reservations`, {
      trajetId: request.trajetId,
      seatsReserved: request.seatsReserved,
    });
  }

  /**
   * GET /api/v1/reservations/my
   *
   * NOTE: the backend returns a {@code List<ReservationResponse>} directly
   * (no Spring Data Page envelope) — the page/size params are accepted
   * but the response is a flat array.
   */
  getMyReservations(page = 0, size = 20): Observable<ReservationResponse[]> {
    const params = new HttpParams().set('page', page).set('size', size);
    return this.http.get<ReservationResponse[]>(`${this.apiUrl}/api/v1/reservations/my`, {
      params,
    });
  }

  /** GET /api/v1/reservations/{id} */
  getReservationById(reservationId: string): Observable<ReservationResponse> {
    return this.http.get<ReservationResponse>(
      `${this.apiUrl}/api/v1/reservations/${reservationId}`,
    );
  }

  /** GET /api/v1/reservations/{id}/pricing */
  getPricing(reservationId: string): Observable<ReservationPricingResponse> {
    return this.http.get<ReservationPricingResponse>(
      `${this.apiUrl}/api/v1/reservations/${reservationId}/pricing`,
    );
  }

  /** DELETE /api/v1/reservations/{id} */
  cancelReservation(reservationId: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/api/v1/reservations/${reservationId}`);
  }

  // ────────────────────────────────────────────────────────────────────
  //  Driver (kept here for service reuse — passenger pages won't call them)
  // ────────────────────────────────────────────────────────────────────

  /** GET /api/v1/reservations/driver/pending  (paginated) */
  getDriverPending(page = 0, size = 20): Observable<ReservationResponse[]> {
    const params = new HttpParams().set('page', page).set('size', size);
    return this.http.get<ReservationResponse[]>(
      `${this.apiUrl}/api/v1/reservations/driver/pending`,
      { params },
    );
  }

  /** POST /api/v1/reservations/{id}/accept */
  acceptReservation(reservationId: string): Observable<ReservationResponse> {
    return this.http.post<ReservationResponse>(
      `${this.apiUrl}/api/v1/reservations/${reservationId}/accept`,
      {},
    );
  }

  /**
   * POST /api/v1/reservations/{id}/refuse?reason=...
   *
   * The reason is a {@code @RequestParam(required=false)} on the backend —
   * sending a JSON body returns 400. We pass it as a query string instead.
   */
  refuseReservation(reservationId: string, reason?: string): Observable<ReservationResponse> {
    let params = new HttpParams();
    if (reason) params = params.set('reason', reason);
    return this.http.post<ReservationResponse>(
      `${this.apiUrl}/api/v1/reservations/${reservationId}/refuse`,
      null,
      { params },
    );
  }

  /** GET /api/v1/reservations/driver/dashboard */
  getDriverDashboard(): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/api/v1/reservations/driver/dashboard`);
  }

  /** GET /api/v1/reservations/driver/active-trip */
  getActiveTrip(): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/api/v1/reservations/driver/active-trip`);
  }

  /** GET /api/v1/reservations/driver/active-passengers */
  getActivePassengers(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/api/v1/reservations/driver/active-passengers`);
  }

  /** GET /api/v1/reservations/driver/history */
  getDriverHistory(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/api/v1/reservations/driver/history`);
  }
  getDriverActive(page = 0, size = 50): Observable<any[]> {
    const params = new HttpParams().set('page', page).set('size', size);
    return this.http.get<any[]>(`${this.apiUrl}/api/v1/reservations/driver/active`, { params });
  }

  // À AJOUTER en bas de la classe ReservationService (avant la dernière }).
  //
  // Si tu veux le fichier complet, ouvre ton fichier reservation.service.ts existant
  // et colle ces 2 méthodes + 2 interfaces à la fin de la classe.

  // =============================================================================
  // INTERFACES (en haut du fichier, après les imports)
  // =============================================================================

  // =============================================================================
  // MÉTHODES (à coller dans la classe ReservationService)
  // =============================================================================

  /**
   * Passager : récupère son billet QR + facture pour une réservation CONFIRMED.
   * À utiliser pour afficher le QR dans l'app passager.
   */
  getTicket(reservationId: string) {
    return this.http.get<TicketResponse>(
      `${this.apiUrl}/api/v1/reservations/${reservationId}/ticket`,
    );
  }

  /**
   * Download the louage reservation document as a PDF.
   *
   * Backend reality (audited): there is NO `/ticket/pdf` endpoint. The only
   * server-generated PDF is the invoice/facture produced by payment-service:
   *   GET /api/v1/payments/invoice/{reservationId}  ->  application/pdf (byte[])
   *
   * We point the download here so the button delivers a real PDF instead of a
   * 404. NOTE: this serves the FACTURE, not a dedicated boarding-pass billet.
   * A true QR boarding-pass PDF would require a new endpoint (or client-side
   * rendering from getTicket()); see the audit report.
   */
  downloadTicketPdf(reservationId: string) {
    return this.http.get(`${this.apiUrl}/api/v1/payments/invoice/${reservationId}`, {
      responseType: 'blob',
    });
  }

  /**
   * Download the voyage organisé reservation document as a PDF.
   * Same backend reality as the louage variant — routed to the invoice PDF.
   */
  downloadVoyageTicketPdf(reservationId: string) {
    return this.http.get(`${this.apiUrl}/api/v1/payments/invoice/${reservationId}`, {
      responseType: 'blob',
    });
  }

  /**
   * Chauffeur ou organisateur : scanne un QR pour valider l'embarquement.
   * Le token est extrait du QR scanné par la caméra.
   */
  checkInByToken(token: string) {
    return this.http.post<CheckInResponse>(`${this.apiUrl}/api/v1/reservations/checkin`, { token });
  }
}
export interface TicketResponse {
  reservationId: string;
  qrToken: string; // JWT signé — encodé dans le QR
  qrImageBase64: string; // PNG en base64, à préfixer avec 'data:image/png;base64,'
  invoiceNumber: string;
  passengerName: string;
  seats: number;
  departureCity: string;
  arrivalCity: string;
  departureDate: string; // ISO LocalDateTime
  totalPrice: number;
  currency: string;
  status: string;
  boardedAt: string | null;
}

export interface CheckInResponse {
  success: boolean;
  message: string;
  passengerName: string;
  seats: number;
  boardedAt: string;
}
