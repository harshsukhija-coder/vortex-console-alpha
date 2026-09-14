import { API_BASE_URL, assertSuccessfulJsonResponse } from './api';

export interface MeterReadingUser {
  id: number;
  email: string;
  role: 'ADMIN' | 'SUPER_ADMIN';
}

export interface MeterReading {
  id: number;
  readingDate: string;
  meterReading: number;
  imageMimeType: string;
  imageFileName: string;
  imageSize: number;
  submittedBy: number;
  updatedBy?: number | null;
  imageUrl: string;
  submittedByUser?: MeterReadingUser;
  updatedByUser?: MeterReadingUser | null;
}

export interface MeterReadingsProps {
  token: string;
  role: 'ADMIN' | 'SUPER_ADMIN';
  onTodayReadingCompleted: () => void;
}

export interface MeterAnalyticsProps {
  token: string;
}

export interface MeterConsumptionInterval {
  fromDate: string;
  toDate: string;
  openingReading: number;
  closingReading: number;
  calendarDays: number;
  unitsConsumed: number;
  averageUnitsPerDay: number;
  hasNegativeConsumption: boolean;
}

export interface MeterConsumptionAnalytics {
  range: {
    from: string;
    to: string;
    timezone: string;
    totalCalendarDays: number;
  };
  summary: {
    openingReading: number;
    closingReading: number;
    totalUnitsConsumed: number;
    averageUnitsPerDay: number;
    readingsRecorded: number;
    expectedReadings: number;
    missingReadings: number;
    recordedIntervals: number;
    minimumIntervalConsumption: number;
    maximumIntervalConsumption: number;
    hasNegativeConsumption: boolean;
  };
  intervals: MeterConsumptionInterval[];
  dataQuality: {
    isComplete: boolean;
    missingReadingDates: string[];
    negativeIntervals: MeterConsumptionInterval[];
    calculationMethod: string;
  };
}

interface MeterReadingResponse {
  success: boolean;
  message?: string;
  reading: MeterReading | null;
}

function authorizationHeader(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}` };
}

export function getIstDate(): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const getPart = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? '';

  return `${getPart('year')}-${getPart('month')}-${getPart('day')}`;
}

export async function fetchMeterReading(
  token: string,
  date?: string,
): Promise<MeterReading | null> {
  const query = date ? `?date=${encodeURIComponent(date)}` : '';
  const response = await fetch(`${API_BASE_URL}/api/meter-readings${query}`, {
    headers: authorizationHeader(token),
  });
  if (response.status === 404) return null;
  await assertSuccessfulJsonResponse(response);
  const data = (await response.json()) as MeterReadingResponse;
  return data.reading;
}

export async function createMeterReading(
  token: string,
  readingDate: string,
  meterReading: number,
  image: File,
): Promise<MeterReadingResponse> {
  const body = new FormData();
  body.append('readingDate', readingDate);
  body.append('meterReading', String(meterReading));
  body.append('image', image);

  const response = await fetch(`${API_BASE_URL}/api/meter-readings`, {
    method: 'POST',
    headers: authorizationHeader(token),
    body,
  });
  await assertSuccessfulJsonResponse(response);
  return response.json() as Promise<MeterReadingResponse>;
}

export async function updateMeterReading(
  token: string,
  readingDate: string,
  meterReading?: number,
  image?: File,
): Promise<MeterReadingResponse> {
  const body = new FormData();
  if (meterReading !== undefined) {
    body.append('meterReading', String(meterReading));
  }
  if (image) {
    body.append('image', image);
  }

  const response = await fetch(
    `${API_BASE_URL}/api/meter-readings/${encodeURIComponent(readingDate)}`,
    {
      method: 'PUT',
      headers: authorizationHeader(token),
      body,
    },
  );
  await assertSuccessfulJsonResponse(response);
  return response.json() as Promise<MeterReadingResponse>;
}

export async function fetchMeterReadingImage(
  token: string,
  imageUrl: string,
): Promise<Blob> {
  const response = await fetch(`${API_BASE_URL}${imageUrl}`, {
    headers: authorizationHeader(token),
  });
  if (!response.ok) {
    throw new Error(`Could not load meter image. HTTP ${response.status}.`);
  }
  return response.blob();
}

export async function fetchMeterConsumptionAnalytics(
  token: string,
  from: string,
  to: string,
): Promise<MeterConsumptionAnalytics> {
  const params = new URLSearchParams({ from, to });
  const response = await fetch(
    `${API_BASE_URL}/api/meter-readings/analytics?${params}`,
    { headers: authorizationHeader(token) },
  );
  await assertSuccessfulJsonResponse(response);
  const data = (await response.json()) as {
    success: boolean;
    analytics: MeterConsumptionAnalytics;
  };
  return data.analytics;
}
