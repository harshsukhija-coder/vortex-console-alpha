import { API_BASE_URL, assertSuccessfulJsonResponse } from './api';

export interface ExtensionOffer {
  id: number;
  code: string;
  eligible: boolean;
  discount: number;
  finalAmount?: number;
}

export interface ExtensionPreview {
  extensionMinutes: number;
  extensionHours: number;
  previousEndTime: string;
  newEndTime: string;
  totalDurationHours: number;
  pricing: {
    ratePerPersonPerHour: number;
    /** Console × players × total hours after the extension. */
    setupPrice?: number;
    /** Flat game premiums — unchanged on extend. */
    gamesTotal?: number;
    games?: Array<{ id: number; name: string; price: number }>;
    originalAmount: number;
    discountApplied: number;
    totalAmount: number;
    previousTotalAmount: number;
    /** Setup-hours delta only; game premium is not re-charged. */
    additionalAmountToPay: number;
  };
  appliedOffers: ExtensionOffer[];
  ineligibleOffers: ExtensionOffer[];
}

export interface ExtensionPreviewResponse {
  success: boolean;
  canExtend: boolean;
  conflict: string | null;
  extensionPreview: ExtensionPreview;
}

export async function fetchExtensionPreview(
  setupInstanceId: number,
  extensionMinutes: number,
  token: string,
): Promise<ExtensionPreviewResponse> {
  const params = new URLSearchParams({
    extensionMinutes: String(extensionMinutes),
  });
  const response = await fetch(
    `${API_BASE_URL}/api/setup-instances/${setupInstanceId}/extension-preview?${params}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  );

  await assertSuccessfulJsonResponse(response);
  return response.json() as Promise<ExtensionPreviewResponse>;
}
