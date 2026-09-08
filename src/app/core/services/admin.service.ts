// Cible : src/app/core/services/admin.service.ts
// FIX #2 (admin wiring) :
//   - createAdminRole / updateAdminRole / deleteAdminRole : nouveaux (étaient absents)
//   - activate/deactivateAdminRole : POST → PATCH (correspondance backend)
//   - Tout le reste inchangé.

import { Injectable } from '@angular/core';
import { HttpClient, HttpParams, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

export interface UserProfile {
  userId: string;
  email: string;
  name: string;
  phoneNumber: string;
  role: string;
  active: boolean;
  verified?: boolean;
  adminRole?: string;
  suspensionEndDate?: string;
  averageRating?: number;
}

export interface PageResponse<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
}

export interface DashboardStats {
  totalRevenue: number;
  totalReservations: number;
  totalDrivers: number;
  activeTrips: number;
  drivers: number;
  reservations: number;
  revenue: number;
  avgRating: number;
  reservationsThisMonth: number;
  totalUsers?: number;
  completedTrips?: number;
}

export interface SuspendUserRequest {
  reason: string;
  durationDays: number;
}

export interface VerifyUserRequest {
  verified: boolean;
}

// ▶︎ FIX #2 : DTO aligné sur AdminRoleRequest.java côté backend
export interface AdminRoleRequest {
  name: string;
  label: string;
  description?: string;
  permissions?: string[];
  modules?: string[];
}

