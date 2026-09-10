import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatAgeGroup, formatAnalyticsDate, formatCurrency } from './formatters';
import type {
  AgeGroupStat,
  ConfigurationStat,
  DailyTrendStat,
  PeakStartHourStat,
} from './types';

interface AnalyticsChartsProps {
  dailyTrend: DailyTrendStat[];
  configurationBreakdown: ConfigurationStat[];
  ageGroups: AgeGroupStat[];
  peakStartHours: PeakStartHourStat[];
}

const tooltipStyle = {
  background: 'var(--bg-card)',
  border: '1px solid var(--border)',
  borderRadius: '10px',
  boxShadow: 'var(--shadow-lg)',
};

export default function AnalyticsCharts({
  dailyTrend,
  configurationBreakdown,
  ageGroups,
  peakStartHours,
}: AnalyticsChartsProps) {
  const visibleAgeGroups = ageGroups.filter((group) => group.playerVisits > 0);

  return (
    <div className="analytics-chart-grid">
      <article className="analytics-panel analytics-chart-wide">
        <header>
          <div><span className="analytics-eyebrow">Revenue velocity</span><h3>Daily performance</h3></div>
          <span className="analytics-legend-dot violet">Revenue</span>
        </header>
        <div className="analytics-chart">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={dailyTrend}>
              <defs>
                <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.5} />
                  <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="date" tickFormatter={formatAnalyticsDate} tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={(value: number) => `₹${value}`} tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} width={54} />
              <Tooltip contentStyle={tooltipStyle} labelFormatter={(label) => formatAnalyticsDate(String(label))} formatter={(value) => [formatCurrency(Number(value)), 'Revenue']} />
              <Area type="monotone" dataKey="revenue" stroke="#8b5cf6" strokeWidth={3} fill="url(#revenueGradient)" activeDot={{ r: 5 }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </article>

      <article className="analytics-panel">
        <header><div><span className="analytics-eyebrow">Audience</span><h3>Player age mix</h3></div></header>
        <div className="analytics-chart">
          {visibleAgeGroups.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={visibleAgeGroups} layout="vertical" margin={{ left: 14, right: 18 }}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" allowDecimals={false} tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="ageGroup" width={74} tickFormatter={formatAgeGroup} tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={tooltipStyle} labelFormatter={(label) => formatAgeGroup(String(label))} formatter={(value) => [Number(value), 'Player visits']} />
                <Bar dataKey="playerVisits" fill="#8b5cf6" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <div className="analytics-empty">No age data for this range</div>}
        </div>
      </article>

      <article className="analytics-panel">
        <header><div><span className="analytics-eyebrow">Portfolio</span><h3>Revenue by setup</h3></div></header>
        <div className="analytics-chart">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={configurationBreakdown} layout="vertical" margin={{ left: 8 }}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" hide />
              <YAxis type="category" dataKey="name" width={115} tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={tooltipStyle} formatter={(value) => [formatCurrency(Number(value)), 'Revenue']} />
              <Bar dataKey="revenue" fill="#06b6d4" radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </article>

      <article className="analytics-panel">
        <header><div><span className="analytics-eyebrow">Demand</span><h3>Peak start hours</h3></div></header>
        <div className="analytics-chart">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={peakStartHours}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="sessions" fill="#f59e0b" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </article>
    </div>
  );
}
