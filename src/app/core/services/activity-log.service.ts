import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ActivityLog } from '../models/activity-log.model';

export interface PageResponse<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
}

@Injectable({ providedIn: 'root' })
export class ActivityLogService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  // Backend: GET /api/v1/admin/audit-logs (alias /activity-logs also works)
  // Supported params: page, size, sort (Spring Pageable only — no userEmail/action filters)
  getLogs(
    page: number = 0,
    size: number = 20,
    filters?: { userEmail?: string; action?: string },
  ): Observable<PageResponse<ActivityLog>> {
    // NOTE: backend does not support userEmail/action filters — params are accepted
    // here for component compatibility but are not forwarded to the API
    let params = new HttpParams().set('page', page).set('size', size);
    // If backend adds filter support in the future, uncomment:
    // if (filters?.action) params = params.set('action', filters.action);
    return this.http.get<PageResponse<ActivityLog>>(`${this.apiUrl}/api/v1/admin/audit-logs`, {
      params,
    });
  }

  // Get logs by admin (acteur)
  getLogsByAdmin(adminId: string, page = 0, size = 20): Observable<PageResponse<ActivityLog>> {
    const params = new HttpParams().set('page', page).set('size', size);
    return this.http.get<PageResponse<ActivityLog>>(
      `${this.apiUrl}/api/v1/admin/audit-logs/admin/${adminId}`,
      { params },
    );
  }

  // Get logs for a specific entity
  getLogsByTarget(
    type: string,
    id: string,
    page = 0,
    size = 20,
  ): Observable<PageResponse<ActivityLog>> {
    const params = new HttpParams().set('page', page).set('size', size);
    return this.http.get<PageResponse<ActivityLog>>(
      `${this.apiUrl}/api/v1/admin/audit-logs/target/${type}/${id}`,
      { params },
    );
  }
}