@Injectable({ providedIn: 'root' })
export class AdminService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  // ============================================================
  // USERS
  // ============================================================

  listAllUsers(page = 0, size = 50, role?: string, status?: string): Observable<UserProfile[]> {
    let params = new HttpParams().set('page', page).set('size', size);
    if (role) params = params.set('role', role);
    if (status) params = params.set('status', status);
    return this.http
      .get<PageResponse<UserProfile>>(`${this.apiUrl}/api/v1/admin/users`, { params })
      .pipe(map((p) => p.content ?? (p as any)));
  }

  getUserProfile(userId: string): Observable<UserProfile> {
    return this.http.get<UserProfile>(`${this.apiUrl}/api/v1/admin/users/${userId}`);
  }

  assignAdminRole(userId: string, adminRole: string): Observable<UserProfile> {
    return this.http.post<UserProfile>(`${this.apiUrl}/api/v1/admin/users/${userId}/admin-role`, {
      adminRole,
    });
  }

  deactivateUser(userId: string): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/api/v1/admin/users/${userId}/deactivate`, {});
  }

  reactivateUser(userId: string): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/api/v1/admin/users/${userId}/reactivate`, {});
  }

  verifyUser(userId: string, verified: boolean, rejectionReason?: string): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/api/v1/admin/users/${userId}/verify`, {
      status: verified ? 'VERIFIED' : 'REJECTED',
      rejectionReason: rejectionReason ?? null,
    });
  }

  suspendUser(userId: string, reason: string, durationDays: number): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/api/v1/admin/users/${userId}/suspend`, {
      reason,
      durationDays,
    });
  }

  liftSuspension(userId: string): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/api/v1/admin/users/${userId}/lift-suspension`, {});
  }

  bulkUserAction(userIds: string[], action: string, reason?: string): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/api/v1/admin/users/action`, {
      userIds,
      action,
      reason,
    });
  }

  getUserLoyaltyPoints(userId: string): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/api/v1/admin/users/${userId}/loyalty-points`);
  }

  createUser(payload: {
    name: string;
    email: string;
    phoneNumber?: string;
    role: string;
    password: string;
  }): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/api/v1/admin/users`, payload);
  }

  // ============================================================
  // DASHBOARDS / STATS
  // ============================================================

  getDashboardCharts(months: number = 6): Observable<any> {
    const params = new HttpParams().set('months', months);
    return this.http.get<any>(`${this.apiUrl}/api/v1/admin/statistics/charts`, { params });
  }

  getRecentActivity(limit: number = 10): Observable<any> {
    const params = new HttpParams().set('limit', limit);
    return this.http.get<any>(`${this.apiUrl}/api/v1/admin/statistics/recent-activity`, { params });
  }

  getDashboardStats(): Observable<DashboardStats> {
    return this.http.get<DashboardStats>(`${this.apiUrl}/api/v1/admin/statistics`);
  }

  getDashboardByRole(): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/api/v1/admin/dashboard/me`);
  }

  getSuperAdminDashboard(): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/api/v1/admin/dashboard/super-admin`);
  }
  getOperationalDashboard(): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/api/v1/admin/dashboard/operational`);
  }
  getFinancialDashboard(): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/api/v1/admin/dashboard/financial`);
  }
  getModeratorDashboard(): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/api/v1/admin/dashboard/moderator`);
  }
  getReporterDashboard(): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/api/v1/admin/dashboard/reporter`);
  }
  getAuditorDashboard(): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/api/v1/admin/dashboard/auditor`);
  }

  getUsersStats(): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/api/v1/admin/dashboard/users/stats`);
  }

  // ============================================================
  // RESERVATIONS
  // ============================================================

  getAllReservations(page = 0, size = 50): Observable<any[]> {
    const params = new HttpParams().set('page', page).set('size', size);
    return this.http
      .get<PageResponse<any>>(`${this.apiUrl}/api/v1/admin/reservations`, { params })
      .pipe(map((p) => p.content ?? (p as any)));
  }

  updateReservationStatus(reservationId: string, status: string): Observable<void> {
    return this.http.put<void>(`${this.apiUrl}/api/v1/admin/reservations/${reservationId}/status`, {
      status,
    });
  }

  getReservationDetail(reservationId: string): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/api/v1/admin/reservations/${reservationId}`);
  }
  getReservationsStats(): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/api/v1/admin/reservations/stats`);
  }
  refundReservation(reservationId: string, amount?: number, reason?: string): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/api/v1/admin/reservations/${reservationId}/refund`, {
      amount,
      reason,
    });
  }

  // ============================================================
  // DRIVERS / KYC
  // ============================================================

  getAllDrivers(): Observable<UserProfile[]> {
    return this.listAllUsers(0, 100, 'DRIVER');
  }

  getPendingKycDocuments(page = 0, size = 50): Observable<any[]> {
    const params = new HttpParams().set('page', page).set('size', size);
    return this.http
      .get<
        PageResponse<any>
      >(`${this.apiUrl}/api/v1/drivers/documents/internal/admin/pending`, { params })
      .pipe(map((p) => p.content ?? []));
  }

  getDriverKycDocuments(driverId: string): Observable<any> {
    return this.http.get<any>(
      `${this.apiUrl}/api/v1/drivers/documents/internal/admin/user/${driverId}/kyc-status`,
    );
  }

  approveKycDocument(documentId: string): Observable<any> {
    return this.http.post<any>(
      `${this.apiUrl}/api/v1/drivers/documents/internal/admin/${documentId}/approve`,
      {},
    );
  }

  rejectKycDocument(documentId: string, reason: string): Observable<any> {
    return this.http.post<any>(
      `${this.apiUrl}/api/v1/drivers/documents/internal/admin/${documentId}/reject`,
      { reason },
    );
  }

  getKycDocumentPreviewUrl(documentId: string): Observable<{ url: string }> {
    return this.http.get<{ url: string }>(
      `${this.apiUrl}/api/v1/drivers/documents/internal/admin/${documentId}/preview`,
    );
  }

  // ============================================================
  // ACTIVITY LOG / BANNERS / PAYMENTS
  // ============================================================

  getActivityLogs(page = 0, size = 20): Observable<any> {
    const params = new HttpParams().set('page', page).set('size', size);
    return this.http.get<any>(`${this.apiUrl}/api/v1/admin/activity-logs`, { params });
  }

  getBannerPerformance(): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/api/v1/admin/banners/performance`);
  }
  getBannerStats(bannerId: string): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/api/v1/admin/banners/${bannerId}/stats`);
  }

  getPaymentDetail(paymentId: string): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/api/v1/admin/payments/${paymentId}`);
  }

  importFares(file: File): Observable<any> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<any>(`${this.apiUrl}/api/v1/admin/fares/import`, formData);
  }

  toggleFeature(featureId: string): Observable<any> {
    return this.http.patch<any>(`${this.apiUrl}/api/v1/admin/features/${featureId}/toggle`, {});
  }

  // ============================================================
  // NOTIFICATIONS
  // ============================================================

  broadcastNotification(payload: {
    title: string;
    body: string;
    targetRole?: string;
  }): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/api/v1/admin/notifications/broadcast`, payload);
  }
  sendNotification(payload: { userId: string; title: string; body: string }): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/api/v1/admin/notifications/send`, payload);
  }
  getNotificationTemplates(): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/api/v1/admin/notifications/templates`);
  }

  // ============================================================
  // ADMIN ROLES (CRUD complet)
  // ============================================================

  listAdminRoles(): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/api/v1/admin/roles`);
  }
  getAdminRole(roleId: string): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/api/v1/admin/roles/${roleId}`);
  }
  getAdminRoleByName(name: string): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/api/v1/admin/roles/name/${name}`);
  }

  /** ▶︎ FIX #2 : nouveau — création de rôle custom (SUPER_ADMIN only) */
  createAdminRole(payload: AdminRoleRequest): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/api/v1/admin/roles`, payload);
  }

  /** ▶︎ FIX #2 : nouveau — mise à jour d'un rôle (label, description, permissions) */
  updateAdminRole(roleId: string, payload: AdminRoleRequest): Observable<any> {
    return this.http.put<any>(`${this.apiUrl}/api/v1/admin/roles/${roleId}`, payload);
  }

  /** ▶︎ FIX #2 : nouveau — suppression d'un rôle custom (les rôles système sont protégés côté backend) */
  deleteAdminRole(roleId: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/api/v1/admin/roles/${roleId}`);
  }

  /** ▶︎ FIX #2 : POST → PATCH (le backend utilise @PatchMapping) */
  activateAdminRole(roleId: string): Observable<any> {
    return this.http.patch<any>(`${this.apiUrl}/api/v1/admin/roles/${roleId}/activate`, {});
  }

  /** ▶︎ FIX #2 : POST → PATCH (le backend utilise @PatchMapping) */
  deactivateAdminRole(roleId: string): Observable<any> {
    return this.http.patch<any>(`${this.apiUrl}/api/v1/admin/roles/${roleId}/deactivate`, {});
  }

  simulateRole(roleName: string): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/api/v1/admin/simulate-role/${roleName}`);
  }

  // ============================================================
  // LOYALTY
  // ============================================================

  addLoyaltyPoints(userId: string, points: number, reason?: string): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/api/v1/admin/users/${userId}/loyalty-points/add`, {
      points,
      reason,
    });
  }

  // ============================================================
  // LITIGES / DISPUTES
  // ============================================================

  /**
   * ▶︎ FIX #2 : statuts backend valides → OPEN, IN_PROGRESS, RESOLVED, REJECTED, CLOSED.
   *   L'ancien appel `getLitiges('PENDING')` renvoyait HTTP 500
   *   (DisputeStatus.valueOf("PENDING") → IllegalArgumentException).
   */
  getLitiges(
    status?: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'REJECTED' | 'CLOSED',
    page = 0,
    size = 50,
  ): Observable<any[]> {
    let params = new HttpParams().set('page', page).set('size', size);
    if (status) params = params.set('status', status);
    return this.http
      .get<
        PageResponse<any>
      >(`${this.apiUrl}/api/v1/reservations/internal/admin/disputes/all`, { params })
      .pipe(map((p) => p.content ?? []));
  }

  updateLitigeStatus(litigeId: string, outcome: string, resolution?: string): Observable<any> {
    const params = new HttpParams().set('outcome', outcome).set('resolution', resolution ?? '');
    return this.http.post<any>(
      `${this.apiUrl}/api/v1/reservations/internal/admin/disputes/${litigeId}/resolve`,
      null,
      { params },
    );
  }

  assignLitige(litigeId: string): Observable<any> {
    return this.http.post<any>(
      `${this.apiUrl}/api/v1/reservations/internal/admin/disputes/${litigeId}/assign`,
      null,
    );
  }

  getLitigesStats(): Observable<Record<string, number>> {
    return this.http.get<Record<string, number>>(
      `${this.apiUrl}/api/v1/reservations/internal/admin/disputes/stats`,
    );
  }
}
