import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

/**
 * Mirrors backend {@code Dispute} entity + {@code DisputeResponse} DTO
 * in {@code reservation-service}.
 *
 * <p><b>v1.2 — wire alignment</b>:</p>
 * <ul>
 *   <li>{@code status} is now the exact enum the backend emits:
 *       OPEN | IN_PROGRESS | RESOLVED | REJECTED | CLOSED.
 *       (Previously the frontend declared IN_REVIEW which the backend
 *       never sends, and was missing REJECTED entirely — see W1.)</li>
 *   <li>{@code category} typed as {@link DisputeCategory} for IDE
 *       safety; values match {@code DisputeCategory.java}.</li>
 * </ul>
 *
 * <p>Wire field renames (from older versions):</p>
 * <ul>
 *   <li>frontend's previous {@code reason} → backend's {@code category}</li>
 *   <li>new mandatory field {@code reportedUserId} (the OTHER party)</li>
 *   <li>{@code reporterRole}, {@code reporterId}, {@code adminId},
 *       {@code resolvedAt} surfaced from the entity</li>
 * </ul>
 */
export type DisputeStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'REJECTED' | 'CLOSED';

export type DisputeCategory = 'PAYMENT' | 'BEHAVIOR' | 'NO_SHOW' | 'VEHICLE_CONDITION' | 'OTHER';

export interface Dispute {
  id: string;
  reservationId: string;
  reporterId: string;
  reporterRole: 'PASSENGER' | 'DRIVER';
  reportedUserId: string;
  category: DisputeCategory;
  description: string;
  status: DisputeStatus;
  adminId?: string;
  resolution?: string;
  resolvedAt?: string;
  createdAt: string;
  updatedAt?: string;
}

/** Spring Data Page wrapper returned by {@code GET /disputes/my}. */
interface PageResponse<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
}

/**
 * Front-end client for {@code DisputeController}.
 *
 * <p><b>Note on the POST shape</b>: the backend now accepts both a
 * JSON body (preferred, with Bean Validation) and the legacy query
 * string. This client uses the JSON body to benefit from the proper
 * 400 / field-error messages.</p>
 */
@Injectable({ providedIn: 'root' })
export class DisputeService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  /**
   * GET /api/v1/reservations/disputes/my  (paginated)
   * Returns the disputes I opened (reporterId = me).
   */
  getMyDisputes(page = 0, size = 20): Observable<Dispute[]> {
    const params = new HttpParams().set('page', page).set('size', size);
    return this.http
      .get<PageResponse<Dispute>>(`${this.apiUrl}/api/v1/reservations/disputes/my`, { params })
      .pipe(map((p) => p.content ?? []));
  }

  /**
   * GET /api/v1/reservations/disputes/reservation/{reservationId}
   */
  getDisputesByReservation(reservationId: string): Observable<Dispute[]> {
    return this.http.get<Dispute[]>(
      `${this.apiUrl}/api/v1/reservations/disputes/reservation/${reservationId}`,
    );
  }

  /**
   * POST /api/v1/reservations/disputes  (JSON body).
   *
   * The backend reads everything from the body and persists the
   * reporterId / reporterRole from the X-User-Id / X-User-Role
   * headers (injected by the gateway).
   */
  createDispute(
    reservationId: string,
    reportedUserId: string,
    category: DisputeCategory,
    description: string,
  ): Observable<Dispute> {
    return this.http.post<Dispute>(`${this.apiUrl}/api/v1/reservations/disputes`, {
      reservationId,
      reportedUserId,
      category,
      description,
    });
  }

  /**
   * Legacy convenience kept for the {@code disputes} passenger
   * component, which only knows the reservation id at submit time
   * and resolves the reported party by fetching the reservation
   * first.
   */
  openDispute(
    reservationId: string,
    category: DisputeCategory,
    description: string,
    reportedUserId: string,
  ): Observable<Dispute> {
    return this.createDispute(reservationId, reportedUserId, category, description);
  }
}
