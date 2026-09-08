// Cible : src/app/modules/driver/scan-qr/scan-qr.component.ts

import { Component } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import {
  ReservationService,
  CheckInResponse,
} from '../../../core/services/reservation.service';
import { ToastService } from '../../../core/services/toast.service';
import { QrScannerComponent } from '../../shared/components/qr-scanner/qr-scanner.component';
import { DriverSidebarComponent } from '../driver-sidebar/driver-sidebar.component';

type ResultState =
  | { kind: 'idle' }
  | { kind: 'processing' }
  | { kind: 'success'; data: CheckInResponse }
  | { kind: 'error'; message: string };

@Component({
  selector: 'app-driver-scan-qr',
  standalone: true,
  imports: [CommonModule, DatePipe, QrScannerComponent, DriverSidebarComponent],
  template: `
    <div class="layout">
      <app-driver-sidebar></app-driver-sidebar>

      <main class="content">
        <header>
          <h1>📷 Scanner le billet d''un passenger </h1>
          <p class="muted">
            Le scan valide automatiquement l'embarquement du voyageur sur votre trajet.
          </p>
        </header>

        <ng-container [ngSwitch]="result.kind">
          <ng-container *ngSwitchCase="'idle'">
            <app-qr-scanner (scanned)="onScanned($event)"></app-qr-scanner>
          </ng-container>

          <div *ngSwitchCase="'processing'" class="state-card">
            <div class="spinner-border"></div>
            <p>Vérification…</p>
          </div>

          <div *ngSwitchCase="'success'" class="state-card success">
            <div class="icon">✅</div>
            <h2>{{ successData.message }}</h2>
            <dl>
              <dt>Voyageur</dt>
              <dd>
                <strong>{{ successData.passengerName || '—' }}</strong>
              </dd>
              <dt>Places</dt>
              <dd>{{ successData.seats }}</dd>
              <dt>Embarqué le</dt>
              <dd>{{ successData.boardedAt | date: 'dd MMM yyyy à HH:mm' }}</dd>
            </dl>
            <button class="btn-primary" (click)="reset()">Scanner un autre voyageur</button>
          </div>

          <div *ngSwitchCase="'error'" class="state-card error">
            <div class="icon">⚠️</div>
            <h2>Billet refusé</h2>
            <p>{{ errorMessage }}</p>
            <button class="btn-primary" (click)="reset()">Réessayer</button>
          </div>
        </ng-container>
      </main>
    </div>
  `,
  styles: [
    `
      .layout {
        display: flex;
        min-height: 100vh;
      }
      .content {
        flex: 1;
        padding: 2rem;
        max-width: 720px;
        margin: 0 auto;
      }
      header h1 {
        font-size: 1.5rem;
        margin: 0 0 0.5rem 0;
      }
      .muted {
        color: #64748b;
        margin: 0 0 1.5rem 0;
      }
      .state-card {
        background: #fff;
        border: 1px solid #e2e8f0;
        border-radius: 12px;
        padding: 2.5rem 1.5rem;
        text-align: center;
        margin-top: 1.5rem;
      }
      .state-card.success {
        border-color: #10b981;
        background: #f0fdf4;
      }
      .state-card.error {
        border-color: #ef4444;
        background: #fef2f2;
      }
      .state-card .icon {
        font-size: 3rem;
        line-height: 1;
        margin-bottom: 0.75rem;
      }
      .state-card h2 {
        font-size: 1.25rem;
        margin: 0 0 1rem 0;
      }
      .state-card dl {
        display: grid;
        grid-template-columns: 120px 1fr;
        gap: 0.5rem 1rem;
        max-width: 360px;
        margin: 1rem auto 1.5rem;
        text-align: left;
      }
      .state-card dt {
        color: #64748b;
        font-size: 0.875rem;
      }
      .state-card dd {
        margin: 0;
        font-size: 0.9375rem;
      }
      .btn-primary {
        background: #1976d2;
        color: white;
        border: none;
        padding: 0.75rem 1.5rem;
        border-radius: 8px;
        font-weight: 500;
        cursor: pointer;
      }
      .btn-primary:hover {
        opacity: 0.92;
      }
    `,
  ],
})
export class DriverScanQrComponent {
  result: ResultState = { kind: 'idle' };

  constructor(
    private reservationService: ReservationService,
    private toast: ToastService,
  ) {}

  /** Getters pour le narrowing de type dans le template */
  get successData(): CheckInResponse {
    return (this.result as Extract<ResultState, { kind: 'success' }>).data;
  }

  get errorMessage(): string {
    return (this.result as Extract<ResultState, { kind: 'error' }>).message;
  }

  onScanned(token: string): void {
    this.result = { kind: 'processing' };
    this.reservationService.checkInByToken(token).subscribe({
      next: (response) => {
        if (response.success) {
          this.result = { kind: 'success', data: response };
          this.toast.success('Embarquement validé');
        } else {
          this.result = { kind: 'error', message: response.message };
        }
      },
      error: (err) => {
        this.result = {
          kind: 'error',
          message: err.error?.message || err.message || 'Erreur lors du check-in.',
        };
      },
    });
  }

  reset(): void {
    this.result = { kind: 'idle' };
  }
}
