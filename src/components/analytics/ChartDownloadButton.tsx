import { useState, type RefObject } from 'react';
import { exportChartAsPng } from './analyticsExport';

interface ChartDownloadButtonProps {
  targetRef: RefObject<HTMLElement | null>;
  filename: string;
}

export default function ChartDownloadButton({
  targetRef,
  filename,
}: ChartDownloadButtonProps) {
  const [isDownloading, setIsDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDownload = async () => {
    if (!targetRef.current) return;
    setError(null);
    setIsDownloading(true);
    try {
      await exportChartAsPng(targetRef.current, filename);
    } catch {
      setError('Download failed');
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <button
      type="button"
      className="analytics-chart-download"
      data-export-control="true"
      onClick={handleDownload}
      disabled={isDownloading}
      title={error || 'Download chart as PNG'}
      aria-label={`Download ${filename} chart as PNG`}
    >
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 3v12M7 10l5 5 5-5M5 21h14"/>
      </svg>
      {isDownloading ? 'Saving' : error || 'PNG'}
    </button>
  );
}
