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
  date: string;
  month: string;
}

export function useSessionAnalytics({
  token,
  rangeMode,
  date,
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
        const query = rangeMode === 'MONTH'
          ? `?month=${encodeURIComponent(month)}`
          : rangeMode === 'DATE'
            ? `?date=${encodeURIComponent(date)}`
            : '';
        const response = await fetch(`${API_BASE_URL}/api/analytics/sessions${query}`, {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        });
        await assertSuccessfulJsonResponse(response);
        const data = (await response.json()) as SessionAnalyticsResponse;
        if (!data.success || !data.analytics) {
          throw new Error(data.error || data.message || 'Analytics data is unavailable.');
        }
        const result = data.analytics;
        setAnalytics({
          ...result,
          generatedAt: result.generatedAt ?? new Date().toISOString(),
          overview: {
            totalSessions: 0,
            completedSessions: 0,
            confirmedSessions: 0,
            totalPlayerVisits: 0,
            uniqueBookingCustomers: 0,
            totalOperatingHours: 0,
            averageSessionHours: 0,
            averagePlayersPerSession: 0,
            totalRevenue: 0,
            cashCollected: 0,
            upiCollected: 0,
            totalCollected: 0,
            refundDue: 0,
            paymentDue: 0,
            averageRevenuePerSession: 0,
            completionRatePercent: 0,
            ...result.overview,
          },
          ageGroups: result.ageGroups ?? [],
          consoleInstances: result.consoleInstances ?? [],
          games: result.games ?? [],
          topPlayers: result.topPlayers ?? [],
          dailyTrend: result.dailyTrend ?? [],
          peakStartHours: result.peakStartHours ?? [],
          configurationBreakdown: result.configurationBreakdown ?? [],
          dataQuality: {
            totalPlayerVisits: result.overview?.totalPlayerVisits ?? 0,
            identifiedPrimaryPlayerVisits: 0,
            ageKnownPrimaryPlayerVisits: 0,
            unattributedAdditionalPlayerVisits: 0,
            ageGroupMethod: 'No age-group methodology was returned for this range.',
            revenueMethod: 'No revenue methodology was returned for this range.',
            durationMethod: 'No duration methodology was returned for this range.',
            ...result.dataQuality,
          },
        });
      } catch (loadError) {
        if (controller.signal.aborted) return;
        setError(loadError instanceof Error ? loadError.message : 'Failed to load analytics.');
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    };

    loadAnalytics();
    return () => controller.abort();
  }, [date, month, rangeMode, refreshKey, token]);

  return { analytics, isLoading, error, refresh };
}
