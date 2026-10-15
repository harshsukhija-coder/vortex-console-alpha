import { API_BASE_URL } from './api';

export interface CouponPreview {
  playersCount: number;
  originalAmount: number;
  offerDiscount: number;
  couponDiscount: number;
  /** Offers plus coupons. */
  discountApplied: number;
  totalAmount: number;
  /** One coupon per player. */
  maxAllowed: number;
  codes: string[];
}

export interface BookingCoupon {
  code: string;
  phoneNumber: string;
  redeemedAt: string;
}

/** Carries the HTTP status so callers can react to 401 / 404 / 409 / 410. */
export class CouponApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'CouponApiError';
    this.status = status;
  }
}

/** Codes are case-insensitive and trimmed by the API; normalise for display and de-duping. */
export function normalizeCouponCode(code: string): string {
  return code.trim().toUpperCase();
}

function readErrorMessage(body: string, status: number): string {
  if (status === 401) return 'Your session has expired. Please sign in again.';
  if (!body) return `Request failed with HTTP ${status}.`;
  try {
    const parsed: unknown = JSON.parse(body);
    if (typeof parsed === 'object' && parsed !== null) {
      const record = parsed as Record<string, unknown>;
      if (typeof record.error === 'string') return record.error;
      if (typeof record.message === 'string') return record.message;
    }
  } catch {
    // Plain-text body.
  }
  return body;
}

/**
 * Prices a booking with coupons applied via POST /api/offers/evaluate/actual.
 * `appliedOfferIds` must be passed explicitly (an empty list means "no offers"),
 * otherwise the API auto-applies the best eligible offer and the coupon value
 * would not match what the operator selected.
 */
export async function evaluateCoupons(
  token: string,
  bookingPayload: Record<string, unknown>,
  couponCodes: string[],
  appliedOfferIds: number[],
): Promise<CouponPreview> {
  const response = await fetch(`${API_BASE_URL}/api/offers/evaluate/actual`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ ...bookingPayload, couponCodes, appliedOfferIds }),
  });

  if (!response.ok) {
    const body = (await response.text()).trim();
    throw new CouponApiError(readErrorMessage(body, response.status), response.status);
  }

  const data = (await response.json()) as {
    bookingSummary: Omit<CouponPreview, 'maxAllowed' | 'codes'>;
    coupons?: { codes?: string[]; maxAllowed?: number };
  };
  const summary = data.bookingSummary;

  return {
    playersCount: summary.playersCount,
    originalAmount: summary.originalAmount,
    offerDiscount: summary.offerDiscount ?? 0,
    couponDiscount: summary.couponDiscount ?? 0,
    discountApplied: summary.discountApplied ?? 0,
    totalAmount: summary.totalAmount,
    maxAllowed: data.coupons?.maxAllowed ?? summary.playersCount,
    codes: data.coupons?.codes ?? couponCodes,
  };
}
