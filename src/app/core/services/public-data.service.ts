import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { Trajet } from '../models/trajet.model';
import { Voyage } from '../models/voyage.model';
import { AuthService } from './auth.service'; // ← import AuthService

interface PageResponse<T> {
  content: T[];
  totalElements: number;
}

@Injectable({ providedIn: 'root' })
export class PublicDataService {
  private apiUrl = environment.apiUrl;

  constructor(
    private http: HttpClient,
    private authService: AuthService, // ← inject it
  ) {}

  /** Build headers with the Bearer token from AuthService */
  private authHeaders(): HttpHeaders {
    const token = this.authService.getToken(); // reads from sessionStorage
    let headers = new HttpHeaders();
    if (token) {
      headers = headers.set('Authorization', `Bearer ${token}`);
    }
    return headers;
  }

  getUpcomingTrajets(limit = 6): Observable<Trajet[]> {
    const today = new Date().toISOString().split('T')[0];
    const params = new HttpParams()
      .set('seatsNeeded', '1')
      .set('date', today)
      .set('size', limit.toString());
    return this.http
      .get<Trajet[] | PageResponse<Trajet>>(
        `${this.apiUrl}/api/v1/trajets/search`,
        { params, headers: this.authHeaders() }, // ← attach headers
      )
      .pipe(
        map((res: any) => {
          if (Array.isArray(res)) return res.slice(0, limit);
          return (res.content ?? []).slice(0, limit);
        }),
      );
  }

  getFeaturedVoyages(limit = 6): Observable<Voyage[]> {
    const params = new HttpParams().set('page', '0').set('size', limit.toString());
    return this.http
      .get<Voyage[] | PageResponse<Voyage>>(
        `${this.apiUrl}/api/v1/voyages`,
        { params, headers: this.authHeaders() }, // ← attach headers
      )
      .pipe(
        map((res: any) => {
          if (Array.isArray(res)) return res.slice(0, limit);
          return (res.content ?? []).slice(0, limit);
        }),
      );
  }
}
