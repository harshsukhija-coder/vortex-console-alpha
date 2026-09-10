export const formatCurrency = (value: number): string =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value);

export const formatCompactNumber = (value: number): string =>
  new Intl.NumberFormat('en-IN', {
    notation: value >= 1000 ? 'compact' : 'standard',
    maximumFractionDigits: 1,
  }).format(value);

export const formatAnalyticsDate = (value: string): string =>
  new Date(value).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
  });

export const formatDateTime = (value: string): string =>
  new Date(value).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });

export const formatAgeGroup = (value: string): string => {
  if (value === 'UNKNOWN_PRIMARY') return 'Unknown';
  if (value === 'UNATTRIBUTED_ADDITIONAL') return 'Additional';
  return value;
};

export const formatPlayerCountLabel = (value: string): string => {
  const labels: Record<string, string> = {
    SINGLE: '1 player',
    DOUBLE: '2 players',
    TRIPLE: '3 players',
    FOUR: '4 players',
    FIVE_OR_MORE: '5+ players',
  };
  return labels[value] ?? value.replaceAll('_', ' ').toLowerCase();
};

export const formatAnalyticsRange = (
  start: string,
  endExclusive: string,
): string => {
  const end = new Date(endExclusive);
  end.setMilliseconds(end.getMilliseconds() - 1);
  return `${formatAnalyticsDate(start)} – ${formatAnalyticsDate(end.toISOString())}`;
};
