import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Banner, CreateBannerRequest } from '../models/banner.model';

@Injectable({ providedIn: 'root' })
export class AdminBannerService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  getAll(): Observable<Banner[]> {
    return this.http.get<Banner[]>(`${this.apiUrl}/api/v1/admin/banners`);
  }

  create(banner: CreateBannerRequest): Observable<Banner> {
    return this.http.post<Banner>(`${this.apiUrl}/api/v1/admin/banners`, banner);
  }

  update(id: string, banner: Partial<CreateBannerRequest>): Observable<Banner> {
    return this.http.put<Banner>(`${this.apiUrl}/api/v1/admin/banners/${id}`, banner);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/api/v1/admin/banners/${id}`);
  }

  uploadImage(file: File): Observable<{ imageUrl: string }> {
    const formData = new FormData();
    formData.append('file', file);

    // FIX : ajouter le header X-User-Id requis par BannerController
    const userId = localStorage.getItem('userId') || '';
    const headers = new HttpHeaders({
      'X-User-Id': userId,
    });

    return this.http.post<{ imageUrl: string }>(`${this.apiUrl}/api/v1/banners/upload`, formData, {
      headers,
    });
  }
}
