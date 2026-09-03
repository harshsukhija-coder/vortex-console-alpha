import { formatCountdown } from '../../lib/sessionTiming';

interface OccupancySessionTimerProps {
  isPendingStart: boolean;
  secsLeft: number;
  totalSecs: number;
  status: string;
  startLabel: string;
  endLabel: string;
}

function OccupancySessionTimer({
  isPendingStart,
  secsLeft,
  totalSecs,
  status,
  startLabel,
  endLabel,
}: OccupancySessionTimerProps) {
  const isExpired = !isPendingStart && secsLeft <= 0;
  const is1Min = !isPendingStart && secsLeft > 0 && secsLeft <= 60;
  const is3Min = !isPendingStart && secsLeft > 60 && secsLeft <= 180;
  const is5Min = !isPendingStart && secsLeft > 180 && secsLeft <= 300;
  const is10Min = !isPendingStart && secsLeft > 300 && secsLeft <= 600;
  const isStart10 = isPendingStart && secsLeft > 0 && secsLeft <= 600;
  const isStart5 = isPendingStart && secsLeft > 0 && secsLeft <= 300;

  const barColor = isPendingStart
    ? isStart5
      ? '#f97316'
      : isStart10
        ? 'var(--warning)'
        : 'var(--accent)'
    : isExpired || is1Min
      ? 'var(--error)'
      : is3Min
        ? '#f97316'
        : is5Min || is10Min
          ? 'var(--warning)'
          : status === 'TENTATIVE'
            ? 'var(--warning)'
            : 'var(--accent)';

  const label = isPendingStart
    ? isExpired
      ? 'STARTING NOW'
      : isStart5
        ? '5 MINS TO START'
        : isStart10
          ? '10 MINS TO START'
          : 'NEXT SESSION STARTS'
    : isExpired
      ? 'SESSION EXPIRED'
      : is1Min
        ? '1 MIN LEFT'
        : is3Min
          ? '3 MINS LEFT'
          : is5Min
            ? '5 MINS LEFT'
            : is10Min
              ? '10 MINS LEFT'
              : 'TIME REMAINING';

  const displayStr = isPendingStart
    ? secsLeft <= 0
      ? 'Starting now'
      : formatCountdown(secsLeft)
    : isExpired
      ? '00m 00s (TIME UP)'
      : formatCountdown(secsLeft);

  const pct = isPendingStart || isExpired
    ? 0
    : Math.max(0, Math.min(100, (secsLeft / Math.max(totalSecs, 1)) * 100));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={barColor} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <polyline points="12 6 12 12 16 14"></polyline>
          </svg>
          <span style={{ fontSize: '0.72rem', fontWeight: 600, color: isExpired ? 'var(--error)' : 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {label}
          </span>
        </div>
        <span style={{ fontFamily: 'monospace', fontSize: '0.85rem', fontWeight: 800, color: barColor, letterSpacing: '0.05em' }}>
          {displayStr}
        </span>
      </div>
      {isPendingStart ? (
        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>
          Starts {startLabel} · Ends {endLabel}
        </div>
      ) : (
        <div style={{ height: '4px', borderRadius: '4px', background: 'var(--border)', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${pct}%`, borderRadius: '4px', background: barColor, transition: 'width 1s linear' }} />
        </div>
      )}
    </div>
  );
}

export default OccupancySessionTimer;
