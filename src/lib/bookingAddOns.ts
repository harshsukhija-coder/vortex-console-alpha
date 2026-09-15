import { API_BASE_URL, assertSuccessfulJsonResponse } from './api';

export interface AddOnCatalogItem {
  id: number;
  itemName: string;
  price: number;
  quantity: number;
  quantityUnit: string;
  imageUrl?: string | null;
  isActive: boolean;
}

export interface SelectedAddOn {
  addOnId: number;
  units: number;
}

export interface BookingAddOn {
  addOnId?: number;
  itemName: string;
  unitPrice: number;
  itemQuantity: number;
  quantityUnit: string;
  units: number;
  lineTotal: number;
}

export interface AddOnSelectorProps {
  items: AddOnCatalogItem[];
  selected: SelectedAddOn[];
  isLoading?: boolean;
  disabled?: boolean;
  onChange: (items: SelectedAddOn[]) => void;
}

export interface BookingAddOnsResponse {
  success: boolean;
  bookingId: number;
  addOns: BookingAddOn[];
  addOnsTotal: number;
}

export interface AttachBookingAddOnsResponse {
  success: boolean;
  message: string;
  booking: {
    id: number;
    originalAmount: number;
    amountCharged: number;
    cashAmount: number;
    upiAmount: number;
  };
  addedTotal: number;
  addOnsTotal: number;
}

function headers(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}` };
}

export async function fetchAvailableAddOns(token: string): Promise<AddOnCatalogItem[]> {
  const response = await fetch(`${API_BASE_URL}/api/add-ons`, {
    headers: headers(token),
  });
  await assertSuccessfulJsonResponse(response);
  const data = (await response.json()) as {
    success: boolean;
    addOns: AddOnCatalogItem[];
  };
  return data.addOns.filter((item) => item.isActive);
}

export async function fetchBookingAddOns(
  token: string,
  bookingId: number,
): Promise<BookingAddOnsResponse> {
  const response = await fetch(`${API_BASE_URL}/api/bookings/${bookingId}/add-ons`, {
    headers: headers(token),
  });
  await assertSuccessfulJsonResponse(response);
  return response.json() as Promise<BookingAddOnsResponse>;
}

export async function attachBookingAddOns(
  token: string,
  bookingId: number,
  items: SelectedAddOn[],
): Promise<AttachBookingAddOnsResponse> {
  const response = await fetch(`${API_BASE_URL}/api/bookings/${bookingId}/add-ons`, {
    method: 'POST',
    headers: {
      ...headers(token),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ items }),
  });
  await assertSuccessfulJsonResponse(response);
  return response.json() as Promise<AttachBookingAddOnsResponse>;
}

export function calculateAddOnsTotal(
  catalog: AddOnCatalogItem[],
  selected: SelectedAddOn[],
): number {
  return selected.reduce((total, selection) => {
    const item = catalog.find((candidate) => candidate.id === selection.addOnId);
    return total + (item?.price ?? 0) * selection.units;
  }, 0);
}
