import { useEffect, useMemo, useState } from 'react';
import {
  cancelUpcomingBooking,
  formatScheduleDate,
  formatScheduleTime,
  inferHoursFromSlot,
  parseScheduleTime,
  ScheduleApiError,
  updateUpcomingBooking,
  type UpcomingBooking,
  type UpcomingBookingUpdate,
} from '../../lib/schedule';
import { formatCountdown } from '../../lib/sessionTiming';
import './UpcomingScheduleList.css';

interface StationOption {
  id: number;
  name: string;
}

interface UpcomingScheduleListProps {
  upcoming: UpcomingBooking[];
  isLoading: boolean;
  error: string | null;
  stations: StationOption[];
  token: string;
  onRefresh: () => void;
  onChanged: () => void;
  onUnauthorized: () => void;
  startCountdownMap: Record<number, number>;
  timezone?: string;
}

interface EditFormState {
  date: string;
  hour: string;
  minute: string;
  period: 'AM' | 'PM';
  noOfHours: number;
  playersCount: number;
  phoneNumber: string;
  setupInstanceId: number;
}

const HOUR_OPTIONS = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];
const MINUTE_OPTIONS = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'));
const DURATION_OPTIONS = [
  { value: 0.25, label: '15 minutes' },
  { value: 0.5, label: '30 minutes' },
  { value: 1, label: '1 hour' },
  { value: 1.5, label: '1.5 hours' },
  { value: 2, label: '2 hours' },
  { value: 3, label: '3 hours' },
  { value: 4, label: '4 hours' },
];

function buildEditForm(item: UpcomingBooking): EditFormState {
  const time = parseScheduleTime(item.startTime);
  return {
    date: item.date,
    hour: time.hour,
    minute: time.minute,
    period: time.period,
    noOfHours: item.noOfHours ?? inferHoursFromSlot(item.startTime, item.endTime),
    playersCount: item.playersCount,
    phoneNumber: item.phoneNumber,
    setupInstanceId: item.setupInstanceId,
  };
}

function buildPatch(item: UpcomingBooking, form: EditFormState): UpcomingBookingUpdate {
  const startTime = formatScheduleTime(form.hour, form.minute, form.period);
  const patch: UpcomingBookingUpdate = {};

  if (form.date !== item.date) patch.date = form.date;
  if (startTime !== item.startTime) patch.startTime = startTime;
  const currentHours = item.noOfHours ?? inferHoursFromSlot(item.startTime, item.endTime);
  if (form.noOfHours !== currentHours) patch.noOfHours = form.noOfHours;
  if (form.playersCount !== item.playersCount) patch.playersCount = form.playersCount;
  if (form.phoneNumber.trim() !== item.phoneNumber) patch.phoneNumber = form.phoneNumber.trim();
  if (form.setupInstanceId !== item.setupInstanceId) patch.setupInstanceId = form.setupInstanceId;

  return patch;
}

function displayStation(item: UpcomingBooking): string {
  return item.instanceName || item.setupName;
}

