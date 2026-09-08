import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

/**
 * Mirrors the backend DriverDocument entity (user-service).
 *
 * status values:
 *   - PENDING_REVIEW  (just uploaded, waiting for admin)
 *   - APPROVED        (admin validated)
 *   - REJECTED        (admin refused — rejectionReason populated)
 *   - EXPIRED         (scheduler flipped it when expiryDate passed)
 */
export interface DriverDocument {
  id: string;
  userId: string;
  documentType: string;
  fileUrl: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  status: 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED' | 'EXPIRED';
  expiryDate?: string;
  rejectionReason?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  supersededById?: string;
  uploadedAt: string;
  updatedAt: string;
}

export interface KycStatus {
  userId: string;
  complete: boolean;
  percentage: number;
  approvedCount: number;
  totalRequired: number;
  missing: string[];
  pending: string[];
  expired: string[];
  rejected: string[];
}

export interface PageResponse<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
}

@Injectable({ providedIn: 'root' })
export class DriverDocumentsService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  // ═══════════════════════════════════════════════════════════
  // DRIVER ENDPOINTS
  // ═══════════════════════════════════════════════════════════

  /** Upload a KYC document. type = DocumentType enum value. */
  uploadDocument(type: string, file: File, expiryDate?: string): Observable<DriverDocument> {
    const formData = new FormData();
    formData.append('type', type); // backend expects 'type', not 'documentType'
    formData.append('file', file);
    if (expiryDate) {
      formData.append('expiryDate', expiryDate); // ISO date: YYYY-MM-DD
    }
    return this.http.post<DriverDocument>(`${this.apiUrl}/api/v1/drivers/documents`, formData);
  }

  /** List current (non-superseded) documents for the authenticated driver. */
  getMyDocuments(): Observable<DriverDocument[]> {
    return this.http.get<DriverDocument[]>(`${this.apiUrl}/api/v1/drivers/documents/me`);
  }

  /** Get KYC progress: percentage, missing, pending, expired, rejected. */
  getKycStatus(): Observable<KycStatus> {
    return this.http.get<KycStatus>(`${this.apiUrl}/api/v1/drivers/documents/me/kyc-status`);
  }

  /** Delete a document (only allowed if status is PENDING_REVIEW). */
  deleteDocument(docId: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/api/v1/drivers/documents/${docId}`);
  }

  // ═══════════════════════════════════════════════════════════
  // ADMIN ENDPOINTS (MODERATOR / SUPER_ADMIN)
  // ═══════════════════════════════════════════════════════════

  /** Get paginated queue of pending documents for admin review. */
  getPendingDocuments(page = 0, size = 20): Observable<DriverDocument[]> {
    const params = new HttpParams().set('page', page.toString()).set('size', size.toString());
    return this.http
      .get<
        PageResponse<DriverDocument>
      >(`${this.apiUrl}/api/v1/drivers/documents/internal/admin/pending`, { params })
      .pipe(map((p) => p.content ?? []));
  }

  /** Approve a document. */
  approveDocument(docId: string): Observable<DriverDocument> {
    return this.http.post<DriverDocument>(
      `${this.apiUrl}/api/v1/drivers/documents/internal/admin/${docId}/approve`,
      {},
    );
  }

  /** Reject a document with a reason. */
  rejectDocument(docId: string, reason: string): Observable<DriverDocument> {
    return this.http.post<DriverDocument>(
      `${this.apiUrl}/api/v1/drivers/documents/internal/admin/${docId}/reject`,
      { reason },
    );
  }

  /** Get a 1-hour presigned URL to preview the document file. */
  getDocumentPreviewUrl(docId: string): Observable<{ url: string }> {
    return this.http.get<{ url: string }>(
      `${this.apiUrl}/api/v1/drivers/documents/internal/admin/${docId}/preview`,
    );
  }

  /** Check KYC status of any driver (admin only). */
  getDriverKycStatus(driverId: string): Observable<KycStatus> {
    return this.http.get<KycStatus>(
      `${this.apiUrl}/api/v1/drivers/documents/internal/admin/user/${driverId}/kyc-status`,
    );
  }
}
