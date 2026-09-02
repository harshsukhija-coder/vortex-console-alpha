// Empty = same-origin `/api` (Vite proxy in dev, Vercel rewrite in prod).
export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? '').replace(
  /\/$/,
  '',
);
