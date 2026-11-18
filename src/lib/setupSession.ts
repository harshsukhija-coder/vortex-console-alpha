import { API_BASE_URL, assertSuccessfulJsonResponse } from './api';

export interface SessionGame {
  id: number;
  name: string;
  price?: number;
}

export interface PreviousSession {
  bookingId: number;
  status: string;
  phoneNumber: string;
  playersCount: number;
  scheduledStartTime?: string | null;
  scheduledEndTime?: string | null;
  /** Prefer startedAt from newer APIs; keep actualStartTime for older payloads. */
  startedAt?: string | null;
  startedAtFormatted?: string | null;
  actualStartTime?: string | null;
  actualEndTime?: string | null;
  originalAmount?: number;
  amountCharged?: number;
  customer?: {
    name: string;
    phoneNumber: string;
  };
  games?: SessionGame[];
}

export interface CheckoutPreview {
  setupPricing: {
    singlePlayerPrice: number;
    multiplayerPrice: number;
    ratePerPersonPerHour: number;
    playerType?: string;
  };
  timing: {
    sessionStarted?: boolean;
    /** Canonical start used by the new terminate preview. */
    startedAt?: string;
    /** Older field — still accepted as a fallback. */
    actualStartTime?: string;
    proposedEndTime?: string;
    elapsedMinutes: number;
    billedMinutes: number;
    billedHours: number;
  };
  games?: {
    items: SessionGame[];
    total: number;
  };
  gameplay: {
    setupAmount?: number;
    gamesTotal?: number;
    /** What the UI labels “Initial Gameplay”. */
    initialAmount?: number;
    originalAmount: number;
    discountApplied?: number;
    amountAfterOffers?: number;
  };
  addOns?: {
    items: Array<{
      addOnId: number;
      itemName: string;
      unitPrice: number;
      itemQuantity: number;
      quantityUnit: string;
      units: number;
      lineTotal: number;
    }>;
    total: number;
  };
  settlement: {
    calculatedAmountCharged?: number;
    totalPayable: number;
    calculationFormula: string;
    cashAmount: number;
    upiAmount: number;
    paymentRecorded?: number;
    paymentDue?: number;
    refundDue?: number;
    exactBalance?: boolean;
    status: string;
  };
  appliedOffers?: Array<{
    id: number;
    code: string;
    discount: number;
  }>;
}

export interface CheckoutPreviewParams {
  actualEndTime?: string;
  /** Use when the session started before the scheduled start. */
  actualStartTime?: string;
  cashAmount?: number;
  upiAmount?: number;
}

export interface SetupSessionStatus {
  success: boolean;
  setupInstance?: {
    id: number;
    name: string;
    setupConfigurationId: number;
    isActive: boolean;
  };
  previousSessionTerminatedSuccessfully: boolean;
  canCreateNewSession: boolean;
  requiresTermination: boolean;
  canTerminate: boolean;
  canTerminateWithProposedTime?: boolean;
  /** Present when preview is available but something needs attention (e.g. not started yet). */
  checkoutPreviewError?: string | null;
  previousSession?: PreviousSession;
  checkoutPreview?: CheckoutPreview | null;
}

export interface TerminatedSessionSummary {
  bookingId: number;
  status: string;
  timing?: {
    startTime: string;
    endTime: string;
    elapsedMinutes: number;
    chargedMinutes: number;
  };
  gamesPlayed?: SessionGame[];
  billing?: {
    setupAmount?: number;
    gamesTotal?: number;
    finalAmountCharged?: number;
    calculationFormula?: string;
    [key: string]: unknown;
  };
}

export interface TerminateSetupSessionResponse {
  success: boolean;
  message?: string;
  error?: string;
  sessionSummary?: TerminatedSessionSummary;
}

export interface TerminateSetupSessionPayload {
  actualStartTime?: string;
  actualEndTime: string;
  finalAmountCharged?: number;
  cashAmount: number;
  upiAmount: number;
}

function getAuthorizationHeaders(token: string): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
  };
}

/** Prefer the new `startedAt` field, then older aliases. */
export function getCheckoutStartedAt(
  preview?: CheckoutPreview | null,
  previousSession?: PreviousSession | null,
): string | null {
  return (
    preview?.timing.startedAt
    || preview?.timing.actualStartTime
    || previousSession?.startedAt
    || previousSession?.actualStartTime
    || previousSession?.scheduledStartTime
    || null
  );
}

export function getCheckoutInitialGameplay(preview?: CheckoutPreview | null): number {
  if (!preview) return 0;
  return Number(
    preview.gameplay.initialAmount
    ?? preview.gameplay.originalAmount
    ?? preview.gameplay.setupAmount
    ?? 0,
  );
}

export function getCheckoutGameplayAfterOffers(preview?: CheckoutPreview | null): number {
  if (!preview) return 0;
  if (preview.gameplay.amountAfterOffers != null) return Number(preview.gameplay.amountAfterOffers);
  const setup = Number(preview.gameplay.setupAmount ?? 0);
  const games = Number(preview.gameplay.gamesTotal ?? preview.games?.total ?? 0);
  const discount = Number(preview.gameplay.discountApplied ?? 0);
  return Math.max(0, setup + games - discount);
}

export async function fetchSetupSessionStatus(
  setupInstanceId: number,
  token: string,
  preview?: CheckoutPreviewParams,
): Promise<SetupSessionStatus> {
  const params = new URLSearchParams();
  if (preview?.actualEndTime) params.set('actualEndTime', preview.actualEndTime);
  if (preview?.actualStartTime) params.set('actualStartTime', preview.actualStartTime);
  if (preview?.cashAmount !== undefined) params.set('cashAmount', String(preview.cashAmount));
  if (preview?.upiAmount !== undefined) params.set('upiAmount', String(preview.upiAmount));
  const query = params.size > 0 ? `?${params}` : '';
  const response = await fetch(
    `${API_BASE_URL}/api/setup-instances/${setupInstanceId}/terminate-session${query}`,
    { headers: getAuthorizationHeaders(token) },
  );
  await assertSuccessfulJsonResponse(response);
  return response.json() as Promise<SetupSessionStatus>;
}

export async function terminateSetupSession(
  setupInstanceId: number,
  token: string,
  payload: TerminateSetupSessionPayload,
): Promise<TerminateSetupSessionResponse> {
  const response = await fetch(
    `${API_BASE_URL}/api/setup-instances/${setupInstanceId}/terminate-session`,
    {
      method: 'POST',
      headers: {
        ...getAuthorizationHeaders(token),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    },
  );
  await assertSuccessfulJsonResponse(response);
  return response.json() as Promise<TerminateSetupSessionResponse>;
}

export function createDefaultTerminationPayload(
  status: SetupSessionStatus,
): TerminateSetupSessionPayload {
  const previousSession = status.previousSession;
  const preview = status.checkoutPreview;
  const actualStartTime = getCheckoutStartedAt(preview, previousSession);
  if (!actualStartTime) {
    throw new Error('The previous session is missing its start time.');
  }

  const finalAmountCharged = Number(
    preview?.settlement.totalPayable
    ?? previousSession?.amountCharged
    ?? previousSession?.originalAmount
    ?? 0,
  );

  return {
    actualStartTime,
    actualEndTime:
      preview?.timing.proposedEndTime
      ?? previousSession?.actualEndTime
      ?? new Date().toISOString(),
    finalAmountCharged,
    cashAmount: preview?.settlement.cashAmount ?? finalAmountCharged,
    upiAmount: preview?.settlement.upiAmount ?? 0,
  };
}
