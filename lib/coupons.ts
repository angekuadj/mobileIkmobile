export interface CouponPick {
  market: 'result' | 'goals';
  selection: string | null;
  historicalRate: number | null;
  sampleSize: number;
}

export interface CouponMatch {
  fixtureId: string;
  homeTeam: string;
  awayTeam: string;
  picks: CouponPick[];
}

export interface GeneratedCoupon {
  level: string;
  title: string;
  description: string;
  matches: CouponMatch[];
  estimatedCombinedRate?: number;
}

export interface StoredGeneratedCombination {
  id: string;
  createdAt: string;
  coupon: GeneratedCoupon;
}

export const GENERATED_COMBINATIONS_STORAGE_KEY = '@ikprono_generated_combinations_v1';
