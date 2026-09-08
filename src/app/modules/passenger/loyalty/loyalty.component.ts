import { Component, OnInit } from '@angular/core';
import { CommonModule, DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { LoyaltyPointsService } from '../../../core/services/loyalty-points.service';
import { ToastService } from '../../../core/services/toast.service';
import {
  LoyaltyPoints,
  LoyaltyTier,
  PointTransaction,
} from '../../../core/models/loyalty-points.model';

/**
 * Tier metadata — kept in the component as it is purely a UI concern.
 * Thresholds must stay in sync with backend LoyaltyTier comments.
 */
interface TierMeta {
  key: LoyaltyTier;
  label: string;
  min: number;
  next: number | null;
  color: string;
  bg: string;
  icon: string;
}

const TIERS: TierMeta[] = [
  { key: 'BRONZE',   label: 'Bronze',   min: 0,    next: 500,  color: '#a16207', bg: '#fef3c7', icon: 'bi-award' },
  { key: 'SILVER',   label: 'Argent',   min: 500,  next: 2000, color: '#475467', bg: '#eaecf0', icon: 'bi-award-fill' },
  { key: 'GOLD',     label: 'Or',       min: 2000, next: 5000, color: '#b54708', bg: '#fef0c7', icon: 'bi-star-fill' },
  { key: 'PLATINUM', label: 'Platine',  min: 5000, next: null, color: '#5925dc', bg: '#f4ebff', icon: 'bi-gem' },
];

// Conversion rate: 100 points = 1 DT discount (must match payment-service)
const POINTS_PER_DT = 100;
const MIN_REDEEM = 100;

@Component({
  selector: 'app-passenger-loyalty',
  standalone: true,
  imports: [CommonModule, DatePipe, DecimalPipe, FormsModule, RouterModule],
  templateUrl: './loyalty.component.html',
  styleUrls: ['./loyalty.component.css'],
})
export class PassengerLoyaltyComponent implements OnInit {
  loading = true;
  account: LoyaltyPoints | null = null;
  history: PointTransaction[] = [];

  redeemAmount: number | null = null;
  redeeming = false;

  readonly tiers = TIERS;
  readonly pointsPerDt = POINTS_PER_DT;
  readonly minRedeem = MIN_REDEEM;
  Math = Math;

  constructor(
    private loyaltyService: LoyaltyPointsService,
    private toast: ToastService,
  ) {}

  ngOnInit(): void {
    this.loadAll();
  }

  loadAll(): void {
    this.loading = true;
    forkJoin({
      acc: this.loyaltyService.getMyPoints().pipe(catchError(() => of(null))),
      hist: this.loyaltyService.getLoyaltyHistory().pipe(catchError(() => of([] as any))),
    }).subscribe(({ acc, hist }) => {
      this.account = acc;
      // Backend returns Page<PointTransactionResponse> — handle both shapes
      const list: any[] = Array.isArray(hist)
        ? hist
        : (hist && Array.isArray(hist.content) ? hist.content : []);
      // Normalize: backend uses `pointsDelta` + `reason`, model uses `points` + `type`
      this.history = list.map((t: any) => ({
        id: t.id,
        userId: t.userId || '',
        points: t.pointsDelta ?? t.points ?? 0,
        type: this.deriveType(t),
        referenceId: t.referenceId,
        description: t.description || t.reason,
        createdAt: t.createdAt,
      }));
      this.loading = false;
    });
  }

  private deriveType(t: any): 'EARN' | 'REDEEM' | 'EXPIRE' | 'ADJUSTMENT' {
    if (t.type) return t.type;
    const delta = t.pointsDelta ?? t.points ?? 0;
    const reason = (t.reason || '').toUpperCase();
    if (reason.includes('EXPIR')) return 'EXPIRE';
    if (reason.includes('ADJUST')) return 'ADJUSTMENT';
    return delta >= 0 ? 'EARN' : 'REDEEM';
  }

  // ────────── Tier helpers ──────────

  get currentTier(): TierMeta {
    const tier = this.account?.tier;
    return TIERS.find(t => t.key === tier) || TIERS[0];
  }

  get nextTier(): TierMeta | null {
    const idx = TIERS.findIndex(t => t.key === this.currentTier.key);
    return idx >= 0 && idx < TIERS.length - 1 ? TIERS[idx + 1] : null;
  }

  get progressToNext(): number {
    if (!this.account || !this.nextTier) return 100;
    const span = this.nextTier.min - this.currentTier.min;
    const have = this.account.totalEarned - this.currentTier.min;
    return Math.max(0, Math.min(100, Math.round((have / span) * 100)));
  }

  get pointsToNext(): number {
    if (!this.account || !this.nextTier) return 0;
    return Math.max(0, this.nextTier.min - this.account.totalEarned);
  }

  // ────────── Redeem ──────────

  get availablePoints(): number {
    return this.account?.points || 0;
  }

  get equivalentDt(): number {
    return Math.floor(this.availablePoints / POINTS_PER_DT);
  }

  get redeemEquivalentDt(): number {
    const n = Number(this.redeemAmount) || 0;
    return n > 0 ? Math.floor(n / POINTS_PER_DT * 100) / 100 : 0;
  }

  get canRedeem(): boolean {
    const n = Number(this.redeemAmount) || 0;
    return !this.redeeming
        && n >= MIN_REDEEM
        && n <= this.availablePoints
        && n % MIN_REDEEM === 0;
  }

  setQuickAmount(pts: number): void {
    if (pts > this.availablePoints) return;
    this.redeemAmount = pts;
  }

  redeem(): void {
    if (!this.canRedeem || !this.redeemAmount) return;
    this.redeeming = true;
    this.loyaltyService.redeemPoints({ points: this.redeemAmount }).subscribe({
      next: (updated) => {
        this.account = updated;
        this.toast.success(`Échange réussi : ${this.redeemAmount} points`);
        this.redeemAmount = null;
        this.redeeming = false;
        // Reload history to surface the new REDEEM transaction
        this.loyaltyService.getLoyaltyHistory().pipe(
          catchError(() => of([] as any)),
        ).subscribe((hist: any) => {
          const list = Array.isArray(hist) ? hist : (hist?.content || []);
          this.history = list.map((t: any) => ({
            id: t.id,
            userId: t.userId || '',
            points: t.pointsDelta ?? t.points ?? 0,
            type: this.deriveType(t),
            referenceId: t.referenceId,
            description: t.description || t.reason,
            createdAt: t.createdAt,
          }));
        });
      },
      error: (err) => {
        this.toast.error(err?.error?.message || 'Échec de l\'échange');
        this.redeeming = false;
      },
    });
  }

  // ────────── History UI ──────────

  iconForType(t: PointTransaction['type']): string {
    switch (t) {
      case 'EARN': return 'bi-plus-circle-fill';
      case 'REDEEM': return 'bi-gift-fill';
      case 'EXPIRE': return 'bi-clock-history';
      case 'ADJUSTMENT': return 'bi-pencil-square';
      default: return 'bi-circle';
    }
  }

  colorForType(t: PointTransaction['type']): string {
    switch (t) {
      case 'EARN': return '#027a48';
      case 'REDEEM': return '#7e3af2';
      case 'EXPIRE': return '#b42318';
      case 'ADJUSTMENT': return '#175cd3';
      default: return '#667085';
    }
  }

  labelForType(t: PointTransaction['type']): string {
    switch (t) {
      case 'EARN': return 'Gagné';
      case 'REDEEM': return 'Échangé';
      case 'EXPIRE': return 'Expiré';
      case 'ADJUSTMENT': return 'Ajustement';
      default: return '';
    }
  }
}
