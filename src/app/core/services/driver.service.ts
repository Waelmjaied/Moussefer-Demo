import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { DriverInfo } from '../models/driver.model';

@Injectable({ providedIn: 'root' })
export class DriverService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  getDriverInfo(driverId: string): Observable<DriverInfo> {
    return this.http.get<DriverInfo>(`${this.apiUrl}/api/v1/drivers/${driverId}/info`);
  }

  getDriverContact(driverId: string): Observable<{ phoneNumber: string }> {
    return this.http.get<{ phoneNumber: string }>(
      `${this.apiUrl}/api/v1/drivers/${driverId}/contact`,
    );
  }

  uploadDocument(formData: FormData): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/api/v1/drivers/documents`, formData);
  }
}
