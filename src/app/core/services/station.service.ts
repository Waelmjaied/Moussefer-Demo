import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Station } from '../models/station.model';

// READ-ONLY public service — mutations go through AdminStationService → /api/v1/admin/stations
@Injectable({ providedIn: 'root' })
export class StationService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  getAll(): Observable<Station[]> {
    return this.http.get<Station[]>(`${this.apiUrl}/api/v1/stations`);
  }

  getById(id: string): Observable<Station> {
    return this.http.get<Station>(`${this.apiUrl}/api/v1/stations/${id}`);
  }
}
