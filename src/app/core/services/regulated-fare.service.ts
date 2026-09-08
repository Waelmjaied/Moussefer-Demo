import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

export interface RegulatedFare {
  id: string;
  departureCity: string;
  arrivalCity: string;
  pricePerSeat: number;
  distanceKm?: number;
  effectiveDate?: string;
  source?: string;
  active: boolean;
}

export interface FareImportReport {
  total: number;
  created: number;
  updated: number;
  skipped: number;
  errors: string[];
}

@Injectable({ providedIn: 'root' })
export class RegulatedFareService {
  private apiUrl = environment.apiUrl;
  constructor(private http: HttpClient) {}

  getAll(city?: string): Observable<RegulatedFare[]> {
    let params = new HttpParams();
    if (city) params = params.set('city', city);
    params = params.set('size', '1000');
    return this.http
      .get<any>(`${this.apiUrl}/api/v1/admin/fares`, { params })
      .pipe(map((page) => page.content ?? []));
  }

  create(fare: Partial<RegulatedFare>): Observable<RegulatedFare> {
    return this.http.post<RegulatedFare>(`${this.apiUrl}/api/v1/admin/fares`, fare);
  }

  update(id: string, fare: Partial<RegulatedFare>): Observable<RegulatedFare> {
    return this.http.post<RegulatedFare>(`${this.apiUrl}/api/v1/admin/fares`, fare);
  }

  toggleActive(id: string, active: boolean): Observable<void> {
    return this.http.patch<void>(
      `${this.apiUrl}/api/v1/admin/fares/${id}/active?active=${active}`,
      {},
    );
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/api/v1/admin/fares/${id}`);
  }

  importFile(formData: FormData): Observable<FareImportReport> {
    return this.http.post<FareImportReport>(`${this.apiUrl}/api/v1/admin/fares/import`, formData);
  }

  importJson(fares: any[]): Observable<FareImportReport> {
    return this.http.post<FareImportReport>(`${this.apiUrl}/api/v1/admin/fares/import-json`, fares);
  }

  lookup(dep: string, arr: string): Observable<RegulatedFare> {
    const params = new HttpParams().set('departureCity', dep).set('arrivalCity', arr);
    return this.http.get<RegulatedFare>(`${this.apiUrl}/api/v1/fares/lookup`, { params });
  }

  listPublicFares(): Observable<RegulatedFare[]> {
    return this.http
      .get<any>(`${this.apiUrl}/api/v1/fares`)
      .pipe(map((page) => page.content ?? []));
  }
}
