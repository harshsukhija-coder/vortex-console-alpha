export interface AnalyticsRange {
  type: string;
  label: string;
  start: string;
  endExclusive: string;
  days: number;
  timezone: string;
}

export interface AnalyticsOverview {
  totalSessions: number;
  completedSessions: number;
  confirmedSessions: number;
  totalPlayerVisits: number;
  uniqueBookingCustomers: number;
  totalOperatingHours: number;
  averageSessionHours: number;
  averagePlayersPerSession: number;
  totalRevenue: number;
  cashCollected: number;
  upiCollected: number;
  totalCollected: number;
  refundDue: number;
  paymentDue: number;
  averageRevenuePerSession: number;
  completionRatePercent: number;
}

export interface AgeGroupStat {
  ageGroup: string;
  playerVisits: number;
}

export interface ConsoleInstanceStat {
  setupInstanceId: number;
  instanceName: string;
  setupConfigurationId: number;
  configurationName: string;
  consoleType: string;
  sessions: number;
  completedSessions: number;
  playerVisits: number;
  totalOperatingHours: number;
  revenue: number;
  utilizationPercent: number;
}

export interface GameStat {
  gameId: number;
  name: string;
  sessionsPlayed: number;
  playerExposures: number;
  sessionHours: number;
  lastPlayedAt: string;
}

export interface TopPlayerStat {
  name: string;
  phoneNumber: string;
  dateOfBirth: string | null;
  age: number | null;
  sessionsPlayed: number;
  partyPlayersBrought: number;
  totalHours: number;
  totalSpent: number;
  lastPlayedAt: string;
  favoriteGame?: {
    gameId: number;
    name: string;
    sessionsPlayed: number;
  };
}

export interface DailyTrendStat {
  date: string;
  sessions: number;
  playerVisits: number;
  operatingHours: number;
  revenue: number;
}

export interface PeakStartHourStat {
  hour: number;
  label: string;
  sessions: number;
  playerVisits: number;
}

export interface ConfigurationStat {
  setupConfigurationId: number;
  name: string;
  consoleType: string;
  sessions: number;
  playerVisits: number;
  operatingHours: number;
  revenue: number;
}

export interface AnalyticsDataQuality {
  totalPlayerVisits: number;
  identifiedPrimaryPlayerVisits: number;
  ageKnownPrimaryPlayerVisits: number;
  unattributedAdditionalPlayerVisits: number;
  ageGroupMethod: string;
  revenueMethod: string;
  durationMethod: string;
}

export interface SessionAnalytics {
  generatedAt: string;
  range: AnalyticsRange;
  overview: AnalyticsOverview;
  ageGroups: AgeGroupStat[];
  consoleInstances: ConsoleInstanceStat[];
  games: GameStat[];
  topPlayers: TopPlayerStat[];
  dailyTrend: DailyTrendStat[];
  peakStartHours: PeakStartHourStat[];
  configurationBreakdown: ConfigurationStat[];
  dataQuality: AnalyticsDataQuality;
}

export interface SessionAnalyticsResponse {
  success: boolean;
  analytics?: SessionAnalytics;
  error?: string;
  message?: string;
}

export type AnalyticsRangeMode = 'LAST_15_DAYS' | 'MONTH';
