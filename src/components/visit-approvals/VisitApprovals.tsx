import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import {
  VisitApiError,
  approveVisitRequest,
  fetchVisitRequests,
  rejectVisitRequest,
  type VisitApprovalResult,
  type VisitRequest,
  type VisitRewardProgress,
  type VisitStatusFilter,
} from '../../lib/visitRewards';
import './VisitApprovals.css';

interface VisitApprovalsProps {
  token: string;
  role: 'ADMIN' | 'SUPER_ADMIN';
  onUnauthorized: () => void;
}

interface ListResult {
  queryKey: string;
  visits: VisitRequest[];
  error: string | null;
}

interface Toast {
  id: number;
  tone: 'success' | 'error' | 'info';
  title: string;
  detail?: string;
}

type BusyAction = 'approve' | 'reject';

const PAGE_SIZE = 20;
const TOAST_DURATION_MS = 5000;
const SEARCH_DEBOUNCE_MS = 400;
const DEFAULT_PROGRESS = { requiredVisits: 7, windowDays: 30, codeValidityDays: 7 };

const STATUS_TABS: Array<{ value: VisitStatusFilter; label: string }> = [
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'all', label: 'All' },
];

const EMPTY_COPY: Record<VisitStatusFilter, { title: string; detail: string }> = {
  pending: {
    title: 'All caught up',
    detail: 'There are no visit requests waiting for approval right now.',
  },
  approved: {
    title: 'No approved visits',
    detail: 'Approved visits will show up here once you start confirming requests.',
  },
  all: {
    title: 'No visit requests yet',
    detail: 'Customer visit requests will appear here as they come in.',
  },
};

const IST = 'Asia/Kolkata';

function getIstToday(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: IST,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function formatVisitDate(value: string): string {
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return value;
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'UTC',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    weekday: 'short',
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

function formatDateTime(value: string | null): string {
  if (!value) return '—';
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: IST,
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(new Date(value));
}

function formatRelative(value: string, now = Date.now()): string {
  const diffSeconds = Math.round((new Date(value).getTime() - now) / 1000);
  const formatter = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  const divisions: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ['day', 86400],
    ['hour', 3600],
    ['minute', 60],
  ];
  for (const [unit, seconds] of divisions) {
    if (Math.abs(diffSeconds) >= seconds) {
      return formatter.format(Math.round(diffSeconds / seconds), unit);
    }
  }
  return 'just now';
}

function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) return `${digits.slice(0, 5)} ${digits.slice(5)}`;
  return phone;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  const first = parts[0][0] ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1][0] ?? '') : '';
  return (first + last).toUpperCase();
}

function getAvatarHue(seed: string): number {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) % 360;
  }
  return hash;
}

function Icon({ name }: { name: 'check' | 'x' | 'refresh' | 'search' | 'gift' | 'copy' | 'phone' | 'calendar' | 'clock' | 'inbox' | 'alert' }) {
  const common = {
    width: 16,
    height: 16,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2.2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  };

  switch (name) {
    case 'check':
      return (
        <svg {...common}>
          <polyline points="20 6 9 17 4 12" />
        </svg>
      );
    case 'x':
      return (
        <svg {...common}>
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      );
    case 'refresh':
      return (
        <svg {...common}>
          <polyline points="23 4 23 10 17 10" />
          <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
        </svg>
      );
    case 'search':
      return (
        <svg {...common}>
          <circle cx="11" cy="11" r="7" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
      );
    case 'gift':
      return (
        <svg {...common}>
          <polyline points="20 12 20 22 4 22 4 12" />
          <rect x="2" y="7" width="20" height="5" />
          <line x1="12" y1="22" x2="12" y2="7" />
          <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z" />
          <path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" />
        </svg>
      );
    case 'copy':
      return (
        <svg {...common}>
          <rect x="9" y="9" width="13" height="13" rx="2" />
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
        </svg>
      );
    case 'phone':
      return (
        <svg {...common}>
          <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" />
        </svg>
      );
    case 'calendar':
      return (
        <svg {...common}>
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
      );
    case 'clock':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
      );
    case 'inbox':
      return (
        <svg {...common} strokeWidth={1.8}>
          <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
          <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
        </svg>
      );
    case 'alert':
      return (
        <svg {...common}>
          <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      );
  }
}

