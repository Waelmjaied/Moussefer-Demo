import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Station } from '../models/station.model';

export interface ImportResult {
  created: number;
  updated: number;
  failed: number;
  total: number;
  errors: string[];
}

@Injectable({ providedIn: 'root' })
export class AdminStationService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  // ═══ Public read-only ═══
  getAll(): Observable<Station[]> {
    return this.http.get<Station[]>(`${this.apiUrl}/api/v1/stations`);
  }

  getById(id: string): Observable<Station> {
    return this.http.get<Station>(`${this.apiUrl}/api/v1/stations/${id}`);
  }

  getByCity(city: string): Observable<Station[]> {
    return this.http.get<Station[]>(`${this.apiUrl}/api/v1/stations/city/${city}`);
  }

  getSecondaryPoints(stationId: string): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/api/v1/stations/${stationId}/secondary-points`);
  }

  getStats(stationId: string): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/api/v1/stations/${stationId}/stats`);
  }

  // ═══ Admin CRUD (proxied) ═══
  create(station: Partial<Station>): Observable<Station> {
    return this.http.post<Station>(`${this.apiUrl}/api/v1/admin/stations`, station);
  }

  update(id: string, station: Partial<Station>): Observable<Station> {
    return this.http.put<Station>(`${this.apiUrl}/api/v1/admin/stations/${id}`, station);
  }

  deactivate(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/api/v1/admin/stations/${id}`);
  }

  addSecondaryPoint(
    stationId: string,
    params: {
      name: string;
      address?: string;
      latitude?: number;
      longitude?: number;
      displayOrder?: number;
    },
  ): Observable<any> {
    return this.http.post<any>(
      `${this.apiUrl}/api/v1/admin/stations/${stationId}/secondary-points`,
      null,
      { params: params as any },
    );
  }

  removeSecondaryPoint(pointId: string): Observable<void> {
    return this.http.delete<void>(
      `${this.apiUrl}/api/v1/admin/stations/secondary-points/${pointId}`,
    );
  }

  getGlobalStats(): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/api/v1/admin/stations/stats`);
  }

  // ═════════════════════════════════════════════════════
  // IMPORTS BATCH (JSON / CSV / Excel)
  // ═════════════════════════════════════════════════════

  importJson(rows: any[]): Observable<ImportResult> {
    return this.http.post<ImportResult>(`${this.apiUrl}/api/v1/admin/stations/import/json`, rows);
  }

  importCsv(file: File): Observable<ImportResult> {
    const formData = new FormData();
    formData.append('file', file, file.name);
    return this.http.post<ImportResult>(
      `${this.apiUrl}/api/v1/admin/stations/import/csv`,
      formData,
    );
  }

  importExcel(file: File): Observable<ImportResult> {
    const formData = new FormData();
    formData.append('file', file, file.name);
    return this.http.post<ImportResult>(
      `${this.apiUrl}/api/v1/admin/stations/import/excel`,
      formData,
    );
  }
}
