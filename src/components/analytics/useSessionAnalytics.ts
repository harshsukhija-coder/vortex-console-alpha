import { useCallback, useEffect, useState } from 'react';
import { API_BASE_URL, assertSuccessfulJsonResponse } from '../../lib/api';
import type {
  AnalyticsRangeMode,
  SessionAnalytics,
  SessionAnalyticsResponse,
} from './types';

interface UseSessionAnalyticsOptions {
  token: string;
  rangeMode: AnalyticsRangeMode;
  month: string;
}

export function useSessionAnalytics({
  token,
  rangeMode,
  month,
}: UseSessionAnalyticsOptions) {
  const [analytics, setAnalytics] = useState<SessionAnalytics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = useCallback(() => {
    setRefreshKey((current) => current + 1);
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    const loadAnalytics = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const query = rangeMode === 'MONTH' ? `?month=${encodeURIComponent(month)}` : '';
        const response = await fetch(`${API_BASE_URL}/api/analytics/sessions${query}`, {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        });
        await assertSuccessfulJsonResponse(response);
        const data = (await response.json()) as SessionAnalyticsResponse;
        if (!data.success || !data.analytics) {
          throw new Error(data.error || data.message || 'Analytics data is unavailable.');
        }
        setAnalytics(data.analytics);
      } catch (loadError) {
        if (controller.signal.aborted) return;
        setError(loadError instanceof Error ? loadError.message : 'Failed to load analytics.');
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    };

    loadAnalytics();
    return () => controller.abort();
  }, [month, rangeMode, refreshKey, token]);

  return { analytics, isLoading, error, refresh };
}
