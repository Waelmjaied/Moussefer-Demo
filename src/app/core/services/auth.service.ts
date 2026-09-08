import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpErrorResponse } from '@angular/common/http';
import { BehaviorSubject, Observable, tap, catchError, throwError } from 'rxjs';
import { jwtDecode } from 'jwt-decode';
import { environment } from '../../../environments/environment';
import {
  LoginRequest,
  RegisterRequest,
  AuthResponse,
  User,
  Role,
  AdminRole,
} from '../models/user.model';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly apiUrl = `${environment.apiUrl}/api/v1/auth`;
  private readonly currentUserSubject = new BehaviorSubject<User | null>(null);
  private readonly adminGradeSubject = new BehaviorSubject<string | null>(null);

  readonly currentUser$ = this.currentUserSubject.asObservable();
  readonly adminGrade$ = this.adminGradeSubject.asObservable();

  constructor(private http: HttpClient) {
    this.loadStoredUser();
  }

  // ==================== PUBLIC METHODS ====================

  login(request: LoginRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.apiUrl}/login`, request).pipe(
      tap((response) => {
        this.storeTokens(response);
        this.loadStoredUser();
      }),
    );
  }

  register(request: RegisterRequest): Observable<string> {
    return this.http
      .post(`${this.apiUrl}/register`, request, { responseType: 'text' })
      .pipe(catchError(this.handleRegisterError.bind(this)));
  }

  forgotPassword(email: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.apiUrl}/forgot-password`, { email });
  }

  resetPassword(token: string, newPassword: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.apiUrl}/reset-password`, {
      token,
      newPassword,
    });
  }

  logout(): void {
    const token = this.getToken();
    const headers = token
      ? new HttpHeaders().set('Authorization', `Bearer ${token}`)
      : new HttpHeaders();

    this.http
      .post(`${this.apiUrl}/logout`, { refreshToken: this.getRefreshToken() }, { headers })
      .subscribe({
        error: () => {}, // Silent fail - we clear storage regardless
      });

    this.clearSession();
  }

  refreshToken(): Observable<AuthResponse> {
    const refresh = this.getRefreshToken();
    if (!refresh) {
      throw new Error('No refresh token available');
    }

    const headers = new HttpHeaders().set('X-Refresh-Token', refresh);
    return this.http
      .post<AuthResponse>(`${this.apiUrl}/refresh`, null, { headers })
      .pipe(tap((response) => this.storeTokens(response)));
  }

  validateToken(): Observable<{
    valid: boolean;
    userId?: string;
    role?: string;
    adminRole?: string;
  }> {
    return this.http.post<{
      valid: boolean;
      userId?: string;
      role?: string;
      adminRole?: string;
    }>(`${this.apiUrl}/validate`, {});
  }

  // ==================== TOKEN METHODS ====================

  isAuthenticated(): boolean {
    const token = this.getToken();
    if (!token) return false;

    try {
      const decoded: any = jwtDecode(token);
      return decoded.exp * 1000 > Date.now();
    } catch {
      return false;
    }
  }

  getToken(): string | null {
    return sessionStorage.getItem('token');
  }

  getRefreshToken(): string | null {
    return sessionStorage.getItem('refreshToken');
  }

  // ==================== USER INFO METHODS ====================

  getUserRole(): string | null {
    return this.decodeTokenField('role');
  }

  getAdminRole(): AdminRole | string | null {
    return this.decodeTokenField('adminRole') || this.decodeTokenField('admin_role');
  }

  getUserId(): string | null {
    return this.decodeTokenField('userId');
  }

  getUserEmail(): string | null {
    return this.decodeTokenField('sub');
  }

  getUserName(): string | null {
    return sessionStorage.getItem('userName');
  }

  getCurrentUser(): User | null {
    return this.currentUserSubject.value;
  }

  getStoredAdminGrade(): string | null {
    const stored = sessionStorage.getItem('adminGrade');
    if (stored) return stored;

    const fromToken = this.getAdminRole();
    if (fromToken) {
      sessionStorage.setItem('adminGrade', fromToken);
      return fromToken;
    }

    return null;
  }

  // ==================== PRIVATE METHODS ====================

  private decodeTokenField(field: string): string | null {
    const token = this.getToken();
    if (!token) return null;

    try {
      const decoded: any = jwtDecode(token);
      return decoded[field] || null;
    } catch {
      return null;
    }
  }

  private storeTokens(response: AuthResponse): void {
    sessionStorage.setItem('token', response.accessToken);

    if (response.refreshToken) {
      sessionStorage.setItem('refreshToken', response.refreshToken);
    }
    if (response.name) {
      sessionStorage.setItem('userName', response.name);
    }
    if (response.userId) {
      sessionStorage.setItem('userId', response.userId);
    }
    if (response.role) {
      sessionStorage.setItem('userRole', response.role);
    }
    if (response.adminRole) {
      sessionStorage.setItem('adminGrade', response.adminRole);
    }
  }

  private loadStoredUser(): void {
    if (!this.isAuthenticated()) return;

    const user: User = {
      id: this.getUserId()!,
      name: this.getUserName() || '',
      email: this.getUserEmail() || '',
      phoneNumber: '',
      role: this.getUserRole() as Role,
      adminRole: this.getAdminRole() || undefined,
    };

    this.currentUserSubject.next(user);

    const adminGrade = this.getStoredAdminGrade();
    if (adminGrade) {
      this.adminGradeSubject.next(adminGrade);
    }
  }

  private clearSession(): void {
    const keys = ['token', 'refreshToken', 'adminGrade', 'userName', 'userId', 'userRole'];
    keys.forEach((key) => sessionStorage.removeItem(key));

    this.currentUserSubject.next(null);
    this.adminGradeSubject.next(null);
  }

  private handleRegisterError(err: HttpErrorResponse) {
    let message = "Erreur lors de l'inscription";

    if (err.error) {
      if (typeof err.error === 'string') {
        message = this.parseErrorMessage(err.error);
      } else if (typeof err.error === 'object') {
        message =
          err.error.detail ||
          err.error.message ||
          this.extractFieldError(err.error.errors) ||
          JSON.stringify(err.error);
      }
    }

    return throwError(() => ({
      error: { message },
      status: err.status,
      statusText: err.statusText,
    }));
  }

  private parseErrorMessage(error: string): string {
    try {
      const parsed = JSON.parse(error);
      return parsed.detail || parsed.message || this.extractFieldError(parsed.errors) || error;
    } catch {
      return error;
    }
  }

  private extractFieldError(errors: any): string | null {
    if (!errors) return null;

    const priorityFields = ['password', 'email', 'name', 'phoneNumber'];
    for (const field of priorityFields) {
      if (errors[field]) return errors[field];
    }

    return null;
  }
}
