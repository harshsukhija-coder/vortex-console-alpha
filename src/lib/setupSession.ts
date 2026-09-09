import { API_BASE_URL, assertSuccessfulJsonResponse } from './api';

export interface PreviousSession {
  bookingId: number;
  status: string;
  phoneNumber: string;
  playersCount: number;
  actualStartTime?: string | null;
  actualEndTime: string | null;
  originalAmount?: number;
  amountCharged?: number;
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
  previousSession?: PreviousSession;
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
}

export interface TerminateSetupSessionResponse {
  success: boolean;
  message?: string;
  error?: string;
  sessionSummary?: TerminatedSessionSummary;
}

export interface TerminateSetupSessionPayload {
  actualStartTime: string;
  actualEndTime: string;
  finalAmountCharged: number;
  cashAmount: number;
  upiAmount: number;
}

function getAuthorizationHeaders(token: string): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
  };
}

export async function fetchSetupSessionStatus(
  setupInstanceId: number,
  token: string,
): Promise<SetupSessionStatus> {
  const response = await fetch(
    `${API_BASE_URL}/api/setup-instances/${setupInstanceId}/terminate-session`,
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
  if (!previousSession?.actualStartTime) {
    throw new Error('The previous session is missing its actual start time.');
  }

  const finalAmountCharged = Number(
    previousSession.amountCharged ?? previousSession.originalAmount ?? 0,
  );

  return {
    actualStartTime: previousSession.actualStartTime,
    actualEndTime: previousSession.actualEndTime ?? new Date().toISOString(),
    finalAmountCharged,
    cashAmount: finalAmountCharged,
    upiAmount: 0,
  };
}
