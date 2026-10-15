import { API_BASE_URL } from './api';

export type VisitStatusFilter = 'pending' | 'approved' | 'all';

export interface VisitRequest {
  id: number;
  phoneNumber: string;
  name: string;
  /** Calendar date (YYYY-MM-DD) the customer claims to have visited. */
  dateOfVisit: string;
  isUsed: boolean;
  isApproved: boolean;
  approvedBy: number | null;
  approvedAt: string | null;
  rewardCodeId: number | null;
  createdAt: string;
}

export interface VisitRewardCode {
  id: number;
  phoneNumber: string;
  code: string;
  expiresAt: string;
  redeemedAt: string | null;
  redeemedBy: number | null;
  redeemedBookingId: number | null;
  createdAt: string;
  status: 'ACTIVE' | 'REDEEMED' | 'EXPIRED' | string;
}

export interface VisitRewardProgress {
  requiredVisits: number;
  windowDays: number;
  codeValidityDays: number;
  approvedVisits: number;
  visitsRemaining: number;
  pendingVisits: number;
  hasActiveRewardCode: boolean;
}

export interface VisitListParams {
  status: VisitStatusFilter;
  phone?: string;
  limit: number;
  offset: number;
}

export interface VisitApprovalResult {
  message: string;
  visit: VisitRequest;
  rewardCode: VisitRewardCode | null;
  progress: VisitRewardProgress;
}

export interface VisitRejectionResult {
  message: string;
  visit: VisitRequest;
}

/** Error carrying the HTTP status so callers can react to 401/404/409. */
export class VisitApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'VisitApiError';
    this.status = status;
  }
}

function extractErrorMessage(body: string, status: number): string {
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
    // Plain-text error body.
  }

  return body;
}

async function request<T>(
  token: string,
  path: string,
  method: 'GET' | 'POST' | 'DELETE' = 'GET',
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}/api/visit-rewards${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    const body = (await response.text()).trim();
    throw new VisitApiError(extractErrorMessage(body, response.status), response.status);
  }

  return (await response.json()) as T;
}

export async function fetchVisitRequests(
  token: string,
  { status, phone, limit, offset }: VisitListParams,
): Promise<VisitRequest[]> {
  const params = new URLSearchParams({
    status,
    limit: String(limit),
    offset: String(offset),
  });
  if (phone) params.set('phone', phone);

  const data = await request<{ success: boolean; visits: VisitRequest[] }>(
    token,
    `/visits?${params}`,
  );
  return data.visits ?? [];
}

export async function approveVisitRequest(
  token: string,
  visitId: number,
): Promise<VisitApprovalResult> {
  const data = await request<VisitApprovalResult & { success: boolean }>(
    token,
    `/visits/${visitId}/approve`,
    'POST',
  );
  return {
    message: data.message,
    visit: data.visit,
    rewardCode: data.rewardCode ?? null,
    progress: data.progress,
  };
}

export async function rejectVisitRequest(
  token: string,
  visitId: number,
): Promise<VisitRejectionResult> {
  const data = await request<VisitRejectionResult & { success: boolean }>(
    token,
    `/visits/${visitId}`,
    'DELETE',
  );
  return { message: data.message, visit: data.visit };
}