export default function VisitApprovals({ token, role, onUnauthorized }: VisitApprovalsProps) {
  const [status, setStatus] = useState<VisitStatusFilter>('pending');
  const [phoneInput, setPhoneInput] = useState('');
  const [phoneFilter, setPhoneFilter] = useState('');
  const [page, setPage] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);
  const [result, setResult] = useState<ListResult | null>(null);
  const [busy, setBusy] = useState<Record<number, BusyAction>>({});
  const [rejectTarget, setRejectTarget] = useState<VisitRequest | null>(null);
  const [rewardResult, setRewardResult] = useState<VisitApprovalResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [progressInfo, setProgressInfo] = useState<VisitRewardProgress | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const toastId = useRef(0);
  const toastTimers = useRef<number[]>([]);
  const onUnauthorizedRef = useRef(onUnauthorized);

  useEffect(() => {
    onUnauthorizedRef.current = onUnauthorized;
  }, [onUnauthorized]);

  const queryKey = `${status}|${phoneFilter}|${page}`;
  const isLoading = result?.queryKey !== queryKey;
  const visits = result && !isLoading ? result.visits : [];
  const listError = result && !isLoading ? result.error : null;

  // Debounce the phone search so we don't hit the API on every keystroke.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setPhoneFilter(phoneInput.replace(/\D/g, ''));
      setPage(0);
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [phoneInput]);

  // Keep relative timestamps ("5 min ago") fresh.
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const timers = toastTimers.current;
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, []);

  // Fetch the visit list whenever the query (or an explicit refresh) changes.
  useEffect(() => {
    let active = true;

    fetchVisitRequests(token, {
      status,
      phone: phoneFilter || undefined,
      limit: PAGE_SIZE,
      offset: page * PAGE_SIZE,
    })
      .then((list) => {
        if (active) setResult({ queryKey, visits: list, error: null });
      })
      .catch((requestError: unknown) => {
        if (!active) return;
        if (requestError instanceof VisitApiError && requestError.status === 401) {
          onUnauthorizedRef.current();
          return;
        }
        setResult({
          queryKey,
          visits: [],
          error:
            requestError instanceof Error
              ? requestError.message
              : 'Could not load visit requests.',
        });
      });

    return () => {
      active = false;
    };
  }, [token, status, phoneFilter, page, refreshKey, queryKey]);

  const dismissToast = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const pushToast = useCallback(
    (toast: Omit<Toast, 'id'>) => {
      toastId.current += 1;
      const id = toastId.current;
      setToasts((current) => [...current.slice(-3), { ...toast, id }]);
      toastTimers.current.push(window.setTimeout(() => dismissToast(id), TOAST_DURATION_MS));
    },
    [dismissToast],
  );

  // Close dialogs with Escape.
  useEffect(() => {
    if (!rejectTarget && !rewardResult) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setRejectTarget(null);
      setRewardResult(null);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [rejectTarget, rewardResult]);

  const refresh = () => setRefreshKey((key) => key + 1);

  const handleStatusChange = (next: VisitStatusFilter) => {
    if (next === status) return;
    setStatus(next);
    setPage(0);
  };

  const setBusyFor = (id: number, action: BusyAction | null) => {
    setBusy((current) => {
      const next = { ...current };
      if (action) next[id] = action;
      else delete next[id];
      return next;
    });
  };

  const handleActionError = (requestError: unknown, fallback: string) => {
    if (requestError instanceof VisitApiError && requestError.status === 401) {
      onUnauthorizedRef.current();
      return;
    }
    pushToast({
      tone: 'error',
      title: requestError instanceof Error ? requestError.message : fallback,
    });
    // 404 / 409 mean our copy is stale, so resync with the server.
    if (
      requestError instanceof VisitApiError &&
      (requestError.status === 404 || requestError.status === 409)
    ) {
      refresh();
    }
  };

  const handleApprove = async (visit: VisitRequest) => {
    setBusyFor(visit.id, 'approve');
    try {
      const approval = await approveVisitRequest(token, visit.id);
      setProgressInfo(approval.progress);

      setResult((current) => {
        if (!current) return current;
        const visits =
          status === 'pending'
            ? current.visits.filter((item) => item.id !== visit.id)
            : current.visits.map((item) => (item.id === visit.id ? approval.visit : item));
        return { ...current, visits };
      });

      if (approval.rewardCode) {
        setCopied(false);
        setRewardResult(approval);
      } else {
        const { approvedVisits, requiredVisits, visitsRemaining } = approval.progress;
        pushToast({
          tone: 'success',
          title: `${visit.name} approved`,
          detail: `${approvedVisits} of ${requiredVisits} visits counted · ${visitsRemaining} to go`,
        });
      }
      refresh();
    } catch (requestError) {
      handleActionError(requestError, 'Could not approve this visit.');
    } finally {
      setBusyFor(visit.id, null);
    }
  };

  const handleConfirmReject = async () => {
    if (!rejectTarget) return;
    const visit = rejectTarget;
    setBusyFor(visit.id, 'reject');
    try {
      await rejectVisitRequest(token, visit.id);
      setResult((current) =>
        current
          ? { ...current, visits: current.visits.filter((item) => item.id !== visit.id) }
          : current,
      );
      pushToast({
        tone: 'info',
        title: `Request from ${visit.name} rejected`,
        detail: 'They can submit a new request for the same day if this was a mistake.',
      });
      setRejectTarget(null);
      refresh();
    } catch (requestError) {
      setRejectTarget(null);
      handleActionError(requestError, 'Could not reject this visit.');
    } finally {
      setBusyFor(visit.id, null);
    }
  };

  const handleCopyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      pushToast({ tone: 'error', title: 'Could not copy the code. Select and copy it manually.' });
    }
  };

  const today = getIstToday();
  const rules = progressInfo ?? DEFAULT_PROGRESS;
  const hasNextPage = visits.length === PAGE_SIZE;
  const isFiltered = phoneFilter.length > 0;
  const rejectBusy = rejectTarget ? busy[rejectTarget.id] === 'reject' : false;

  return (
    <section className="va-page">
      <header className="va-header">
        <div className="va-header-copy">
          <span className="va-eyebrow">Customer Rewards</span>
          <h2>Visit Approvals</h2>
          <p>
            Confirm genuine customer visits. {rules.requiredVisits} approved visits within{' '}
            {rules.windowDays} days unlock a reward code, valid for {rules.codeValidityDays} days.
          </p>
        </div>
        <span className="va-role-chip">
          {role === 'SUPER_ADMIN' ? 'Super Admin' : 'Admin'} access
        </span>
      </header>

      <div className="va-toolbar">
        <div className="va-segmented" role="tablist" aria-label="Visit status">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.value}
              type="button"
              role="tab"
              aria-selected={status === tab.value}
              className={status === tab.value ? 'active' : ''}
              onClick={() => handleStatusChange(tab.value)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <label className="va-search">
          <Icon name="search" />
          <input
            type="tel"
            inputMode="numeric"
            placeholder="Filter by phone number"
            value={phoneInput}
            onChange={(event) => setPhoneInput(event.target.value)}
            aria-label="Filter by phone number"
          />
          {phoneInput && (
            <button
              type="button"
              className="va-search-clear"
              onClick={() => setPhoneInput('')}
              aria-label="Clear phone filter"
            >
              <Icon name="x" />
            </button>
          )}
        </label>

        <button
          type="button"
          className="va-refresh"
          onClick={refresh}
          disabled={isLoading}
          title="Refresh list"
        >
          <span className={isLoading ? 'va-spin' : ''}>
            <Icon name="refresh" />
          </span>
          Refresh
        </button>
      </div>

      {listError && (
        <div className="va-banner error" role="alert">
          <Icon name="alert" />
          <span>{listError}</span>
          <button type="button" onClick={refresh}>
            Try again
          </button>
        </div>
      )}

      <div className="va-list-card">
        <div className="va-list-head">
          <span>Customer</span>
          <span>Visit date</span>
          <span>Requested</span>
          <span>Status</span>
          <span className="va-head-actions">Actions</span>
        </div>

        {isLoading && (
          <ul className="va-list" aria-busy="true" aria-label="Loading visit requests">
            {[0, 1, 2, 3].map((item) => (
              <li key={item} className="va-row va-skeleton-row">
                <div className="va-skeleton-block" />
              </li>
            ))}
          </ul>
        )}

        {!isLoading && !listError && visits.length === 0 && (
          <div className="va-empty">
            <div className="va-empty-icon">
              <Icon name={status === 'pending' && !isFiltered ? 'check' : 'inbox'} />
            </div>
            <strong>{isFiltered ? 'No matching visits' : EMPTY_COPY[status].title}</strong>
            <p>
              {isFiltered
                ? `Nothing found for ${phoneFilter} in this view. Try another number or clear the filter.`
                : EMPTY_COPY[status].detail}
            </p>
            {isFiltered && (
              <button type="button" className="va-link-btn" onClick={() => setPhoneInput('')}>
                Clear filter
              </button>
            )}
          </div>
        )}

        {!isLoading && visits.length > 0 && (
          <ul className="va-list">
            {visits.map((visit) => {
              const action = busy[visit.id];
              const isRewarded = visit.isApproved && visit.rewardCodeId !== null;
              const isToday = visit.dateOfVisit === today;
              const hue = getAvatarHue(visit.phoneNumber);

              return (
                <li key={visit.id} className={`va-row ${action ? 'is-busy' : ''}`}>
                  <div className="va-cell va-customer">
                    <span
                      className="va-avatar"
                      style={{ '--va-hue': hue } as CSSProperties}
                      aria-hidden="true"
                    >
                      {getInitials(visit.name)}
                    </span>
                    <div className="va-customer-text">
                      <strong title={visit.name}>{visit.name}</strong>
                      <span>
                        <Icon name="phone" />
                        {formatPhone(visit.phoneNumber)}
                      </span>
                    </div>
                  </div>

                  <div className="va-cell va-date" data-label="Visit date">
                    <Icon name="calendar" />
                    <span>{formatVisitDate(visit.dateOfVisit)}</span>
                    {isToday && <em className="va-today">Today</em>}
                  </div>

                  <div
                    className="va-cell va-requested"
                    data-label="Requested"
                    title={formatDateTime(visit.createdAt)}
                  >
                    <Icon name="clock" />
                    <span>{formatRelative(visit.createdAt, now)}</span>
                  </div>

                  <div className="va-cell va-status-cell" data-label="Status">
                    {isRewarded ? (
                      <span className="va-pill rewarded" title="This visit counted toward a reward code">
                        <Icon name="gift" />
                        Reward issued
                      </span>
                    ) : visit.isApproved ? (
                      <span
                        className="va-pill approved"
                        title={`Approved ${formatDateTime(visit.approvedAt)}`}
                      >
                        <Icon name="check" />
                        Approved
                      </span>
                    ) : (
                      <span className="va-pill pending">
                        <span className="va-dot" />
                        Pending
                      </span>
                    )}
                    {visit.isApproved && visit.approvedAt && (
                      <small>{formatDateTime(visit.approvedAt)}</small>
                    )}
                  </div>

                  <div className="va-cell va-actions">
                    {visit.isApproved ? (
                      <span className="va-locked">Finalised</span>
                    ) : (
                      <>
                        <button
                          type="button"
                          className="va-btn reject"
                          disabled={Boolean(action)}
                          onClick={() => setRejectTarget(visit)}
                          aria-label={`Reject visit request from ${visit.name}`}
                        >
                          <Icon name="x" />
                          Reject
                        </button>
                        <button
                          type="button"
                          className="va-btn approve"
                          disabled={Boolean(action)}
                          onClick={() => void handleApprove(visit)}
                          aria-label={`Approve visit request from ${visit.name}`}
                        >
                          {action === 'approve' ? <span className="va-btn-spinner" /> : <Icon name="check" />}
                          {action === 'approve' ? 'Approving' : 'Approve'}
                        </button>
                      </>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {!listError && (page > 0 || hasNextPage) && (
          <footer className="va-pagination">
            <span>
              Showing {page * PAGE_SIZE + 1}–{page * PAGE_SIZE + visits.length}
            </span>
            <div>
              <button
                type="button"
                onClick={() => setPage((current) => Math.max(0, current - 1))}
                disabled={page === 0 || isLoading}
              >
                Previous
              </button>
              <button
                type="button"
                onClick={() => setPage((current) => current + 1)}
                disabled={!hasNextPage || isLoading}
              >
                Next
              </button>
            </div>
          </footer>
        )}
      </div>

      {rejectTarget && (
        <div className="va-overlay" onClick={() => !rejectBusy && setRejectTarget(null)}>
          <div
            className="va-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="va-reject-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="va-dialog-icon danger">
              <Icon name="alert" />
            </div>
            <h3 id="va-reject-title">Reject this visit request?</h3>
            <p>
              The claim from <strong>{rejectTarget.name}</strong> ({formatPhone(rejectTarget.phoneNumber)}) for{' '}
              <strong>{formatVisitDate(rejectTarget.dateOfVisit)}</strong> will be deleted. The customer can
              submit a new request for the same day.
            </p>
            <div className="va-dialog-actions">
              <button
                type="button"
                className="va-btn ghost"
                onClick={() => setRejectTarget(null)}
                disabled={rejectBusy}
              >
                Keep request
              </button>
              <button
                type="button"
                className="va-btn danger"
                onClick={() => void handleConfirmReject()}
                disabled={rejectBusy}
                autoFocus
              >
                {rejectBusy && <span className="va-btn-spinner" />}
                {rejectBusy ? 'Rejecting' : 'Reject request'}
              </button>
            </div>
          </div>
        </div>
      )}

      {rewardResult?.rewardCode && (
        <div className="va-overlay" onClick={() => setRewardResult(null)}>
          <div
            className="va-dialog reward"
            role="dialog"
            aria-modal="true"
            aria-labelledby="va-reward-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="va-confetti" aria-hidden="true">
              {Array.from({ length: 14 }, (_, index) => (
                <i key={index} style={{ '--i': index } as CSSProperties} />
              ))}
            </div>
            <div className="va-dialog-icon gift">
              <Icon name="gift" />
            </div>
            <span className="va-eyebrow">Reward unlocked</span>
            <h3 id="va-reward-title">{rewardResult.visit.name} earned a reward!</h3>
            <p>
              Visit approved — this was their {rewardResult.progress.requiredVisits}th visit within{' '}
              {rewardResult.progress.windowDays} days. Share this code with{' '}
              {formatPhone(rewardResult.rewardCode.phoneNumber)}.
            </p>

            <div className="va-code-box">
              <code>{rewardResult.rewardCode.code}</code>
              <button
                type="button"
                onClick={() => void handleCopyCode(rewardResult.rewardCode?.code ?? '')}
                className={copied ? 'copied' : ''}
              >
                <Icon name={copied ? 'check' : 'copy'} />
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>

            <div className="va-code-meta">
              <div>
                <span>Valid until</span>
                <strong>{formatDateTime(rewardResult.rewardCode.expiresAt)}</strong>
              </div>
              <div>
                <span>Status</span>
                <strong>{rewardResult.rewardCode.status}</strong>
              </div>
            </div>

            <div className="va-dialog-actions">
              <button type="button" className="va-btn approve" onClick={() => setRewardResult(null)}>
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="va-toasts" aria-live="polite">
        {toasts.map((toast) => (
          <div key={toast.id} className={`va-toast ${toast.tone}`} role="status">
            <span className="va-toast-icon">
              <Icon name={toast.tone === 'error' ? 'alert' : 'check'} />
            </span>
            <div>
              <strong>{toast.title}</strong>
              {toast.detail && <p>{toast.detail}</p>}
            </div>
            <button type="button" onClick={() => dismissToast(toast.id)} aria-label="Dismiss notification">
              <Icon name="x" />
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
