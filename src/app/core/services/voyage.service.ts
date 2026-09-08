import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import {
  Voyage,
  CreateVoyageRequest,
  UpdateVoyageRequest,
  ReserveVoyageRequest,
  ReservationVoyageResponse,
  PaymentInitiationResponse,
  OrganizerManualBookingRequest,
  AcceptReservationRequest,
  AddSeatsRequest,
  BookingSource,
  OrganizerOverviewResponse,
  OrganizerFinancesResponse,
  OrganizerClientsResponse,
  OrganizerStatisticsResponse,
} from '../models/voyage.model';

/**
 * Spring Data REST page envelope, returned for every backend endpoint
 * declared with `Page<T>` (voyage list, organizer reservations, …).
 */
export interface PageResponse<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number; // current page index, 0-based
  first: boolean;
  last: boolean;
}

/**
 * Front-end gateway to the `voyage-service` REST API.
 *
 * All paths are routed through the API gateway under `/api/v1/voyages/**`
 * (cf. backend api-gateway/.../application.yml). The JwtInterceptor
 * automatically attaches Authorization + X-User-Id + X-User-Role headers,
 * which all organizer endpoints require.
 *
 * Endpoint reference (backend):
 *   - VoyageController              → /api/v1/voyages/...
 *   - OrganizerDashboardController  → /api/v1/voyages/organizer/...
 */
@Injectable({ providedIn: 'root' })
export class VoyageService {
  private readonly base = `${environment.apiUrl}/api/v1/voyages`;

  constructor(private http: HttpClient) {}

  // ===========================================================================
  //  PUBLIC LISTING & SEARCH
  // ===========================================================================

  /** GET /api/v1/voyages — paginated, returns content (legacy callers). */
  getVoyages(page = 0, size = 20): Observable<Voyage[]> {
    const params = new HttpParams().set('page', page).set('size', size);
    return this.http
      .get<PageResponse<Voyage>>(this.base, { params })
      .pipe(map((p) => p.content ?? []));
  }

  /** Same as above but exposes the full Page envelope for paginated UIs. */
  getVoyagesPage(page = 0, size = 20): Observable<PageResponse<Voyage>> {
    const params = new HttpParams().set('page', page).set('size', size);
    return this.http.get<PageResponse<Voyage>>(this.base, { params });
  }

  /**
   * GET /api/v1/voyages/search — backend declares `departureCity` and
   * `arrivalCity` as @RequestParam (required). All other filters are optional.
   */
  searchVoyages(
    departureCity: string,
    arrivalCity: string,
    date?: string,
    organizerId?: string,
    minPrice?: number,
    maxPrice?: number,
    page = 0,
    size = 20,
  ): Observable<Voyage[]> {
    let params = new HttpParams()
      .set('departureCity', departureCity)
      .set('arrivalCity', arrivalCity)
      .set('page', page)
      .set('size', size);
    if (date) params = params.set('date', date);
    if (organizerId) params = params.set('organizerId', organizerId);
    if (minPrice != null) params = params.set('minPrice', minPrice);
    if (maxPrice != null) params = params.set('maxPrice', maxPrice);
    return this.http
      .get<PageResponse<Voyage>>(`${this.base}/search`, { params })
      .pipe(map((p) => p.content ?? []));
  }

  getVoyageById(id: string): Observable<Voyage> {
    return this.http.get<Voyage>(`${this.base}/${id}`);
  }

  // ===========================================================================
  //  ORGANIZER — VOYAGE CRUD
  // ===========================================================================

  /** POST /api/v1/voyages */
  createVoyage(request: CreateVoyageRequest): Observable<Voyage> {
    return this.http.post<Voyage>(this.base, request);
  }

  /** PUT /api/v1/voyages/{id}  (OPEN status only — enforced by backend) */
  updateVoyage(id: string, request: UpdateVoyageRequest): Observable<Voyage> {
    return this.http.put<Voyage>(`${this.base}/${id}`, request);
  }

  /** POST /api/v1/voyages/{id}/add-seats */
  addSeats(voyageId: string, additionalSeats: number): Observable<Voyage> {
    const body: AddSeatsRequest = { additionalSeats };
    return this.http.post<Voyage>(`${this.base}/${voyageId}/add-seats`, body);
  }

  /**
   * DELETE /api/v1/voyages/{id} — soft-cancel (status -> CANCELLED).
   *
   * The backend does NOT expose hard delete. Calling this "cancel" matches
   * the business intent. `deleteVoyage` is kept as an alias because several
   * components still reference it.
   */
  cancelVoyage(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }

