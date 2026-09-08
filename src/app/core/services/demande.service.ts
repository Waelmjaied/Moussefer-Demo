import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  DemandeCollective,
  DemandeCreationRequest,
  JoinDemandeRequest,
} from '../models/demande.model';
import { AuthService } from './auth.service';

// Backend JoinRequest body shape
interface JoinRequestBody {
  demandeId: string;
  seatsReserved: number;
}

@Injectable({ providedIn: 'root' })
export class DemandeService {
  private apiUrl = environment.apiUrl;

  constructor(
    private http: HttpClient,
    private authService: AuthService,
  ) {}

  // ✅ Helper pour créer les headers avec auth
  private getAuthHeaders(): HttpHeaders {
    const token = this.authService.getToken();
    const userId = this.authService.getUserId();
    const userRole = this.authService.getUserRole();

    let headers = new HttpHeaders({
      'Content-Type': 'application/json',
    });

    if (token) {
      headers = headers.set('Authorization', `Bearer ${token}`);
    }
    if (userId) {
      headers = headers.set('X-User-Id', userId);
    }
    if (userRole) {
      headers = headers.set('X-User-Role', userRole);
    }

    return headers;
  }

  // Create a new collective demand (organizer / passenger)
  createDemande(request: DemandeCreationRequest): Observable<DemandeCollective> {
    return this.http.post<DemandeCollective>(`${this.apiUrl}/api/v1/demandes`, request, {
      headers: this.getAuthHeaders(),
    });
  }

  // Browse OPEN demands only (legacy)
  getOpenDemandes(departureCity?: string, arrivalCity?: string): Observable<DemandeCollective[]> {
    let params = new HttpParams();
    if (departureCity) params = params.set('departureCity', departureCity);
    if (arrivalCity) params = params.set('arrivalCity', arrivalCity);
    return this.http.get<DemandeCollective[]>(`${this.apiUrl}/api/v1/demandes/search`, {
      params,
      headers: this.getAuthHeaders(),
    });
  }

  // ← AJOUTÉ: Get ALL active demands (OPEN + TRIGGERED)
  getAllDemandes(): Observable<DemandeCollective[]> {
    return this.http.get<DemandeCollective[]>(`${this.apiUrl}/api/v1/demandes/all`, {
      headers: this.getAuthHeaders(),
    });
  }

  // Get a single demand
  getDemandeById(id: string): Observable<DemandeCollective> {
    return this.http.get<DemandeCollective>(`${this.apiUrl}/api/v1/demandes/${id}`, {
      headers: this.getAuthHeaders(),
    });
  }

  // Passenger: join an existing demand
  joinDemande(id: string, request: JoinDemandeRequest): Observable<DemandeCollective> {
    const body: JoinRequestBody = { demandeId: id, seatsReserved: request.seatsReserved };
    return this.http.post<DemandeCollective>(`${this.apiUrl}/api/v1/demandes/join`, body, {
      headers: this.getAuthHeaders(),
    });
  }

  // Organizer: get my demands
  getMyDemandes(): Observable<DemandeCollective[]> {
    return this.http.get<DemandeCollective[]>(`${this.apiUrl}/api/v1/demandes/my`, {
      headers: this.getAuthHeaders(),
    });
  }

  // Organizer: close a demand
  closeDemande(id: string): Observable<void> {
    return this.http.post<void>(
      `${this.apiUrl}/api/v1/demandes/${id}/close`,
      {},
      {
        headers: this.getAuthHeaders(),
      },
    );
  }

  // Driver/Admin: convert collective demand into a confirmed trajet
  convertToTrajet(id: string): Observable<any> {
    return this.http.post<any>(
      `${this.apiUrl}/api/v1/demandes/${id}/convert`,
      {},
      {
        headers: this.getAuthHeaders(),
      },
    );
  }
}
