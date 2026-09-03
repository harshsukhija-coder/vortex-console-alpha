import { API_BASE_URL } from './api';

export interface UpcomingBooking {
  bookingId: number;
  status: string;
  setupInstanceId: number;
  setupName: string;
  phoneNumber: string;
  playersCount: number;
  date: string;
  startTime: string;
  endTime: string;
  startTimeIso: string;
  endTimeIso: string;
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
}

export interface ScheduleQuery {
  token?: string | null;
  days?: number;
  setupInstanceId?: number;
}

export async function fetchUpcomingSchedule(
  query: ScheduleQuery = {},
): Promise<ScheduleResponse> {
  const params = new URLSearchParams();
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
  return response.json() as Promise<ScheduleResponse>;
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