  /** @deprecated — alias for {@link cancelVoyage}. */
  deleteVoyage(id: string): Observable<void> {
    return this.cancelVoyage(id);
  }

  /** GET /api/v1/voyages/my */
  getMyVoyages(page = 0, size = 20): Observable<Voyage[]> {
    const params = new HttpParams().set('page', page).set('size', size);
    return this.http
      .get<PageResponse<Voyage>>(`${this.base}/my`, { params })
      .pipe(map((p) => p.content ?? []));
  }

  /** Same as getMyVoyages but exposes the Page envelope. */
  getMyVoyagesPage(page = 0, size = 20): Observable<PageResponse<Voyage>> {
    const params = new HttpParams().set('page', page).set('size', size);
    return this.http.get<PageResponse<Voyage>>(`${this.base}/my`, { params });
  }

  /** POST /api/v1/voyages/{id}/image (multipart/form-data) */
  uploadVoyageImage(voyageId: string, file: File): Observable<{ imageUrl: string }> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<{ imageUrl: string }>(`${this.base}/${voyageId}/image`, formData);
  }

  // ===========================================================================
  //  PASSENGER — RESERVATION & PAYMENT
  // ===========================================================================

  /**
   * POST /api/v1/voyages/reserve
   * Body shape (ReserveVoyageRequest): { "voyageId": "uuid", "seats": 2 }
   */
  reserveVoyage(request: ReserveVoyageRequest): Observable<ReservationVoyageResponse> {
    return this.http.post<ReservationVoyageResponse>(`${this.base}/reserve`, request);
  }

  /** POST /api/v1/voyages/reservations/{reservationId}/pay */
  payForReservation(reservationId: string): Observable<PaymentInitiationResponse> {
    return this.http.post<PaymentInitiationResponse>(
      `${this.base}/reservations/${reservationId}/pay`,
      {},
    );
  }

  /** GET /api/v1/voyages/my-reservations */
  getMyVoyageReservations(page = 0, size = 20): Observable<ReservationVoyageResponse[]> {
    const params = new HttpParams().set('page', page).set('size', size);
    return this.http
      .get<PageResponse<ReservationVoyageResponse>>(`${this.base}/my-reservations`, {
        params,
      })
      .pipe(map((p) => p.content ?? []));
  }

  // ===========================================================================
  //  ORGANIZER — ACCEPT / REFUSE / CANCEL RESERVATIONS
  // ===========================================================================

  /** POST /api/v1/voyages/reservations/accept */
  acceptReservation(reservationId: string): Observable<ReservationVoyageResponse> {
    const body: AcceptReservationRequest = { reservationId };
    return this.http.post<ReservationVoyageResponse>(`${this.base}/reservations/accept`, body);
  }

  /** POST /api/v1/voyages/reservations/{reservationId}/refuse?reason=... */
  refuseReservation(reservationId: string, reason?: string): Observable<void> {
    let params = new HttpParams();
    if (reason) params = params.set('reason', reason);
    return this.http.post<void>(`${this.base}/reservations/${reservationId}/refuse`, null, {
      params,
    });
  }

  /** POST /api/v1/voyages/reservations/{reservationId}/cancel */
  cancelReservation(reservationId: string): Observable<void> {
    return this.http.post<void>(`${this.base}/reservations/${reservationId}/cancel`, {});
  }

  // ---- Convenience aliases used by ReservationsComponent ------------------
  acceptVoyageReservation(_voyageId: string, reservationId: string) {
    return this.acceptReservation(reservationId);
  }
  refuseVoyageReservation(_voyageId: string, reservationId: string, reason?: string) {
    return this.refuseReservation(reservationId, reason);
  }

  // ===========================================================================
  //  ORGANIZER — RESERVATION LISTINGS
  // ===========================================================================

  /**
   * GET /api/v1/voyages/organizer/reservations/{voyageId}
   * (organizer-only — backend enforces ownership)
   */
  getVoyageReservations(
    voyageId: string,
    page = 0,
    size = 20,
  ): Observable<ReservationVoyageResponse[]> {
    const params = new HttpParams().set('page', page).set('size', size);
    return this.http
      .get<PageResponse<ReservationVoyageResponse>>(
        `${this.base}/organizer/reservations/${voyageId}`,
        { params },
      )
      .pipe(map((p) => p.content ?? []));
  }

  /** Page-envelope variant when the UI needs total counts. */
  getVoyageReservationsPage(
    voyageId: string,
    page = 0,
    size = 20,
  ): Observable<PageResponse<ReservationVoyageResponse>> {
    const params = new HttpParams().set('page', page).set('size', size);
    return this.http.get<PageResponse<ReservationVoyageResponse>>(
      `${this.base}/organizer/reservations/${voyageId}`,
      { params },
    );
  }

  /** GET /api/v1/voyages/reservations/{reservationId} */
  getReservationById(reservationId: string): Observable<ReservationVoyageResponse> {
    return this.http.get<ReservationVoyageResponse>(`${this.base}/reservations/${reservationId}`);
  }

  /**
   * GET /api/v1/voyages/organizer/reservations[?bookingSource=...]
   *
   * Returns ALL reservations across ALL the organizer's voyages, with an
   * optional filter on the booking source. This is the endpoint that backs
   * the "Réservation" page in the dashboard (Tous / Moussefer / Hors Moussefer
   * / En attente / Confirmés).
   */
  getAllOrganizerReservations(
    bookingSource?: BookingSource,
    page = 0,
    size = 20,
  ): Observable<PageResponse<ReservationVoyageResponse>> {
    let params = new HttpParams().set('page', page).set('size', size);
    if (bookingSource) params = params.set('bookingSource', bookingSource);
    return this.http.get<PageResponse<ReservationVoyageResponse>>(
      `${this.base}/organizer/reservations`,
      { params },
    );
  }

  // ===========================================================================
  //  ORGANIZER — MANUAL BOOKING (Hors Moussefer)
  // ===========================================================================

  /** POST /api/v1/voyages/organizer/manual-booking */
  organizerManualBooking(
    request: OrganizerManualBookingRequest,
  ): Observable<ReservationVoyageResponse> {
    return this.http.post<ReservationVoyageResponse>(
      `${this.base}/organizer/manual-booking`,
      request,
    );
  }

  // ===========================================================================
  //  ORGANIZER — DASHBOARD ENDPOINTS
  // ===========================================================================

  /** GET /api/v1/voyages/organizer/overview — KPIs + quickActions */
  getOrganizerOverview(): Observable<OrganizerOverviewResponse> {
    return this.http.get<OrganizerOverviewResponse>(`${this.base}/organizer/overview`);
  }

  /** GET /api/v1/voyages/organizer/finances — revenue KPIs + monthly chart + invoices */
  getOrganizerFinances(): Observable<OrganizerFinancesResponse> {
    return this.http.get<OrganizerFinancesResponse>(`${this.base}/organizer/finances`);
  }

  /** GET /api/v1/voyages/organizer/clients — weekly + top destinations */
  getOrganizerClients(): Observable<OrganizerClientsResponse> {
    return this.http.get<OrganizerClientsResponse>(`${this.base}/organizer/clients`);
  }

  /** GET /api/v1/voyages/organizer/statistics — conversion, avg, source split */
  getOrganizerStatistics(): Observable<OrganizerStatisticsResponse> {
    return this.http.get<OrganizerStatisticsResponse>(`${this.base}/organizer/statistics`);
  }

  // ───────────────────────── Billet / embarquement ─────────────────────────

  /**
   * GET /api/v1/voyages/reservations/{id}/ticket
   * Passenger: fetch the QR boarding pass for a voyage reservation.
   * (Distinct from the trajet ticket, which lives in reservation-service.)
   */
  getVoyageTicket(reservationId: string): Observable<VoyageTicketResponse> {
    return this.http.get<VoyageTicketResponse>(`${this.base}/reservations/${reservationId}/ticket`);
  }

  /**
   * POST /api/v1/voyages/reservations/checkin
   * Organizer: validate boarding by scanning a voyage QR token.
   */
  checkInByToken(token: string): Observable<VoyageTicketResponse> {
    return this.http.post<VoyageTicketResponse>(`${this.base}/reservations/checkin`, { token });
  }
}

/**
 * Mirrors voyage-service `VoyageTicketResponse`. A check-in returns the same
 * shape with `status` flipped to BOARDED and `boardedAt`/`boardedBy` populated.
 */
export interface VoyageTicketResponse {
  reservationId: string;
  invoiceNumber?: string;
  passengerId?: string;
  voyageId?: string;
  voyageTitle?: string;
  departureCity?: string;
  arrivalCity?: string;
  departureDate?: string;
  seats: number;
  totalPrice?: number;
  currency?: string;
  organizerId?: string;
  organizerName?: string;
  organizerPhone?: string;
  status?: string;
  boardedAt?: string;
  boardedBy?: string;
  qrToken?: string;
  qrImageBase64?: string;
}
