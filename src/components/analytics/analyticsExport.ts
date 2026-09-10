import type { SessionAnalytics } from './types';

export type AnalyticsExportFormat = 'json' | 'xlsx' | 'csv';

interface ExportDataset {
  name: string;
  rows: Record<string, unknown>[];
}

function flattenObject(
  value: object,
  prefix = '',
): Record<string, unknown> {
  return Object.entries(value).reduce<Record<string, unknown>>((result, [key, item]) => {
    const outputKey = prefix ? `${prefix}.${key}` : key;
    if (item && typeof item === 'object' && !Array.isArray(item)) {
      Object.assign(result, flattenObject(item, outputKey));
    } else {
      result[outputKey] = Array.isArray(item) ? item.join(', ') : item;
    }
    return result;
  }, {});
}

function toRows(items: readonly object[]): Record<string, unknown>[] {
  return items.map((item) => flattenObject(item));
}

function getDatasets(analytics: SessionAnalytics): ExportDataset[] {
  return [
    { name: 'Overview', rows: [flattenObject(analytics.overview)] },
    { name: 'Range', rows: [flattenObject({ generatedAt: analytics.generatedAt, ...analytics.range })] },
    { name: 'Player Count', rows: toRows(analytics.playerCountBreakdown) },
    { name: 'Daily Trend', rows: toRows(analytics.dailyTrend) },
    { name: 'Console Instances', rows: toRows(analytics.consoleInstances) },
    { name: 'Configurations', rows: toRows(analytics.configurationBreakdown) },
    { name: 'Games', rows: toRows(analytics.games) },
    { name: 'Top Players', rows: toRows(analytics.topPlayers) },
    { name: 'Age Groups', rows: toRows(analytics.ageGroups) },
    { name: 'Peak Start Hours', rows: toRows(analytics.peakStartHours) },
    { name: 'Data Quality', rows: [flattenObject(analytics.dataQuality)] },
  ];
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function getFilename(analytics: SessionAnalytics, extension: string): string {
  const range = analytics.range.label.replace(/[^a-z0-9-]/gi, '-').toLowerCase();
  return `vortex-session-analytics-${range}.${extension}`;
}

function rowsToCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return '';
  const headers = Array.from(new Set(rows.flatMap((row) => Object.keys(row))));
  const escapeCell = (value: unknown): string => {
    const text = value === null || value === undefined ? '' : String(value);
    return `"${text.replace(/"/g, '""')}"`;
  };
  return [
    headers.map(escapeCell).join(','),
    ...rows.map((row) => headers.map((header) => escapeCell(row[header])).join(',')),
  ].join('\n');
}

async function exportCsvBundle(analytics: SessionAnalytics): Promise<void> {
  const { default: JSZip } = await import('jszip');
  const zip = new JSZip();
  getDatasets(analytics).forEach((dataset) => {
    const filename = `${dataset.name.toLowerCase().replace(/\s+/g, '-')}.csv`;
    zip.file(filename, `\uFEFF${rowsToCsv(dataset.rows)}`);
  });
  zip.file('complete-response.json', JSON.stringify({ success: true, analytics }, null, 2));
  const blob = await zip.generateAsync({ type: 'blob' });
  downloadBlob(blob, getFilename(analytics, 'csv.zip'));
}

async function exportExcel(analytics: SessionAnalytics): Promise<void> {
  const XLSX = await import('xlsx');
  const workbook = XLSX.utils.book_new();
  getDatasets(analytics).forEach((dataset) => {
    const worksheet = XLSX.utils.json_to_sheet(dataset.rows);
    XLSX.utils.book_append_sheet(workbook, worksheet, dataset.name.slice(0, 31));
  });
  XLSX.writeFile(workbook, getFilename(analytics, 'xlsx'), { compression: true });
}

export async function exportAnalytics(
  analytics: SessionAnalytics,
  format: AnalyticsExportFormat,
): Promise<void> {
  if (format === 'json') {
    downloadBlob(
      new Blob([JSON.stringify({ success: true, analytics }, null, 2)], {
        type: 'application/json;charset=utf-8',
      }),
      getFilename(analytics, 'json'),
    );
    return;
  }
  if (format === 'xlsx') {
    await exportExcel(analytics);
    return;
  }
  await exportCsvBundle(analytics);
}

export async function exportChartAsPng(
  element: HTMLElement,
  filename: string,
): Promise<void> {
  const { toPng } = await import('html-to-image');
  const elementBackground = getComputedStyle(element).backgroundColor;
  const themeBackground = getComputedStyle(document.documentElement)
    .getPropertyValue('--bg-card')
    .trim();
  const backgroundColor = elementBackground && elementBackground !== 'rgba(0, 0, 0, 0)'
    ? elementBackground
    : themeBackground;
  const dataUrl = await toPng(element, {
    backgroundColor,
    cacheBust: true,
    pixelRatio: 2,
    filter: (node) => !(node as HTMLElement).dataset?.exportControl,
  });
  const anchor = document.createElement('a');
  anchor.href = dataUrl;
  anchor.download = `${filename}.png`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}

export async function exportSectionAsExcel(
  rows: readonly object[],
  sheetName: string,
  filename: string,
): Promise<void> {
  const XLSX = await import('xlsx');
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(toRows(rows));
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName.slice(0, 31));
  XLSX.writeFile(workbook, `${filename}.xlsx`, { compression: true });
}
