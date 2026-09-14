import { useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  fetchMeterConsumptionAnalytics,
  getIstDate,
  type MeterAnalyticsProps,
  type MeterConsumptionAnalytics,
} from '../../lib/meterReadings';
import './MeterReadings.css';

function shiftDate(date: string, days: number): string {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

export default function MeterAnalytics({ token }: MeterAnalyticsProps) {
  const today = getIstDate();
  const [from, setFrom] = useState(shiftDate(today, -1));
  const [to, setTo] = useState(today);
  const [analytics, setAnalytics] = useState<MeterConsumptionAnalytics | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLoad = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!from || !to || from >= to) {
      setError('The end date must be after the start date.');
      return;
    }

    setIsLoading(true);
    try {
      setAnalytics(await fetchMeterConsumptionAnalytics(token, from, to));
    } catch (requestError) {
      setAnalytics(null);
      setError(requestError instanceof Error ? requestError.message : 'Could not load meter analytics.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <section className="meter-analytics">
      <div className="meter-analytics-header">
        <div>
          <span className="meter-eyebrow">Super Admin</span>
          <h3>Consumption Analytics</h3>
          <p>Compare two recorded boundary readings and inspect daily usage.</p>
        </div>
        <form className="meter-range-form" onSubmit={handleLoad}>
          <label>
            <span>From</span>
            <input type="date" value={from} max={today} onChange={(event) => setFrom(event.target.value)} />
          </label>
          <label>
            <span>To</span>
            <input type="date" value={to} max={today} onChange={(event) => setTo(event.target.value)} />
          </label>
          <button type="submit" disabled={isLoading}>
            {isLoading ? 'Loading...' : 'Analyze'}
          </button>
        </form>
      </div>

      <p className="meter-boundary-note">Both selected boundary dates must have readings.</p>
      {error && <div className="meter-alert error">{error}</div>}

      {analytics && (
        <>
          {analytics.summary.hasNegativeConsumption && (
            <div className="meter-alert error">
              Negative consumption detected. Check for a meter reset or an incorrect reading.
            </div>
          )}

          <div className="meter-stat-grid">
            <div><span>Total consumed</span><strong>{analytics.summary.totalUnitsConsumed.toLocaleString()} units</strong></div>
            <div><span>Daily average</span><strong>{analytics.summary.averageUnitsPerDay.toLocaleString()} units</strong></div>
            <div><span>Opening</span><strong>{analytics.summary.openingReading.toLocaleString()}</strong></div>
            <div><span>Closing</span><strong>{analytics.summary.closingReading.toLocaleString()}</strong></div>
            <div><span>Coverage</span><strong>{analytics.summary.readingsRecorded}/{analytics.summary.expectedReadings} readings</strong></div>
            <div><span>Calendar days</span><strong>{analytics.range.totalCalendarDays}</strong></div>
            <div><span>Interval min / max</span><strong>{analytics.summary.minimumIntervalConsumption.toLocaleString()} / {analytics.summary.maximumIntervalConsumption.toLocaleString()}</strong></div>
          </div>

          <div className="meter-chart-card">
            <div>
              <strong>Interval consumption</strong>
              <span>{analytics.range.from} to {analytics.range.to}</span>
            </div>
            {analytics.intervals.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={analytics.intervals} margin={{ top: 16, right: 8, left: -12, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="toDate" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
                  <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
                  <Tooltip
                    contentStyle={{
                      background: 'var(--bg-card)',
                      border: '1px solid var(--border)',
                      borderRadius: '8px',
                      color: 'var(--text-heading)',
                    }}
                    labelStyle={{ color: 'var(--text-heading)' }}
                    itemStyle={{ color: 'var(--text-heading)' }}
                  />
                  <Bar dataKey="unitsConsumed" name="Units consumed" radius={[5, 5, 0, 0]}>
                    {analytics.intervals.map((interval) => (
                      <Cell
                        key={`${interval.fromDate}-${interval.toDate}`}
                        fill={interval.hasNegativeConsumption ? 'var(--error)' : 'var(--accent)'}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="meter-empty">No consumption intervals in this range.</div>
            )}
          </div>

          {!analytics.dataQuality.isComplete && (
            <div className="meter-quality-card">
              <strong>{analytics.summary.missingReadings} missing reading(s)</strong>
              <span>{analytics.dataQuality.missingReadingDates.join(', ')}</span>
            </div>
          )}
        </>
      )}
    </section>
  );
}
