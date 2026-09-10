import { formatCompactNumber, formatCurrency } from './formatters';
import type { AnalyticsOverview as AnalyticsOverviewData } from './types';

interface AnalyticsOverviewProps {
  overview: AnalyticsOverviewData;
}

const cards = [
  { key: 'totalRevenue', label: 'Session revenue', tone: 'violet' },
  { key: 'totalSessions', label: 'Total sessions', tone: 'blue' },
  { key: 'totalPlayerVisits', label: 'Player visits', tone: 'cyan' },
  { key: 'totalOperatingHours', label: 'Operating hours', tone: 'amber' },
  { key: 'completionRatePercent', label: 'Completion rate', tone: 'green' },
  { key: 'averageRevenuePerSession', label: 'Average per session', tone: 'pink' },
] as const;

function formatValue(
  key: (typeof cards)[number]['key'],
  overview: AnalyticsOverviewData,
): string {
  const value = overview[key];
  if (key === 'totalRevenue' || key === 'averageRevenuePerSession') {
    return formatCurrency(value);
  }
  if (key === 'completionRatePercent') return `${value.toFixed(1)}%`;
  if (key === 'totalOperatingHours') return `${value.toFixed(1)}h`;
  return formatCompactNumber(value);
}

export default function AnalyticsOverview({ overview }: AnalyticsOverviewProps) {
  return (
    <>
      <div className="analytics-kpi-grid">
        {cards.map((card) => (
          <article className={`analytics-kpi-card ${card.tone}`} key={card.key}>
            <span className="analytics-kpi-label">{card.label}</span>
            <strong>{formatValue(card.key, overview)}</strong>
            <span className="analytics-kpi-meta">
              {card.key === 'totalSessions' && `${overview.completedSessions} completed`}
              {card.key === 'totalPlayerVisits' && `${overview.uniqueBookingCustomers} unique customers`}
              {card.key === 'totalOperatingHours' && `${overview.averageSessionHours.toFixed(2)}h average`}
              {card.key === 'completionRatePercent' && `${overview.confirmedSessions} currently confirmed`}
              {card.key === 'totalRevenue' && `${formatCurrency(overview.totalCollected)} collected`}
              {card.key === 'averageRevenuePerSession' && `${overview.averagePlayersPerSession.toFixed(1)} players/session`}
            </span>
          </article>
        ))}
      </div>

      <div className="analytics-money-strip">
        <div><span>Cash collected</span><strong>{formatCurrency(overview.cashCollected)}</strong></div>
        <div><span>UPI collected</span><strong>{formatCurrency(overview.upiCollected)}</strong></div>
        <div><span>Refund due</span><strong className="negative">{formatCurrency(overview.refundDue)}</strong></div>
        <div><span>Payment due</span><strong className="warning">{formatCurrency(overview.paymentDue)}</strong></div>
      </div>
    </>
  );
}
