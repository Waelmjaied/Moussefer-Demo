import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Banner } from '../models/banner.model';

@Injectable({ providedIn: 'root' })
export class BannerService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  // Public endpoint — returns active banners for the current user's audience
  getActiveBanners(): Observable<Banner[]> {
    return this.http.get<Banner[]>(`${this.apiUrl}/api/v1/banners/active`);
  }

  // Track impression (fire-and-forget — called when banner is displayed)
  trackImpression(bannerId: string): void {
    this.http
      .post(`${this.apiUrl}/api/v1/banners/${bannerId}/impression`, {})
      .subscribe({ error: () => {} }); // silent fail
  }

  // Track click (called when user clicks banner link)
  trackClick(bannerId: string): void {
    this.http
      .post(`${this.apiUrl}/api/v1/banners/${bannerId}/click`, {})
      .subscribe({ error: () => {} }); // silent fail
  }

  // Get a single banner by id (for detail/edit pages)
  getBannerById(bannerId: string): Observable<Banner> {
    return this.http.get<Banner>(`${this.apiUrl}/api/v1/banners/${bannerId}`);
  }
}
