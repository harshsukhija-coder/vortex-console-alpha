import { useMemo, useState } from 'react';
import {
  formatScheduleDate,
  type UpcomingBooking,
} from '../../lib/schedule';
import { formatCountdown } from '../../lib/sessionTiming';

interface StationOption {
  id: number;
  name: string;
}

interface UpcomingScheduleListProps {
  upcoming: UpcomingBooking[];
  isLoading: boolean;
  error: string | null;
  stations: StationOption[];
  onRefresh: () => void;
  startCountdownMap: Record<number, number>;
  timezone?: string;
}

function UpcomingScheduleList({
  upcoming,
  isLoading,
  error,
  stations,
  onRefresh,
  startCountdownMap,
  timezone,
}: UpcomingScheduleListProps) {
  const [stationFilter, setStationFilter] = useState('ALL');

  const filtered = useMemo(() => {
    if (stationFilter === 'ALL') return upcoming;
    const stationId = Number(stationFilter);
    return upcoming.filter((item) => item.setupInstanceId === stationId);
  }, [upcoming, stationFilter]);

  return (
    <>
      <div className="dashboard-section-header">
        <div>
          <h2 className="section-title">Upcoming Confirmed Sessions</h2>
          <p className="section-desc" style={{ fontSize: '0.85rem' }}>
            CONFIRMED bookings with start time after now{timezone ? ` (${timezone})` : ''}. Tentative, cancelled, and past sessions are excluded.
          </p>
        </div>
      </div>

      <div className="tentative-header-controls">
        <div className="date-picker-group">
          <label htmlFor="schedule-station-filter" className="form-label" style={{ margin: 0 }}>
            Station:
          </label>
          <select
            id="schedule-station-filter"
            className="form-input"
            value={stationFilter}
            onChange={(e) => setStationFilter(e.target.value)}
            style={{ width: 'auto', minWidth: '220px', padding: '8px 12px' }}
          >
            <option value="ALL">All stations</option>
            {stations.map((station) => (
              <option key={station.id} value={station.id}>
                {station.name}
              </option>
            ))}
          </select>
        </div>

        <button className="btn-refresh" onClick={onRefresh} disabled={isLoading}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ animation: isLoading ? 'spin 1.5s infinite linear' : 'none' }}>
            <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/>
          </svg>
          {isLoading ? 'Syncing...' : 'Refresh Schedule'}
        </button>
      </div>

      {isLoading ? (
        <div className="feed-welcome-note" style={{ textAlign: 'center', padding: '48px' }}>
          Loading upcoming confirmed bookings...
        </div>
      ) : error ? (
        <div className="form-error-banner" style={{ marginBottom: '24px' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="16" x2="12" y2="12"></line>
            <line x1="12" y1="8" x2="12.01" y2="8"></line>
          </svg>
          <span>{error}</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="feed-welcome-note" style={{ textAlign: 'center', padding: '48px', borderLeftColor: 'var(--accent)' }}>
          No future confirmed bookings.
        </div>
      ) : (
        <div className="tentative-bookings-grid">
          {filtered.map((item) => {
            const secs = startCountdownMap[item.bookingId] ?? 0;
            const imminent = secs > 0 && secs <= 600;
            return (
              <div key={item.bookingId} className="tentative-booking-card">
                <div className="tentative-card-header">
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <span className="booking-id-badge" style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--accent)' }}>
                      BOOKING #{item.bookingId}
                    </span>
                    <div className="booking-phone-row" style={{ marginTop: '2px' }}>
                      <span className="booking-phone">{item.phoneNumber}</span>
                    </div>
                  </div>
                  <span className={`metric-badge ${imminent ? 'amber' : 'purple'}`} style={{ textTransform: 'uppercase', fontSize: '0.7rem' }}>
                    {imminent ? `${secs <= 300 ? '5' : '10'} min to start` : 'Scheduled'}
                  </span>
                </div>

                <div className="tentative-card-body">
                  <div className="setup-snapshot-box" style={{ padding: '10px 12px', borderRadius: '8px', background: 'var(--bg-card-hover)', border: '1px solid var(--border)' }}>
                    <div style={{ fontWeight: 700, fontSize: '0.8rem', color: 'var(--text-heading)' }}>
                      {item.setupName}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                      Station #{item.setupInstanceId} · {item.playersCount} {item.playersCount === 1 ? 'player' : 'players'}
                    </div>
                  </div>

                  <div className="booking-info-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', margin: '8px 0' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <span style={{ fontSize: '0.65rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Slot</span>
                      <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-heading)' }}>
                        {item.startTime} – {item.endTime}
                      </span>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        {formatScheduleDate(item.date)}
                      </span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <span style={{ fontSize: '0.65rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Starts in</span>
                      <span style={{ fontFamily: 'monospace', fontSize: '0.85rem', fontWeight: 800, color: imminent ? 'var(--warning)' : 'var(--text-heading)' }}>
                        {secs > 0 ? formatCountdown(secs) : 'Starting now'}
                      </span>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        Billed ₹{item.amountCharged}
                        {item.originalAmount !== item.amountCharged ? ` (₹${item.originalAmount} orig)` : ''}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

export default UpcomingScheduleList;
