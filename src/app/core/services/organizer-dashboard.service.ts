import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class OrganizerDashboardService {
  private apiUrl = environment.apiUrl;
  constructor(private http: HttpClient) {}

  getOverview(): Observable<any> {
    return this.http.get(`${this.apiUrl}/api/v1/voyages/organizer/overview`);
  }
  getFinances(): Observable<any> {
    return this.http.get(`${this.apiUrl}/api/v1/voyages/organizer/finances`);
  }
  getClients(page = 0, size = 20): Observable<any> {
    const params = new HttpParams().set('page', page).set('size', size);
    return this.http.get(`${this.apiUrl}/api/v1/voyages/organizer/clients`, { params });
  }
  getStatistics(): Observable<any> {
    return this.http.get(`${this.apiUrl}/api/v1/voyages/organizer/statistics`);
  }
}
