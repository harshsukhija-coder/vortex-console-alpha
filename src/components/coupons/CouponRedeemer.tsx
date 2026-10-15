import { useState } from 'react';
import { normalizeCouponCode } from '../../lib/coupons';
import './CouponRedeemer.css';

interface CouponRedeemerProps {
  /** Codes already validated by the API. */
  codes: string[];
  /** One coupon per player. */
  maxAllowed: number;
  /** Total gameplay discount currently coming from coupons. */
  couponDiscount: number;
  isChecking: boolean;
  error: string | null;
  /** Validates the code against the API. Resolves true when it was accepted. */
  onApply: (code: string) => Promise<boolean>;
  onRemove: (code: string) => void;
  onDismissError: () => void;
}

export default function CouponRedeemer({
  codes,
  maxAllowed,
  couponDiscount,
  isChecking,
  error,
  onApply,
  onRemove,
  onDismissError,
}: CouponRedeemerProps) {
  const [input, setInput] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  const isFull = codes.length >= maxAllowed;
  const shownError = localError ?? error;
  const perCoupon = codes.length > 0 ? Math.round(couponDiscount / codes.length) : 0;

  const handleApply = async () => {
    const code = normalizeCouponCode(input);
    if (!code) return;

    if (codes.includes(code)) {
      setLocalError(`Coupon ${code} was already added.`);
      return;
    }
    if (isFull) {
      setLocalError(
        `Maximum is one coupon per player. This booking has ${maxAllowed} player${maxAllowed === 1 ? '' : 's'}.`,
      );
      return;
    }

    setLocalError(null);
    const accepted = await onApply(code);
    if (accepted) setInput('');
  };

  return (
    <section className="coupon-section" aria-label="Coupon codes">
      <header className="coupon-header">
        <div className="coupon-title">
          <span className="coupon-title-icon" aria-hidden="true">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2z" />
              <line x1="13" y1="5" x2="13" y2="7" />
              <line x1="13" y1="17" x2="13" y2="19" />
              <line x1="13" y1="11" x2="13" y2="13" />
            </svg>
          </span>
          <div>
            <strong>Coupon codes</strong>
            <span>Each coupon covers one player&apos;s share of gameplay. Add-ons are never discounted.</span>
          </div>
        </div>
        <div className="coupon-meter" title={`${codes.length} of ${maxAllowed} players covered`}>
          <div className="coupon-meter-dots">
            {Array.from({ length: maxAllowed }, (_, index) => (
              <i key={index} className={index < codes.length ? 'on' : ''} />
            ))}
          </div>
          <span>
            {codes.length}/{maxAllowed}
          </span>
        </div>
      </header>

      {!isFull ? (
        <form
          className="coupon-form"
          onSubmit={(event) => {
            event.preventDefault();
            void handleApply();
          }}
        >
          <input
            type="text"
            value={input}
            onChange={(event) => {
              setInput(event.target.value.toUpperCase());
              setLocalError(null);
              if (error) onDismissError();
            }}
            placeholder="VTX-XXXXXXXX"
            aria-label="Coupon code"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            disabled={isChecking}
          />
          <button type="submit" disabled={isChecking || !input.trim()}>
            {isChecking ? <span className="coupon-spinner" /> : null}
            {isChecking ? 'Checking' : 'Apply'}
          </button>
        </form>
      ) : (
        <div className="coupon-full-note">All {maxAllowed} players are covered by a coupon.</div>
      )}

      {shownError && (
        <div className="coupon-error" role="alert">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <span>{shownError}</span>
        </div>
      )}

      {codes.length > 0 && (
        <ul className="coupon-list">
          {codes.map((code) => (
            <li key={code} className="coupon-ticket">
              <div className="coupon-ticket-main">
                <span className="coupon-ticket-check" aria-hidden="true">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </span>
                <code>{code}</code>
              </div>
              <div className="coupon-ticket-side">
                <span className="coupon-ticket-value">−₹{perCoupon}</span>
                <button
                  type="button"
                  onClick={() => onRemove(code)}
                  disabled={isChecking}
                  aria-label={`Remove coupon ${code}`}
                  title="Remove coupon"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {codes.length > 0 && (
        <div className="coupon-total">
          <span>Coupon discount</span>
          <strong>−₹{couponDiscount}</strong>
        </div>
      )}
    </section>
  );
}
