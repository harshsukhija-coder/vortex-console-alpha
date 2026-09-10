import { useState } from 'react';
import { exportSectionAsExcel } from './analyticsExport';

interface SectionDownloadButtonProps {
  rows: readonly object[];
  sheetName: string;
  filename: string;
}

export default function SectionDownloadButton({
  rows,
  sheetName,
  filename,
}: SectionDownloadButtonProps) {
  const [isDownloading, setIsDownloading] = useState(false);
  const [failed, setFailed] = useState(false);

  const handleDownload = async () => {
    setFailed(false);
    setIsDownloading(true);
    try {
      await exportSectionAsExcel(rows, sheetName, filename);
    } catch {
      setFailed(true);
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <button
      type="button"
      className="analytics-section-download"
      onClick={handleDownload}
      disabled={isDownloading || rows.length === 0}
      title={failed ? 'Excel download failed' : `Download ${sheetName} as Excel`}
    >
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 3v12M7 10l5 5 5-5M5 21h14"/>
      </svg>
      {isDownloading ? 'Saving' : failed ? 'Retry' : 'Excel'}
    </button>
  );
}
