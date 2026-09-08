import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { PromoCode } from '../models/promo-code.model';

@Injectable({ providedIn: 'root' })
export class AdminPromoCodeService {
  private apiUrl = `${environment.apiUrl}/api/v1/payments/internal/admin/promo-codes`;

  constructor(private http: HttpClient) {}

  private getHeaders(): HttpHeaders {
    const adminId = localStorage.getItem('adminId') || 'system';
    return new HttpHeaders({
      'Content-Type': 'application/json',
    });
  }

  getAll(): Observable<PromoCode[]> {
    return this.http.get<PromoCode[]>(this.apiUrl);
  }

  getStats(): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/stats`);
  }

  create(data: Partial<PromoCode>): Observable<PromoCode> {
    return this.http.post<PromoCode>(this.apiUrl, data, { headers: this.getHeaders() });
  }

  update(id: string, data: Partial<PromoCode>): Observable<PromoCode> {
    return this.http.patch<PromoCode>(`${this.apiUrl}/${id}`, data, { headers: this.getHeaders() });
  }

  activate(id: string): Observable<void> {
    return this.http.post<void>(
      `${this.apiUrl}/${id}/activate`,
      {},
      { headers: this.getHeaders() },
    );
  }

  deactivate(id: string): Observable<void> {
    return this.http.post<void>(
      `${this.apiUrl}/${id}/deactivate`,
      {},
      { headers: this.getHeaders() },
    );
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`, { headers: this.getHeaders() });
  }
}
