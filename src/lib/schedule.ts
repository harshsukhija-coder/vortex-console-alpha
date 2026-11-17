import { API_BASE_URL, assertSuccessfulJsonResponse } from './api';

export interface UpcomingBooking {
  bookingId: number;
  status: string;
  setupInstanceId: number;
  setupConfigurationId?: number;
  setupName: string;
  instanceName?: string;
  phoneNumber: string;
  playersCount: number;
  date: string;
  startTime: string;
  endTime: string;
  startTimeIso: string;
  endTimeIso?: string;
  noOfHours?: number;
  originalAmount: number;
  amountCharged: number;
}

export interface ScheduleResponse {
  success: boolean;
  view?: string;
  timezone?: string;
  from?: string;
  days?: number;
  count?: number;
  upcoming?: UpcomingBooking[];
  error?: string;
  message?: string;
  httpStatus?: number;
}

export interface ScheduleQuery {
  token?: string | null;
  days?: number;
  setupInstanceId?: number;
}

/** Fields accepted by PATCH /api/schedule/upcoming/:bookingId */
export interface UpcomingBookingUpdate {
  date?: string;
  startTime?: string;
  noOfHours?: number;
  playersCount?: number;
  phoneNumber?: string;
  setupInstanceId?: number;
}

export interface UpcomingMutationResult {
  success: boolean;
  message?: string;
  upcoming?: UpcomingBooking;
  error?: string;
}

/** Error carrying the HTTP status so callers can react to 401/404/409. */
export class ScheduleApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ScheduleApiError';
    this.status = status;
  }
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

export async function fetchUpcomingSchedule(
  query: ScheduleQuery = {},
): Promise<ScheduleResponse> {
  const params = new URLSearchParams();
  params.set('view', 'upcoming');
  params.set('days', String(query.days ?? 14));
  if (query.setupInstanceId) {
    params.set('setupInstanceId', String(query.setupInstanceId));
  }

  const headers: HeadersInit = {};
  if (query.token) {
    headers.Authorization = `Bearer ${query.token}`;
  }

  const response = await fetch(`${API_BASE_URL}/api/schedule?${params.toString()}`, {
    headers,
  });
  if (!response.ok) {
    const message = (await response.text()).trim();
    return {
      success: false,
      error: message || `Request failed with HTTP ${response.status}.`,
      httpStatus: response.status,
    };
  }
  await assertSuccessfulJsonResponse(response);
  const data = (await response.json()) as ScheduleResponse;
  return { ...data, httpStatus: response.status };
}

export async function updateUpcomingBooking(
  token: string,
  bookingId: number,
  patch: UpcomingBookingUpdate,
): Promise<UpcomingMutationResult> {
  const response = await fetch(
    `${API_BASE_URL}/api/schedule/upcoming/${bookingId}`,
    {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(patch),
    },
  );

  if (!response.ok) {
    const body = (await response.text()).trim();
    throw new ScheduleApiError(readErrorMessage(body, response.status), response.status);
  }

  return (await response.json()) as UpcomingMutationResult;
}

export async function cancelUpcomingBooking(
  token: string,
  bookingId: number,
): Promise<UpcomingMutationResult> {
  const response = await fetch(
    `${API_BASE_URL}/api/schedule/upcoming/${bookingId}`,
    {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    },
  );

  if (!response.ok) {
    const body = (await response.text()).trim();
    throw new ScheduleApiError(readErrorMessage(body, response.status), response.status);
  }

  return (await response.json()) as UpcomingMutationResult;
}

export function getNextUpcomingForInstance(
  upcoming: UpcomingBooking[],
  setupInstanceId: number,
  excludeBookingId?: number,
): UpcomingBooking | undefined {
  return upcoming.find(
    (item) =>
      item.setupInstanceId === setupInstanceId &&
      item.bookingId !== excludeBookingId,
  );
}

export function formatScheduleDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  if (!year || !month || !day) return dateStr;
  return new Date(year, month - 1, day).toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
  });
}

/** Parse API times like "07:00 PM" into form parts. */
export function parseScheduleTime(value: string): {
  hour: string;
  minute: string;
  period: 'AM' | 'PM';
} {
  const match = value.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return { hour: '07', minute: '00', period: 'PM' };
  return {
    hour: String(Number(match[1])).padStart(2, '0'),
    minute: match[2],
    period: match[3].toUpperCase() as 'AM' | 'PM',
  };
}

export function formatScheduleTime(hour: string, minute: string, period: 'AM' | 'PM'): string {
  return `${String(Number(hour)).padStart(2, '0')}:${minute} ${period}`;
}

/** Infer duration from start/end labels when the API omits noOfHours. */
export function inferHoursFromSlot(startTime: string, endTime: string): number {
  const toMinutes = (label: string) => {
    const { hour, minute, period } = parseScheduleTime(label);
    let h = Number(hour) % 12;
    if (period === 'PM') h += 12;
    return h * 60 + Number(minute);
  };
  const diff = toMinutes(endTime) - toMinutes(startTime);
  if (!Number.isFinite(diff) || diff <= 0) return 1;
  return Math.round((diff / 60) * 100) / 100;
}
