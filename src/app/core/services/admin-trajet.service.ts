import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Trajet } from '../models/trajet.model';
import { environment } from '../../../environments/environment';

export interface PageResponse<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
}

@Injectable({ providedIn: 'root' })
export class AdminTrajetService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  // Backend returns paginated Page<TrajetResponse>
  getAllTrajets(page = 0, size = 20): Observable<PageResponse<Trajet>> {
    const params = new HttpParams().set('page', page).set('size', size);
    return this.http.get<PageResponse<Trajet>>(`${this.apiUrl}/api/v1/admin/trajets`, { params });
  }

  // Backend: PUT /api/v1/admin/trajets/{id}/status  Body: { status }
  updateTrajetStatus(id: string, status: string): Observable<void> {
    return this.http.put<void>(`${this.apiUrl}/api/v1/admin/trajets/${id}/status`, { status });
  }

  // Backend: DELETE /api/v1/admin/trajets/{id}
  // reason + notifyPassenger are forwarded as query params; the admin proxy
  // logs them for audit even though the underlying trajet-service ignores them
  // (the cancellation reason is captured in the audit log, not on the entity).
  cancelTrajet(trajetId: string, reason?: string, notifyPassenger?: boolean): Observable<void> {
    let params = new HttpParams();
    if (reason) params = params.set('reason', reason);
    if (typeof notifyPassenger === 'boolean') {
      params = params.set('notifyPassenger', String(notifyPassenger));
    }
    return this.http.delete<void>(`${this.apiUrl}/api/v1/admin/trajets/${trajetId}`, { params });
  }

  // FIX: was POST /reassign {newDriverId}
  // Backend: PUT /api/v1/admin/trajets/{id}/status  Body: { status: "ASSIGNED", driverId }
  reassignTrajet(trajetId: string, newDriverId: string): Observable<void> {
    return this.http.put<void>(`${this.apiUrl}/api/v1/admin/trajets/${trajetId}/status`, {
      status: 'ASSIGNED',
      driverId: newDriverId,
    });
  }
}
