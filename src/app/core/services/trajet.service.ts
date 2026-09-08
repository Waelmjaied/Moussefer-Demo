import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Trajet, CreateTrajetRequest, SearchTrajetRequest } from '../models/trajet.model';

export interface RegulatedFare {
  departureCity: string;
  arrivalCity: string;
  pricePerSeat: number;
  distanceKm?: number;
  effectiveDate?: string;
  source?: string;
}

@Injectable({ providedIn: 'root' })
export class TrajetService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  // 🔑 size=10000 pour forcer Spring Data à tout renvoyer (pas de pagination tronquée)
  getAllRegulatedFares(): Observable<any> {
    const params = new HttpParams().set('size', '10000');
    return this.http.get(`${this.apiUrl}/api/v1/fares`, { params });
  }

  searchTrajets(req: SearchTrajetRequest): Observable<Trajet[]> {
    let params = new HttpParams().set('seatsNeeded', req.seatsNeeded.toString());
    if (req.departureCity) params = params.set('departureCity', req.departureCity);
    if (req.arrivalCity) params = params.set('arrivalCity', req.arrivalCity);
    if (req.date) params = params.set('date', req.date);
    if (req.timeOfDay) params = params.set('timeOfDay', req.timeOfDay);
    if (req.acceptsPets !== undefined) params = params.set('acceptsPets', String(req.acceptsPets));
    if (req.airConditioned !== undefined)
      params = params.set('airConditioned', String(req.airConditioned));
    if (req.allowsLargeBags !== undefined)
      params = params.set('allowsLargeBags', String(req.allowsLargeBags));
    return this.http.get<Trajet[]>(`${this.apiUrl}/api/v1/trajets/search`, { params });
  }

  getTrajetById(id: string): Observable<Trajet> {
    return this.http.get<Trajet>(`${this.apiUrl}/api/v1/trajets/${id}`);
  }

  publishTrajet(request: CreateTrajetRequest): Observable<Trajet> {
    const driverId = localStorage.getItem('user_id') || '';
    return this.http.post<Trajet>(`${this.apiUrl}/api/v1/trajets`, request, {
      headers: { 'X-User-Id': driverId },
    });
  }

  getMyTrajets(): Observable<Trajet[]> {
    return this.http.get<Trajet[]>(`${this.apiUrl}/api/v1/trajets/my`);
  }

  updateTrajet(
    trajetId: string,
    request: { vehicleDescription?: string; pricePerSeat?: number },
  ): Observable<Trajet> {
    return this.http.put<Trajet>(`${this.apiUrl}/api/v1/trajets/${trajetId}`, request);
  }

  markDeparted(id: string): Observable<Trajet> {
    return this.http.post<Trajet>(`${this.apiUrl}/api/v1/trajets/${id}/depart`, {});
  }

  cancelTrajet(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/api/v1/trajets/${id}`);
  }

  reduceSeats(id: string, seats: number): Observable<Trajet> {
    return this.http.patch<Trajet>(`${this.apiUrl}/api/v1/trajets/${id}/reduce-seats`, null, {
      params: new HttpParams().set('seats', seats.toString()),
    });
  }

  adminCancelTrajet(trajetId: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/api/v1/trajets/internal/admin/${trajetId}`);
  }

  onsiteSale(trajetId: string, seats: number): Observable<Trajet> {
    return this.http.post<Trajet>(
      `${this.apiUrl}/api/v1/trajets/${trajetId}/driver/onsite-sale`,
      null,
      { params: new HttpParams().set('seats', seats.toString()) },
    );
  }

  updateAvailableSeats(trajetId: string, availableSeats: number): Observable<Trajet> {
    return this.http.patch<Trajet>(
      `${this.apiUrl}/api/v1/trajets/${trajetId}/driver/update-seats`,
      null,
      { params: new HttpParams().set('availableSeats', availableSeats.toString()) },
    );
  }

  lookupFare(departureCity: string, arrivalCity: string): Observable<any> {
    const params = new HttpParams()
      .set('departureCity', departureCity)
      .set('arrivalCity', arrivalCity);
    return this.http.get<any>(`${this.apiUrl}/api/v1/fares/lookup`, { params });
  }
}
