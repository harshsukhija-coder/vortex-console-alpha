import { useState } from 'react';
import AnalyticsCharts from './AnalyticsCharts';
import AnalyticsOverview from './AnalyticsOverview';
import AnalyticsRankings from './AnalyticsRankings';
import { exportAnalytics, type AnalyticsExportFormat } from './analyticsExport';
import { formatAnalyticsRange, formatDateTime } from './formatters';
import type { AnalyticsRangeMode } from './types';
import { useSessionAnalytics } from './useSessionAnalytics';
import './PerformanceAnalytics.css';

interface PerformanceAnalyticsProps {
  token: string;
}

const currentMonth = new Date().toISOString().slice(0, 7);
const currentDate = new Date().toISOString().slice(0, 10);

export default function PerformanceAnalytics({ token }: PerformanceAnalyticsProps) {
  const [rangeMode, setRangeMode] = useState<AnalyticsRangeMode>('LAST_15_DAYS');
  const [date, setDate] = useState(currentDate);
  const [month, setMonth] = useState(currentMonth);
  const [exportingFormat, setExportingFormat] = useState<AnalyticsExportFormat | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const { analytics, isLoading, error, refresh } = useSessionAnalytics({
    token,
    rangeMode,
    date,
    month,
  });

  const handleExport = async (format: AnalyticsExportFormat) => {
    if (!analytics) return;
    setExportError(null);
    setExportingFormat(format);
    try {
      await exportAnalytics(analytics, format);
    } catch (error) {
      setExportError(error instanceof Error ? error.message : 'Could not export analytics.');
    } finally {
      setExportingFormat(null);
    }
  };

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
            <button className={rangeMode === 'DATE' ? 'active' : ''} onClick={() => setRangeMode('DATE')}>Date</button>
            <button className={rangeMode === 'MONTH' ? 'active' : ''} onClick={() => setRangeMode('MONTH')}>Month</button>
          </div>
          {rangeMode === 'DATE' && (
            <label className="analytics-period-field">
              <span>Reporting date</span>
              <input aria-label="Analytics date" type="date" value={date} max={currentDate} onChange={(event) => setDate(event.target.value)} />
            </label>
          )}
          {rangeMode === 'MONTH' && (
            <label className="analytics-period-field">
              <span>Reporting month</span>
              <input aria-label="Analytics month" type="month" value={month} max={currentMonth} onChange={(event) => setMonth(event.target.value)} />
            </label>
          )}
          <button className="analytics-refresh" onClick={refresh} disabled={isLoading}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M20 7v5h-5M4 17v-5h5"/><path d="M6.1 9a7 7 0 0 1 11.7-2L20 9M4 15l2.2 2a7 7 0 0 0 11.7-2"/></svg>
            {isLoading ? 'Refreshing' : 'Refresh'}
          </button>
          <details className="analytics-export-menu">
            <summary>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 3v12M7 10l5 5 5-5M5 21h14"/>
              </svg>
              {exportingFormat ? 'Exporting...' : 'Export all'}
            </summary>
            <div>
              <button onClick={() => handleExport('xlsx')} disabled={!analytics || exportingFormat !== null}>
                <strong>Excel workbook</strong><span>All datasets in separate sheets</span>
              </button>
              <button onClick={() => handleExport('csv')} disabled={!analytics || exportingFormat !== null}>
                <strong>CSV bundle</strong><span>ZIP with every dataset and raw JSON</span>
              </button>
              <button onClick={() => handleExport('json')} disabled={!analytics || exportingFormat !== null}>
                <strong>JSON</strong><span>Complete original analytics response</span>
              </button>
            </div>
          </details>
        </div>
      </div>

      {exportError && <div className="analytics-export-error" role="alert">{exportError}</div>}

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
            <span>
              {analytics.range.type === 'MONTH'
                ? `Month · ${analytics.range.label}`
                : analytics.range.type === 'DATE'
                  ? `Date · ${analytics.range.label}`
                  : 'Rolling 15-day view'}
            </span>
            <span>{analytics.range.timezone} · Updated {formatDateTime(analytics.generatedAt)}</span>
          </div>
          <AnalyticsOverview overview={analytics.overview} />
          <AnalyticsCharts
            dateRange={formatAnalyticsRange(analytics.range.start, analytics.range.endExclusive)}
            playerCountBreakdown={analytics.playerCountBreakdown}
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
