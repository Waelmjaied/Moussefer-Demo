import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { PaymentResponse } from '../models/payment.model';

export interface PageResponse<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
}

@Injectable({ providedIn: 'root' })
export class AdminPaymentService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  // FIX 11: backend returns paginated Object — unwrap .content
  getAllPayments(page = 0, size = 50): Observable<PaymentResponse[]> {
    const params = new HttpParams().set('page', page).set('size', size);
    return this.http
      .get<PageResponse<PaymentResponse>>(`${this.apiUrl}/api/v1/admin/payments`, { params })
      .pipe(map((p) => p.content ?? (p as any)));
  }

  getPaymentStats(): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/api/v1/admin/payments/stats`);
  }

  updatePaymentStatus(paymentId: string, status: string): Observable<void> {
    return this.http.put<void>(`${this.apiUrl}/api/v1/admin/payments/${paymentId}/status`, {
      status,
    });
  }

  refundPayment(paymentId: string): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/api/v1/admin/payments/${paymentId}/refund`, {});
  }

  getCommissions(page = 0, size = 50): Observable<any[]> {
    const params = new HttpParams().set('page', page).set('size', size);
    return this.http
      .get<any>(`${this.apiUrl}/api/v1/admin/payments/commissions`, { params })
      .pipe(map((r: any) => r.content ?? r));
  }

  getDriverPayouts(page = 0, size = 50): Observable<any[]> {
    const params = new HttpParams().set('page', page).set('size', size);
    return this.http
      .get<any>(`${this.apiUrl}/api/v1/admin/payments/driver-payouts`, { params })
      .pipe(map((r: any) => r.content ?? r));
  }

  exportPayments(format: 'csv' | 'xlsx' = 'csv'): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/api/v1/admin/payments/export?format=${format}`, {
      responseType: 'blob',
    });
  }
}
