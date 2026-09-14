import { useEffect, useState } from 'react';
import {
  createMeterReading,
  fetchMeterReading,
  fetchMeterReadingImage,
  getIstDate,
  updateMeterReading,
  type MeterReading,
  type MeterReadingsProps,
} from '../../lib/meterReadings';
import './MeterReadings.css';

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_IMAGE_SIZE = 4 * 1024 * 1024;

export default function MeterReadings({
  token,
  role,
  onTodayReadingCompleted,
}: MeterReadingsProps) {
  const today = getIstDate();
  const [selectedDate, setSelectedDate] = useState(today);
  const [reading, setReading] = useState<MeterReading | null>(null);
  const [readingValue, setReadingValue] = useState('');
  const [image, setImage] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [imageVersion, setImageVersion] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    setError(null);
    setMessage(null);
    setImage(null);

    void fetchMeterReading(token, selectedDate)
      .then((result) => {
        if (!active) return;
        setReading(result);
        setReadingValue(result ? String(result.meterReading) : '');
      })
      .catch((requestError: unknown) => {
        if (!active) return;
        setReading(null);
        setError(requestError instanceof Error ? requestError.message : 'Could not load the meter reading.');
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [selectedDate, token]);

  useEffect(() => {
    if (!reading?.imageUrl) {
      setImagePreviewUrl(null);
      return;
    }

    let objectUrl: string | null = null;
    let active = true;
    void fetchMeterReadingImage(token, reading.imageUrl)
      .then((blob) => {
        if (!active) return;
        objectUrl = URL.createObjectURL(blob);
        setImagePreviewUrl(objectUrl);
      })
      .catch(() => {
        if (active) setImagePreviewUrl(null);
      });

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [imageVersion, reading?.imageUrl, token]);

  const handleImageChange = (file: File | null) => {
    setError(null);
    if (!file) {
      setImage(null);
      return;
    }
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      setError('Upload a JPEG, PNG, or WebP image.');
      return;
    }
    if (file.size > MAX_IMAGE_SIZE) {
      setError('The image must be 4 MB or smaller.');
      return;
    }
    setImage(file);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setMessage(null);

    const numericReading = Number(readingValue);
    if (!Number.isFinite(numericReading) || numericReading < 0) {
      setError('Enter a valid non-negative meter reading.');
      return;
    }
    const isHistoricalUpdate = selectedDate !== today && role === 'SUPER_ADMIN';
    if (!reading && !isHistoricalUpdate && !image) {
      setError('Upload a meter image before submitting.');
      return;
    }
    if (reading && role !== 'SUPER_ADMIN') {
      setError('Only a Super Admin can update an existing reading.');
      return;
    }

    setIsSaving(true);
    try {
      const result = reading || isHistoricalUpdate
        ? await updateMeterReading(token, selectedDate, numericReading, image ?? undefined)
        : await createMeterReading(token, selectedDate, numericReading, image as File);
      setReading(result.reading);
      setImage(null);
      setImageVersion((version) => version + 1);
      setMessage(result.message ?? 'Meter reading saved successfully.');
      if (selectedDate === today) onTodayReadingCompleted();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Could not save the meter reading.');
    } finally {
      setIsSaving(false);
    }
  };

  const canEdit = role === 'SUPER_ADMIN' || (!reading && selectedDate === today);
  const isUpdate = reading !== null || (role === 'SUPER_ADMIN' && selectedDate !== today);

  return (
    <section className="meter-page">
      <header className="meter-header">
        <div>
          <span className="meter-eyebrow">Daily Operations</span>
          <h2>Opening Meter Reading</h2>
          <p>One verified electricity meter reading per IST calendar day.</p>
        </div>
        <label className="meter-date-control">
          <span>Reading date</span>
          <input
            type="date"
            value={selectedDate}
            max={today}
            onChange={(event) => setSelectedDate(event.target.value)}
          />
        </label>
      </header>

      {error && <div className="meter-alert error">{error}</div>}
      {message && <div className="meter-alert success">{message}</div>}

      {isLoading ? (
        <div className="meter-empty">Loading meter reading...</div>
      ) : (
        <div className="meter-grid">
          <form className="meter-form-card" onSubmit={handleSubmit}>
            <div className="meter-card-heading">
              <div>
                <span>{reading ? 'Recorded reading' : 'Reading required'}</span>
                <strong>{selectedDate === today ? 'Today, IST' : selectedDate}</strong>
              </div>
              <span className={`meter-status ${reading ? 'complete' : 'pending'}`}>
                {reading ? 'Completed' : 'Pending'}
              </span>
            </div>

            <label className="meter-field">
              <span>Meter reading</span>
              <div className="meter-input-wrap">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  value={readingValue}
                  onChange={(event) => setReadingValue(event.target.value)}
                  disabled={!canEdit || isSaving}
                  placeholder="Enter current meter value"
                />
                <span>units</span>
              </div>
            </label>

            <label className={`meter-upload ${!canEdit ? 'disabled' : ''}`}>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(event) => handleImageChange(event.target.files?.[0] ?? null)}
                disabled={!canEdit || isSaving}
              />
              <strong>{image ? image.name : reading ? 'Replace meter image' : 'Upload meter image'}</strong>
              <span>JPEG, PNG, or WebP. Maximum 4 MB.</span>
            </label>

            {canEdit && (
              <button className="meter-submit" type="submit" disabled={isSaving}>
                {isSaving ? 'Saving reading...' : isUpdate ? 'Update reading' : 'Submit today’s reading'}
              </button>
            )}

            {reading && role !== 'SUPER_ADMIN' && (
              <p className="meter-readonly-note">Recorded readings are read-only for Admin users.</p>
            )}
          </form>

          <aside className="meter-proof-card">
            <div className="meter-image-frame">
              {imagePreviewUrl ? (
                <img src={imagePreviewUrl} alt={`Meter reading for ${selectedDate}`} />
              ) : (
                <div>No stored image available</div>
              )}
            </div>
            {imagePreviewUrl && reading && (
              <a
                className="meter-download"
                href={imagePreviewUrl}
                download={reading.imageFileName}
              >
                Download original image
              </a>
            )}

            {reading ? (
              <div className="meter-details">
                <div><span>Reading</span><strong>{reading.meterReading.toLocaleString()} units</strong></div>
                <div><span>File</span><strong>{reading.imageFileName}</strong></div>
                <div><span>Submitted by</span><strong>{reading.submittedByUser?.email ?? `User #${reading.submittedBy}`}</strong></div>
                {reading.updatedBy && (
                  <div><span>Updated by</span><strong>{reading.updatedByUser?.email ?? `User #${reading.updatedBy}`}</strong></div>
                )}
              </div>
            ) : (
              <div className="meter-empty-copy">
                <strong>No reading found</strong>
                <span>{selectedDate === today ? 'Complete today’s opening task.' : 'No reading was recorded for this date.'}</span>
              </div>
            )}
          </aside>
        </div>
      )}
    </section>
  );
}
