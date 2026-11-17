import { API_BASE_URL } from './api';

export interface PricedGame {
  id: number;
  name: string;
  price: number;
}

/**
 * Live pricing from POST /api/offers/evaluate/actual.
 * Coupons and offers only discount setup; game premiums stay flat.
 */
export interface CouponPreview {
  playersCount: number;
  /** Console × players × hours. */
  setupPrice: number;
  /** Sum of flat game premiums. */
  gamesTotal: number;
  games: PricedGame[];
  /** Setup after offers, before coupons. */
  gameplayAfterOffers: number;
  /** setupPrice + gamesTotal (before discounts). */
  originalAmount: number;
  offerDiscount: number;
  /** Free-visit coupons — setup only. */
  couponDiscount: number;
  /** Offers plus coupons. */
  discountApplied: number;
  /** Final charge for setup + games (add-ons layered on by the UI). */
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

function asNumber(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function asPricedGames(value: unknown): PricedGame[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (typeof item !== 'object' || item === null) return null;
      const record = item as Record<string, unknown>;
      const id = Number(record.id);
      const price = Number(record.price);
      if (!Number.isFinite(id) || !Number.isFinite(price)) return null;
      return {
        id,
        name: typeof record.name === 'string' ? record.name : `Game ${id}`,
        price,
      };
    })
    .filter((game): game is PricedGame => game !== null);
}

export function parseBookingSummary(
  summary: Record<string, unknown>,
  couponCodes: string[] = [],
  couponsMeta?: { codes?: string[]; maxAllowed?: number },
): CouponPreview {
  const playersCount = asNumber(summary.playersCount);
  const setupPrice = asNumber(
    summary.setupPrice,
    asNumber(summary.originalAmount) - asNumber(summary.gamesTotal),
  );
  const games = asPricedGames(summary.games);
  const gamesTotal = asNumber(
    summary.gamesTotal,
    games.reduce((sum, game) => sum + game.price, 0),
  );
  const offerDiscount = asNumber(summary.offerDiscount);
  const couponDiscount = asNumber(summary.couponDiscount);
  const originalAmount = asNumber(summary.originalAmount, setupPrice + gamesTotal);
  const gameplayAfterOffers = asNumber(
    summary.gameplayAfterOffers,
    Math.max(0, setupPrice - offerDiscount),
  );
  const discountApplied = asNumber(summary.discountApplied, offerDiscount + couponDiscount);
  const totalAmount = asNumber(
    summary.totalAmount,
    Math.max(0, gameplayAfterOffers - couponDiscount) + gamesTotal,
  );

  return {
    playersCount,
    setupPrice,
    gamesTotal,
    games,
    gameplayAfterOffers,
    originalAmount,
    offerDiscount,
    couponDiscount,
    discountApplied,
    totalAmount,
    maxAllowed: couponsMeta?.maxAllowed ?? playersCount,
    codes: couponsMeta?.codes ?? couponCodes,
  };
}

/**
 * Prices a booking (with optional coupons) via POST /api/offers/evaluate/actual.
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
    bookingSummary: Record<string, unknown>;
    coupons?: { codes?: string[]; maxAllowed?: number };
  };

  return parseBookingSummary(data.bookingSummary ?? {}, couponCodes, data.coupons);
}
