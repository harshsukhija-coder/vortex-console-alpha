export function getTokenExpiryMs(token: string): number | null {
  try {
    const payload = token.split('.')[1];
    if (!payload) return null;
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const parsed = JSON.parse(atob(normalized)) as { exp?: number };
    if (typeof parsed.exp !== 'number') return null;
    return parsed.exp * 1000;
  } catch {
    return null;
  }
}

export function isAuthTokenExpired(token: string, skewMs = 5000): boolean {
  const expiryMs = getTokenExpiryMs(token);
  if (expiryMs === null) return false;
  return Date.now() >= expiryMs - skewMs;
}

export function isUnauthorizedResponse(
  response?: { status?: number } | null,
  body?: { error?: string; message?: string } | null,
): boolean {
  if (response?.status === 401) return true;
  const text = `${body?.error || ''} ${body?.message || ''}`.toLowerCase();
  return (
    text.includes('unauthorized') ||
    text.includes('unauthenticated') ||
    text.includes('token expired') ||
    text.includes('jwt expired') ||
    text.includes('invalid token') ||
    text.includes('session expired')
  );
}