export default function UpcomingScheduleList({
  upcoming,
  isLoading,
  error,
  stations,
  token,
  onRefresh,
  onChanged,
  onUnauthorized,
  startCountdownMap,
  timezone,
}: UpcomingScheduleListProps) {
  const [stationFilter, setStationFilter] = useState('ALL');
  const [editing, setEditing] = useState<UpcomingBooking | null>(null);
  const [editForm, setEditForm] = useState<EditFormState | null>(null);
  const [cancelTarget, setCancelTarget] = useState<UpcomingBooking | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (stationFilter === 'ALL') return upcoming;
    const stationId = Number(stationFilter);
    return upcoming.filter((item) => item.setupInstanceId === stationId);
  }, [upcoming, stationFilter]);

  useEffect(() => {
    if (!editing && !cancelTarget) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || isSaving || isCancelling) return;
      setEditing(null);
      setEditForm(null);
      setCancelTarget(null);
      setFormError(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [editing, cancelTarget, isSaving, isCancelling]);

  const openEdit = (item: UpcomingBooking) => {
    setCancelTarget(null);
    setFormError(null);
    setActionMessage(null);
    setEditing(item);
    setEditForm(buildEditForm(item));
  };

  const closeEdit = () => {
    if (isSaving) return;
    setEditing(null);
    setEditForm(null);
    setFormError(null);
  };

  const handleSave = async () => {
    if (!editing || !editForm) return;

    const phone = editForm.phoneNumber.trim();
    if (phone.replace(/\D/g, '').length < 10) {
      setFormError('Enter a valid 10-digit phone number.');
      return;
    }
    if (!editForm.date) {
      setFormError('Date is required.');
      return;
    }

    const patch = buildPatch(editing, editForm);
    if (Object.keys(patch).length === 0) {
      setFormError('Change at least one field before saving.');
      return;
    }

    setIsSaving(true);
    setFormError(null);
    try {
      const result = await updateUpcomingBooking(token, editing.bookingId, patch);
      setActionMessage(result.message || `Booking #${editing.bookingId} updated.`);
      closeEdit();
      onChanged();
    } catch (requestError) {
      if (requestError instanceof ScheduleApiError && requestError.status === 401) {
        onUnauthorized();
        return;
      }
      setFormError(
        requestError instanceof Error ? requestError.message : 'Could not update this booking.',
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelConfirm = async () => {
    if (!cancelTarget) return;
    setIsCancelling(true);
    setFormError(null);
    try {
      const result = await cancelUpcomingBooking(token, cancelTarget.bookingId);
      setActionMessage(result.message || `Booking #${cancelTarget.bookingId} cancelled.`);
      setCancelTarget(null);
      onChanged();
    } catch (requestError) {
      if (requestError instanceof ScheduleApiError && requestError.status === 401) {
        onUnauthorized();
        return;
      }
      setFormError(
        requestError instanceof Error ? requestError.message : 'Could not cancel this booking.',
      );
    } finally {
      setIsCancelling(false);
    }
  };

  return (
    <>
      <div className="dashboard-section-header">
        <div>
          <h2 className="section-title">Upcoming Confirmed Sessions</h2>
          <p className="section-desc" style={{ fontSize: '0.85rem' }}>
            CONFIRMED bookings with start time after now{timezone ? ` (${timezone})` : ''}. Edit slot details or cancel future sessions here.
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
            <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38"/>
          </svg>
          {isLoading ? 'Syncing...' : 'Refresh Schedule'}
        </button>
      </div>

      {actionMessage && (
        <div className="schedule-success-banner" role="status">
          <span>{actionMessage}</span>
          <button type="button" onClick={() => setActionMessage(null)}>
            Dismiss
          </button>
        </div>
      )}

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
            const hours = item.noOfHours ?? inferHoursFromSlot(item.startTime, item.endTime);
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
                  <span style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--success)', background: 'var(--success-light)', padding: '3px 8px', borderRadius: '999px' }}>
                    {item.status}
                  </span>
                </div>

                <div className="tentative-card-body">
                  <div className="setup-snapshot-box" style={{ padding: '10px 12px', borderRadius: '8px', background: 'var(--bg-card-hover)', border: '1px solid var(--border)' }}>
                    <div style={{ fontWeight: 700, fontSize: '0.8rem', color: 'var(--text-heading)' }}>
                      {displayStation(item)}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                      {item.setupName !== displayStation(item) ? `${item.setupName} · ` : ''}
                      Station #{item.setupInstanceId} · {item.playersCount} {item.playersCount === 1 ? 'player' : 'players'} · {hours} hr
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

                  <div className="schedule-card-actions">
                    <button type="button" className="btn-card-action" onClick={() => openEdit(item)}>
                      Edit
                    </button>
                    <button
                      type="button"
                      className="btn-card-action danger"
                      onClick={() => {
                        setEditing(null);
                        setEditForm(null);
                        setFormError(null);
                        setActionMessage(null);
                        setCancelTarget(item);
                      }}
                    >
                      Cancel booking
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {editing && editForm && (
        <div className="modal-overlay" onClick={closeEdit}>
          <div className="modal-card" style={{ maxWidth: '520px' }} onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3 className="modal-title">Edit booking #{editing.bookingId}</h3>
                <p style={{ margin: '4px 0 0', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  Slot conflicts are checked and the price is recalculated when time, players, or station change.
                </p>
              </div>
              <button type="button" className="modal-close-btn" onClick={closeEdit} disabled={isSaving} aria-label="Close">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {formError && (
                <div className="form-error-banner" role="alert">
                  <span>{formError}</span>
                </div>
              )}

              <div className="schedule-edit-grid">
                <div className="form-group">
                  <label className="form-label" htmlFor="schedule-edit-date">Date</label>
                  <input
                    id="schedule-edit-date"
                    type="date"
                    className="form-input"
                    value={editForm.date}
                    onChange={(event) => setEditForm({ ...editForm, date: event.target.value })}
                    disabled={isSaving}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="schedule-edit-players">Players</label>
                  <select
                    id="schedule-edit-players"
                    className="form-input"
                    value={editForm.playersCount}
                    onChange={(event) => setEditForm({ ...editForm, playersCount: Number(event.target.value) })}
                    disabled={isSaving}
                  >
                    {[1, 2, 3, 4].map((count) => (
                      <option key={count} value={count}>
                        {count} {count === 1 ? 'player' : 'players'}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group full">
                  <label className="form-label">Start time</label>
                  <div className="schedule-time-row">
                    <select
                      className="form-input"
                      value={editForm.hour}
                      onChange={(event) => setEditForm({ ...editForm, hour: event.target.value })}
                      disabled={isSaving}
                      aria-label="Hour"
                    >
                      {HOUR_OPTIONS.map((hour) => (
                        <option key={hour} value={hour}>{hour}</option>
                      ))}
                    </select>
                    <select
                      className="form-input"
                      value={editForm.minute}
                      onChange={(event) => setEditForm({ ...editForm, minute: event.target.value })}
                      disabled={isSaving}
                      aria-label="Minute"
                    >
                      {MINUTE_OPTIONS.map((minute) => (
                        <option key={minute} value={minute}>{minute}</option>
                      ))}
                    </select>
                    <select
                      className="form-input"
                      value={editForm.period}
                      onChange={(event) => setEditForm({ ...editForm, period: event.target.value as 'AM' | 'PM' })}
                      disabled={isSaving}
                      aria-label="AM/PM"
                    >
                      <option value="AM">AM</option>
                      <option value="PM">PM</option>
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="schedule-edit-hours">Duration</label>
                  <select
                    id="schedule-edit-hours"
                    className="form-input"
                    value={editForm.noOfHours}
                    onChange={(event) => setEditForm({ ...editForm, noOfHours: Number(event.target.value) })}
                    disabled={isSaving}
                  >
                    {DURATION_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                    {!DURATION_OPTIONS.some((option) => option.value === editForm.noOfHours) && (
                      <option value={editForm.noOfHours}>{editForm.noOfHours} hours</option>
                    )}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="schedule-edit-station">Station</label>
                  <select
                    id="schedule-edit-station"
                    className="form-input"
                    value={editForm.setupInstanceId}
                    onChange={(event) => setEditForm({ ...editForm, setupInstanceId: Number(event.target.value) })}
                    disabled={isSaving}
                  >
                    {!stations.some((station) => station.id === editForm.setupInstanceId) && (
                      <option value={editForm.setupInstanceId}>
                        Current station #{editForm.setupInstanceId}
                      </option>
                    )}
                    {stations.map((station) => (
                      <option key={station.id} value={station.id}>{station.name}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group full">
                  <label className="form-label" htmlFor="schedule-edit-phone">Phone number</label>
                  <input
                    id="schedule-edit-phone"
                    type="tel"
                    className="form-input"
                    value={editForm.phoneNumber}
                    onChange={(event) => setEditForm({ ...editForm, phoneNumber: event.target.value })}
                    disabled={isSaving}
                  />
                </div>
              </div>

              <p className="schedule-price-note">
                Currently billed ₹{editing.amountCharged}
                {editing.originalAmount !== editing.amountCharged ? ` (₹${editing.originalAmount} original)` : ''}.
                Changing time, players, or station recalculates setup rate + game premiums.
              </p>
            </div>

            <div className="modal-footer">
              <button type="button" className="btn-card-action" onClick={closeEdit} disabled={isSaving}>
                Keep as is
              </button>
              <button type="button" className="btn-card-action primary" onClick={() => void handleSave()} disabled={isSaving}>
                {isSaving ? 'Saving...' : 'Save changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {cancelTarget && (
        <div className="modal-overlay" onClick={() => !isCancelling && setCancelTarget(null)}>
          <div className="modal-card" style={{ maxWidth: '420px' }} onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Cancel booking #{cancelTarget.bookingId}?</h3>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setCancelTarget(null)}
                disabled={isCancelling}
                aria-label="Close"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <div className="modal-body">
              {formError && (
                <div className="form-error-banner" role="alert" style={{ marginBottom: '12px' }}>
                  <span>{formError}</span>
                </div>
              )}
              <div className="schedule-dialog-icon" aria-hidden="true">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
              </div>
              <p style={{ margin: 0, textAlign: 'center', color: 'var(--text)', fontSize: '0.85rem', lineHeight: 1.55 }}>
                This marks the session for <strong>{cancelTarget.phoneNumber}</strong> on{' '}
                <strong>{formatScheduleDate(cancelTarget.date)}</strong> at <strong>{cancelTarget.startTime}</strong> as cancelled.
                It will leave the upcoming schedule.
              </p>
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="btn-card-action"
                onClick={() => setCancelTarget(null)}
                disabled={isCancelling}
              >
                Keep booking
              </button>
              <button
                type="button"
                className="btn-card-action danger"
                onClick={() => void handleCancelConfirm()}
                disabled={isCancelling}
              >
                {isCancelling ? 'Cancelling...' : 'Cancel booking'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
