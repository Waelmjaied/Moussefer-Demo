export interface PromoCode {
  id: string;
  code: string;
  discountType: 'PERCENTAGE' | 'FIXED';
  discountValue: number;
  validUntil: string; // ISO date
  usageLimit?: number;
  usedCount?: number;
  active: boolean;
  description?: string;
}
