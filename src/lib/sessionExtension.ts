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
    originalAmount: number;
    discountApplied: number;
    totalAmount: number;
    previousTotalAmount: number;
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
