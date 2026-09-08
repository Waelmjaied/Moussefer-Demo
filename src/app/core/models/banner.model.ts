export type BannerAudience = 'ALL' | 'PASSENGER' | 'DRIVER' | 'ORGANIZER';

export interface Banner {
  id: string; // ← string UUID (was number)
  title: string;
  imageUrl: string;
  redirectUrl: string; // ← backend field name (was 'link')
  displayOrder: number;
  targetAudience: BannerAudience;
  active: boolean;
  startsAt?: string;
  endsAt?: string;
  createdAt?: string;
}

export interface CreateBannerRequest {
  title: string;
  imageUrl: string;
  redirectUrl: string;
  displayOrder?: number;
  targetAudience?: BannerAudience;
  active: boolean;
  startsAt?: string;
  endsAt?: string;
}
