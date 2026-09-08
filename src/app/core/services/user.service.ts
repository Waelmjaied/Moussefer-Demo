import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

/**
 * Wire shape returned by GET /api/v1/users/me (user-service).
 * Backend uses a SINGLE {@code name} column.
 */
interface UserProfileWire {
  userId: string;
  email: string;
  name: string;
  phoneNumber: string;
  role: string;
  adminRole?: string;
  active: boolean;
  verifiedOrganizer?: boolean;
  verificationStatus?: string;
  rejectionReason?: string;
  averageRating?: number;
  totalTrips?: number;
  profilePictureUrl?: string;
  cinNumber?: string;
  driverLicenseNumber?: string;
  vehicleBrand?: string;
  vehicleModel?: string;
  vehiclePlate?: string;
  vehicleColor?: string;
  vehicleYear?: number;
  companyName?: string;
  companyRegistration?: string;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * UI projection: uses {@code name} directly — no firstName/lastName split.
 */
export interface UserProfile {
  userId: string;
  email: string;
  name: string;
  phoneNumber: string;
  role: string;
  adminRole?: string;
  active: boolean;
  verified?: boolean;
  verifiedOrganizer?: boolean;
  verificationStatus?: string;
  rejectionReason?: string;
  averageRating?: number;
  totalTrips?: number;
  profilePictureUrl?: string;
  cinNumber?: string;
  driverLicenseNumber?: string;
  vehicleBrand?: string;
  vehicleModel?: string;
  vehiclePlate?: string;
  vehicleColor?: string;
  vehicleYear?: number;
  companyName?: string;
  companyRegistration?: string;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Update payload. Pass {@code name} directly.
 */
export interface UpdateProfileRequest {
  name?: string;
  phoneNumber?: string;
  profilePictureUrl?: string;
  cinNumber?: string;
  driverLicenseNumber?: string;
  vehicleBrand?: string;
  vehicleModel?: string;
  vehiclePlate?: string;
  vehicleColor?: string;
  vehicleYear?: number;
  companyName?: string;
  companyRegistration?: string;
}

@Injectable({ providedIn: 'root' })
export class UserService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  private fromWire(wire: UserProfileWire): UserProfile {
    return {
      ...wire,
      verified: wire.verifiedOrganizer,
    };
  }

  private toWire(req: UpdateProfileRequest): Partial<UserProfileWire> {
    return {
      ...req,
      name: req.name?.trim(),
    };
  }

  /** GET /api/v1/users/me */
  getMyProfile(): Observable<UserProfile> {
    return this.http
      .get<UserProfileWire>(`${this.apiUrl}/api/v1/users/me`)
      .pipe(map((wire) => this.fromWire(wire)));
  }

  /** PUT /api/v1/users/me */
  updateMyProfile(request: UpdateProfileRequest): Observable<UserProfile> {
    return this.http
      .put<UserProfileWire>(`${this.apiUrl}/api/v1/users/me`, this.toWire(request))
      .pipe(map((wire) => this.fromWire(wire)));
  }

  /** POST /api/v1/users/me/deactivate */
  deactivateMyAccount(): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/api/v1/users/me/deactivate`, {});
  }

  /** POST /api/v1/users/me/reactivate */
  reactivateMyAccount(): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/api/v1/users/me/reactivate`, {});
  }

  /** POST /api/v1/users/me/profile-picture (multipart/form-data) */
  uploadProfilePicture(file: File): Observable<UserProfile> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http
      .post<UserProfileWire>(`${this.apiUrl}/api/v1/users/me/profile-picture`, formData)
      .pipe(map((wire) => this.fromWire(wire)));
  }

  /** Convenience: update only the profile picture URL through PUT /me. */
  updateProfilePictureUrl(url: string): Observable<UserProfile> {
    return this.updateMyProfile({ profilePictureUrl: url });
  }

  /** PUT /api/v1/users/me/fcm-token */
  registerFcmToken(fcmToken: string): Observable<void> {
    return this.http.put<void>(`${this.apiUrl}/api/v1/users/me/fcm-token`, { fcmToken });
  }

  /** GET /api/v1/users/driver/{driverId} — passenger viewing a driver card. */
  getDriverProfile(driverId: string): Observable<UserProfile> {
    return this.http
      .get<UserProfileWire>(`${this.apiUrl}/api/v1/users/driver/${driverId}`)
      .pipe(map((wire) => this.fromWire(wire)));
  }

  /**
   * Récupère le profil PUBLIC d'un utilisateur par son ID (chauffeur, organisateur,
   * passager — n'importe quel rôle). Utilise le même endpoint que getDriverProfile,
   * qui accepte n'importe quel userId malgré son nom historique.
   *
   * Utilisé pour enrichir les listes de chat avec les noms réels au lieu d'afficher
   * "Chauffeur 1" / "Passager #abcd" / etc.
   *
   * @param userId UUID de l'utilisateur cible
   */
  getPublicProfile(userId: string): Observable<UserProfile> {
    return this.http
      .get<UserProfileWire>(`${this.apiUrl}/api/v1/users/driver/${userId}`)
      .pipe(map((wire) => this.fromWire(wire)));
  }
}
