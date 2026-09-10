import { useRef } from 'react';
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
import ChartDownloadButton from './ChartDownloadButton';
import SectionDownloadButton from './SectionDownloadButton';
import {
  formatAgeGroup,
  formatAnalyticsDate,
  formatCurrency,
  formatPlayerCountLabel,
} from './formatters';
import type {
  AgeGroupStat,
  ConfigurationStat,
  DailyTrendStat,
  PeakStartHourStat,
  PlayerCountBreakdownStat,
} from './types';

interface AnalyticsChartsProps {
  dateRange: string;
  playerCountBreakdown: PlayerCountBreakdownStat[];
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
  dateRange,
  playerCountBreakdown,
  dailyTrend,
  configurationBreakdown,
  ageGroups,
  peakStartHours,
}: AnalyticsChartsProps) {
  const visibleAgeGroups = ageGroups.filter((group) => group.playerVisits > 0);
  const dailyChartRef = useRef<HTMLElement>(null);
  const playerCountChartRef = useRef<HTMLElement>(null);
  const ageChartRef = useRef<HTMLElement>(null);
  const setupChartRef = useRef<HTMLElement>(null);
  const peakChartRef = useRef<HTMLElement>(null);

  return (
    <div className="analytics-chart-grid">
      <article className="analytics-panel analytics-chart-wide" ref={dailyChartRef}>
        <header>
          <div><span className="analytics-eyebrow">Revenue velocity</span><h3>Daily performance</h3><span className="analytics-chart-period">{dateRange}</span></div>
          <div className="analytics-chart-actions">
            <span className="analytics-legend-dot violet">Revenue</span>
            <SectionDownloadButton rows={dailyTrend} sheetName="Daily Performance" filename="daily-performance" />
            <ChartDownloadButton targetRef={dailyChartRef} filename="daily-revenue-performance" />
          </div>
        </header>
        <div className="analytics-chart">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={dailyTrend}>
              <defs>
                <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--analytics-violet)" stopOpacity={0.5} />
                  <stop offset="100%" stopColor="var(--analytics-violet)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="date" tickFormatter={formatAnalyticsDate} minTickGap={18} tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={(value: number) => `₹${value}`} tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} width={54} />
              <Tooltip contentStyle={tooltipStyle} labelFormatter={(label) => formatAnalyticsDate(String(label))} formatter={(value) => [formatCurrency(Number(value)), 'Revenue']} />
              <Area type="monotone" dataKey="revenue" stroke="var(--analytics-violet)" strokeWidth={3} fill="url(#revenueGradient)" activeDot={{ r: 5 }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </article>

      <article className="analytics-panel analytics-chart-wide" ref={playerCountChartRef}>
        <header>
          <div><span className="analytics-eyebrow">Party composition</span><h3>Sessions by player count</h3><span className="analytics-chart-period">{dateRange}</span></div>
          <div className="analytics-chart-actions">
            <SectionDownloadButton rows={playerCountBreakdown} sheetName="Player Count Breakdown" filename="player-count-breakdown" />
            <ChartDownloadButton targetRef={playerCountChartRef} filename="sessions-by-player-count" />
          </div>
        </header>
        <div className="analytics-chart">
          {playerCountBreakdown.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={playerCountBreakdown}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" tickFormatter={formatPlayerCountLabel} tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={tooltipStyle} labelFormatter={(label) => formatPlayerCountLabel(String(label))} />
                <Bar dataKey="sessions" name="Sessions" fill="var(--analytics-violet)" radius={[5, 5, 0, 0]} />
                <Bar dataKey="playerVisits" name="Player visits" fill="var(--analytics-green)" radius={[5, 5, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <div className="analytics-empty">No player-count data for this range</div>}
        </div>
      </article>

      <article className="analytics-panel" ref={ageChartRef}>
        <header>
          <div><span className="analytics-eyebrow">Audience</span><h3>Player age mix</h3><span className="analytics-chart-period">{dateRange}</span></div>
          <div className="analytics-chart-actions">
            <SectionDownloadButton rows={visibleAgeGroups} sheetName="Player Age Mix" filename="player-age-mix" />
            <ChartDownloadButton targetRef={ageChartRef} filename="player-age-mix" />
          </div>
        </header>
        <div className="analytics-chart">
          {visibleAgeGroups.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={visibleAgeGroups} layout="vertical" margin={{ left: 14, right: 18 }}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" allowDecimals={false} tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="ageGroup" width={74} tickFormatter={formatAgeGroup} tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={tooltipStyle} labelFormatter={(label) => formatAgeGroup(String(label))} formatter={(value) => [Number(value), 'Player visits']} />
                <Bar dataKey="playerVisits" fill="var(--analytics-violet)" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <div className="analytics-empty">No age data for this range</div>}
        </div>
      </article>

      <article className="analytics-panel" ref={setupChartRef}>
        <header>
          <div><span className="analytics-eyebrow">Portfolio</span><h3>Revenue by setup</h3><span className="analytics-chart-period">{dateRange}</span></div>
          <div className="analytics-chart-actions">
            <SectionDownloadButton rows={configurationBreakdown} sheetName="Revenue By Setup" filename="revenue-by-setup" />
            <ChartDownloadButton targetRef={setupChartRef} filename="revenue-by-setup" />
          </div>
        </header>
        <div className="analytics-chart">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={configurationBreakdown} layout="vertical" margin={{ left: 8 }}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" hide />
              <YAxis type="category" dataKey="name" width={115} tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={tooltipStyle} formatter={(value) => [formatCurrency(Number(value)), 'Revenue']} />
              <Bar dataKey="revenue" fill="var(--analytics-cyan)" radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </article>

      <article className="analytics-panel" ref={peakChartRef}>
        <header>
          <div><span className="analytics-eyebrow">Demand</span><h3>Peak start hours</h3><span className="analytics-chart-period">{dateRange}</span></div>
          <div className="analytics-chart-actions">
            <SectionDownloadButton rows={peakStartHours} sheetName="Peak Start Hours" filename="peak-start-hours" />
            <ChartDownloadButton targetRef={peakChartRef} filename="peak-session-start-hours" />
          </div>
        </header>
        <div className="analytics-chart">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={peakStartHours}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="sessions" fill="var(--analytics-amber)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </article>
    </div>
  );
}
