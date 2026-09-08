import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface FeatureToggle {
  featureName: string;
  enabled: boolean;
  description?: string;
  updatedAt?: string;
}

@Injectable({ providedIn: 'root' })
export class FeatureToggleService {
  private apiUrl = environment.apiUrl;
  constructor(private http: HttpClient) {}

  getAll(): Observable<FeatureToggle[]> {
    return this.http.get<FeatureToggle[]>(`${this.apiUrl}/api/v1/admin/features`);
  }
  update(featureName: string, enabled: boolean): Observable<FeatureToggle> {
    return this.http.patch<FeatureToggle>(`${this.apiUrl}/api/v1/admin/features/${featureName}`, {
      enabled,
    });
  }
}
