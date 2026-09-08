// Cible : src/app/modules/shared/components/qr-scanner/qr-scanner.component.ts
// VERSION CORRIGÉE (v2) :
//   - Fix bug "Cannot read properties of undefined (reading 'nativeElement')"
//     causé par *ngIf qui retire le <video> du DOM (incompatible avec ViewChild static)
//   - Utilise [hidden] à la place pour garder l'élément vidéo toujours présent
//   - Stop la caméra explicitement quand on bascule en mode manuel
//   - Restart de la caméra quand on revient au mode scan

import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  OnDestroy,
  Output,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BrowserMultiFormatReader, IScannerControls } from '@zxing/browser';
import { BarcodeFormat, DecodeHintType } from '@zxing/library';

@Component({
  selector: 'app-qr-scanner',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <!-- ─── SCANNER MODE (toujours dans le DOM, masqué visuellement si mode manuel) ─── -->
    <div class="scanner-wrap" [hidden]="showManualInput">
      <video #videoEl class="scanner-video" autoplay playsinline muted></video>
      <div class="scanner-overlay">
        <div class="scanner-frame" *ngIf="!error && !initializing"></div>
        <p class="scanner-hint" *ngIf="!error && !initializing">Pointez la caméra vers le QR du billet</p>
        <p class="scanner-hint" *ngIf="initializing">⏳ Activation de la caméra…</p>

        <div class="scanner-error-card" *ngIf="error">
          <div class="error-icon">⚠️</div>
          <p class="error-title">{{ error }}</p>
          <p class="error-help" *ngIf="errorHelp">{{ errorHelp }}</p>
        </div>
      </div>

      <div class="scanner-controls">
        <select
          [value]="selectedDeviceId"
          (change)="onDeviceChange($event)"
          *ngIf="devices.length > 1 && !error">
          <option *ngFor="let d of devices" [value]="d.deviceId">
            {{ d.label || 'Caméra ' + (devices.indexOf(d) + 1) }}
          </option>
        </select>
        <button class="btn-action" *ngIf="paused" (click)="restart()">
          <i class="bi bi-arrow-clockwise"></i> Scanner à nouveau
        </button>
        <button class="btn-action" (click)="retryCamera()" *ngIf="error">
          🔄 Réessayer la caméra
        </button>
        <button class="btn-action secondary" (click)="goToManualMode()">
          ⌨️ Saisir le token manuellement
        </button>
      </div>
    </div>

    <!-- ─── MANUAL INPUT MODE (toujours dans le DOM, masqué visuellement si mode scan) ─── -->
    <div class="manual-input-wrap" [hidden]="!showManualInput">
      <h3>Saisie manuelle du token QR</h3>
      <p class="muted">
        Si la caméra ne fonctionne pas, colle ici le token JWT extrait du QR
        (récupérable via l'email du billet ou directement via l'API du backend).
      </p>
      <textarea
        [(ngModel)]="manualToken"
        placeholder="eyJhbGciOiJIUzI1NiIs..."
        rows="4"></textarea>
      <div class="manual-actions">
        <button class="btn-action secondary" (click)="goToCameraMode()">
          ← Retour à la caméra
        </button>
        <button class="btn-action" (click)="submitManual()" [disabled]="!manualToken.trim()">
          Valider
        </button>
      </div>
    </div>
  `,
  styles: [
    `
      .scanner-wrap {
        position: relative;
        max-width: 480px;
        margin: 0 auto;
        background: #000;
        border-radius: 12px;
        overflow: hidden;
      }
      .scanner-video {
        width: 100%;
        height: auto;
        min-height: 280px;
        display: block;
        background: #000;
      }
      .scanner-overlay {
        position: absolute;
        inset: 0;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        pointer-events: none;
      }
      .scanner-frame {
        width: 65%;
        aspect-ratio: 1;
        border: 3px solid #fff;
        border-radius: 16px;
        box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.4);
      }
      .scanner-hint {
        margin-top: 1rem;
        color: #fff;
        font-size: 0.875rem;
        text-shadow: 0 1px 2px rgba(0, 0, 0, 0.6);
        padding: 0 1rem;
        text-align: center;
      }
      .scanner-error-card {
        background: rgba(0,0,0,0.85);
        border: 2px solid #ef4444;
        border-radius: 12px;
        padding: 1.5rem;
        max-width: 90%;
        text-align: center;
        pointer-events: auto;
      }
      .error-icon { font-size: 2.5rem; line-height: 1; }
      .error-title {
        color: #fff;
        font-weight: 600;
        margin: 0.5rem 0;
        font-size: 0.95rem;
      }
      .error-help {
        color: #cbd5e1;
        font-size: 0.825rem;
        margin: 0;
        line-height: 1.4;
      }
      .scanner-controls {
        display: flex;
        gap: 0.5rem;
        justify-content: center;
        padding: 0.75rem;
        background: #111;
        flex-wrap: wrap;
      }
      .scanner-controls select {
        flex: 1;
        max-width: 240px;
        padding: 0.5rem;
        background: #fff;
        border: none;
        border-radius: 6px;
        font-size: 0.875rem;
      }
      .btn-action {
        background: #1976d2;
        color: white;
        border: none;
        padding: 0.5rem 1rem;
        border-radius: 6px;
        font-weight: 500;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
        font-size: 0.875rem;
      }
      .btn-action.secondary { background: #475569; }
      .btn-action:hover { opacity: 0.92; }
      .btn-action:disabled { opacity: 0.5; cursor: not-allowed; }

      .manual-input-wrap {
        max-width: 520px;
        margin: 0 auto;
        background: #fff;
        border: 1px solid #e2e8f0;
        border-radius: 12px;
        padding: 1.5rem;
      }
      .manual-input-wrap h3 { margin: 0 0 0.5rem 0; font-size: 1.125rem; }
      .manual-input-wrap .muted {
        color: #64748b;
        font-size: 0.875rem;
        margin: 0 0 1rem 0;
      }
      .manual-input-wrap textarea {
        width: 100%;
        padding: 0.75rem;
        border: 1px solid #cbd5e1;
        border-radius: 8px;
        font-family: monospace;
        font-size: 0.825rem;
        resize: vertical;
      }
      .manual-actions {
        display: flex;
        justify-content: space-between;
        margin-top: 1rem;
        gap: 0.5rem;
      }
    `,
  ],
})
export class QrScannerComponent implements AfterViewInit, OnDestroy {
  @Output() scanned = new EventEmitter<string>();

  // 🔑 static:true OK car le <video> est toujours dans le DOM ([hidden] au lieu de *ngIf)
  @ViewChild('videoEl', { static: true }) videoEl!: ElementRef<HTMLVideoElement>;

  devices: MediaDeviceInfo[] = [];
  selectedDeviceId = '';
  error: string | null = null;
  errorHelp: string | null = null;
  paused = false;
  initializing = false;
  showManualInput = false;
  manualToken = '';

  private codeReader: BrowserMultiFormatReader;
  private controls: IScannerControls | null = null;

  constructor() {
    const hints = new Map<DecodeHintType, unknown>();
    hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.QR_CODE]);
    this.codeReader = new BrowserMultiFormatReader(hints);
  }

  async ngAfterViewInit(): Promise<void> {
    // Petit délai pour s'assurer que le DOM est bien attaché (SSR-safe)
    await new Promise((r) => setTimeout(r, 50));
    await this.initCamera();
  }

  ngOnDestroy(): void {
    this.stop();
  }

  goToManualMode(): void {
    this.showManualInput = true;
    this.stop(); // libère la caméra
  }

  async goToCameraMode(): Promise<void> {
    this.showManualInput = false;
    this.manualToken = '';
    // Redémarre la caméra
    if (!this.error && this.selectedDeviceId) {
      await this.startScan();
    } else {
      await this.initCamera();
    }
  }

  async retryCamera(): Promise<void> {
    this.error = null;
    this.errorHelp = null;
    await this.initCamera();
  }

  private async initCamera(): Promise<void> {
    // Guard SSR / DOM non disponible
    if (typeof navigator === 'undefined' || !navigator.mediaDevices) {
      this.error = 'API caméra non disponible.';
      this.errorHelp = 'Ce navigateur ne supporte pas l\'API mediaDevices.';
      return;
    }
    if (!this.videoEl?.nativeElement) {
      console.error('[QrScanner] videoEl not ready, retrying...');
      // Petit retry au cas où
      await new Promise((r) => setTimeout(r, 100));
      if (!this.videoEl?.nativeElement) {
        this.error = 'Élément vidéo non initialisé.';
        this.errorHelp = 'Rafraîchis la page (F5).';
        return;
      }
    }

    this.initializing = true;
    try {
      // 🔑 ÉTAPE 1 : demande EXPLICITE de permission
      let testStream: MediaStream | null = null;
      try {
        testStream = await navigator.mediaDevices.getUserMedia({ video: true });
        testStream.getTracks().forEach((t) => t.stop());
      } catch (permErr: any) {
        this.handlePermissionError(permErr);
        return;
      }

      // ÉTAPE 2 : lister les devices
      this.devices = await BrowserMultiFormatReader.listVideoInputDevices();
      if (this.devices.length === 0) {
        this.error = 'Aucune caméra disponible.';
        this.errorHelp = 'Vérifie que ton appareil a bien une webcam connectée et activée.';
        return;
      }

      // ÉTAPE 3 : choisir la caméra arrière si dispo, sinon la première
      const rear = this.devices.find((d) => /back|rear|environment/i.test(d.label));
      this.selectedDeviceId = rear?.deviceId ?? this.devices[0].deviceId;

      // ÉTAPE 4 : démarrer le scan
      await this.startScan();
    } catch (err: any) {
      console.error('[QrScanner] init failed', err);
      this.error = 'Erreur d\'initialisation de la caméra.';
      this.errorHelp = err?.message || String(err);
    } finally {
      this.initializing = false;
    }
  }

  private handlePermissionError(err: any): void {
    const name = err?.name || '';
    if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
      this.error = 'Accès caméra refusé.';
      this.errorHelp =
        'Clique sur l\'icône à gauche de l\'URL → Caméra → Autoriser, puis recharge la page.';
    } else if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
      this.error = 'Aucune caméra détectée.';
      this.errorHelp = 'Branche une webcam ou utilise un appareil avec caméra intégrée.';
    } else if (name === 'NotReadableError' || name === 'TrackStartError') {
      this.error = 'Caméra déjà utilisée par une autre application.';
      this.errorHelp = 'Ferme Teams, Zoom, Skype, OBS, ou tout logiciel qui utilise la caméra.';
    } else if (name === 'OverconstrainedError') {
      this.error = 'Configuration caméra non supportée.';
      this.errorHelp = 'Réessaie avec un autre périphérique caméra.';
    } else if (typeof location !== 'undefined' && location.protocol !== 'https:' && location.hostname !== 'localhost') {
      this.error = 'Caméra disponible uniquement en HTTPS ou sur localhost.';
      this.errorHelp = 'Utilise http://localhost:4200 au lieu de l\'IP réseau.';
    } else {
      this.error = `Erreur caméra : ${name || 'inconnue'}`;
      this.errorHelp = err?.message || 'Vérifie la console pour plus de détails.';
    }
    console.error('[QrScanner] permission error', err);
  }

  async onDeviceChange(event: Event): Promise<void> {
    const newId = (event.target as HTMLSelectElement).value;
    this.selectedDeviceId = newId;
    this.stop();
    await this.startScan();
  }

  restart(): void {
    this.paused = false;
    this.error = null;
    this.errorHelp = null;
    void this.startScan();
  }

  submitManual(): void {
    const token = this.manualToken.trim();
    if (token) {
      this.scanned.emit(token);
      this.manualToken = '';
    }
  }

  private async startScan(): Promise<void> {
    if (!this.selectedDeviceId) return;
    if (!this.videoEl?.nativeElement) {
      console.error('[QrScanner] videoEl missing in startScan');
      return;
    }
    try {
      this.controls = await this.codeReader.decodeFromVideoDevice(
        this.selectedDeviceId,
        this.videoEl.nativeElement,
        (result, _err, controls) => {
          if (result) {
            const text = result.getText();
            controls.stop();
            this.paused = true;
            this.scanned.emit(text);
          }
        },
      );
    } catch (err: any) {
      console.error('[QrScanner] startScan failed', err);
      this.handlePermissionError(err);
    }
  }

  private stop(): void {
    if (this.controls) {
      try {
        this.controls.stop();
      } catch (_) { /* noop */ }
      this.controls = null;
    }
  }
}
