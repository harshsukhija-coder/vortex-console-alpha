export function secondsUntilIso(iso: string, nowMs = Date.now()): number {
  const ms = new Date(iso).getTime();
  if (Number.isNaN(ms) || ms <= nowMs) return 0;
  return Math.floor((ms - nowMs) / 1000);
}

export function formatCountdown(totalSeconds: number): string {
  const secs = Math.max(0, Math.floor(totalSeconds));
  const days = Math.floor(secs / 86400);
  const hrs = Math.floor((secs % 86400) / 3600);
  const mins = Math.floor((secs % 3600) / 60);
  const rem = secs % 60;
  if (days > 0) return `${days}d ${hrs}h ${mins}m`;
  if (hrs > 0) return `${hrs}h ${mins}m ${String(rem).padStart(2, '0')}s`;
  return `${mins}m ${String(rem).padStart(2, '0')}s`;
}
