// Empty = same-origin `/api` (Vite proxy in dev, Vercel rewrite in prod).
export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? '').replace(
  /\/$/,
  '',
);

export async function assertSuccessfulJsonResponse(
  response: Response,
): Promise<void> {
  if (!response.ok) {
    const message = (await response.text()).trim();
    throw new Error(message || `Request failed with HTTP ${response.status}.`);
  }

  const contentType = response.headers.get('content-type');
  if (!contentType?.toLowerCase().includes('application/json')) {
    const body = (await response.text()).trim();
    throw new Error(
      body || `Expected a JSON response, received ${contentType || 'no content type'}.`,
    );
  }
}
