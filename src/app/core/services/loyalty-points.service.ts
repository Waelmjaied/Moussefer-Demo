import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  LoyaltyPoints,
  RedeemPointsRequest,
  RedeemPointsResponse,
} from '../models/loyalty-points.model';

@Injectable({ providedIn: 'root' })
export class LoyaltyPointsService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  // Get current user's loyalty account
  // Backend: GET /api/v1/loyalty/me
  getMyPoints(): Observable<LoyaltyPoints> {
    return this.http.get<LoyaltyPoints>(`${this.apiUrl}/api/v1/loyalty/me`);
  }

  // Redeem points for a discount on a reservation
  // Backend: POST /api/v1/loyalty/redeem
  redeemPoints(request: RedeemPointsRequest): Observable<RedeemPointsResponse> {
    return this.http.post<RedeemPointsResponse>(`${this.apiUrl}/api/v1/loyalty/redeem`, request);
  }

  // Get loyalty history
  // Backend: GET /api/v1/loyalty/history
  getLoyaltyHistory(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/api/v1/loyalty/history`);
  }
}
