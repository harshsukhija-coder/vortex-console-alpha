// Empty = same-origin `/api` (Vite proxy in dev, Vercel rewrite in prod).
export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? '').replace(
  /\/$/,
  '',
);

function getApiErrorMessage(body: string, status: number): string {
  if (!body) return `Request failed with HTTP ${status}.`;

  try {
    const parsed: unknown = JSON.parse(body);
    if (typeof parsed === 'object' && parsed !== null) {
      const errorResponse = parsed as Record<string, unknown>;
      if (typeof errorResponse.error === 'string') return errorResponse.error;
      if (typeof errorResponse.message === 'string') return errorResponse.message;
    }
  } catch {
    return body;
  }

  return body;
}

export async function assertSuccessfulJsonResponse(
  response: Response,
): Promise<void> {
  if (!response.ok) {
    const body = (await response.text()).trim();
    throw new Error(getApiErrorMessage(body, response.status));
  }

  const contentType = response.headers.get('content-type');
  if (!contentType?.toLowerCase().includes('application/json')) {
    const body = (await response.text()).trim();
    throw new Error(
      body || `Expected a JSON response, received ${contentType || 'no content type'}.`,
    );
  }
}
