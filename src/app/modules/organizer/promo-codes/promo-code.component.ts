import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import {
  ReactiveFormsModule,
  FormBuilder,
  FormGroup,
  Validators,
} from '@angular/forms';
import { HttpClient, HttpParams } from '@angular/common/http';

import { OrganizerSidebarComponent } from '../organizer-sidebar/organizer-sidebar.component';
import { ConfirmModalService } from '../../../core/services/confirm-modal.service';
import { VoyageService } from '../../../core/services/voyage.service';
import { Voyage } from '../../../core/models/voyage.model';
import { environment } from '../../../../environments/environment';

/**
 * Backend DTO ({@code OrganizerPromoCodeResponse}). Kept as a verbatim
 * interface so the template can bind to {@code p.code}, {@code p.active},
 * etc. without an additional mapping layer.
 */
interface OrganizerPromoCode {
  id: string;
  code: string;
  discountType: 'PERCENTAGE' | 'FIXED_AMOUNT';
  discountValue: number;
  validFrom?: string;
  validUntil?: string;
  maxUses?: number | null;
  usedCount: number;
  minAmount?: number;
  active: boolean;
  currentlyValid: boolean;
  organizerId: string;
  voyageId?: string | null;
  createdAt: string;

  /** UI alias: the template binds to {@code p.currentUses}. */
  currentUses: number;
}

interface PageEnvelope<T> {
  content: T[];
  totalElements: number;
}

/**
 * "Codes promotionnels" — organizer dashboard.
 *
 * Backend mapping (payment-service, V1.4 — `OrganizerPromoCodeController`):
 *  - GET  /api/v1/payments/organizer/promo-codes           → list
 *  - POST /api/v1/payments/organizer/promo-codes           → create
 *  - PATCH /api/v1/payments/organizer/promo-codes/{id}     → update
 *  - POST /api/v1/payments/organizer/promo-codes/{id}/activate
 *  - POST /api/v1/payments/organizer/promo-codes/{id}/deactivate
 *  - DELETE /api/v1/payments/organizer/promo-codes/{id}    → delete
 *  - GET  /api/v1/payments/organizer/promo-codes/stats     → KPI
 */
@Component({
  selector: 'app-organizer-promo-codes',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    ReactiveFormsModule,
    OrganizerSidebarComponent,
  ],
  templateUrl: './promo-code.component.html',
  styleUrls: ['./promo-code.component.css'],
})
export class OrganizerPromoCodesComponent implements OnInit {
  private readonly baseUrl = `${environment.apiUrl}/api/v1/payments/organizer/promo-codes`;

  promoCodes: OrganizerPromoCode[] = [];
  voyages: Voyage[] = [];
  promoForm: FormGroup;

  loading = true;
  submitting = false;
  showModal = false;
  errorMessage = '';
  successMessage = '';
  statusFilter: 'all' | 'active' | 'expired' = 'all';

  currentDate = '';
  agencyName = 'Bonjour Tunisia Tours';

  // ---- KPIs ------------------------------------------------------------
  monthlySavings = 0;
  savingsTrend: number | null = null;
  popularityData: { code: string; percent: number }[] = [];

