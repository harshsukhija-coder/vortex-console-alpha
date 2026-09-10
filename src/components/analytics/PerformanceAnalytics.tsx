import { useState } from 'react';
import AnalyticsCharts from './AnalyticsCharts';
import AnalyticsOverview from './AnalyticsOverview';
import AnalyticsRankings from './AnalyticsRankings';
import { formatDateTime } from './formatters';
import type { AnalyticsRangeMode } from './types';
import { useSessionAnalytics } from './useSessionAnalytics';
import './PerformanceAnalytics.css';

interface PerformanceAnalyticsProps {
  token: string;
}

const currentMonth = new Date().toISOString().slice(0, 7);

export default function PerformanceAnalytics({ token }: PerformanceAnalyticsProps) {
  const [rangeMode, setRangeMode] = useState<AnalyticsRangeMode>('LAST_15_DAYS');
  const [month, setMonth] = useState(currentMonth);
  const { analytics, isLoading, error, refresh } = useSessionAnalytics({
    token,
    rangeMode,
    month,
  });

  return (
    <section className="analytics-dashboard">
      <div className="analytics-hero">
        <div>
          <span className="analytics-eyebrow">Business intelligence</span>
          <h2>Performance &amp; Stats</h2>
          <p>Sessions, revenue, audience behavior, station utilization, and game engagement.</p>
        </div>
        <div className="analytics-controls">
          <div className="analytics-range-toggle">
            <button className={rangeMode === 'LAST_15_DAYS' ? 'active' : ''} onClick={() => setRangeMode('LAST_15_DAYS')}>Last 15 days</button>
            <button className={rangeMode === 'MONTH' ? 'active' : ''} onClick={() => setRangeMode('MONTH')}>Month</button>
          </div>
          {rangeMode === 'MONTH' && (
            <label className="analytics-month-field">
              <span>Reporting month</span>
              <input aria-label="Analytics month" type="month" value={month} max={currentMonth} onChange={(event) => setMonth(event.target.value)} />
            </label>
          )}
          <button className="analytics-refresh" onClick={refresh} disabled={isLoading}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M20 7v5h-5M4 17v-5h5"/><path d="M6.1 9a7 7 0 0 1 11.7-2L20 9M4 15l2.2 2a7 7 0 0 0 11.7-2"/></svg>
            {isLoading ? 'Refreshing' : 'Refresh'}
          </button>
        </div>
      </div>

      {error && (
        <div className="analytics-error" role="alert">
          <strong>Analytics unavailable</strong>
          <span>{error}</span>
          <button onClick={refresh}>Try again</button>
        </div>
      )}

      {isLoading && !analytics && (
        <div className="analytics-loading">
          {Array.from({ length: 10 }, (_, index) => <span key={index} />)}
        </div>
      )}

      {analytics && (
        <>
          <div className="analytics-range-meta">
            <span>{analytics.range.type === 'MONTH' ? `Month · ${analytics.range.label}` : 'Rolling 15-day view'}</span>
            <span>{analytics.range.timezone} · Updated {formatDateTime(analytics.generatedAt)}</span>
          </div>
          <AnalyticsOverview overview={analytics.overview} />
          <AnalyticsCharts
            dailyTrend={analytics.dailyTrend}
            configurationBreakdown={analytics.configurationBreakdown}
            ageGroups={analytics.ageGroups}
            peakStartHours={analytics.peakStartHours}
          />
          <AnalyticsRankings
            consoleInstances={analytics.consoleInstances}
            games={analytics.games}
            topPlayers={analytics.topPlayers}
          />
          <details className="analytics-quality">
            <summary>Data quality &amp; calculation notes</summary>
            <div>
              <p>{analytics.dataQuality.ageGroupMethod}</p>
              <p>{analytics.dataQuality.revenueMethod}</p>
              <p>{analytics.dataQuality.durationMethod}</p>
            </div>
          </details>
        </>
      )}
    </section>
  );
}
