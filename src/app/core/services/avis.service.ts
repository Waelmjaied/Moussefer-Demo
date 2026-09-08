import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Avis, CreateAvisRequest } from '../models/avis.model';

@Injectable({ providedIn: 'root' })
export class AvisService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  // Submit a review for a completed reservation
  submitAvis(request: CreateAvisRequest): Observable<Avis> {
    return this.http.post<Avis>(`${this.apiUrl}/api/v1/avis`, request);
  }

  // Get review for a specific reservation
  getAvisForReservation(reservationId: string): Observable<Avis | null> {
    return this.http.get<Avis>(`${this.apiUrl}/api/v1/avis/reservation/${reservationId}`);
  }

  // Get all reviews for a driver
  getAvisForDriver(driverId: string): Observable<Avis[]> {
    return this.http.get<Avis[]>(`${this.apiUrl}/api/v1/avis/driver/${driverId}`);
  }

  // Get my own submitted reviews
  getMyAvis(): Observable<Avis[]> {
    return this.http.get<Avis[]>(`${this.apiUrl}/api/v1/avis/me`);
  }

  // Update an existing review (within edit window, e.g. 7 days)
  updateAvis(avisId: string, payload: { rating: number; comment?: string }): Observable<Avis> {
    return this.http.put<Avis>(`${this.apiUrl}/api/v1/avis/${avisId}`, payload);
  }

  // Delete an avis (admin moderation or own deletion within window)
  deleteAvis(avisId: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/api/v1/avis/${avisId}`);
  }
}