  constructor(
    private http: HttpClient,
    private fb: FormBuilder,
    private confirm: ConfirmModalService,
    private voyageService: VoyageService,
  ) {
    this.promoForm = this.fb.group({
      code: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(50),
        Validators.pattern(/^[A-Z0-9_-]+$/)]],
      discountType: ['PERCENTAGE', Validators.required],
      discountValue: [10, [Validators.required, Validators.min(0.01)]],
      maxUses: [null],
      expiresAt: [''],
      voyageId: [''],
    });
  }

  ngOnInit(): void {
    this.setCurrentDate();
    this.loadVoyages();
    this.loadPromoCodes();
  }

  private setCurrentDate(): void {
    this.currentDate = new Date().toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  }

  // =====================================================================
  //  LIST
  // =====================================================================

  loadPromoCodes(): void {
    this.loading = true;
    const params = new HttpParams().set('status', this.statusFilter).set('size', 100);
    this.http
      .get<PageEnvelope<OrganizerPromoCode>>(this.baseUrl, { params })
      .subscribe({
        next: (page) => {
          this.promoCodes = (page.content ?? []).map((p) => ({
            ...p,
            currentUses: p.usedCount ?? 0,
          }));
          this.computePopularity();
          this.loading = false;
        },
        error: () => {
          this.promoCodes = [];
          this.loading = false;
        },
      });

    // KPI in parallel — failure is non-blocking.
    this.http.get<{ totalRedemptions: number }>(`${this.baseUrl}/stats`).subscribe({
      next: (s) => {
        // No "savings in DT" endpoint yet — use redemption count as the
        // headline metric; the dashboard label still reads correctly
        // because the API returns a single scalar.
        this.monthlySavings = s.totalRedemptions ?? 0;
        this.savingsTrend = null;
      },
      error: () => {
        this.monthlySavings = 0;
        this.savingsTrend = null;
      },
    });
  }

  private loadVoyages(): void {
    this.voyageService.getMyVoyages(0, 100).subscribe({
      next: (data) => (this.voyages = data),
      error: () => (this.voyages = []),
    });
  }

  private computePopularity(): void {
    if (this.promoCodes.length === 0) {
      this.popularityData = [];
      return;
    }
    const max = Math.max(...this.promoCodes.map((p) => p.currentUses), 1);
    this.popularityData = [...this.promoCodes]
      .sort((a, b) => b.currentUses - a.currentUses)
      .slice(0, 5)
      .map((p) => ({
        code: p.code,
        percent: Math.round((p.currentUses / max) * 100),
      }));
  }

  toggleFilter(): void {
    const order: Array<typeof this.statusFilter> = ['all', 'active', 'expired'];
    const idx = order.indexOf(this.statusFilter);
    this.statusFilter = order[(idx + 1) % order.length];
    this.loadPromoCodes();
  }

  // =====================================================================
  //  CREATE
  // =====================================================================

  openModal(): void {
    this.showModal = true;
    this.errorMessage = '';
    this.successMessage = '';
    this.promoForm.reset({
      code: '',
      discountType: 'PERCENTAGE',
      discountValue: 10,
      maxUses: null,
      expiresAt: '',
      voyageId: '',
    });
  }

  closeModal(): void {
    this.showModal = false;
  }

  closeModalOnOverlay(event: MouseEvent): void {
    if (event.target === event.currentTarget) this.closeModal();
  }

  addPromo(): void {
    if (this.promoForm.invalid || this.submitting) return;
    this.submitting = true;
    this.errorMessage = '';

    const v = this.promoForm.value;

    // `expiresAt` is bound to a `<input type="date">` ⇒ "yyyy-MM-dd".
    // Append a time-of-day so Spring's LocalDateTime binder accepts it.
    const validUntil = v.expiresAt ? `${v.expiresAt}T23:59:00` : undefined;

    const payload = {
      code: String(v.code).trim().toUpperCase(),
      discountType: v.discountType,
      discountValue: Number(v.discountValue),
      maxUses: v.maxUses ? Number(v.maxUses) : undefined,
      validUntil,
      voyageId: v.voyageId || undefined,
    };

    this.http.post<OrganizerPromoCode>(this.baseUrl, payload).subscribe({
      next: () => {
        this.successMessage = 'Code promo créé avec succès';
        this.submitting = false;
        setTimeout(() => {
          this.closeModal();
          this.loadPromoCodes();
        }, 400);
      },
      error: (err) => {
        this.errorMessage = err.error?.message || 'Erreur lors de la création';
        this.submitting = false;
      },
    });
  }

  // =====================================================================
  //  ACTIONS
  // =====================================================================

  /**
   * The "Action" button is contextual:
   *   - expired       → DELETE (with confirm)
   *   - active        → POST /deactivate
   *   - inactive      → POST /activate
   */
  async handleAction(p: OrganizerPromoCode): Promise<void> {
    if (this.isExpired(p)) {
      const ok = await this.confirm.confirm(
        `Supprimer le code « ${p.code} » ?`,
        'Suppression',
      );
      if (!ok) return;
      this.http.delete<void>(`${this.baseUrl}/${p.id}`).subscribe({
        next: () => this.loadPromoCodes(),
        error: () => (this.errorMessage = 'Erreur lors de la suppression'),
      });
      return;
    }

    const verb = p.active ? 'deactivate' : 'activate';
    this.http.post<OrganizerPromoCode>(`${this.baseUrl}/${p.id}/${verb}`, {}).subscribe({
      next: () => this.loadPromoCodes(),
      error: () => (this.errorMessage = 'Erreur lors de la mise à jour'),
    });
  }

  // =====================================================================
  //  TEMPLATE HELPERS
  // =====================================================================

  isExpired(p: OrganizerPromoCode): boolean {
    // The backend computes this in {@code currentlyValid} — invert it for
    // the "expired/exhausted" pill.
    return !p.currentlyValid;
  }

  getDiscountLabel(p: OrganizerPromoCode): string {
    if (p.discountType === 'PERCENTAGE') return `-${p.discountValue}%`;
    return `-${p.discountValue} DT`;
  }

  getVoyageLabel(p: OrganizerPromoCode): string {
    if (!p.voyageId) return 'Tous mes voyages';
    const voyage = this.voyages.find((v) => v.id === p.voyageId);
    return voyage ? voyage.title : 'Voyage spécifique';
  }

  getExpiryLabel(p: OrganizerPromoCode): string {
    if (!p.validUntil) return 'Sans expiration';
    const d = new Date(p.validUntil);
    return `Expire le ${d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })}`;
  }

  getPreviewText(): string {
    const v = this.promoForm.value;
    if (!v.code) return 'Renseignez le code et la valeur pour voir l\'aperçu';
    const discount = v.discountType === 'PERCENTAGE'
      ? `-${v.discountValue || 0}%`
      : `-${v.discountValue || 0} DT`;
    const limit = v.maxUses ? ` • limité à ${v.maxUses} utilisations` : '';
    return `${v.code.toUpperCase()} : ${discount}${limit}`;
  }
}
