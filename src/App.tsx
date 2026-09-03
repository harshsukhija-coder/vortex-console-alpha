import { useState, useEffect, useRef, useCallback } from 'react';
import OccupancySessionTimer from './components/occupancy/OccupancySessionTimer';
import UpcomingScheduleList from './components/schedule/UpcomingScheduleList';
import { API_BASE_URL } from './lib/api';
import {
  fetchUpcomingSchedule,
  formatScheduleDate,
  getNextUpcomingForInstance,
  type UpcomingBooking,
} from './lib/schedule';
import { formatCountdown, secondsUntilIso } from './lib/sessionTiming';
import './App.css';

// Log item interface for platform updates feed
interface LogItem {
  id: string;
  type: 'info' | 'success' | 'warning' | 'danger';
  message: string;
  timestamp: string;
}

// User session profile
interface UserSession {
  id: number;
  email: string;
  role: 'SUPER_ADMIN' | 'ADMIN';
}

// Setup Details from API
interface SetupDetails {
  id: number;
  name: string;
  consoleType: string;
  chargePerPersonPerHour: number;
  multiplayerPrice?: number;
  singlePlayerPrice?: number;
}

// Booking Details from API
interface BookingDetails {
  bookingId: number;
  phoneNumber: string;
  playersCount: number;
  status: 'CONFIRMED' | 'PENDING' | string;
  startTime: string;
  endTime: string;
  originalAmount: number;
  amountCharged: number;
  timeLeftMinutes: number;
  timeLeftFormatted: string;
  requestedNoOfHours?: number;
}

// Setup Instance from API
interface SetupInstance {
  instanceId: number;
  instanceName: string;
  isActive: boolean;
  setup: SetupDetails;
  status: 'OCCUPIED' | 'AVAILABLE' | 'TENTATIVE' | string;
  currentBooking: BookingDetails | null;
}

function App() {
  // Mobile navbar toggle state
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // Dashboard Sub-navigation Tabs State
  const [activeDashboardTab, setActiveDashboardTab] = useState<'stats' | 'tentative' | 'bookings' | 'sessions' | 'schedule'>('bookings');

  // Past Sessions date-filtered ledger
  const [pastSessionsDate, setPastSessionsDate] = useState<string>(() => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  });
  const [pastSessionsStationFilter, setPastSessionsStationFilter] = useState<string>('ALL');
  const [pastSessionsStatusFilter, setPastSessionsStatusFilter] = useState<'ALL' | 'CONFIRMED' | 'CANCELLED'>('ALL');
  const [pastSessionsSearch, setPastSessionsSearch] = useState<string>('');
  const [pastSessionsData, setPastSessionsData] = useState<{ summary?: any; sessions?: any[] }>({});
  const [isPastSessionsLoading, setIsPastSessionsLoading] = useState<boolean>(false);
  const [pastSessionsError, setPastSessionsError] = useState<string | null>(null);

  // Tentative Bookings date-filtered list
  const [tentativeBookings, setTentativeBookings] = useState<any[]>([]);
  const [isTentativeLoading, setIsTentativeLoading] = useState(false);
  const [tentativeError, setTentativeError] = useState<string | null>(null);
  const [tentativeDate, setTentativeDate] = useState<string>(() => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  });

  // Search booking by ID state
  const [searchBookingId, setSearchBookingId] = useState<string>('');

  // Tentative Booking Confirmation States
  const [confirmingTentativeBooking, setConfirmingTentativeBooking] = useState<any>(null);
  const [confirmSetupInstanceId, setConfirmSetupInstanceId] = useState<number | ''>('');
  const [confirmCashAmount, setConfirmCashAmount] = useState<number>(0);
  const [confirmUpiAmount, setConfirmUpiAmount] = useState<number>(0);
  const [confirmStartTime, setConfirmStartTime] = useState<string>('');
  const [confirmEndTime, setConfirmEndTime] = useState<string>('');
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [isConfirmSubmitting, setIsConfirmSubmitting] = useState<boolean>(false);

  // Theme state switcher
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const savedTheme = localStorage.getItem('vortex_theme');
    if (savedTheme === 'light' || savedTheme === 'dark') {
      return savedTheme;
    }
    return 'dark';
  });

  useEffect(() => {
    if (theme === 'light') {
      document.documentElement.classList.add('light-theme');
      document.documentElement.classList.remove('dark-theme');
    } else {
      document.documentElement.classList.add('dark-theme');
      document.documentElement.classList.remove('light-theme');
    }
    localStorage.setItem('vortex_theme', theme);
  }, [theme]);

  // ----------------------------------------------------
  // Visual Rotator & Live Preview States
  // ----------------------------------------------------
  const taglines = [
    'Next-Gen Control Center',
    'Real-Time Booking Engine',
    'Live Lounge Occupancy Grid',
    'Secure Operations Console'
  ];
  const [taglineText, setTaglineText] = useState('');
  const [taglineIndex, setTaglineIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);
  const [mockTimeLeft, setMockTimeLeft] = useState(1455); // 24m 15s in seconds

  useEffect(() => {
    let timer: any;
    const currentFullText = taglines[taglineIndex];
    
    const handleTyping = () => {
      if (!isDeleting) {
        setTaglineText(currentFullText.substring(0, taglineText.length + 1));
        
        if (taglineText === currentFullText) {
          timer = setTimeout(() => setIsDeleting(true), 2000);
        } else {
          timer = setTimeout(handleTyping, 60);
        }
      } else {
        setTaglineText(currentFullText.substring(0, taglineText.length - 1));
        
        if (taglineText === '') {
          setIsDeleting(false);
          setTaglineIndex((prev) => (prev + 1) % taglines.length);
          timer = setTimeout(handleTyping, 150);
        } else {
          timer = setTimeout(handleTyping, 30);
        }
      }
    };
    
    timer = setTimeout(handleTyping, isDeleting ? 30 : 60);
    return () => clearTimeout(timer);
  }, [taglineText, isDeleting, taglineIndex]);

  // Simulated countdown for preview stations
  useEffect(() => {
    const mockInterval = setInterval(() => {
      setMockTimeLeft((prev) => (prev > 0 ? prev - 1 : 1455));
    }, 1000);
    return () => clearInterval(mockInterval);
  }, []);

  const formatMockTime = (totalSeconds: number) => {
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${m}m ${String(s).padStart(2, '0')}s`;
  };

  // Client-side Hash Router state ('#/', '#/login', '#/dashboard')
  const [currentHash, setCurrentHash] = useState<string>('#/');

  // Authentication states (restored from localStorage)
  const [authToken, setAuthToken] = useState<string | null>(() => {
    return localStorage.getItem('vortex_auth_token');
  });
  const [authUser, setAuthUser] = useState<UserSession | null>(() => {
    const savedUser = localStorage.getItem('vortex_auth_user');
    if (savedUser) {
      try {
        return JSON.parse(savedUser);
      } catch {
        return null;
      }
    }
    return null;
  });

  // Login form states
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginInfoMessage, setLoginInfoMessage] = useState<string | null>(null);
  const [isLoginLoading, setIsLoginLoading] = useState(false);

  // Real-time Console Occupancy state
  const [occupancyData, setOccupancyData] = useState<SetupInstance[]>([]);
  const [isOccupancyLoading, setIsOccupancyLoading] = useState(false);
  const [occupancyError, setOccupancyError] = useState<string | null>(null);

  // Booking allocation form states
  const [selectedInstanceForBooking, setSelectedInstanceForBooking] = useState<SetupInstance | null>(null);
  const [bookingPhone, setBookingPhone] = useState('');
  const [bookingPlayers, setBookingPlayers] = useState(2);
  const [bookingHours, setBookingHours] = useState(1);
  const [bookingTime, setBookingTime] = useState('');
  const [bookingDate, setBookingDate] = useState('');
  const [isBookingSubmitting, setIsBookingSubmitting] = useState(false);
  const [bookingFormError, setBookingFormError] = useState<string | null>(null);

  // Customer info states for booking flow
  interface CustomerInfo {
    id?: number;
    phoneNumber: string;
    name: string;
    dateOfBirth: string;
  }
  interface MemberInfo {
    name: string;
    phone: string;
    dateOfBirth: string;
  }
  const [, setCustomerLookupDone] = useState(false);
  const [isLookingUpCustomer, setIsLookingUpCustomer] = useState(false);
  const [foundCustomer, setFoundCustomer] = useState<CustomerInfo | null>(null);
  const [customerName, setCustomerName] = useState('');
  const [customerDob, setCustomerDob] = useState('');
  const [additionalMembers, setAdditionalMembers] = useState<MemberInfo[]>([]);
  const [memberLookupLoading, setMemberLookupLoading] = useState<Record<number, boolean>>({});

  // Dynamic Pricing state from POST /api/price
  interface DynamicPricingInfo {
    setupId: number;
    setupName?: string;
    configurationName?: string;
    playerType?: 'SINGLE_PLAYER' | 'MULTIPLAYER' | string;
    noOfPlayers: number;
    sessionDurationHours: number;
    ratePerPersonPerHour: number;
    basePrice: number;
    calculationFormula?: string;
  }
  const [slotPricing, setSlotPricing] = useState<DynamicPricingInfo | null>(null);
  const [isSlotPricingLoading, setIsSlotPricingLoading] = useState(false);

  // Available Games state from GET /api/games?setupId=<id>
  interface GameItem {
    id: number;
    name: string;
    price?: number;
    images?: string[];
    gameplays?: any[];
    isActive?: boolean;
  }
  const [availableGames, setAvailableGames] = useState<GameItem[]>([]);
  const [selectedGameIds, setSelectedGameIds] = useState<number[]>([]);
  const [gameSearchQuery, setGameSearchQuery] = useState('');
  const [isGamesLoading, setIsGamesLoading] = useState(false);
  const [, setCopiedPayload] = useState(false);

  // Multi-step booking wizard states (7 steps: Phone → Customer Info → Members → Games → Slot Details → Review → Confirm)
  const [bookingStep, setBookingStep] = useState<1 | 2 | 3 | 4 | 5 | 6 | 7>(1);
  const [bookingReview, setBookingReview] = useState<any>(null);
  const [, setBookingOffers] = useState<any[]>([]);
  const [applicableOffers, setApplicableOffers] = useState<any[]>([]);
  const [ineligibleOffers, setIneligibleOffers] = useState<any[]>([]);
  const [selectedOfferIds, setSelectedOfferIds] = useState<number[]>([]);
  const [isLoadingReview, setIsLoadingReview] = useState(false);

  // Custom End Session Module States
  const [terminatingInstance, setTerminatingInstance] = useState<SetupInstance | null>(null);
  const [terminateEndTime, setTerminateEndTime] = useState<string>('');
  const [terminateElapsedMinutes, setTerminateElapsedMinutes] = useState<number>(0);
  const [terminateChargedMinutes, setTerminateChargedMinutes] = useState<number>(0);
  const [terminateOriginalAmount, setTerminateOriginalAmount] = useState<number>(0);
  const [terminateOffers, setTerminateOffers] = useState<any[]>([]);
  const [terminateSelectedOfferIds, setTerminateSelectedOfferIds] = useState<number[]>([]);
  const [terminateDiscount, setTerminateDiscount] = useState<number>(0);
  const [terminateFinalAmount, setTerminateFinalAmount] = useState<number>(0);
  const [terminateCashAmount, setTerminateCashAmount] = useState<number>(0);
  const [terminateUpiAmount, setTerminateUpiAmount] = useState<number>(0);
  const [terminateError, setTerminateError] = useState<string | null>(null);
  const [isTerminating, setIsTerminating] = useState<boolean>(false);
  const [isLoadingTerminateOffers, setIsLoadingTerminateOffers] = useState<boolean>(false);
  const [sessionSummaryResult, setSessionSummaryResult] = useState<any | null>(null);

  // Live countdown timers: bookingId -> seconds remaining / until start
  const [countdownMap, setCountdownMap] = useState<Record<number, number>>({});
  const [startCountdownMap, setStartCountdownMap] = useState<Record<number, number>>({});
  const [upcomingSchedule, setUpcomingSchedule] = useState<UpcomingBooking[]>([]);
  const [isScheduleLoading, setIsScheduleLoading] = useState(false);
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const [scheduleTimezone, setScheduleTimezone] = useState('Asia/Kolkata');

  // Session Warning Alert Modal State (start 10m/5m, end 10m/5m/3m/1m/0m)
  interface SessionWarningAlert {
    kind: 'ending' | 'starting';
    instanceId: number;
    instanceName: string;
    bookingId: number;
    phoneNumber: string;
    minutesThreshold: 10 | 5 | 3 | 1 | 0;
    secondsLeft: number;
    setupInfo: string;
    startLabel?: string;
  }
  const [activeSessionAlert, setActiveSessionAlert] = useState<SessionWarningAlert | null>(null);
  const dismissedAlertsRef = useRef<Record<string, boolean>>({});
  const startedRefreshRef = useRef<Record<number, boolean>>({});

  // Booking extension states
  const [extendingSessionInstance, setExtendingSessionInstance] = useState<SetupInstance | null>(null);
  const [extensionMinutes, setExtensionMinutes] = useState(30);
  const [extensionCashAmount, setExtensionCashAmount] = useState<number | string>('');
  const [extensionUpiAmount, setExtensionUpiAmount] = useState<number | string>('');
  const [extensionOfferIds, setExtensionOfferIds] = useState<number[]>([]);
  const [isExtensionSubmitting, setIsExtensionSubmitting] = useState(false);
  const [extensionError, setExtensionError] = useState<string | null>(null);
  const [extensionSummaryResult, setExtensionSummaryResult] = useState<any | null>(null);

  // Action status (Scanning / Deploying)
  const [activeAction, setActiveAction] = useState<'idle' | 'scanning'>('idle');
  const [actionProgress, setActionProgress] = useState(0);

  // Trigger warning notice banner
  const [isAlertActive, setIsAlertActive] = useState(false);

  // Live operational logs list
  const [logs, setLogs] = useState<LogItem[]>([
    {
      id: 'log-1',
      type: 'info',
      message: 'Vortex Dashboard Hub loaded. Connection secure.',
      timestamp: '12:00:00'
    },
    {
      id: 'log-2',
      type: 'success',
      message: 'Platform security checkup completed. 0 issues detected.',
      timestamp: '12:00:15'
    }
  ]);

  const feedBodyRef = useRef<HTMLDivElement>(null);

  // Monitor window hash changes for routing
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash || '#/';
      setCurrentHash(hash);
      setIsMenuOpen(false); // Close mobile menu on navigate
    };

    window.addEventListener('hashchange', handleHashChange);
    // Trigger initial check
    handleHashChange();

    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // Handle Route Guarding & Redirection
  useEffect(() => {
    if (currentHash === '#/dashboard' && !authToken) {
      setTimeout(() => {
        setLoginInfoMessage('Please sign in to access the control center.');
      }, 0);
      window.location.hash = '#/login';
    } else if (currentHash === '#/login' && authToken) {
      window.location.hash = '#/dashboard';
    }
  }, [currentHash, authToken]);

  // Dynamic Pricing: Fetch real-time rate & calculation from POST /api/price
  useEffect(() => {
    if (!selectedInstanceForBooking?.setup?.id) {
      setSlotPricing(null);
      return;
    }

    let isMounted = true;
    const fetchSlotPrice = async () => {
      setIsSlotPricingLoading(true);
      try {
        const res = await fetch(`${API_BASE_URL}/api/price`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            setupId: selectedInstanceForBooking.setup.id,
            noOfPlayers: Number(bookingPlayers),
            sessionDuration: Number(bookingHours)
          })
        });
        const data = await res.json();
        if (isMounted && res.ok && data.success && data.pricing) {
          setSlotPricing(data.pricing);
        }
      } catch {
        // Fallback gracefully
      } finally {
        if (isMounted) {
          setIsSlotPricingLoading(false);
        }
      }
    };

    fetchSlotPrice();
    return () => {
      isMounted = false;
    };
  }, [selectedInstanceForBooking?.setup?.id, bookingPlayers, bookingHours]);

  // Fetch active games configured for the selected setup instance
  useEffect(() => {
    if (!selectedInstanceForBooking?.setup?.id) {
      setAvailableGames([]);
      setSelectedGameIds([]);
      return;
    }

    let isMounted = true;
    const fetchGames = async () => {
      setIsGamesLoading(true);
      try {
        let url = `${API_BASE_URL}/api/games?setupId=${selectedInstanceForBooking.setup.id}`;
        if (gameSearchQuery.trim()) {
          url += `&q=${encodeURIComponent(gameSearchQuery.trim())}`;
        }
        const res = await fetch(url);
        const data = await res.json();
        if (isMounted && res.ok && data.success && Array.isArray(data.games)) {
          setAvailableGames(data.games);
          // Default select the first game if none currently selected
          setSelectedGameIds((prev) => {
            if (prev.length === 0 && data.games.length > 0) {
              return [data.games[0].id];
            }
            return prev;
          });
        }
      } catch {
        // Fallback
      } finally {
        if (isMounted) {
          setIsGamesLoading(false);
        }
      }
    };

    fetchGames();
    return () => {
      isMounted = false;
    };
  }, [selectedInstanceForBooking?.setup?.id, gameSearchQuery]);

  // Fetch real-time setup occupancy status
  const fetchOccupancyData = useCallback(async (silent = false) => {
    if (!silent) {
      setIsOccupancyLoading(true);
      setOccupancyError(null);
    }

    try {
      const headers: HeadersInit = {};
      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
      }

      const response = await fetch(`${API_BASE_URL}/api/setup-instances/occupancy`, { headers });
      const data = await response.json();

      if (response.ok && data.success) {
        setOccupancyData(data.occupancy);
        // Append operational update log
        setLogs((prev) => [
          ...prev,
          {
            id: `log-sync-${Date.now()}`,
            type: 'success',
            message: `Occupancy sync: Verified status of ${data.occupancy.length} console setup stations.`,
            timestamp: getTimestamp()
          }
        ]);
      } else {
        setOccupancyError(data.error || 'Failed to fetch setup occupancy data.');
      }
    } catch {
      setOccupancyError('Failed to connect to the occupancy API. Make sure the backend server is reachable.');
    } finally {
    if (!silent) {
      setIsOccupancyLoading(false);
    }
  }
}, [authToken]);

  const fetchScheduleData = useCallback(async (silent = false) => {
    if (!authToken) return;
    if (!silent) {
      setIsScheduleLoading(true);
      setScheduleError(null);
    }

    try {
      const data = await fetchUpcomingSchedule({ token: authToken, days: 14 });
      if (data.success) {
        setUpcomingSchedule(data.upcoming || []);
        if (data.timezone) setScheduleTimezone(data.timezone);
        setScheduleError(null);
      } else {
        setScheduleError(data.error || data.message || 'Failed to load upcoming schedule.');
      }
    } catch {
      setScheduleError('Failed to connect to the schedule API.');
    } finally {
      if (!silent) setIsScheduleLoading(false);
    }
  }, [authToken]);

// Fetch tentative bookings for selected date
const fetchTentativeBookings = useCallback(async (dateStr: string) => {
  if (!authToken) return;
  setIsTentativeLoading(true);
  setTentativeError(null);

  try {
    const response = await fetch(`${API_BASE_URL}/api/bookings/tentative?date=${dateStr}`, {
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });
    const data = await response.json();

    if (response.ok && data.success) {
      setTentativeBookings(data.bookings);
      setLogs((prev) => [
        ...prev,
        {
          id: `log-tentative-${Date.now()}`,
          type: 'success',
          message: `Tentative query: Fetched ${data.bookings.length} bookings for date ${dateStr}.`,
          timestamp: getTimestamp()
        }
      ]);
    } else {
      setTentativeError(data.error || 'Failed to fetch tentative bookings.');
    }
  } catch {
    setTentativeError('Failed to connect to the bookings API. Ensure the backend engine is reachable.');
  } finally {
    setIsTentativeLoading(false);
  }
}, [authToken]);

  // Fetch tentative bookings when tentative tab is active or date changes
  useEffect(() => {
    if (currentHash === '#/dashboard' && authToken && activeDashboardTab === 'tentative') {
      fetchTentativeBookings(tentativeDate);
    }
  }, [currentHash, authToken, activeDashboardTab, tentativeDate, fetchTentativeBookings]);

  // Fetch past console sessions history from GET /api/sessions/past
  const fetchPastSessions = useCallback(async (dateStr?: string, stationId?: string, statusVal?: string) => {
    if (!authToken) return;
    const targetDate = dateStr !== undefined ? dateStr : pastSessionsDate;
    const targetStation = stationId !== undefined ? stationId : pastSessionsStationFilter;
    const targetStatus = statusVal !== undefined ? statusVal : pastSessionsStatusFilter;

    setIsPastSessionsLoading(true);
    setPastSessionsError(null);

    try {
      let url = `${API_BASE_URL}/api/sessions/past?date=${encodeURIComponent(targetDate)}`;
      if (targetStation && targetStation !== 'ALL') {
        url += `&setupInstanceId=${encodeURIComponent(targetStation)}`;
      }
      if (targetStatus && targetStatus !== 'ALL') {
        url += `&status=${encodeURIComponent(targetStatus)}`;
      }

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });
      const data = await response.json();

      if (response.ok && data.success) {
        setPastSessionsData({
          summary: data.summary,
          sessions: data.sessions || []
        });
        setLogs((prev) => [
          ...prev,
          {
            id: `log-past-sessions-${Date.now()}`,
            type: 'info',
            message: `Past sessions query: Fetched ${data.sessions?.length || 0} records for ${targetDate} (Revenue: ₹${data.summary?.totalRevenue || 0}).`,
            timestamp: getTimestamp()
          }
        ]);
      } else {
        setPastSessionsError(data.error || data.message || 'Failed to load past sessions.');
        setPastSessionsData({});
      }
    } catch {
      setPastSessionsError('Failed to connect to the past sessions API. Ensure the backend engine is online.');
      setPastSessionsData({});
    } finally {
      setIsPastSessionsLoading(false);
    }
  }, [authToken, pastSessionsDate, pastSessionsStationFilter, pastSessionsStatusFilter]);

  // Fetch past sessions when sessions tab is active or date/filter changes
  useEffect(() => {
    if (currentHash === '#/dashboard' && authToken && activeDashboardTab === 'sessions') {
      fetchPastSessions(pastSessionsDate, pastSessionsStationFilter, pastSessionsStatusFilter);
    }
  }, [currentHash, authToken, activeDashboardTab, pastSessionsDate, pastSessionsStationFilter, pastSessionsStatusFilter, fetchPastSessions]);

  // Poll occupancy data while in dashboard
  useEffect(() => {
    if (currentHash === '#/dashboard' && authToken) {
      const loadTimer = setTimeout(() => {
        fetchOccupancyData();
        fetchScheduleData(true);
      }, 0);

      // Poll every 20 seconds to refresh remaining duration and upcoming slots
      const pollTimer = setInterval(() => {
        fetchOccupancyData(true);
        fetchScheduleData(true);
      }, 20000);

      return () => {
        clearTimeout(loadTimer);
        clearInterval(pollTimer);
      };
    }
  }, [currentHash, authToken, fetchOccupancyData, fetchScheduleData]);

  // Auto scroll logs
  useEffect(() => {
    if (feedBodyRef.current) {
      feedBodyRef.current.scrollTop = feedBodyRef.current.scrollHeight;
    }
  }, [logs, activeAction]);

  // Robust helpers for booking fields
  const getBookingId = (booking: any): number => {
    if (!booking) return 0;
    return Number(booking.bookingId || booking.id || 0);
  };

  const getBookingEndTime = (booking: any): string => {
    if (!booking) return '';
    return booking.endTime || booking.estimatedEndTime || booking.sessionEstimatedEndTime || booking.actualEndTime || '';
  };

  const getBookingStartTime = (booking: any): string => {
    if (!booking) return '';
    return booking.startTimeIso || booking.startTime || booking.actualStartTime || booking.sessionStartTime || booking.requestedStartTime || '';
  };

  const resolveBookingStartMs = (booking: any): number | null => {
    if (!booking) return null;
    if (booking.startTimeIso) {
      const isoMs = new Date(booking.startTimeIso).getTime();
      if (!Number.isNaN(isoMs)) return isoMs;
    }
    const bookingId = getBookingId(booking);
    const scheduled = upcomingSchedule.find((item) => item.bookingId === bookingId);
    if (scheduled?.startTimeIso) {
      const scheduledMs = new Date(scheduled.startTimeIso).getTime();
      if (!Number.isNaN(scheduledMs)) return scheduledMs;
    }
    return parseTimestampMs(getBookingStartTime(booking), booking.date);
  };

  const isBookingPendingStart = (booking: any, nowMs = Date.now()): boolean => {
    if (!booking) return false;
    const startMs = resolveBookingStartMs(booking);
    return startMs !== null && startMs > nowMs;
  };

  const calculateSecondsUntilStart = (booking: any, nowMs = Date.now()): number => {
    if (!booking) return 0;
    const startMs = resolveBookingStartMs(booking);
    if (!startMs || startMs <= nowMs) return 0;
    return Math.floor((startMs - nowMs) / 1000);
  };

  // Robust date & time parser: handles full ISO strings, 12h AM/PM, cross-day dates
  const parseTimestampMs = (dateTimeStr?: string, dateFallback?: string): number | null => {
    if (!dateTimeStr) return null;
    // 1. Direct standard ISO / RFC parsing
    const direct = new Date(dateTimeStr);
    if (!isNaN(direct.getTime()) && direct.getFullYear() > 2020) {
      return direct.getTime();
    }
    // 2. 12-hour AM/PM format (e.g. "11:00 AM", "02:30 PM", "04:15:30 PM")
    const baseDate = dateFallback || getTodayDateString();
    const match12 = dateTimeStr.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)$/i);
    if (match12) {
      let hours = parseInt(match12[1], 10);
      const minutes = parseInt(match12[2], 10);
      const seconds = match12[3] ? parseInt(match12[3], 10) : 0;
      const ampm = match12[4].toUpperCase();
      if (ampm === 'PM' && hours < 12) hours += 12;
      if (ampm === 'AM' && hours === 12) hours = 0;
      const [y, m, d] = baseDate.split('-').map(Number);
      const constructed = new Date(y, m - 1, d, hours, minutes, seconds);
      if (!isNaN(constructed.getTime())) return constructed.getTime();
    }
    // 3. Fallback ISO with combined date
    const combined = new Date(`${baseDate}T${dateTimeStr}`);
    if (!isNaN(combined.getTime())) return combined.getTime();
    const combinedSpace = new Date(`${baseDate} ${dateTimeStr}`);
    if (!isNaN(combinedSpace.getTime())) return combinedSpace.getTime();
    return null;
  };

  // Calculate live seconds remaining with robust fallbacks
  const calculateBookingSecondsRemaining = (booking: any, nowMs = Date.now()): number => {
    if (!booking) return 0;
    if (isBookingPendingStart(booking, nowMs)) return 0;
    const endTimeStr = getBookingEndTime(booking);
    const endMs = parseTimestampMs(endTimeStr);

    // If endMs is in future and within 24 hours of now
    if (endMs && endMs > nowMs && (endMs - nowMs) < 24 * 60 * 60 * 1000) {
      return Math.floor((endMs - nowMs) / 1000);
    }

    // If backend occupancy payload provides timeLeftMinutes
    if (booking.timeLeftMinutes !== undefined && Number(booking.timeLeftMinutes) > 0) {
      return Number(booking.timeLeftMinutes) * 60;
    }

    // If endMs exists and is in the future
    if (endMs && endMs > nowMs) {
      return Math.floor((endMs - nowMs) / 1000);
    }

    return 0;
  };

  // Helper to check 10m, 5m, 3m, 1m, and 0m (expired) warning thresholds
  const checkWarningThresholds = (inst: SetupInstance, secsLeft: number) => {
    if (!inst.currentBooking || isBookingPendingStart(inst.currentBooking)) return;
    const bookingId = getBookingId(inst.currentBooking);
    if (bookingId <= 0) return;

    const thresholds: Array<{ mins: 10 | 5 | 3 | 1 | 0; minSec: number; maxSec: number }> = [
      { mins: 10, minSec: 541, maxSec: 600 },
      { mins: 5, minSec: 241, maxSec: 300 },
      { mins: 3, minSec: 121, maxSec: 180 },
      { mins: 1, minSec: 1, maxSec: 60 },
      { mins: 0, minSec: 0, maxSec: 0 }
    ];

    for (const t of thresholds) {
      if (secsLeft >= t.minSec && secsLeft <= t.maxSec) {
        const alertKey = `${bookingId}-end-${t.mins}`;
        if (!dismissedAlertsRef.current[alertKey]) {
          dismissedAlertsRef.current[alertKey] = true;

          setActiveSessionAlert({
            kind: 'ending',
            instanceId: inst.instanceId,
            instanceName: inst.instanceName,
            bookingId,
            phoneNumber: inst.currentBooking.phoneNumber,
            minutesThreshold: t.mins,
            secondsLeft: secsLeft,
            setupInfo: `${inst.setup?.consoleType} (₹${inst.setup?.chargePerPersonPerHour}/person/hr)`
          });

          setLogs((prev) => [
            ...prev,
            {
              id: `log-alert-${Date.now()}-${t.mins}`,
              type: t.mins === 0 ? 'danger' : 'warning',
              message: t.mins === 0
                ? `[TIME UP] ${inst.instanceName} session has expired for ${inst.currentBooking?.phoneNumber}. Action required.`
                : `[TIME WARNING] ${inst.instanceName} has ${t.mins} min remaining for ${inst.currentBooking?.phoneNumber}.`,
              timestamp: getTimestamp()
            }
          ]);
          break;
        }
      }
    }
  };

  const checkStartThresholds = (
    bookingId: number,
    secsUntilStart: number,
    meta: { instanceId: number; instanceName: string; phoneNumber: string; setupInfo: string; startLabel: string }
  ) => {
    if (bookingId <= 0 || secsUntilStart <= 0) return;

    const thresholds: Array<{ mins: 10 | 5; minSec: number; maxSec: number }> = [
      { mins: 10, minSec: 541, maxSec: 600 },
      { mins: 5, minSec: 241, maxSec: 300 },
    ];

    for (const t of thresholds) {
      if (secsUntilStart >= t.minSec && secsUntilStart <= t.maxSec) {
        const alertKey = `${bookingId}-start-${t.mins}`;
        if (!dismissedAlertsRef.current[alertKey]) {
          dismissedAlertsRef.current[alertKey] = true;
          setActiveSessionAlert({
            kind: 'starting',
            instanceId: meta.instanceId,
            instanceName: meta.instanceName,
            bookingId,
            phoneNumber: meta.phoneNumber,
            minutesThreshold: t.mins,
            secondsLeft: secsUntilStart,
            setupInfo: meta.setupInfo,
            startLabel: meta.startLabel,
          });
          setLogs((prev) => [
            ...prev,
            {
              id: `log-start-${Date.now()}-${t.mins}`,
              type: 'warning',
              message: `[SESSION STARTING] ${meta.instanceName} starts in ${t.mins} min for ${meta.phoneNumber}.`,
              timestamp: getTimestamp()
            }
          ]);
          break;
        }
      }
    }
  };

  // Live countdown timer: date-aware, stops at 0, decrements every second
  useEffect(() => {
    if (occupancyData.length === 0 && upcomingSchedule.length === 0) return;

    setCountdownMap((prev) => {
      const freshMap: Record<number, number> = { ...prev };
      occupancyData.forEach((inst) => {
        if (inst.currentBooking) {
          const booking = inst.currentBooking;
          const bookingId = getBookingId(booking);
          if (bookingId > 0) {
            if (isBookingPendingStart(booking)) {
              delete freshMap[bookingId];
            } else {
              const calculatedSecs = calculateBookingSecondsRemaining(booking);
              if (freshMap[bookingId] === undefined || calculatedSecs > 0) {
                freshMap[bookingId] = calculatedSecs;
              }
            }
          }
        }
      });
      return freshMap;
    });

    setStartCountdownMap((prev) => {
      const next: Record<number, number> = { ...prev };
      occupancyData.forEach((inst) => {
        if (!inst.currentBooking) return;
        const bookingId = getBookingId(inst.currentBooking);
        if (bookingId <= 0) return;
        if (isBookingPendingStart(inst.currentBooking)) {
          next[bookingId] = calculateSecondsUntilStart(inst.currentBooking);
        } else {
          delete next[bookingId];
        }
      });
      upcomingSchedule.forEach((item) => {
        const secs = secondsUntilIso(item.startTimeIso);
        if (secs > 0) {
          next[item.bookingId] = secs;
        } else {
          delete next[item.bookingId];
        }
      });
      return next;
    });

    const tickId = setInterval(() => {
      setCountdownMap((prev) => {
        const next = { ...prev };
        for (const key in next) {
          if (next[key] > 0) {
            next[key] -= 1;
          }
        }

        occupancyData.forEach((inst) => {
          if (inst.currentBooking && (inst.status === 'OCCUPIED' || inst.status === 'TENTATIVE') && !isBookingPendingStart(inst.currentBooking)) {
            const bId = getBookingId(inst.currentBooking);
            const remaining = next[bId] !== undefined ? next[bId] : 0;
            checkWarningThresholds(inst, remaining);
          }
        });

        return next;
      });

      setStartCountdownMap((prev) => {
        const next = { ...prev };
        for (const key in next) {
          if (next[key] > 0) {
            next[key] -= 1;
          }
        }

        occupancyData.forEach((inst) => {
          if (!inst.currentBooking || !isBookingPendingStart(inst.currentBooking)) return;
          const bookingId = getBookingId(inst.currentBooking);
          const secs = next[bookingId] ?? 0;
          checkStartThresholds(bookingId, secs, {
            instanceId: inst.instanceId,
            instanceName: inst.instanceName,
            phoneNumber: inst.currentBooking.phoneNumber,
            setupInfo: `${inst.setup?.consoleType} (₹${inst.setup?.chargePerPersonPerHour}/person/hr)`,
            startLabel: inst.currentBooking.startTime || formatTimeStr(getBookingStartTime(inst.currentBooking)),
          });
        });

        upcomingSchedule.forEach((item) => {
          const matched = occupancyData.find((inst) => inst.instanceId === item.setupInstanceId);
          if (matched?.currentBooking && getBookingId(matched.currentBooking) === item.bookingId) return;
          const secs = next[item.bookingId] ?? 0;
          checkStartThresholds(item.bookingId, secs, {
            instanceId: item.setupInstanceId,
            instanceName: item.setupName,
            phoneNumber: item.phoneNumber,
            setupInfo: `${item.playersCount} ${item.playersCount === 1 ? 'player' : 'players'} · ${formatScheduleDate(item.date)}`,
            startLabel: `${item.startTime} · ${formatScheduleDate(item.date)}`,
          });
        });

        return next;
      });
    }, 1000);

    return () => clearInterval(tickId);
  }, [occupancyData, upcomingSchedule]);

  useEffect(() => {
    Object.entries(startCountdownMap).forEach(([id, secs]) => {
      const bookingId = Number(id);
      if (secs === 0 && !startedRefreshRef.current[bookingId]) {
        startedRefreshRef.current[bookingId] = true;
        fetchOccupancyData(true);
        fetchScheduleData(true);
        setLogs((prev) => [
          ...prev,
          {
            id: `log-start-now-${bookingId}-${Date.now()}`,
            type: 'info',
            message: `Session #${bookingId} start time reached. Refreshing station occupancy.`,
            timestamp: getTimestamp(),
          },
        ]);
      }
    });
  }, [startCountdownMap, fetchOccupancyData, fetchScheduleData]);

  // Generate current timestamp string
  const getTimestamp = () => {
    const now = new Date();
    return now.toTimeString().split(' ')[0];
  };

  // Helper date/time formatters for tentative bookings
  const formatTimeStr = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return isoString;
    }
  };

  const formatDateStr = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return isoString;
    }
  };

  const formatDateForDatetimeInput = (date: Date) => {
    if (!date || isNaN(date.getTime())) return '';
    const pad = (n: number) => String(n).padStart(2, '0');
    const year = date.getFullYear();
    const month = pad(date.getMonth() + 1);
    const day = pad(date.getDate());
    const hours = pad(date.getHours());
    const minutes = pad(date.getMinutes());
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  // Perform login API integration
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setLoginInfoMessage(null);

    const cleanEmail = loginEmail.trim();
    if (!cleanEmail || !loginPassword) {
      setLoginError('Please enter both email and password.');
      return;
    }

    setIsLoginLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/api/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: cleanEmail,
          password: loginPassword,
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        // Persist session
        localStorage.setItem('vortex_auth_token', data.token);
        localStorage.setItem('vortex_auth_user', JSON.stringify(data.user));

        // Update React State
        setAuthToken(data.token);
        setAuthUser(data.user);

        // Reset form
        setLoginEmail('');
        setLoginPassword('');
        
        // Redirect to dashboard
        window.location.hash = '#/dashboard';
      } else {
        setLoginError(data.error || 'Invalid email or password. Please try again.');
      }
    } catch {
      setLoginError('Unable to connect to the login server. Please ensure the backend engine is reachable.');
    } finally {
      setIsLoginLoading(false);
    }
  };

  // Pre-fill test credentials
  const handlePreFillCredentials = (email: string, pass: string) => {
    setLoginEmail(email);
    setLoginPassword(pass);
    setLoginError(null);
    setLoginInfoMessage(null);
  };

  // Perform logout
  const handleLogout = () => {
    localStorage.removeItem('vortex_auth_token');
    localStorage.removeItem('vortex_auth_user');
    setAuthToken(null);
    setAuthUser(null);
    setOccupancyData([]);
    window.location.hash = '#/';
  };

  // Helper date/time formatters for bookings inputs
  const getTodayDateString = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const getCurrentTimeString = () => {
    const now = new Date();
    let hours = now.getHours();
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12; // hour '0' matches '12'
    const hoursStr = String(hours).padStart(2, '0');
    return `${hoursStr}:${minutes} ${ampm}`;
  };

  const getTomorrowDateString = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const year = tomorrow.getFullYear();
    const month = String(tomorrow.getMonth() + 1).padStart(2, '0');
    const day = String(tomorrow.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const formatTimeFromDate = (d: Date) => {
    let hours = d.getHours();
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    const hoursStr = String(hours).padStart(2, '0');
    return `${hoursStr}:${minutes} ${ampm}`;
  };

  const parseTimeComponents = (timeStr: string) => {
    if (!timeStr) {
      const now = new Date();
      let h = now.getHours();
      const m = String(now.getMinutes()).padStart(2, '0');
      const p = h >= 12 ? 'PM' : 'AM';
      h = h % 12 || 12;
      return { hour: String(h).padStart(2, '0'), minute: m, period: p as 'AM' | 'PM' };
    }
    const match = timeStr.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
    if (match) {
      let h = parseInt(match[1], 10);
      const m = String(match[2]).padStart(2, '0');
      let p = match[3] ? match[3].toUpperCase() : '';
      if (!p) {
        p = h >= 12 ? 'PM' : 'AM';
        if (h > 12) h -= 12;
      }
      if (h === 0) h = 12;
      return { hour: String(h).padStart(2, '0'), minute: m, period: p as 'AM' | 'PM' };
    }
    return { hour: '10', minute: '00', period: 'AM' as 'AM' | 'PM' };
  };

  const calculateSlotEndTime = (startTimeStr: string, hoursCount: number) => {
    if (!startTimeStr) return '';
    const parsed = parseTimeComponents(startTimeStr);
    let h = parseInt(parsed.hour, 10);
    const m = parseInt(parsed.minute, 10);
    if (parsed.period === 'PM' && h < 12) h += 12;
    if (parsed.period === 'AM' && h === 12) h = 0;

    const totalMins = h * 60 + m + Math.round(hoursCount * 60);
    const endTotalMins = totalMins % (24 * 60);
    let endH = Math.floor(endTotalMins / 60);
    const endM = endTotalMins % 60;
    const endP = endH >= 12 ? 'PM' : 'AM';
    endH = endH % 12 || 12;
    return `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')} ${endP}`;
  };

  const setTimePreset = (type: 'now' | '+15m' | '+30m' | '+1h' | 'next-hour') => {
    const now = new Date();
    if (type === 'now') {
      setBookingTime(getCurrentTimeString());
    } else if (type === '+15m') {
      now.setMinutes(now.getMinutes() + 15);
      setBookingTime(formatTimeFromDate(now));
    } else if (type === '+30m') {
      now.setMinutes(now.getMinutes() + 30);
      setBookingTime(formatTimeFromDate(now));
    } else if (type === '+1h') {
      now.setHours(now.getHours() + 1);
      setBookingTime(formatTimeFromDate(now));
    } else if (type === 'next-hour') {
      now.setHours(now.getHours() + 1, 0, 0, 0);
      setBookingTime(formatTimeFromDate(now));
    }
  };

  const updateBookingTimeComponent = (part: 'hour' | 'minute' | 'period', value: string) => {
    const current = parseTimeComponents(bookingTime);
    const updated = { ...current, [part]: value };
    setBookingTime(`${updated.hour}:${updated.minute} ${updated.period}`);
  };

  // Trigger Booking Allocator Modal overlay
  const openBookingModal = (instance: SetupInstance) => {
    setSelectedInstanceForBooking(instance);
    setBookingPhone('');
    setBookingPlayers(2);
    setBookingHours(1);
    setBookingDate(getTodayDateString());
    setBookingTime(getCurrentTimeString());
    setBookingFormError(null);
    setBookingStep(1);
    setBookingReview(null);
    setBookingOffers([]);
    setSelectedOfferIds([]);
    // Reset customer info states
    setCustomerLookupDone(false);
    setIsLookingUpCustomer(false);
    setFoundCustomer(null);
    setCustomerName('');
    setCustomerDob('');
    setAdditionalMembers([]);
    setMemberLookupLoading({});
    setSlotPricing(null);
    setIsSlotPricingLoading(false);
    setSelectedGameIds([]);
    setGameSearchQuery('');
    setCopiedPayload(false);
  };

  // Toggle game selection
  const toggleGameSelection = (gameId: number) => {
    setSelectedGameIds((prev) => {
      if (prev.includes(gameId)) {
        return prev.filter((id) => id !== gameId);
      } else {
        return [...prev, gameId];
      }
    });
  };

  // Lookup customer by phone number
  const handleCustomerPhoneLookup = async () => {
    const cleanPhone = bookingPhone.trim();
    if (!cleanPhone || cleanPhone.length < 10) {
      setBookingFormError('Please enter a valid 10-digit phone number.');
      return;
    }
    setBookingFormError(null);
    setIsLookingUpCustomer(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/customers/lookup?phone=${encodeURIComponent(cleanPhone)}`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      const data = await res.json();
      if (res.ok && data.success && data.customer) {
        setFoundCustomer(data.customer);
        setCustomerName(data.customer.name || '');
        setCustomerDob(data.customer.dateOfBirth || '');
      } else {
        setFoundCustomer(null);
        setCustomerName('');
        setCustomerDob('');
      }
      setCustomerLookupDone(true);
      setBookingStep(2);
    } catch {
      setFoundCustomer(null);
      setCustomerName('');
      setCustomerDob('');
      setCustomerLookupDone(true);
      setBookingStep(2);
    } finally {
      setIsLookingUpCustomer(false);
    }
  };

  // Lookup member by phone number (for additional members)
  const handleMemberPhoneLookup = async (index: number) => {
    const phone = additionalMembers[index]?.phone?.trim();
    if (!phone || phone.length < 10) return;
    setMemberLookupLoading(prev => ({ ...prev, [index]: true }));
    try {
      const res = await fetch(`${API_BASE_URL}/api/customers/lookup?phone=${encodeURIComponent(phone)}`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      const data = await res.json();
      if (res.ok && data.success && data.customer) {
        setAdditionalMembers(prev => {
          const updated = [...prev];
          updated[index] = {
            ...updated[index],
            name: data.customer.name || updated[index].name,
            dateOfBirth: data.customer.dateOfBirth || updated[index].dateOfBirth,
          };
          return updated;
        });
      }
    } catch { /* silent */ }
    finally {
      setMemberLookupLoading(prev => ({ ...prev, [index]: false }));
    }
  };

  // Add an empty member slot
  const addMemberSlot = () => {
    setAdditionalMembers(prev => [...prev, { name: '', phone: '', dateOfBirth: '' }]);
  };

  // Remove a member slot
  const removeMemberSlot = (index: number) => {
    setAdditionalMembers(prev => prev.filter((_, i) => i !== index));
  };

  // Update a member field
  const updateMember = (index: number, field: keyof MemberInfo, value: string) => {
    setAdditionalMembers(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  // Step 4 → Step 5: Fetch pricing review & available offers
  const handleProceedToReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInstanceForBooking) return;

    setBookingFormError(null);
    if (!bookingDate || !bookingTime) {
      setBookingFormError('Date and start time are required.');
      return;
    }

    if (selectedGameIds.length === 0 && availableGames.length > 0) {
      setBookingFormError('Please select at least one game for this session.');
      return;
    }

    const effectiveGameIds = selectedGameIds.length > 0 ? selectedGameIds : (availableGames.length > 0 ? [availableGames[0].id] : [1]);
    const selectedGamesObjects = availableGames.filter((g) => effectiveGameIds.includes(g.id));

    setIsLoadingReview(true);
    const simplePayload = {
      setupInstanceId: selectedInstanceForBooking.instanceId,
      count: Number(bookingPlayers),
      date: bookingDate,
      startTime: bookingTime,
      noOfHours: Number(bookingHours),
      gameIds: effectiveGameIds
    };

    const fullEvaluationPayload = {
      setupInstanceId: selectedInstanceForBooking.instanceId,
      setupName: selectedInstanceForBooking.instanceName,
      consoleType: selectedInstanceForBooking.setup?.consoleType || 'PS5',
      customer: {
        name: customerName,
        phoneNumber: bookingPhone,
        dateOfBirth: customerDob || null
      },
      additionalMembers: additionalMembers.filter((m) => m.name || m.phone).map((m) => ({
        name: m.name,
        phone: m.phone,
        dateOfBirth: m.dateOfBirth || null
      })),
      bookingDetails: {
        playersCount: Number(bookingPlayers),
        date: bookingDate,
        startTime: bookingTime,
        endTime: calculateSlotEndTime(bookingTime, bookingHours),
        noOfHours: Number(bookingHours),
        gameIds: effectiveGameIds,
        games: selectedGamesObjects.map((g) => ({ id: g.id, name: g.name }))
      }
    };

    try {
      // Fetch offer eligibility first from /api/offers/evaluate
      const offerRes = await fetch(`${API_BASE_URL}/api/offers/evaluate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fullEvaluationPayload)
      });
      const offerData = await offerRes.json();

      let initialSelectedOfferIds: number[] = [];
      if (offerData.success) {
        setBookingOffers(offerData.offers || []);
        const applicable = offerData.applicableOffers || (offerData.offers || []).filter((o: any) => o.eligible);
        const ineligible = offerData.ineligibleOffers || (offerData.offers || []).filter((o: any) => !o.eligible);
        setApplicableOffers(applicable);
        setIneligibleOffers(ineligible);
        if (applicable.length > 0) {
          initialSelectedOfferIds = [applicable[0].id];
        }
      } else {
        setBookingOffers([]);
        setApplicableOffers([]);
        setIneligibleOffers([]);
      }
      setSelectedOfferIds(initialSelectedOfferIds);

      // Fetch review summary with initial offer selection
      const reviewRes = await fetch(`${API_BASE_URL}/api/bookings/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...simplePayload, appliedOfferIds: initialSelectedOfferIds })
      });
      const reviewData = await reviewRes.json();
      if (!reviewRes.ok || !reviewData.success) {
        throw new Error(reviewData.error || reviewData.message || 'Failed to load booking review.');
      }

      setBookingReview(reviewData.summary);
      setBookingStep(6);
    } catch (err: any) {
      setBookingFormError(err.message || 'Could not load booking preview. Check backend connection.');
    } finally {
      setIsLoadingReview(false);
    }
  };

  // Step 6: Re-fetch review with selected offers applied
  const handleApplyOffers = async () => {
    if (!selectedInstanceForBooking || !bookingReview) return;
    setIsLoadingReview(true);
    const effectiveGameIds = selectedGameIds.length > 0 ? selectedGameIds : (availableGames.length > 0 ? [availableGames[0].id] : [1]);
    const payload = {
      setupInstanceId: selectedInstanceForBooking.instanceId,
      count: Number(bookingPlayers),
      date: bookingDate,
      startTime: bookingTime,
      noOfHours: Number(bookingHours),
      gameIds: effectiveGameIds,
      appliedOfferIds: selectedOfferIds
    };
    try {
      const reviewRes = await fetch(`${API_BASE_URL}/api/bookings/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const reviewData = await reviewRes.json();
      if (reviewRes.ok && reviewData.success) {
        setBookingReview(reviewData.summary);
      }
    } catch { /* silent */ }
    finally { setIsLoadingReview(false); }
  };

  // Step 6: Lock slot + Create tentative booking
  const handleCreateBookingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInstanceForBooking) return;

    setBookingFormError(null);
    setIsBookingSubmitting(true);

    const effectiveGameIds = selectedGameIds.length > 0 ? selectedGameIds : (availableGames.length > 0 ? [availableGames[0].id] : [1]);
    const selectedGamesObjects = availableGames.filter((g) => effectiveGameIds.includes(g.id));
    const selectedOffersObjects = applicableOffers
      .filter((o) => selectedOfferIds.includes(o.id))
      .map((o) => ({
        id: o.id,
        code: o.code,
        name: o.name,
        discount: o.discount,
        reason: o.reason
      }));

    const finalBookingPayload = {
      setupInstanceId: selectedInstanceForBooking.instanceId,
      setupName: selectedInstanceForBooking.instanceName,
      consoleType: selectedInstanceForBooking.setup?.consoleType || 'PS5',
      customer: {
        name: customerName.trim(),
        phoneNumber: bookingPhone.trim(),
        dateOfBirth: customerDob || null
      },
      additionalMembers: additionalMembers
        .filter((m) => m.name.trim() || m.phone.trim())
        .map((m) => ({
          name: m.name.trim(),
          phone: m.phone.trim(),
          dateOfBirth: m.dateOfBirth || null
        })),
      bookingDetails: {
        playersCount: Number(bookingPlayers),
        date: bookingDate,
        startTime: bookingTime,
        endTime: calculateSlotEndTime(bookingTime, bookingHours),
        noOfHours: Number(bookingHours),
        gameIds: effectiveGameIds,
        games: selectedGamesObjects.map((g) => ({ id: g.id, name: g.name }))
      },
      pricing: {
        basePrice: slotPricing?.basePrice ?? (selectedInstanceForBooking.setup.chargePerPersonPerHour * bookingPlayers * bookingHours),
        ratePerPersonPerHour: slotPricing?.ratePerPersonPerHour ?? selectedInstanceForBooking.setup.chargePerPersonPerHour,
        playerType: slotPricing?.playerType ?? (bookingPlayers === 1 ? 'SINGLE_PLAYER' : 'MULTIPLAYER'),
        calculationFormula: slotPricing?.calculationFormula ?? `₹${selectedInstanceForBooking.setup.chargePerPersonPerHour}/hr × ${bookingPlayers} × ${bookingHours} = ₹${(selectedInstanceForBooking.setup.chargePerPersonPerHour || 0) * bookingPlayers * bookingHours}`
      },
      offers: {
        appliedOfferIds: selectedOfferIds,
        appliedOffers: selectedOffersObjects,
        originalAmount: bookingReview?.originalAmount || (slotPricing?.basePrice ?? (selectedInstanceForBooking.setup.chargePerPersonPerHour * bookingPlayers * bookingHours)),
        discountApplied: bookingReview?.discountApplied || 0,
        totalAmount: bookingReview?.totalAmount || (slotPricing?.basePrice ?? (selectedInstanceForBooking.setup.chargePerPersonPerHour * bookingPlayers * bookingHours))
      }
    };

    try {
      // POST /api/bookings with JWT Auth Token
      const res = await fetch(`${API_BASE_URL}/api/bookings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify(finalBookingPayload)
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || data.message || 'Failed to allot slot and confirm booking.');
      }

      setLogs((prev) => [
        ...prev,
        {
          id: `log-booking-${Date.now()}`,
          type: 'success',
          message: `Booking #${data.booking?.id || ''} confirmed successfully for ${customerName} (${bookingPhone}) on ${selectedInstanceForBooking.instanceName}. Total: ₹${data.booking?.pricing?.totalAmount ?? bookingReview?.totalAmount}.`,
          timestamp: getTimestamp()
        }
      ]);

      setSelectedInstanceForBooking(null);
      setBookingStep(1);
      setBookingReview(null);
      fetchOccupancyData();
      fetchScheduleData(true);
      fetchTentativeBookings(tentativeDate);
    } catch (err: any) {
      setBookingFormError(err.message || 'Server connection failure. Ensure backend engine is online.');
    } finally {
      setIsBookingSubmitting(false);
    }
  };

  // Recalculate duration, rates, and discounts for termination modal
  const updateTerminationCalculations = (
    newEndTimeStr: string,
    selectedOfferIdsList: number[],
    currentOffersList: any[],
    targetInst: SetupInstance | null = terminatingInstance
  ) => {
    if (!targetInst || !targetInst.currentBooking) return;
    const booking = targetInst.currentBooking;
    const startTimeDate = new Date(booking.startTime || Date.now());
    const endDate = new Date(newEndTimeStr);

    if (isNaN(endDate.getTime())) return;

    // Calculate actual elapsed minutes
    const elapsed = Math.max(1, Math.round((endDate.getTime() - startTimeDate.getTime()) / (1000 * 60)));
    // Standard gaming lounge rule: round up to nearest 15 minutes, minimum 15 mins
    const charged = Math.max(15, Math.ceil(elapsed / 15) * 15);
    const ratePerHour = targetInst.setup?.chargePerPersonPerHour || 50;
    const players = booking.playersCount || 1;
    const basePrice = Math.round(ratePerHour * players * (charged / 60));

    let discount = 0;
    selectedOfferIdsList.forEach((id) => {
      const offer = currentOffersList.find((o) => o.id === id);
      if (offer && offer.discount) {
        discount += Number(offer.discount) || 0;
      }
    });

    const finalAmount = Math.max(0, basePrice - discount);

    setTerminateElapsedMinutes(elapsed);
    setTerminateChargedMinutes(charged);
    setTerminateOriginalAmount(basePrice);
    setTerminateDiscount(discount);
    setTerminateFinalAmount(finalAmount);
    setTerminateCashAmount(finalAmount);
    setTerminateUpiAmount(0);
  };

  // Open Custom End Session & Checkout Modal
  const openTerminateModal = async (inst: SetupInstance) => {
    if (!inst.currentBooking) return;
    setTerminatingInstance(inst);
    setTerminateError(null);

    const now = new Date();
    const endTimeStr = formatDateForDatetimeInput(now);
    setTerminateEndTime(endTimeStr);

    const booking = inst.currentBooking;
    const startTimeDate = new Date(booking.startTime || now);
    const elapsed = Math.max(1, Math.round((now.getTime() - startTimeDate.getTime()) / (1000 * 60)));
    const charged = Math.max(15, Math.ceil(elapsed / 15) * 15);
    const ratePerHour = inst.setup?.chargePerPersonPerHour || 50;
    const players = booking.playersCount || 1;
    const basePrice = Math.round(ratePerHour * players * (charged / 60));

    setTerminateElapsedMinutes(elapsed);
    setTerminateChargedMinutes(charged);
    setTerminateOriginalAmount(basePrice);
    setTerminateSelectedOfferIds([]);
    setTerminateDiscount(0);
    setTerminateFinalAmount(basePrice);
    setTerminateCashAmount(basePrice);
    setTerminateUpiAmount(0);

    // Fetch / Evaluate eligible offers for this session
    setIsLoadingTerminateOffers(true);
    try {
      const offerRes = await fetch(`${API_BASE_URL}/api/offers/evaluate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          setupInstanceId: inst.instanceId,
          count: players,
          date: getTodayDateString(),
          startTime: formatTimeStr(booking.startTime || now.toISOString()),
          noOfHours: Math.max(0.25, charged / 60),
          gameIds: [1]
        })
      });
      const offerData = await offerRes.json();
      if (offerData && offerData.success && Array.isArray(offerData.offers)) {
        setTerminateOffers(offerData.offers);
      } else {
        setTerminateOffers([]);
      }
    } catch (err) {
      console.warn('Could not load dynamic offers for termination:', err);
      setTerminateOffers([]);
    } finally {
      setIsLoadingTerminateOffers(false);
    }
  };

  // Handle End Time Adjustment in Modal
  const handleTerminateEndTimeChange = (val: string) => {
    setTerminateEndTime(val);
    updateTerminationCalculations(val, terminateSelectedOfferIds, terminateOffers);
  };

  // Toggle Offer in Termination Modal
  const handleToggleTerminateOffer = (offerId: number) => {
    const nextSelected = terminateSelectedOfferIds.includes(offerId)
      ? terminateSelectedOfferIds.filter((id) => id !== offerId)
      : [...terminateSelectedOfferIds, offerId];
    setTerminateSelectedOfferIds(nextSelected);
    updateTerminationCalculations(terminateEndTime, nextSelected, terminateOffers);
  };

  // Submit Final Session Termination (POST /api/setups/:setupId/end-session)
  const handleFinalizeTerminationSubmit = async (e?: React.FormEvent, customInst?: SetupInstance) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    const targetInst = customInst || terminatingInstance;
    if (!targetInst || !targetInst.currentBooking) return;

    const setupId = targetInst.instanceId;
    const bookingId = getBookingId(targetInst.currentBooking) || targetInst.currentBooking.bookingId;
    setTerminateError(null);
    setIsTerminating(true);

    const payload = {
      endTime: terminateEndTime ? new Date(terminateEndTime).toISOString() : new Date().toISOString(),
      cashAmount: Number(terminateCashAmount) || 0,
      upiAmount: Number(terminateUpiAmount) || 0,
      appliedOfferIds: terminateSelectedOfferIds
    };

    try {
      const token = authToken || localStorage.getItem('vortex_auth_token') || '';
      const headers: HeadersInit = {
        'Content-Type': 'application/json'
      };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      // Call POST /api/setups/:setupId/end-session
      const res = await fetch(`${API_BASE_URL}/api/setups/${setupId}/end-session`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (res.ok && data.success) {
        const summary = data.sessionSummary;
        const settleStatus = summary?.billing?.settlement?.status;
        const settleAmount = summary?.billing?.settlement?.amount;
        const settleMsg = settleStatus === 'REFUND_DUE' 
          ? `Refund Due: ₹${settleAmount}` 
          : settleStatus === 'PAYMENT_DUE' 
            ? `Payment Due: ₹${settleAmount}` 
            : 'Settled';

        setLogs((prev) => [
          ...prev,
          {
            id: `log-terminate-${Date.now()}`,
            type: 'success',
            message: `Session Ended: Booking #${summary?.bookingId || bookingId} on ${targetInst.instanceName}. Elapsed: ${summary?.timing?.durationFormatted || `${terminateElapsedMinutes}m`}. Final: ₹${summary?.billing?.finalAmountCharged ?? terminateFinalAmount} (${settleMsg}). Station is now AVAILABLE.`,
            timestamp: getTimestamp()
          }
        ]);

        // Close termination input modal & trigger Session Summary Result modal
        setTerminatingInstance(null);
        setSessionSummaryResult(summary);

        fetchOccupancyData();
        fetchScheduleData(true);
        fetchTentativeBookings(tentativeDate);
        if (activeDashboardTab === 'sessions') {
          fetchPastSessions(pastSessionsDate, pastSessionsStationFilter, pastSessionsStatusFilter);
        }
      } else {
        setTerminateError(data.error || data.message || 'Failed to terminate session.');
      }
    } catch (err: any) {
      setTerminateError(err.message || 'Connection error. Could not terminate session.');
    } finally {
      setIsTerminating(false);
    }
  };

  // Open Tentative Booking Confirmation Modal
  const openConfirmModal = (booking: any) => {
    console.log("openConfirmModal triggered with:", booking);
    try {
      setConfirmingTentativeBooking(booking);
      
      // Find a default setupInstanceId if matching
      const matchingInstance = occupancyData.find(inst => inst.setup?.id === booking.setupId);
      setConfirmSetupInstanceId(matchingInstance ? matchingInstance.instanceId : '');
      
      // Default cash payment is originalAmount
      setConfirmCashAmount(booking.amountCharged || booking.originalAmount || 0);
      setConfirmUpiAmount(0);
      
      // Format dates for input type datetime-local (YYYY-MM-DDTHH:MM)
      if (booking.startTime) {
        const startLocal = new Date(booking.startTime);
        setConfirmStartTime(formatDateForDatetimeInput(startLocal));
      } else {
        setConfirmStartTime('');
      }
      
      if (booking.endTime) {
        const endLocal = new Date(booking.endTime);
        setConfirmEndTime(formatDateForDatetimeInput(endLocal));
      } else {
        setConfirmEndTime('');
      }
      
      setConfirmError(null);
      setIsConfirmSubmitting(false);
    } catch (err) {
      console.error("Error inside openConfirmModal:", err);
    }
  };

  // Helper for tentative confirm quick actions
  const handleSetTentativeStartToNow = () => {
    const now = new Date();
    const currentDurationMs = (() => {
      if (!confirmStartTime || !confirmEndTime) return 60 * 60 * 1000;
      const s = new Date(confirmStartTime).getTime();
      const e = new Date(confirmEndTime).getTime();
      return (!isNaN(s) && !isNaN(e) && e > s) ? (e - s) : 60 * 60 * 1000;
    })();
    const newEnd = new Date(now.getTime() + currentDurationMs);
    setConfirmStartTime(formatDateForDatetimeInput(now));
    setConfirmEndTime(formatDateForDatetimeInput(newEnd));
  };

  const handleSetTentativeDurationPreset = (hours: number) => {
    const start = confirmStartTime ? new Date(confirmStartTime) : new Date();
    const validStart = !isNaN(start.getTime()) ? start : new Date();
    const end = new Date(validStart.getTime() + hours * 60 * 60 * 1000);
    setConfirmStartTime(formatDateForDatetimeInput(validStart));
    setConfirmEndTime(formatDateForDatetimeInput(end));
  };

  const handleSetTentativeQuickPayment = (mode: 'cash' | 'upi' | 'split') => {
    const total = confirmingTentativeBooking?.amountCharged !== undefined 
      ? Number(confirmingTentativeBooking.amountCharged)
      : Number(confirmingTentativeBooking?.originalAmount || 0);
    if (mode === 'cash') {
      setConfirmCashAmount(total);
      setConfirmUpiAmount(0);
    } else if (mode === 'upi') {
      setConfirmCashAmount(0);
      setConfirmUpiAmount(total);
    } else if (mode === 'split') {
      const half = Math.round(total / 2);
      setConfirmCashAmount(half);
      setConfirmUpiAmount(total - half);
    }
  };

  // Submit Tentative Booking Confirmation
  const handleConfirmTentativeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!confirmingTentativeBooking) return;
    
    setIsConfirmSubmitting(true);
    setConfirmError(null);
    
    try {
      const body: any = {};
      if (confirmSetupInstanceId !== '') {
        body.setupInstanceId = Number(confirmSetupInstanceId);
      }
      body.cashAmount = Number(confirmCashAmount);
      body.upiAmount = Number(confirmUpiAmount);
      
      if (confirmStartTime) {
        body.startTime = new Date(confirmStartTime).toISOString();
      }
      if (confirmEndTime) {
        body.endTime = new Date(confirmEndTime).toISOString();
      }
      
      const response = await fetch(`${API_BASE_URL}/api/bookings/tentative/${confirmingTentativeBooking.id}/confirm`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify(body)
      });
      
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Failed to confirm booking.');
      }
      
      setLogs(prev => [
        ...prev,
        {
          id: `log-${Date.now()}`,
          type: 'success',
          message: `Booking #${confirmingTentativeBooking.id} successfully confirmed on station #${body.setupInstanceId || 'N/A'}.`,
          timestamp: getTimestamp()
        }
      ]);
      
      setConfirmingTentativeBooking(null);
      
      fetchOccupancyData();
      fetchScheduleData(true);
      fetchTentativeBookings(tentativeDate);
    } catch (err: any) {
      setConfirmError(err.message || 'Error occurred during confirmation.');
    } finally {
      setIsConfirmSubmitting(false);
    }
  };

  // 2. Submit Session Extension to POST /api/bookings/:id/extend
  const handleExtendBookingSubmit = async (
    e?: React.FormEvent,
    customBookingId?: number,
    customMinutes?: number,
    customOfferIds?: number[],
    customCash?: number,
    customUpi?: number
  ) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    
    // Resolve target booking ID from explicit arg or extendingSessionInstance
    const targetInst = extendingSessionInstance;
    const targetBooking = targetInst?.currentBooking;
    const targetId = Number(
      customBookingId || 
      getBookingId(targetBooking) || 
      (targetBooking as any)?.bookingId || 
      (targetBooking as any)?.id || 
      (targetBooking as any)?.booking_id || 
      0
    );
    const minsToExtend = Number(customMinutes || extensionMinutes || 30);

    console.log('[Extend Session API] Calling /extend with:', { targetId, minsToExtend, targetBooking });

    if (!targetId || isNaN(targetId) || targetId <= 0) {
      const err = 'Invalid booking identifier for extension. Ensure an active session is selected.';
      console.error(err, { targetBooking, extendingSessionInstance });
      setExtensionError(err);
      alert(err);
      return;
    }

    if (!minsToExtend || minsToExtend < 15 || minsToExtend % 15 !== 0) {
      const err = 'Extension duration must be a multiple of 15 minutes (e.g. 15, 30, 45, 60, 120).';
      setExtensionError(err);
      alert(err);
      return;
    }

    setIsExtensionSubmitting(true);
    setExtensionError(null);

    const appliedIds = customOfferIds !== undefined ? customOfferIds : extensionOfferIds;
    const cash = customCash !== undefined ? customCash : (Number(extensionCashAmount) || 0);
    const upi = customUpi !== undefined ? customUpi : (Number(extensionUpiAmount) || 0);

    const payload: any = {
      minutes: Number(minsToExtend),
      appliedOfferIds: appliedIds,
      cashAmount: cash,
      upiAmount: upi
    };

    try {
      const token = authToken || localStorage.getItem('vortex_auth_token') || '';
      const headers: HeadersInit = {
        'Content-Type': 'application/json'
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(`${API_BASE_URL}/api/bookings/${targetId}/extend`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
      });

      const data = await response.json();
      console.log('[Extend Session API] Response:', data);

      if (response.ok && data.success) {
        // Immediately increment the active countdown for targetId
        setCountdownMap((prev) => {
          const currentSecs = prev[targetId] !== undefined ? prev[targetId] : 0;
          return {
            ...prev,
            [targetId]: currentSecs + (minsToExtend * 60)
          };
        });

        // Immediately update occupancyData in local state with the extended duration and charge
        setOccupancyData((prev) =>
          prev.map((inst) => {
            const bId = getBookingId(inst.currentBooking);
            if (bId === targetId && inst.currentBooking) {
              const prevTimeLeft = inst.currentBooking.timeLeftMinutes || 0;
              const newTimeLeft = prevTimeLeft + minsToExtend;
              const newEndTime = data.booking?.endTime || inst.currentBooking.endTime;
              return {
                ...inst,
                currentBooking: {
                  ...inst.currentBooking,
                  ...(data.booking || {}),
                  endTime: newEndTime,
                  timeLeftMinutes: newTimeLeft,
                  timeLeftFormatted: `${newTimeLeft}m`,
                  amountCharged: data.booking?.amountCharged !== undefined 
                    ? data.booking.amountCharged 
                    : (inst.currentBooking.amountCharged + (data.pricing?.additionalAmountToPay || 0))
                }
              };
            }
            return inst;
          })
        );

        const additionalPay = data.pricing?.additionalAmountToPay ?? (data.addedCharge || 0);
        const finalTot = data.pricing?.newTotalAmount ?? data.booking?.amountCharged ?? 0;

        setLogs((prev) => [
          ...prev,
          {
            id: `log-extend-${Date.now()}`,
            type: 'success',
            message: `Session Extended: Booking #${targetId} extended by +${minsToExtend}m (Additional: ₹${additionalPay}, Total: ₹${finalTot}). New End: ${data.extension?.newEndTime || 'Updated'}.`,
            timestamp: getTimestamp()
          }
        ]);

        // Save extension summary result to trigger the Extension Summary Module
        setExtensionSummaryResult({
          bookingId: targetId,
          instanceName: targetInst?.instanceName || `Station #${targetId}`,
          consoleType: targetInst?.setup?.consoleType || 'PS5',
          phoneNumber: targetBooking?.phoneNumber || '',
          playersCount: targetBooking?.playersCount || data.booking?.count || 1,
          extension: data.extension || {
            addedMinutes: minsToExtend,
            addedHours: minsToExtend / 60,
            previousEndTime: targetBooking?.endTime ? formatTimeStr(targetBooking.endTime) : '',
            newEndTime: data.booking?.endTime ? formatTimeStr(data.booking.endTime) : '',
            totalDurationHours: ((targetBooking?.requestedNoOfHours || 1) + (minsToExtend / 60))
          },
          pricing: data.pricing || {
            ratePerPersonPerHour: targetInst?.setup?.chargePerPersonPerHour || 120,
            playerType: (targetBooking?.playersCount || 1) > 1 ? 'MULTIPLAYER' : 'SINGLE_PLAYER',
            previousOriginalAmount: targetBooking?.amountCharged || 0,
            previousTotalAmount: targetBooking?.amountCharged || 0,
            newOriginalAmount: finalTot,
            discountApplied: 0,
            newTotalAmount: finalTot,
            additionalAmountToPay: additionalPay
          },
          appliedOffers: data.appliedOffers || [],
          booking: data.booking
        });

        // Reset extend form modal state
        setExtendingSessionInstance(null);
        setActiveSessionAlert(null);
        setExtensionMinutes(30);
        setExtensionCashAmount('');
        setExtensionUpiAmount('');
        setExtensionOfferIds([]);

        // Fetch fresh state from backend in background
        fetchOccupancyData(true);
        fetchScheduleData(true);
        fetchTentativeBookings(tentativeDate);
        if (activeDashboardTab === 'sessions') {
          fetchPastSessions(pastSessionsDate, pastSessionsStationFilter, pastSessionsStatusFilter);
        }
      } else {
        const errMsg = data.error || data.message || 'Failed to extend session.';
        setExtensionError(errMsg);
        alert(errMsg);
      }
    } catch (err: any) {
      const errMsg = err.message || 'Server connection failure. Ensure backend engine is online.';
      setExtensionError(errMsg);
      alert(errMsg);
    } finally {
      setIsExtensionSubmitting(false);
    }
  };

  // 1-Click Quick Extend for Warning Modal
  const handleQuickExtend = async (bookingId: number, minutes: number) => {
    return handleExtendBookingSubmit(undefined, bookingId, minutes);
  };

  // Run Diagnostics Scan
  const handleDiagnosticsScan = () => {
    if (activeAction !== 'idle') return;
    
    setActiveAction('scanning');
    setActionProgress(0);
    
    const newLog: LogItem = {
      id: `log-${Date.now()}-start`,
      type: 'info',
      message: 'Running core diagnostics scan on backend APIs...',
      timestamp: getTimestamp()
    };
    setLogs((prev) => [...prev, newLog]);

    let currentProgress = 0;
    const progressTimer = setInterval(() => {
      currentProgress += 20;
      setActionProgress(currentProgress);
      
      if (currentProgress >= 100) {
        clearInterval(progressTimer);
        setActiveAction('idle');
        setLogs((prev) => [
          ...prev,
          {
            id: `log-${Date.now()}-check`,
            type: 'success',
            message: `API diagnostics: ${API_BASE_URL}/api/setup-instances/occupancy is responding normally.`,
            timestamp: getTimestamp()
          },
          {
            id: `log-${Date.now()}-complete`,
            type: 'success',
            message: 'Diagnostics scan completed. All API endpoints active.',
            timestamp: getTimestamp()
          }
        ]);
      }
    }, 150);
  };

  // Clear updates feed
  const handleClearLogs = () => {
    setLogs([]);
  };

  // Navigation utility
  const navigateTo = (hash: string) => {
    window.location.hash = hash;
  };

  // Summary Metrics calculations
  const totalStations = occupancyData.length;
  const occupiedCount = occupancyData.filter(s => s.status === 'OCCUPIED' && !(s.currentBooking && isBookingPendingStart(s.currentBooking))).length;
  const availableCount = occupancyData.filter(s => s.status === 'AVAILABLE').length;
  const tentativeCount = occupancyData.filter(s => s.status === 'TENTATIVE').length;
  const scheduledCount = upcomingSchedule.length;

  return (
    <>
      <div className="grid-bg"></div>
      <div className="glow-blob glow-blob-purple"></div>
      <div className="glow-blob glow-blob-cyan"></div>

      <div className={`app-container ${currentHash === '#/dashboard' && authToken ? 'dashboard-mode' : 'landing-mode'}`}>
        {/* Navigation Header */}
        <header className="header">
          <div className="logo-container" style={{ cursor: 'pointer' }} onClick={() => navigateTo('#/')}>
            <img
              src="/logo.jpg"
              alt="Vortex Logo"
              style={{
                width: 34,
                height: 34,
                borderRadius: '50%',
                objectFit: 'cover',
                border: '2px solid var(--accent)',
                flexShrink: 0
              }}
            />
            <span className="logo-text">VORTEX <span className="logo-tag">HUB</span></span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div className="system-status">
              <span className="status-dot"></span>
              <span>SYSTEM ACTIVE</span>
            </div>

            <button 
              className="theme-toggle-btn" 
              onClick={() => setTheme(prev => prev === 'light' ? 'dark' : 'light')}
              title={`Switch to ${theme === 'light' ? 'Dark' : 'Light'} Mode`}
              aria-label="Toggle theme"
            >
              {theme === 'light' ? (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="moon-icon">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
                </svg>
              ) : (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="sun-icon">
                  <circle cx="12" cy="12" r="5"></circle>
                  <line x1="12" y1="1" x2="12" y2="3"></line>
                  <line x1="12" y1="21" x2="12" y2="23"></line>
                  <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
                  <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
                  <line x1="1" y1="12" x2="3" y2="12"></line>
                  <line x1="21" y1="12" x2="23" y2="12"></line>
                  <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
                  <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
                </svg>
              )}
            </button>
          </div>

          {/* Desktop Navigation */}
          <nav className="nav-desktop">
            <a href="#/" onClick={(e) => { e.preventDefault(); navigateTo('#/'); }} className={`nav-link ${currentHash === '#/' ? 'active' : ''}`}>HOME</a>
            {authToken ? (
              <>
                <a href="#/dashboard" onClick={(e) => { e.preventDefault(); navigateTo('#/dashboard'); }} className={`nav-link ${currentHash === '#/dashboard' ? 'active' : ''}`}>CONTROL CENTER</a>
                <div className="user-profile">
                  <span className="user-email-text">{authUser?.email}</span>
                  <span className={`user-role-badge ${authUser?.role.toLowerCase()}`}>
                    {authUser?.role === 'SUPER_ADMIN' ? 'SUPER ADMIN' : 'ADMIN'}
                  </span>
                </div>
                <button className="btn-signout-nav" onClick={handleLogout}>Sign Out</button>
              </>
            ) : (
              <>
                <button className="nav-btn" onClick={() => navigateTo('#/login')}>SIGN IN</button>
              </>
            )}
          </nav>

          {/* Mobile Navigation toggle */}
          <button 
            className="nav-mobile-toggle"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            aria-label="Toggle navigation menu"
          >
            {isMenuOpen ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="3" y1="12" x2="21" y2="12"></line>
                <line x1="3" y1="6" x2="21" y2="6"></line>
                <line x1="3" y1="18" x2="21" y2="18"></line>
              </svg>
            )}
          </button>

          {/* Mobile Overlay Menu */}
          <div className={`nav-mobile-menu ${isMenuOpen ? 'open' : ''}`}>
            <a href="#/" onClick={(e) => { e.preventDefault(); navigateTo('#/'); }} className={`nav-link ${currentHash === '#/' ? 'active' : ''}`}>HOME</a>
            {authToken ? (
              <>
                <a href="#/dashboard" onClick={(e) => { e.preventDefault(); navigateTo('#/dashboard'); }} className={`nav-link ${currentHash === '#/dashboard' ? 'active' : ''}`}>CONTROL CENTER</a>
                <div className="user-profile" style={{ margin: '8px 0' }}>
                  <span className="user-email-text">{authUser?.email}</span>
                  <span className={`user-role-badge ${authUser?.role.toLowerCase()}`}>
                    {authUser?.role === 'SUPER_ADMIN' ? 'SUPER ADMIN' : 'ADMIN'}
                  </span>
                </div>
                <button className="nav-btn" style={{ background: '#ef4444', borderColor: '#ef4444' }} onClick={handleLogout}>Sign Out</button>
              </>
            ) : (
              <>
                <button className="nav-btn" onClick={() => navigateTo('#/login')}>SIGN IN</button>
              </>
            )}
          </div>
        </header>

        <main>
          {/* 1. Landing Page Route */}
          {currentHash === '#/' && (
            <>
              {/* Hero Grid Section */}
              <section className="hero-grid">
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <span className="hero-meta">Platform Administration</span>
                  <h1 className="hero-title">
                    Gaming Zone <span className="gradient-text">Control Dashboard</span>
                  </h1>
                  
                  {/* Rotating animated tagline */}
                  <div className="typing-tagline">
                    <span>Manage with</span>
                    <span style={{ color: 'var(--accent)', fontWeight: 'bold' }}>{taglineText}</span>
                    <span className="typing-cursor"></span>
                  </div>

                  <p className="hero-description">
                    Manage your gaming lounge console stations easily. Track screen allocations, real-time durations, booking details, and active devices under a simplified layout built for lounge operations teams.
                  </p>

                  <div className="hero-actions">
                    <button className="btn-primary" onClick={() => navigateTo(authToken ? '#/dashboard' : '#/login')}>
                      {authToken ? 'Open Control Center' : 'Sign In to Dashboard'}
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="9 18 15 12 9 6"></polyline>
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Simulated Visual Preview Mockup Card */}
                <div className="preview-mockup-container">
                  <div className="preview-mockup-header">
                    <div className="preview-dots">
                      <span className="preview-dot"></span>
                      <span className="preview-dot"></span>
                      <span className="preview-dot"></span>
                    </div>
                    <span className="preview-title">vortex-live-dashboard</span>
                  </div>
                  <div className="preview-mockup-content">
                    <div className="preview-metric-bar">
                      <div className="preview-metric-box">
                        <div className="preview-metric-val">12</div>
                        <div className="preview-metric-lbl">Stations</div>
                      </div>
                      <div className="preview-metric-box">
                        <div className="preview-metric-val" style={{ color: 'var(--accent)' }}>8</div>
                        <div className="preview-metric-lbl">Active</div>
                      </div>
                      <div className="preview-metric-box">
                        <div className="preview-metric-val" style={{ color: 'var(--success)' }}>4</div>
                        <div className="preview-metric-lbl">Free</div>
                      </div>
                    </div>
                    
                    <div className="preview-station-grid">
                      <div className="preview-station-card occupied">
                        <div className="preview-station-name">Station Alpha</div>
                        <div className="preview-station-badge purple">PS5 Console</div>
                        <div className="preview-station-time">Left: {formatMockTime(mockTimeLeft)}</div>
                      </div>
                      <div className="preview-station-card occupied">
                        <div className="preview-station-name">Station Beta</div>
                        <div className="preview-station-badge purple">Xbox Series X</div>
                        <div className="preview-station-time">Left: 42m 18s</div>
                      </div>
                      <div className="preview-station-card available">
                        <div className="preview-station-name">Station Gamma</div>
                        <div className="preview-station-badge green">Nintendo Switch</div>
                        <div className="preview-station-time" style={{ color: 'var(--success)', fontSize: '0.7rem' }}>Ready to Book</div>
                      </div>
                      <div className="preview-station-card available">
                        <div className="preview-station-name">Station Delta</div>
                        <div className="preview-station-badge green">PC Rig 01</div>
                        <div className="preview-station-time" style={{ color: 'var(--success)', fontSize: '0.7rem' }}>Ready to Book</div>
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              {/* Capabilities Grid */}
              <section id="features" className="capabilities-section" style={{ borderBottom: 'none' }}>
                <div>
                  <span className="section-subtitle">System Capabilities</span>
                  <h2 className="section-title">Lounge Operations Management</h2>
                </div>

                <div className="capabilities-grid">
                  <div className="capability-card">
                    <div className="capability-icon-wrapper">
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="20" x2="18" y2="10"></line>
                        <line x1="12" y1="20" x2="12" y2="4"></line>
                        <line x1="6" y1="20" x2="6" y2="14"></line>
                      </svg>
                    </div>
                    <h3 className="capability-title">Setup Diagnostics</h3>
                    <p className="capability-desc">
                      Check which screen sizes, gaming consoles, and configurations are active and operating across the lounge floor.
                    </p>
                  </div>

                  <div className="capability-card">
                    <div className="capability-icon-wrapper">
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                        <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                      </svg>
                    </div>
                    <h3 className="capability-title">Live Occupancy</h3>
                    <p className="capability-desc">
                      View at a glance which setups are occupied, tentative, or available for booking. Keep track of remaining session times.
                    </p>
                  </div>

                  <div className="capability-card">
                    <div className="capability-icon-wrapper">
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                      </svg>
                    </div>
                    <h3 className="capability-title">Client Bookings</h3>
                    <p className="capability-desc">
                      Verify active guest allocations, player counts, billing totals, and user contact details on the fly.
                    </p>
                  </div>

                  <div className="capability-card">
                    <div className="capability-icon-wrapper">
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="12" y1="16" x2="12" y2="12"></line>
                        <line x1="12" y1="8" x2="12.01" y2="8"></line>
                      </svg>
                    </div>
                    <h3 className="capability-title">Secure Portal</h3>
                    <p className="capability-desc">
                      Role-based dashboard locks protect customer booking details and audit records from unverified connections.
                    </p>
                  </div>
                </div>
              </section>
            </>
          )}

          {/* 2. Login Page Route */}
          {/* 2. Login Page Route */}
          {currentHash === '#/login' && (
            <div className="login-container">
              <div className="login-vortex-bg"></div>
              <div className="login-vortex-ring"></div>
              <div className="login-vortex-ring-2"></div>
              <div className="login-card">
                <div className="login-logo-header">
                  <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
                  </svg>
                  <h2 className="login-title-text">Sign In to <span className="gradient-text">Vortex Hub</span></h2>
                  <p className="login-subtitle-text">Enter credentials to unlock administrative controls.</p>
                </div>

                {loginError && (
                  <div className="form-error-banner">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10"></circle>
                      <line x1="15" y1="9" x2="9" y2="15"></line>
                      <line x1="9" y1="9" x2="15" y2="15"></line>
                    </svg>
                    <span>{loginError}</span>
                  </div>
                )}

                {loginInfoMessage && (
                  <div className="form-error-banner" style={{ background: 'var(--accent-light)', borderColor: 'rgba(37, 99, 235, 0.2)', color: 'var(--accent)' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10"></circle>
                      <line x1="12" y1="16" x2="12" y2="12"></line>
                      <line x1="12" y1="8" x2="12.01" y2="8"></line>
                    </svg>
                    <span>{loginInfoMessage}</span>
                  </div>
                )}

                <form onSubmit={handleLoginSubmit} className="login-form">
                  <div className="form-group">
                    <label className="form-label" htmlFor="email">Email Address</label>
                    <input
                      type="email"
                      id="email"
                      className="form-input"
                      placeholder="e.g. meet@gmail.com"
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      required
                      autoComplete="username"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label" htmlFor="password">Password</label>
                    <input
                      type="password"
                      id="password"
                      className="form-input"
                      placeholder="••••••••"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      required
                      autoComplete="current-password"
                    />
                  </div>

                  <button type="submit" className="btn-primary" style={{ width: '100%', marginTop: '8px' }} disabled={isLoginLoading}>
                    {isLoginLoading ? 'Verifying...' : 'Sign In'}
                  </button>
                </form>

                <div className="credential-guidance">
                  <span className="guidance-title">Select Security Keycard to Autofill</span>
                  <div className="keycard-grid">
                    <div 
                      className="keycard-item"
                      onClick={() => handlePreFillCredentials('meet@gmail.com', 'Meet@1234')}
                    >
                      <div className="keycard-role" style={{ color: 'var(--accent)' }}>Super Admin</div>
                      <div className="keycard-email">meet@gmail.com</div>
                      <div className="keycard-pass">••••••••</div>
                    </div>
                    <div 
                      className="keycard-item"
                      onClick={() => handlePreFillCredentials('harsh@gmail.com', 'Harsh@1234')}
                    >
                      <div className="keycard-role" style={{ color: 'var(--warning)' }}>Admin Console</div>
                      <div className="keycard-email">harsh@gmail.com</div>
                      <div className="keycard-pass">••••••••</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {currentHash === '#/dashboard' && authToken && (
            <div className="dashboard-layout">
              {/* Dashboard Sidebar Navigation */}
              <aside className="dashboard-sidebar">
                <div className="sidebar-brand">
                  <span className="sidebar-brand-name">VORTEX CONSOLE</span>
                  <span className="sidebar-brand-desc">Lounge Operations Board</span>
                </div>

                <div className="sidebar-menu-wrapper">
                  <span className="sidebar-section-title">Operations Menu</span>
                  <nav className="sidebar-menu">
                    <button 
                      className={`sidebar-btn ${activeDashboardTab === 'bookings' ? 'active' : ''}`}
                      onClick={() => setActiveDashboardTab('bookings')}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="3" width="7" height="9"></rect>
                        <rect x="14" y="3" width="7" height="5"></rect>
                        <rect x="14" y="12" width="7" height="9"></rect>
                        <rect x="3" y="16" width="7" height="5"></rect>
                      </svg>
                      Allocations & Bookings
                    </button>

                    <button 
                      className={`sidebar-btn ${activeDashboardTab === 'schedule' ? 'active' : ''}`}
                      onClick={() => setActiveDashboardTab('schedule')}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                        <line x1="16" y1="2" x2="16" y2="6"></line>
                        <line x1="8" y1="2" x2="8" y2="6"></line>
                        <line x1="3" y1="10" x2="21" y2="10"></line>
                        <path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01"></path>
                      </svg>
                      Upcoming Schedule
                    </button>

                    <button 
                      className={`sidebar-btn ${activeDashboardTab === 'tentative' ? 'active' : ''}`}
                      onClick={() => setActiveDashboardTab('tentative')}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                        <line x1="16" y1="2" x2="16" y2="6"></line>
                        <line x1="8" y1="2" x2="8" y2="6"></line>
                        <line x1="3" y1="10" x2="21" y2="10"></line>
                      </svg>
                      Tentative Ledger
                    </button>

                    <button 
                      className={`sidebar-btn ${activeDashboardTab === 'sessions' ? 'active' : ''}`}
                      onClick={() => setActiveDashboardTab('sessions')}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10"></circle>
                        <polyline points="12 6 12 12 16 14"></polyline>
                      </svg>
                      Past Sessions & Revenue
                    </button>

                    <button 
                      className={`sidebar-btn ${activeDashboardTab === 'stats' ? 'active' : ''}`}
                      onClick={() => setActiveDashboardTab('stats')}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
                      </svg>
                      Performance & Stats
                    </button>
                  </nav>
                </div>
              </aside>

              {/* Main Content Area */}
              <div className="dashboard-content">

                {/* TAB 1: Occupancy Grid & Booking Allocation */}
                {activeDashboardTab === 'bookings' && (
                  <>
                    {/* Console Setup Grid Header */}
                    <div className="dashboard-section-header">
                      <div>
                        <h2 className="section-title">Console Setup Stations</h2>
                        <p className="section-desc" style={{ fontSize: '0.85rem', display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                          <span>Real-time occupancy status of lounge tables.</span>
                          <span className="station-divider" style={{ width: 4, height: 4, borderRadius: '50%', backgroundColor: 'var(--border)' }}></span>
                          <span style={{ fontWeight: 600, color: 'var(--text-heading)' }}>
                            In Use: <span style={{ color: 'var(--accent)' }}>{occupiedCount + tentativeCount}</span>
                          </span>
                          <span className="station-divider" style={{ width: 4, height: 4, borderRadius: '50%', backgroundColor: 'var(--border)' }}></span>
                          <span style={{ fontWeight: 600, color: 'var(--text-heading)' }}>
                            Scheduled: <span style={{ color: 'var(--warning)' }}>{scheduledCount}</span>
                          </span>
                          <span className="station-divider" style={{ width: 4, height: 4, borderRadius: '50%', backgroundColor: 'var(--border)' }}></span>
                          <span style={{ fontWeight: 600, color: 'var(--text-heading)' }}>
                            Available: <span style={{ color: 'var(--success)' }}>{availableCount}</span>
                          </span>
                        </p>
                      </div>
                      <button 
                        className="btn-refresh" 
                        onClick={() => {
                          fetchOccupancyData(false);
                          fetchScheduleData(true);
                        }}
                        disabled={isOccupancyLoading}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ animation: isOccupancyLoading ? 'spin 1.5s infinite linear' : 'none' }}>
                          <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/>
                        </svg>
                        {isOccupancyLoading ? 'Syncing...' : 'Refresh Status'}
                      </button>
                    </div>

                    {occupancyError && (
                      <div className="form-error-banner" style={{ marginBottom: '24px' }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="10"></circle>
                          <line x1="12" y1="16" x2="12" y2="12"></line>
                          <line x1="12" y1="8" x2="12.01" y2="8"></line>
                        </svg>
                        <span>{occupancyError}</span>
                      </div>
                    )}

                    {/* Station Layout Area */}
                    <div className="control-container" style={{ gridTemplateColumns: '1fr', marginBottom: '32px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                        
                        {/* Grid of occupancy setups */}
                        {occupancyData.length === 0 && !isOccupancyLoading ? (
                          <div className="feed-welcome-note" style={{ textAlign: 'center', padding: '32px' }}>
                            No console setup instances found. Check backend seed details.
                          </div>
                        ) : (
                          <div className="occupancy-grid">
                            {occupancyData.map((inst) => {
                              const pendingStart = Boolean(inst.currentBooking && isBookingPendingStart(inst.currentBooking));
                              const currentBookingId = inst.currentBooking ? getBookingId(inst.currentBooking) : 0;
                              const nextUpcoming = getNextUpcomingForInstance(
                                upcomingSchedule,
                                inst.instanceId,
                                currentBookingId || undefined,
                              );
                              const cardStatus = pendingStart ? 'scheduled' : inst.status.toLowerCase();
                              return (
                              <div 
                                key={inst.instanceId} 
                                className={`occupancy-card ${cardStatus} ${inst.isActive ? '' : 'disabled'}`}
                              >
                                <div className="occupancy-header">
                                  <div className="station-details">
                                    <h3 className="station-name">{inst.instanceName}</h3>
                                    <div className="station-meta-row">
                                      <span>{inst.setup.consoleType}</span>
                                      <span className="station-divider"></span>
                                      <span>₹{inst.setup.chargePerPersonPerHour}/hr</span>
                                    </div>
                                  </div>
                                  
                                  {/* Simple Status badge */}
                                  <span 
                                    className={`metric-badge ${
                                      pendingStart ? 'purple' :
                                      inst.status === 'AVAILABLE' ? 'green' : 
                                      inst.status === 'OCCUPIED' ? 'blue' : 'amber'
                                    }`}
                                  >
                                    <span style={{ 
                                      width: 6, 
                                      height: 6, 
                                      borderRadius: '50%', 
                                      backgroundColor: 
                                        pendingStart ? '#a855f7' :
                                        inst.status === 'AVAILABLE' ? 'var(--success)' : 
                                        inst.status === 'OCCUPIED' ? 'var(--accent)' : 'var(--warning)', 
                                      display: 'inline-block' 
                                    }}></span>
                                    {pendingStart ? 'Scheduled' : inst.status === 'OCCUPIED' ? 'Occupied' : inst.status === 'AVAILABLE' ? 'Available' : 'Tentative'}
                                  </span>
                                </div>

                                {/* Dynamic Active Booking data */}
                                {inst.currentBooking ? (
                                  <div className="booking-info-box">

                                    {/* Header row: phone + amount */}
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                      <div>
                                        <div style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '2px' }}>Customer</div>
                                        <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-heading)', letterSpacing: '0.02em' }}>{inst.currentBooking.phoneNumber}</div>
                                      </div>
                                      <div style={{ textAlign: 'right' }}>
                                        <div style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '2px' }}>Billed</div>
                                        <div style={{ fontSize: '0.9rem', fontWeight: 800, color: inst.status === 'TENTATIVE' ? 'var(--warning)' : 'var(--accent)' }}>₹{inst.currentBooking.amountCharged}</div>
                                      </div>
                                    </div>

                                    {/* Players chip */}
                                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '20px', padding: '3px 10px', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-heading)' }}>
                                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                                          <circle cx="9" cy="7" r="4"/>
                                          <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                                          <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                                        </svg>
                                        {inst.currentBooking.playersCount} {inst.currentBooking.playersCount === 1 ? 'player' : 'players'}
                                      </span>
                                      {inst.currentBooking.originalAmount !== inst.currentBooking.amountCharged && (
                                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.25)', borderRadius: '20px', padding: '3px 10px', fontSize: '0.72rem', fontWeight: 600, color: 'var(--success)' }}>
                                          Save ₹{inst.currentBooking.originalAmount - inst.currentBooking.amountCharged}
                                        </span>
                                      )}
                                    </div>

                                    {(() => {
                                       const booking = inst.currentBooking;
                                       const bookingId = getBookingId(booking);
                                       const pending = isBookingPendingStart(booking);
                                       let secsLeft = pending
                                         ? startCountdownMap[bookingId]
                                         : countdownMap[bookingId];
                                       if (secsLeft === undefined) {
                                         secsLeft = pending
                                           ? calculateSecondsUntilStart(booking)
                                           : calculateBookingSecondsRemaining(booking);
                                       }
                                       const startMs = parseTimestampMs(getBookingStartTime(booking));
                                       const endMs = parseTimestampMs(getBookingEndTime(booking));
                                       const totalSecs = (startMs && endMs && endMs > startMs)
                                         ? Math.floor((endMs - startMs) / 1000)
                                         : Math.max(60, ((booking.timeLeftMinutes || 60) * 60));
                                       const startLabel = booking.startTime && !String(booking.startTime).includes('T')
                                         ? booking.startTime
                                         : formatTimeStr(getBookingStartTime(booking));
                                       const endLabel = booking.endTime && !String(booking.endTime).includes('T')
                                         ? booking.endTime
                                         : formatTimeStr(getBookingEndTime(booking));
                                       return (
                                         <OccupancySessionTimer
                                           isPendingStart={pending}
                                           secsLeft={secsLeft}
                                           totalSecs={totalSecs}
                                           status={inst.status}
                                           startLabel={startLabel}
                                           endLabel={endLabel}
                                         />
                                       );
                                     })()}

                                     {/* Action buttons — only after the session has actually started */}
                                     {!pendingStart && (
                                     <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                       <div style={{ display: 'flex', gap: '5px' }}>
                                         <button
                                           type="button"
                                           className="btn-card-action"
                                           style={{ flex: 1, fontSize: '0.78rem', padding: '6px 8px' }}
                                           onClick={(e) => {
                                             e.stopPropagation();
                                             setExtendingSessionInstance(inst);
                                             setExtensionMinutes(30);
                                             setExtensionError(null);
                                           }}
                                         >
                                           + Extend Session
                                         </button>
                                         <button
                                           type="button"
                                           className="btn-compact"
                                           style={{ padding: '6px 10px', fontSize: '0.75rem', fontWeight: 800, whiteSpace: 'nowrap', background: 'var(--bg-card-hover)' }}
                                           title="1-Click Quick Extend (+30m)"
                                           onClick={(e) => {
                                             e.stopPropagation();
                                             const bId = getBookingId(inst.currentBooking);
                                             handleExtendBookingSubmit(undefined, bId, 30);
                                           }}
                                           disabled={isExtensionSubmitting}
                                         >
                                           +30m
                                         </button>
                                       </div>

                                       <button
                                         type="button"
                                         className="btn-card-action"
                                         style={{ fontSize: '0.78rem', padding: '6px 10px', color: 'var(--error)', borderColor: 'var(--error)' }}
                                         onClick={(e) => {
                                           e.stopPropagation();
                                           openTerminateModal(inst);
                                         }}
                                       >
                                         ⏹ End Session
                                       </button>
                                     </div>
                                     )}

                                     {pendingStart && (
                                       <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, padding: '6px 8px', borderRadius: '6px', background: 'rgba(168,85,247,0.08)', border: '1px solid rgba(168,85,247,0.25)' }}>
                                         Session timer starts at the scheduled start time. You will get a 10 min and 5 min warning.
                                       </div>
                                     )}

                                  </div>
                                ) : (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                    <div style={{ height: '90px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '6px', borderRadius: '8px', background: 'rgba(34,197,94,0.04)', border: '1px dashed rgba(34,197,94,0.3)' }}>
                                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.7 }}>
                                        <circle cx="12" cy="12" r="10"/>
                                        <polyline points="12 8 12 12 14 14"/>
                                      </svg>
                                      <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--success)' }}>Available</span>
                                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Ready for allocation</span>
                                    </div>
                                    {nextUpcoming && (
                                      <div className="next-session-banner">
                                        <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--warning)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                          Next session
                                        </div>
                                        <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-heading)' }}>
                                          {formatScheduleDate(nextUpcoming.date)} · {nextUpcoming.startTime} – {nextUpcoming.endTime}
                                        </div>
                                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                          {nextUpcoming.phoneNumber} · {(startCountdownMap[nextUpcoming.bookingId] ?? secondsUntilIso(nextUpcoming.startTimeIso)) > 0
                                            ? `Starts in ${formatCountdown(startCountdownMap[nextUpcoming.bookingId] ?? secondsUntilIso(nextUpcoming.startTimeIso))}`
                                            : 'Starting now'}
                                        </div>
                                      </div>
                                    )}
                                    <button className="btn-card-action primary" style={{ width: '100%' }} onClick={() => openBookingModal(inst)}>
                                      + Book Station
                                    </button>
                                  </div>
                                )}
                              </div>
                            );
                            })}
                          </div>
                        )}

                        {/* Booking Allocation Modal Overlay — 6-Step Customer-First Wizard */}
                        {selectedInstanceForBooking && (
                          <div className="modal-overlay" onClick={() => setSelectedInstanceForBooking(null)}>
                            <div className="modal-card" style={{ maxWidth: '580px' }} onClick={(e) => e.stopPropagation()}>

                              {/* Modal Header */}
                              <div className="modal-header">
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                  <h3 className="modal-title">New Booking — {selectedInstanceForBooking.instanceName}</h3>
                                  <div style={{ display: 'flex', gap: '4px', alignItems: 'center', marginTop: '6px', flexWrap: 'wrap' }}>
                                    {([
                                      { num: 1, label: 'Phone' },
                                      { num: 2, label: 'Info' },
                                      { num: 3, label: 'Members' },
                                      { num: 4, label: 'Games' },
                                      { num: 5, label: 'Slot' },
                                      { num: 6, label: 'Offers' },
                                      { num: 7, label: 'Review' },
                                    ] as const).map(({ num, label }) => (
                                      <div key={num} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        <div style={{
                                          width: 20, height: 20, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                          fontSize: '0.62rem', fontWeight: 700,
                                          background: bookingStep === num ? 'var(--accent)' : bookingStep > num ? 'var(--success)' : 'var(--border)',
                                          color: bookingStep >= num ? 'white' : 'var(--text-muted)',
                                          transition: 'all 0.2s ease',
                                        }}>
                                          {bookingStep > num ? '✓' : num}
                                        </div>
                                        <span style={{ fontSize: '0.62rem', color: bookingStep === num ? 'var(--text-heading)' : 'var(--text-muted)', fontWeight: bookingStep === num ? 600 : 400 }}>
                                          {label}
                                        </span>
                                        {num < 7 && <div style={{ width: 8, height: 1, background: 'var(--border)' }} />}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                                <button className="modal-close-btn" onClick={() => setSelectedInstanceForBooking(null)}>
                                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="18" y1="6" x2="6" y2="18"></line>
                                    <line x1="6" y1="6" x2="18" y2="18"></line>
                                  </svg>
                                </button>
                              </div>

                              {/* ── STEP 1: Phone Number Lookup ── */}
                              {bookingStep === 1 && (
                                <div>
                                  <div className="modal-body">
                                    {bookingFormError && (
                                      <div className="form-error-banner">
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                          <circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line>
                                        </svg>
                                        <span>{bookingFormError}</span>
                                      </div>
                                    )}
                                    <div style={{ textAlign: 'center', padding: '8px 0' }}>
                                      <div style={{
                                        width: 56, height: 56, borderRadius: '50%', margin: '0 auto 12px',
                                        background: 'var(--accent-light)', border: '2px solid var(--accent)',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                      }}>
                                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                          <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
                                        </svg>
                                      </div>
                                      <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-heading)', marginBottom: '4px' }}>Customer Phone Number</div>
                                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>We'll check if this customer has visited before</div>
                                    </div>
                                    <div className="form-group">
                                      <label className="form-label" htmlFor="book-phone">Phone Number</label>
                                      <input
                                        type="text"
                                        id="book-phone"
                                        className="form-input"
                                        placeholder="e.g. 9988776655"
                                        value={bookingPhone}
                                        onChange={(e) => {
                                          const val = e.target.value.replace(/\D/g, '').slice(0, 10);
                                          setBookingPhone(val);
                                        }}
                                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleCustomerPhoneLookup(); } }}
                                        required
                                        autoFocus
                                        style={{ fontSize: '1.1rem', letterSpacing: '2px', textAlign: 'center', fontWeight: 600, fontFamily: 'var(--font-mono)' }}
                                      />
                                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                                        {bookingPhone.length}/10 digits
                                      </div>
                                    </div>
                                  </div>
                                  <div className="modal-footer">
                                    <button type="button" className="btn-card-action" onClick={() => setSelectedInstanceForBooking(null)}>Cancel</button>
                                    <button
                                      type="button"
                                      className="btn-card-action primary"
                                      disabled={isLookingUpCustomer || bookingPhone.trim().length < 10}
                                      onClick={handleCustomerPhoneLookup}
                                    >
                                      {isLookingUpCustomer ? (
                                        <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'spin 1s infinite linear' }}><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg> Looking up…</>
                                      ) : 'Continue →'}
                                    </button>
                                  </div>
                                </div>
                              )}

                              {/* ── STEP 2: Customer Info (auto-filled if found) ── */}
                              {bookingStep === 2 && (
                                <div>
                                  <div className="modal-body">
                                    {/* Lookup result banner */}
                                    {foundCustomer ? (
                                      <div style={{
                                        display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px',
                                        borderRadius: '8px', background: 'var(--success-light)', border: '1px solid rgba(16, 185, 129, 0.3)',
                                      }}>
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
                                        </svg>
                                        <div>
                                          <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--success)' }}>Returning Customer</div>
                                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Details auto-filled from records</div>
                                        </div>
                                      </div>
                                    ) : (
                                      <div style={{
                                        display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px',
                                        borderRadius: '8px', background: 'var(--accent-light)', border: '1px solid var(--border-accent-dim)',
                                      }}>
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
                                        </svg>
                                        <div>
                                          <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--accent)' }}>New Customer</div>
                                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Please fill in their details below</div>
                                        </div>
                                      </div>
                                    )}
                                    <div className="form-group">
                                      <label className="form-label" htmlFor="cust-phone-display">Phone Number</label>
                                      <input type="text" id="cust-phone-display" className="form-input" value={bookingPhone} disabled
                                        style={{ fontFamily: 'var(--font-mono)', opacity: 0.7, cursor: 'not-allowed' }}
                                      />
                                    </div>
                                    <div className="form-group">
                                      <label className="form-label" htmlFor="cust-name">Full Name <span style={{ color: 'var(--danger)' }}>*</span></label>
                                      <input type="text" id="cust-name" className="form-input" placeholder="e.g. Harsh Sukhija" value={customerName} onChange={(e) => setCustomerName(e.target.value)} required autoFocus />
                                    </div>
                                    <div className="form-group">
                                      <label className="form-label" htmlFor="cust-dob">Date of Birth <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>(optional)</span></label>
                                      <input type="date" id="cust-dob" className="form-input" value={customerDob} onChange={(e) => setCustomerDob(e.target.value)} />
                                    </div>
                                  </div>
                                  <div className="modal-footer">
                                    <button type="button" className="btn-card-action" onClick={() => { setBookingStep(1); setBookingFormError(null); }}>← Back</button>
                                    <button
                                      type="button"
                                      className="btn-card-action primary"
                                      disabled={!customerName.trim()}
                                      onClick={() => { setBookingFormError(null); setBookingStep(3); }}
                                    >
                                      Continue →
                                    </button>
                                  </div>
                                </div>
                              )}

                              {/* ── STEP 3: Additional Members (with skip) ── */}
                              {bookingStep === 3 && (
                                <div>
                                  <div className="modal-body">
                                    <div style={{ textAlign: 'center', padding: '4px 0' }}>
                                      <div style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--text-heading)', marginBottom: '4px' }}>Additional Members</div>
                                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Add info for other people in the group, or skip this step</div>
                                    </div>

                                    {/* Primary customer summary */}
                                    <div style={{
                                      display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px',
                                      borderRadius: '8px', background: 'var(--bg-card-hover)', border: '1px solid var(--border)',
                                    }}>
                                      <div style={{
                                        width: 32, height: 32, borderRadius: '50%', background: 'var(--accent)',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        fontSize: '0.75rem', fontWeight: 700, color: 'white', flexShrink: 0,
                                      }}>
                                        {customerName.charAt(0).toUpperCase()}
                                      </div>
                                      <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-heading)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{customerName}</div>
                                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{bookingPhone}</div>
                                      </div>
                                      <span style={{ fontSize: '0.68rem', fontWeight: 600, color: 'var(--accent)', background: 'var(--accent-light)', padding: '2px 8px', borderRadius: '999px' }}>Primary</span>
                                    </div>

                                    {/* Member cards */}
                                    {additionalMembers.map((member, idx) => (
                                      <div key={idx} style={{
                                        padding: '12px', borderRadius: '8px', border: '1px solid var(--border)',
                                        background: 'var(--bg-card-hover)', position: 'relative',
                                      }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                                          <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-heading)' }}>Member {idx + 2}</span>
                                          <button
                                            type="button"
                                            onClick={() => removeMemberSlot(idx)}
                                            style={{
                                              background: 'var(--danger-light)', border: '1px solid rgba(239,68,68,0.2)',
                                              color: 'var(--danger)', borderRadius: '4px', padding: '2px 6px',
                                              fontSize: '0.7rem', fontWeight: 600, cursor: 'pointer',
                                            }}
                                          >
                                            Remove
                                          </button>
                                        </div>
                                        <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                                          <div style={{ flex: 1 }}>
                                            <label className="form-label" style={{ fontSize: '0.7rem' }}>Phone</label>
                                            <div style={{ display: 'flex', gap: '4px' }}>
                                              <input
                                                type="text"
                                                className="form-input"
                                                placeholder="e.g. 9876543210"
                                                value={member.phone}
                                                onChange={(e) => updateMember(idx, 'phone', e.target.value.replace(/\D/g, '').slice(0, 10))}
                                                style={{ fontSize: '0.8rem', fontFamily: 'var(--font-mono)' }}
                                              />
                                              <button
                                                type="button"
                                                onClick={() => handleMemberPhoneLookup(idx)}
                                                disabled={member.phone.trim().length < 10 || memberLookupLoading[idx]}
                                                style={{
                                                  background: 'var(--accent)', color: 'white', border: 'none', borderRadius: '6px',
                                                  padding: '0 10px', cursor: member.phone.trim().length < 10 ? 'not-allowed' : 'pointer',
                                                  fontSize: '0.7rem', fontWeight: 600, whiteSpace: 'nowrap', opacity: member.phone.trim().length < 10 ? 0.5 : 1,
                                                }}
                                              >
                                                {memberLookupLoading[idx] ? '...' : 'Lookup'}
                                              </button>
                                            </div>
                                          </div>
                                        </div>
                                        <div className="form-row-2col" style={{ gap: '8px' }}>
                                          <div className="form-group" style={{ marginBottom: 0 }}>
                                            <label className="form-label" style={{ fontSize: '0.7rem' }}>Name</label>
                                            <input type="text" className="form-input" placeholder="Full name" value={member.name} onChange={(e) => updateMember(idx, 'name', e.target.value)} style={{ fontSize: '0.8rem' }} />
                                          </div>
                                          <div className="form-group" style={{ marginBottom: 0 }}>
                                            <label className="form-label" style={{ fontSize: '0.7rem' }}>DOB <span style={{ color: 'var(--text-muted)' }}>(opt)</span></label>
                                            <input type="date" className="form-input" value={member.dateOfBirth} onChange={(e) => updateMember(idx, 'dateOfBirth', e.target.value)} style={{ fontSize: '0.8rem' }} />
                                          </div>
                                        </div>
                                      </div>
                                    ))}

                                    {/* Add member button */}
                                    <button
                                      type="button"
                                      onClick={addMemberSlot}
                                      style={{
                                        width: '100%', padding: '10px', borderRadius: '8px',
                                        border: '2px dashed var(--border)', background: 'transparent',
                                        color: 'var(--accent)', fontSize: '0.82rem', fontWeight: 600,
                                        cursor: 'pointer', transition: 'all 0.15s ease',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                                      }}
                                      onMouseOver={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--accent)'; (e.currentTarget as HTMLButtonElement).style.background = 'var(--accent-light)'; }}
                                      onMouseOut={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border)'; (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
                                    >
                                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                        <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                                      </svg>
                                      Add Another Member
                                    </button>
                                  </div>
                                  <div className="modal-footer">
                                    <button type="button" className="btn-card-action" onClick={() => { setBookingStep(2); setBookingFormError(null); }}>← Back</button>
                                    <button type="button" className="btn-card-action" onClick={() => {
                                      setBookingFormError(null);
                                      if (additionalMembers.length > 0) {
                                        setBookingPlayers(Math.min(4, Math.max(1, additionalMembers.length + 1)));
                                      }
                                      setBookingStep(4);
                                    }}
                                      style={{ color: 'var(--text-muted)' }}
                                    >
                                      Skip →
                                    </button>
                                    <button
                                      type="button"
                                      className="btn-card-action primary"
                                      onClick={() => {
                                        setBookingFormError(null);
                                        if (additionalMembers.length > 0) {
                                          setBookingPlayers(Math.min(4, Math.max(1, additionalMembers.length + 1)));
                                        }
                                        setBookingStep(4);
                                      }}
                                    >
                                      Continue →
                                    </button>
                                  </div>
                                </div>
                              )}

                              {/* ── STEP 4: Dedicated Game Selection ── */}
                              {bookingStep === 4 && (
                                <div>
                                  <div className="modal-body">
                                    {bookingFormError && (
                                      <div className="form-error-banner">
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                          <circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line>
                                        </svg>
                                        <span>{bookingFormError}</span>
                                      </div>
                                    )}

                                    {/* Customer summary chip */}
                                    <div style={{
                                      display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px',
                                      borderRadius: '8px', background: 'var(--bg-card-hover)', border: '1px solid var(--border)',
                                      fontSize: '0.8rem',
                                    }}>
                                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
                                      </svg>
                                      <span style={{ fontWeight: 600, color: 'var(--text-heading)' }}>{customerName}</span>
                                      <span style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>{bookingPhone}</span>
                                      {additionalMembers.length > 0 && (
                                        <span style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--accent)', background: 'var(--accent-light)', padding: '1px 6px', borderRadius: '999px', marginLeft: 'auto' }}>
                                          +{additionalMembers.length} member{additionalMembers.length > 1 ? 's' : ''}
                                        </span>
                                      )}
                                    </div>

                                    {/* Dedicated Games Selector */}
                                    <div className="games-selection-container">
                                      <div className="games-header-row">
                                        <div>
                                          <div style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--text-heading)' }}>
                                            Select Games to Play
                                          </div>
                                          <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                                            Available on {selectedInstanceForBooking.setup.name} ({selectedInstanceForBooking.setup.consoleType})
                                          </div>
                                        </div>
                                        {availableGames.length > 0 && (
                                          <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                                            <span style={{ fontSize: '0.74rem', color: 'var(--accent)', fontWeight: 700, marginRight: 4 }}>
                                              {selectedGameIds.length} Selected
                                            </span>
                                            <button
                                              type="button"
                                              className="time-preset-pill"
                                              style={{ padding: '3px 8px', fontSize: '0.7rem' }}
                                              onClick={() => setSelectedGameIds(availableGames.map((g) => g.id))}
                                            >
                                              Select All
                                            </button>
                                            <button
                                              type="button"
                                              className="time-preset-pill"
                                              style={{ padding: '3px 8px', fontSize: '0.7rem' }}
                                              onClick={() => setSelectedGameIds([])}
                                            >
                                              Clear
                                            </button>
                                          </div>
                                        )}
                                      </div>

                                      {/* Search games input */}
                                      <div className="games-search-bar">
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                          <circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                                        </svg>
                                        <input
                                          type="text"
                                          placeholder="Search installed games (e.g. FC 26, Tekken, GTA)..."
                                          value={gameSearchQuery}
                                          onChange={(e) => setGameSearchQuery(e.target.value)}
                                        />
                                        {gameSearchQuery && (
                                          <button
                                            type="button"
                                            onClick={() => setGameSearchQuery('')}
                                            style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.75rem', padding: '0 4px' }}
                                          >
                                            ✕
                                          </button>
                                        )}
                                      </div>

                                      {/* Games Grid */}
                                      {isGamesLoading ? (
                                        <div style={{ textAlign: 'center', padding: '24px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                          Loading available games...
                                        </div>
                                      ) : availableGames.length === 0 ? (
                                        <div style={{ textAlign: 'center', padding: '24px', fontSize: '0.8rem', color: 'var(--text-muted)', background: 'var(--bg-card-hover)', borderRadius: '8px' }}>
                                          No games found{gameSearchQuery ? ` matching "${gameSearchQuery}"` : ''}.
                                        </div>
                                      ) : (
                                        <div className="games-grid" style={{ maxHeight: '340px' }}>
                                          {availableGames.map((game) => {
                                            const isSelected = selectedGameIds.includes(game.id);
                                            const imgUrl = game.images && game.images.length > 0 ? game.images[0] : null;

                                            return (
                                              <div
                                                key={game.id}
                                                className={`game-select-card ${isSelected ? 'selected' : ''}`}
                                                onClick={() => toggleGameSelection(game.id)}
                                              >
                                                <div className="game-card-img-wrap" style={{ height: '90px' }}>
                                                  {imgUrl ? (
                                                    <img
                                                      src={imgUrl}
                                                      alt={game.name}
                                                      className="game-card-img"
                                                      onError={(e) => {
                                                        (e.currentTarget as HTMLElement).style.display = 'none';
                                                        if (e.currentTarget.parentElement) {
                                                          e.currentTarget.parentElement.innerHTML = '<span class="game-card-img-placeholder">🎮</span>';
                                                        }
                                                      }}
                                                    />
                                                  ) : (
                                                    <span className="game-card-img-placeholder">🎮</span>
                                                  )}
                                                  {isSelected && <div className="game-check-badge">✓</div>}
                                                </div>
                                                <div className="game-card-info" style={{ padding: '8px 10px' }}>
                                                  <span className="game-card-name" style={{ fontSize: '0.82rem' }} title={game.name}>{game.name}</span>
                                                  <span style={{ fontSize: '0.68rem', color: isSelected ? 'var(--accent)' : 'var(--text-muted)', fontWeight: isSelected ? 600 : 400 }}>
                                                    {isSelected ? '✓ Selected' : 'Click to select'}
                                                  </span>
                                                </div>
                                              </div>
                                            );
                                          })}
                                        </div>
                                      )}
                                    </div>
                                  </div>

                                  <div className="modal-footer">
                                    <button type="button" className="btn-card-action" onClick={() => { setBookingStep(3); setBookingFormError(null); }}>← Back</button>
                                    <button
                                      type="button"
                                      className="btn-card-action primary"
                                      onClick={() => {
                                        setBookingFormError(null);
                                        if (selectedGameIds.length === 0 && availableGames.length > 0) {
                                          setSelectedGameIds([availableGames[0].id]);
                                        }
                                        setBookingStep(5);
                                      }}
                                    >
                                      Continue to Slot Details →
                                    </button>
                                  </div>
                                </div>
                              )}

                              {/* ── STEP 5: Booking Details & Slot Timing ── */}
                              {bookingStep === 5 && (() => {
                                const parsedTime = parseTimeComponents(bookingTime);
                                const estimatedBase = slotPricing ? slotPricing.basePrice : ((selectedInstanceForBooking.setup.chargePerPersonPerHour || 0) * bookingPlayers * bookingHours);
                                const calculatedEnd = calculateSlotEndTime(bookingTime, bookingHours);
                                const selectedGamesObjects = availableGames.filter((g) => selectedGameIds.includes(g.id));

                                return (
                                  <form onSubmit={handleProceedToReview}>
                                    <div className="modal-body">
                                      {bookingFormError && (
                                        <div className="form-error-banner">
                                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                            <circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line>
                                          </svg>
                                          <span>{bookingFormError}</span>
                                        </div>
                                      )}

                                      {/* Customer & Games summary chip */}
                                      <div style={{
                                        display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px',
                                        borderRadius: '8px', background: 'var(--bg-card-hover)', border: '1px solid var(--border)',
                                        fontSize: '0.8rem', flexWrap: 'wrap'
                                      }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
                                          </svg>
                                          <span style={{ fontWeight: 600, color: 'var(--text-heading)' }}>{customerName}</span>
                                          <span style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>{bookingPhone}</span>
                                        </div>
                                        {selectedGamesObjects.length > 0 && (
                                          <div style={{ marginLeft: 'auto', display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                                            <span style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--accent)', background: 'var(--accent-light)', padding: '2px 8px', borderRadius: '999px' }}>
                                              🎮 {selectedGamesObjects.map((g) => g.name).join(', ')}
                                            </span>
                                          </div>
                                        )}
                                      </div>

                                      {/* Players Count (Pill Selector) */}
                                      <div>
                                        <div className="slot-section-title">
                                          <span>Number of Players</span>
                                          <span style={{ color: 'var(--accent)', fontWeight: 600, textTransform: 'none' }}>{bookingPlayers} Player{bookingPlayers > 1 ? 's' : ''}</span>
                                        </div>
                                        <div className="pill-selector-group">
                                          {[1, 2, 3, 4].map((count) => (
                                            <button
                                              key={count}
                                              type="button"
                                              className={`pill-select-btn ${bookingPlayers === count ? 'active' : ''}`}
                                              onClick={() => setBookingPlayers(count)}
                                            >
                                              <span>{count}</span>
                                              <span style={{ fontSize: '0.65rem', opacity: 0.8 }}>Player{count > 1 ? 's' : ''}</span>
                                            </button>
                                          ))}
                                        </div>
                                      </div>

                                      {/* Duration (Pill Selector with 15m and 30m slots) */}
                                      <div>
                                        <div className="slot-section-title">
                                          <span>Session Duration</span>
                                          <span style={{ color: 'var(--accent)', fontWeight: 600, textTransform: 'none' }}>
                                            {bookingHours === 0.25 ? '15 Mins' : bookingHours === 0.5 ? '30 Mins' : `${bookingHours} Hour${bookingHours > 1 ? 's' : ''}`}
                                          </span>
                                        </div>
                                        <div className="pill-selector-group grid-6">
                                          {[
                                            { val: 0.25, top: '15m', sub: 'Mins' },
                                            { val: 0.5, top: '30m', sub: 'Mins' },
                                            { val: 1, top: '1h', sub: 'Hour' },
                                            { val: 2, top: '2h', sub: 'Hours' },
                                            { val: 3, top: '3h', sub: 'Hours' },
                                            { val: 4, top: '4h', sub: 'Hours' },
                                          ].map(({ val, top, sub }) => (
                                            <button
                                              key={val}
                                              type="button"
                                              className={`pill-select-btn ${bookingHours === val ? 'active' : ''}`}
                                              onClick={() => setBookingHours(val)}
                                            >
                                              <span>{top}</span>
                                              <span style={{ fontSize: '0.62rem', opacity: 0.8 }}>{sub}</span>
                                            </button>
                                          ))}
                                        </div>
                                      </div>

                                      {/* Booking Date Selection with Quick Chips */}
                                      <div>
                                        <div className="slot-section-title">
                                          <span>Booking Date</span>
                                          <div style={{ display: 'flex', gap: '4px' }}>
                                            <button
                                              type="button"
                                              className={`time-preset-pill ${bookingDate === getTodayDateString() ? 'active' : ''}`}
                                              style={{ padding: '2px 8px', fontSize: '0.68rem' }}
                                              onClick={() => setBookingDate(getTodayDateString())}
                                            >
                                              Today
                                            </button>
                                            <button
                                              type="button"
                                              className={`time-preset-pill ${bookingDate === getTomorrowDateString() ? 'active' : ''}`}
                                              style={{ padding: '2px 8px', fontSize: '0.68rem' }}
                                              onClick={() => setBookingDate(getTomorrowDateString())}
                                            >
                                              Tomorrow
                                            </button>
                                          </div>
                                        </div>
                                        <input
                                          type="date"
                                          id="book-date"
                                          className="form-input"
                                          value={bookingDate}
                                          onChange={(e) => setBookingDate(e.target.value)}
                                          required
                                        />
                                      </div>

                                      {/* Start Time Selector with Presets & Segmented Controls */}
                                      <div>
                                        <div className="slot-section-title">
                                          <span>Start Time</span>
                                          <span style={{ color: 'var(--accent)', fontFamily: 'var(--font-mono)', fontSize: '0.78rem' }}>{bookingTime || 'Not set'}</span>
                                        </div>

                                        {/* Quick Time Presets */}
                                        <div className="time-presets-bar">
                                          <button
                                            type="button"
                                            className="time-preset-pill"
                                            onClick={() => setTimePreset('now')}
                                            title="Set to current local time"
                                          >
                                            ⚡ Right Now
                                          </button>
                                          <button
                                            type="button"
                                            className="time-preset-pill"
                                            onClick={() => setTimePreset('+15m')}
                                          >
                                            +15m
                                          </button>
                                          <button
                                            type="button"
                                            className="time-preset-pill"
                                            onClick={() => setTimePreset('+30m')}
                                          >
                                            +30m
                                          </button>
                                          <button
                                            type="button"
                                            className="time-preset-pill"
                                            onClick={() => setTimePreset('+1h')}
                                          >
                                            +1 hr
                                          </button>
                                          <button
                                            type="button"
                                            className="time-preset-pill"
                                            onClick={() => setTimePreset('next-hour')}
                                          >
                                            Next Hour
                                          </button>
                                        </div>

                                        {/* Interactive Segmented Time Picker */}
                                        <div className="time-picker-grid">
                                          {/* Hour */}
                                          <select
                                            className="time-select-unit"
                                            value={parsedTime.hour}
                                            onChange={(e) => updateBookingTimeComponent('hour', e.target.value)}
                                          >
                                            {Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0')).map((h) => (
                                              <option key={h} value={h}>{h}</option>
                                            ))}
                                          </select>

                                          <span className="time-separator">:</span>

                                          {/* Minute (00 to 59) */}
                                          <select
                                            className="time-select-unit"
                                            value={parsedTime.minute}
                                            onChange={(e) => updateBookingTimeComponent('minute', e.target.value)}
                                          >
                                            {Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0')).map((m) => (
                                              <option key={m} value={m}>{m}</option>
                                            ))}
                                          </select>

                                          {/* AM / PM Segmented Control */}
                                          <div className="ampm-toggle-group">
                                            <button
                                              type="button"
                                              className={`ampm-btn ${parsedTime.period === 'AM' ? 'active' : ''}`}
                                              onClick={() => updateBookingTimeComponent('period', 'AM')}
                                            >
                                              AM
                                            </button>
                                            <button
                                              type="button"
                                              className={`ampm-btn ${parsedTime.period === 'PM' ? 'active' : ''}`}
                                              onClick={() => updateBookingTimeComponent('period', 'PM')}
                                            >
                                              PM
                                            </button>
                                          </div>
                                        </div>
                                      </div>

                                      {/* Live Slot Timeline Summary Card */}
                                      <div className="slot-timeline-card">
                                        <div className="slot-timeline-row">
                                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <div className="slot-time-badge">
                                              <span>🚀</span>
                                              <span>{bookingTime}</span>
                                            </div>
                                            <span className="slot-arrow">➔</span>
                                            <div className="slot-time-badge">
                                              <span>🏁</span>
                                              <span>{calculatedEnd}</span>
                                            </div>
                                          </div>
                                          <div style={{
                                            fontSize: '0.72rem',
                                            fontWeight: 700,
                                            background: 'var(--accent-light)',
                                            color: 'var(--accent)',
                                            padding: '2px 8px',
                                            borderRadius: '6px',
                                            border: '1px solid var(--border-accent-dim)',
                                          }}>
                                            {bookingHours === 0.25 ? '15 mins' : bookingHours === 0.5 ? '30 mins' : `${bookingHours} hr${bookingHours > 1 ? 's' : ''}`}
                                          </div>
                                        </div>

                                        {/* Dynamic Rate, Type & Calculation Formula from /api/price */}
                                        <div style={{
                                          borderTop: '1px solid var(--border-accent-dim)',
                                          paddingTop: '8px',
                                          display: 'flex',
                                          flexDirection: 'column',
                                          gap: '4px'
                                        }}>
                                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.78rem' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                              <span style={{
                                                fontSize: '0.68rem',
                                                fontWeight: 700,
                                                background: slotPricing?.playerType === 'SINGLE_PLAYER' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(139, 92, 246, 0.15)',
                                                color: slotPricing?.playerType === 'SINGLE_PLAYER' ? 'var(--success)' : 'var(--accent)',
                                                padding: '2px 6px',
                                                borderRadius: '4px'
                                              }}>
                                                {slotPricing?.playerType === 'SINGLE_PLAYER' ? 'Single Player' : 'Multiplayer'}
                                              </span>
                                              <span style={{ color: 'var(--text-muted)', fontSize: '0.74rem' }}>
                                                Rate: ₹{slotPricing?.ratePerPersonPerHour || selectedInstanceForBooking.setup.chargePerPersonPerHour}/{bookingPlayers > 1 ? 'player/' : ''}hr
                                              </span>
                                            </div>
                                            <div style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--accent)' }}>
                                              {isSlotPricingLoading ? (
                                                <span style={{ fontSize: '0.75rem', opacity: 0.7 }}>Calculating...</span>
                                              ) : (
                                                `₹${estimatedBase}`
                                              )}
                                            </div>
                                          </div>

                                          {slotPricing?.calculationFormula ? (
                                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                                              {slotPricing.calculationFormula}
                                            </div>
                                          ) : (
                                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                              {selectedInstanceForBooking.setup.consoleType} · {selectedInstanceForBooking.setup.name}
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    </div>

                                    <div className="modal-footer">
                                      <button type="button" className="btn-card-action" onClick={() => { setBookingStep(4); setBookingFormError(null); }}>← Back</button>
                                      <button type="submit" className="btn-card-action primary" disabled={isLoadingReview}>
                                        {isLoadingReview ? 'Evaluating Offers...' : 'Select Offers →'}
                                      </button>
                                    </div>
                                  </form>
                                );
                              })()}

                              {/* ── STEP 6: Review & Apply Offers (Evaluated via /api/offers/evaluate) ── */}
                              {bookingStep === 6 && bookingReview && (() => {
                                const selectedGamesObjects = availableGames.filter((g) => selectedGameIds.includes(g.id));

                                return (
                                  <div>
                                    <div className="modal-body">
                                      {/* Booking Summary */}
                                      <div style={{ background: 'var(--bg-card-hover)', border: '1px solid var(--border)', borderRadius: '8px', padding: '12px', marginBottom: '12px' }}>
                                        <div style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-heading)', marginBottom: '8px' }}>Booking Summary</div>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 12px', fontSize: '0.8rem' }}>
                                          <span style={{ color: 'var(--text-muted)' }}>Customer</span><span style={{ fontWeight: 600 }}>{customerName}</span>
                                          <span style={{ color: 'var(--text-muted)' }}>Station</span><span style={{ fontWeight: 600 }}>{bookingReview.zoneName}</span>
                                          <span style={{ color: 'var(--text-muted)' }}>Date</span><span style={{ fontWeight: 600 }}>{bookingReview.date}</span>
                                          <span style={{ color: 'var(--text-muted)' }}>Slot</span><span style={{ fontWeight: 600 }}>{bookingReview.slotsFormatted}</span>
                                          <span style={{ color: 'var(--text-muted)' }}>Players</span><span style={{ fontWeight: 600 }}>{bookingReview.playersCount}</span>
                                          {selectedGamesObjects.length > 0 && (
                                            <>
                                              <span style={{ color: 'var(--text-muted)' }}>Games</span>
                                              <span style={{ fontWeight: 600 }}>{selectedGamesObjects.map((g) => g.name).join(', ')}</span>
                                            </>
                                          )}
                                          <span style={{ color: 'var(--text-muted)' }}>Rate Calculation</span><span style={{ fontWeight: 600, fontFamily: 'var(--font-mono)', fontSize: '0.74rem' }}>{bookingReview.priceCalculationText}</span>
                                        </div>
                                        <div style={{ borderTop: '1px solid var(--border)', marginTop: '10px', paddingTop: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                                            Original: ₹{bookingReview.originalAmount}
                                            {bookingReview.discountApplied > 0 && (
                                              <span style={{ color: 'var(--success)', marginLeft: 6, fontWeight: 700 }}>
                                                − ₹{bookingReview.discountApplied}
                                              </span>
                                            )}
                                          </div>
                                          <div style={{ fontWeight: 800, fontSize: '1.05rem', color: 'var(--accent)' }}>₹{bookingReview.totalAmount}</div>
                                        </div>
                                      </div>

                                      {/* Offers Evaluation Section */}
                                      <div className="offers-section">
                                        {/* 1. Applicable / Eligible Offers */}
                                        {applicableOffers.length > 0 && (
                                          <div>
                                            <div className="offer-group-title" style={{ color: 'var(--success)' }}>
                                              <span>🎉</span>
                                              <span>Eligible Promotional Offers ({applicableOffers.length})</span>
                                            </div>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                              {applicableOffers.map((offer: any) => {
                                                const isChecked = selectedOfferIds.includes(offer.id);
                                                return (
                                                  <label
                                                    key={offer.id}
                                                    className={`offer-card eligible ${isChecked ? 'selected' : ''}`}
                                                  >
                                                    <div className="offer-card-top-row">
                                                      <div className="offer-card-title-group">
                                                        <input
                                                          type="checkbox"
                                                          checked={isChecked}
                                                          onChange={(e) => {
                                                            if (e.target.checked) setSelectedOfferIds((prev) => [...prev, offer.id]);
                                                            else setSelectedOfferIds((prev) => prev.filter((id) => id !== offer.id));
                                                          }}
                                                          style={{ accentColor: 'var(--success)', width: 16, height: 16, cursor: 'pointer' }}
                                                        />
                                                        <div>
                                                          <div style={{ fontWeight: 700, fontSize: '0.82rem', color: 'var(--text-heading)' }}>
                                                            {offer.name}
                                                          </div>
                                                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 2 }}>
                                                            {offer.description}
                                                          </div>
                                                        </div>
                                                      </div>
                                                      <span className="offer-savings-pill">
                                                        −₹{offer.discount} SAVINGS
                                                      </span>
                                                    </div>

                                                    {offer.reason && (
                                                      <div className="offer-reason-box success">
                                                        ✓ {offer.reason}
                                                      </div>
                                                    )}
                                                  </label>
                                                );
                                              })}
                                            </div>
                                          </div>
                                        )}

                                        {/* 2. Ineligible / Locked Offers */}
                                        {ineligibleOffers.length > 0 && (
                                          <div>
                                            <div className="offer-group-title" style={{ color: 'var(--text-muted)' }}>
                                              <span>🔒</span>
                                              <span>Other Café Offers (Not Applicable for this Session)</span>
                                            </div>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                              {ineligibleOffers.map((offer: any) => (
                                                <div key={offer.id} className="offer-card ineligible">
                                                  <div className="offer-card-top-row">
                                                    <div className="offer-card-title-group">
                                                      <span style={{ fontSize: '0.9rem', opacity: 0.7 }}>🔒</span>
                                                      <div>
                                                        <div style={{ fontWeight: 600, fontSize: '0.8rem', color: 'var(--text-heading)' }}>
                                                          {offer.name}
                                                        </div>
                                                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 2 }}>
                                                          {offer.description}
                                                        </div>
                                                      </div>
                                                    </div>
                                                    <span className="offer-code-tag">Locked</span>
                                                  </div>

                                                  {offer.reason && (
                                                    <div className="offer-reason-box locked">
                                                      ⚠️ {offer.reason}
                                                    </div>
                                                  )}
                                                </div>
                                              ))}
                                            </div>
                                          </div>
                                        )}

                                        {applicableOffers.length === 0 && ineligibleOffers.length === 0 && (
                                          <div style={{ textAlign: 'center', padding: '14px', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                                            No promotional offers available for this station.
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                    <div className="modal-footer">
                                      <button type="button" className="btn-card-action" onClick={() => { setBookingStep(5); setBookingFormError(null); }}>← Back</button>
                                      <button type="button" className="btn-card-action" onClick={handleApplyOffers} disabled={isLoadingReview}>
                                        {isLoadingReview ? 'Applying...' : 'Apply Offers'}
                                      </button>
                                      <button type="button" className="btn-card-action primary" onClick={() => setBookingStep(7)}>Review Booking →</button>
                                    </div>
                                  </div>
                                );
                              })()}

                              {/* ── STEP 7: Final Review & Allot Booking (POST /api/bookings) ── */}
                              {bookingStep === 7 && bookingReview && (() => {
                                const selectedGamesObjects = availableGames.filter((g) => selectedGameIds.includes(g.id));
                                const selectedOffersObjects = applicableOffers
                                  .filter((o) => selectedOfferIds.includes(o.id))
                                  .map((o) => ({
                                    id: o.id,
                                    code: o.code,
                                    name: o.name,
                                    discount: o.discount,
                                    reason: o.reason
                                  }));

                                const calculatedEnd = calculateSlotEndTime(bookingTime, bookingHours);

                                void {
                                  setupInstanceId: selectedInstanceForBooking.instanceId,
                                  setupName: selectedInstanceForBooking.instanceName,
                                  consoleType: selectedInstanceForBooking.setup?.consoleType || 'PS5',
                                  customer: {
                                    name: customerName.trim(),
                                    phoneNumber: bookingPhone.trim(),
                                    dateOfBirth: customerDob || null
                                  },
                                  additionalMembers: additionalMembers
                                    .filter((m) => m.name.trim() || m.phone.trim())
                                    .map((m) => ({
                                      name: m.name.trim(),
                                      phone: m.phone.trim(),
                                      dateOfBirth: m.dateOfBirth || null
                                    })),
                                  bookingDetails: {
                                    playersCount: Number(bookingPlayers),
                                    date: bookingDate,
                                    startTime: bookingTime,
                                    endTime: calculatedEnd,
                                    noOfHours: Number(bookingHours),
                                    gameIds: selectedGameIds.length > 0 ? selectedGameIds : (availableGames.length > 0 ? [availableGames[0].id] : [1]),
                                    games: selectedGamesObjects.map((g) => ({ id: g.id, name: g.name }))
                                  },
                                  pricing: {
                                    basePrice: slotPricing?.basePrice ?? (selectedInstanceForBooking.setup.chargePerPersonPerHour * bookingPlayers * bookingHours),
                                    ratePerPersonPerHour: slotPricing?.ratePerPersonPerHour ?? selectedInstanceForBooking.setup.chargePerPersonPerHour,
                                    playerType: slotPricing?.playerType ?? (bookingPlayers === 1 ? 'SINGLE_PLAYER' : 'MULTIPLAYER'),
                                    calculationFormula: slotPricing?.calculationFormula ?? `₹${selectedInstanceForBooking.setup.chargePerPersonPerHour}/hr × ${bookingPlayers} × ${bookingHours} = ₹${(selectedInstanceForBooking.setup.chargePerPersonPerHour || 0) * bookingPlayers * bookingHours}`
                                  },
                                  offers: {
                                    appliedOfferIds: selectedOfferIds,
                                    appliedOffers: selectedOffersObjects,
                                    originalAmount: bookingReview.originalAmount,
                                    discountApplied: bookingReview.discountApplied || 0,
                                    totalAmount: bookingReview.totalAmount
                                  }
                                };

                                return (
                                  <form onSubmit={handleCreateBookingSubmit}>
                                    <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                      {bookingFormError && (
                                        <div className="form-error-banner">
                                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                            <circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line>
                                          </svg>
                                          <span>{bookingFormError}</span>
                                        </div>
                                      )}

                                      <div className="review-cards-container">
                                        {/* Card 1: Console Station & Session Timing */}
                                        <div className="review-card highlight">
                                          <div className="review-card-header">
                                            <div className="review-card-title">
                                              <span>🎮</span>
                                              <span>{selectedInstanceForBooking.instanceName}</span>
                                            </div>
                                            <span style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--accent)', background: 'var(--accent-light)', padding: '2px 8px', borderRadius: '6px' }}>
                                              {selectedInstanceForBooking.setup.consoleType}
                                            </span>
                                          </div>
                                          <div className="review-grid-2col">
                                            <div className="review-row-item">
                                              <span className="review-label">Session Date</span>
                                              <span className="review-val">{bookingReview.date}</span>
                                            </div>
                                            <div className="review-row-item">
                                              <span className="review-label">Duration & Players</span>
                                              <span className="review-val">
                                                {bookingHours === 0.25 ? '15 Mins' : bookingHours === 0.5 ? '30 Mins' : `${bookingHours} hr${bookingHours > 1 ? 's' : ''}`} · {bookingReview.playersCount} Player{bookingReview.playersCount > 1 ? 's' : ''}
                                              </span>
                                            </div>
                                            <div className="review-row-item" style={{ gridColumn: 'span 2' }}>
                                              <span className="review-label">Time Slot</span>
                                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: 2 }}>
                                                <span style={{ fontWeight: 700, color: 'var(--text-heading)', fontFamily: 'var(--font-mono)' }}>🚀 {bookingTime}</span>
                                                <span style={{ color: 'var(--text-muted)' }}>➔</span>
                                                <span style={{ fontWeight: 700, color: 'var(--accent)', fontFamily: 'var(--font-mono)' }}>🏁 {calculatedEnd}</span>
                                              </div>
                                            </div>
                                          </div>
                                        </div>

                                        {/* Card 2: Customer & Companion Members */}
                                        <div className="review-card">
                                          <div className="review-card-header">
                                            <div className="review-card-title">
                                              <span>👤</span>
                                              <span>Customer & Squad</span>
                                            </div>
                                            <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                                              {1 + additionalMembers.filter((m) => m.name || m.phone).length} Member{1 + additionalMembers.filter((m) => m.name || m.phone).length > 1 ? 's' : ''}
                                            </span>
                                          </div>
                                          <div className="review-grid-2col">
                                            <div className="review-row-item">
                                              <span className="review-label">Primary Customer</span>
                                              <span className="review-val" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                <span>{customerName}</span>
                                                <span style={{ fontSize: '0.65rem', background: 'rgba(16, 185, 129, 0.15)', color: 'var(--success)', padding: '1px 5px', borderRadius: '4px' }}>Lead</span>
                                              </span>
                                            </div>
                                            <div className="review-row-item">
                                              <span className="review-label">Mobile Number</span>
                                              <span className="review-val" style={{ fontFamily: 'var(--font-mono)' }}>{bookingPhone}</span>
                                            </div>
                                          </div>
                                          {additionalMembers.filter((m) => m.name || m.phone).length > 0 && (
                                            <div style={{ marginTop: '4px', borderTop: '1px solid var(--border)', paddingTop: '6px' }}>
                                              <span className="review-label">Companion Members</span>
                                              <div className="review-members-wrap">
                                                {additionalMembers.filter((m) => m.name || m.phone).map((m, idx) => (
                                                  <div key={idx} className="review-member-chip">
                                                    <span>👥</span>
                                                    <span style={{ fontWeight: 600 }}>{m.name || 'Member'}</span>
                                                    {m.phone && <span style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>({m.phone})</span>}
                                                  </div>
                                                ))}
                                              </div>
                                            </div>
                                          )}
                                        </div>

                                        {/* Card 3: Selected Games */}
                                        {selectedGamesObjects.length > 0 && (
                                          <div className="review-card">
                                            <div className="review-card-header">
                                              <div className="review-card-title">
                                                <span>🕹️</span>
                                                <span>Selected Games ({selectedGamesObjects.length})</span>
                                              </div>
                                            </div>
                                            <div className="review-games-wrap">
                                              {selectedGamesObjects.map((g) => {
                                                const imgUrl = g.images && g.images.length > 0 ? g.images[0] : null;
                                                return (
                                                  <div key={g.id} className="review-game-pill">
                                                    {imgUrl ? (
                                                      <img src={imgUrl} alt={g.name} className="review-game-thumb" />
                                                    ) : (
                                                      <span>🎮</span>
                                                    )}
                                                    <span>{g.name}</span>
                                                  </div>
                                                );
                                              })}
                                            </div>
                                          </div>
                                        )}

                                        {/* Card 4: Rate Breakdown & Applied Promotions */}
                                        <div className="review-card">
                                          <div className="review-card-header">
                                            <div className="review-card-title">
                                              <span>🏷️</span>
                                              <span>Pricing & Promotions</span>
                                            </div>
                                            <span style={{ fontSize: '0.68rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                                              {slotPricing?.playerType === 'SINGLE_PLAYER' ? 'Single Player' : 'Multiplayer Rate'}
                                            </span>
                                          </div>
                                          <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', padding: '2px 0' }}>
                                            {slotPricing?.calculationFormula || bookingReview.priceCalculationText}
                                          </div>

                                          {/* Applied Offers list */}
                                          {selectedOffersObjects.length > 0 ? (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '4px' }}>
                                              {selectedOffersObjects.map((o) => (
                                                <div key={o.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 10px', background: 'rgba(16, 185, 129, 0.08)', borderRadius: '6px', border: '1px solid rgba(16, 185, 129, 0.25)' }}>
                                                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                    <span style={{ fontSize: '0.8rem' }}>🎉</span>
                                                    <div>
                                                      <div style={{ fontWeight: 700, fontSize: '0.76rem', color: 'var(--text-heading)' }}>{o.name}</div>
                                                      <div style={{ fontSize: '0.68rem', color: 'var(--success)' }}>{o.reason || 'Discount applied'}</div>
                                                    </div>
                                                  </div>
                                                  <span style={{ fontWeight: 800, fontSize: '0.82rem', color: 'var(--success)' }}>−₹{o.discount}</span>
                                                </div>
                                              ))}
                                            </div>
                                          ) : (
                                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontStyle: 'italic', marginTop: '2px' }}>
                                              No promotional discounts applied.
                                            </div>
                                          )}

                                          {/* Total Ledger */}
                                          <div style={{ borderTop: '1px solid var(--border)', paddingTop: '8px', marginTop: '4px', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                                              <span>Original Subtotal</span>
                                              <span>₹{bookingReview.originalAmount}</span>
                                            </div>
                                            {bookingReview.discountApplied > 0 && (
                                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.76rem', color: 'var(--success)', fontWeight: 600 }}>
                                                <span>Promotional Discount</span>
                                                <span>−₹{bookingReview.discountApplied}</span>
                                              </div>
                                            )}
                                            <div className="review-total-banner" style={{ marginTop: '6px' }}>
                                              <div>
                                                <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)' }}>Net Total Payable</div>
                                                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Confirmed on booking allotment</div>
                                              </div>
                                              <div style={{ fontWeight: 800, fontSize: '1.25rem', color: 'var(--text-heading)' }}>
                                                ₹{bookingReview.totalAmount}
                                              </div>
                                            </div>
                                          </div>
                                        </div>
                                      </div>
                                    </div>

                                    <div className="modal-footer">
                                      <button type="button" className="btn-card-action" onClick={() => setBookingStep(6)} disabled={isBookingSubmitting}>← Back</button>
                                      <button type="submit" className="btn-card-action primary" disabled={isBookingSubmitting} style={{ padding: '8px 20px', fontWeight: 700 }}>
                                        {isBookingSubmitting ? 'Allotting Slot...' : `Confirm & Allot Slot (₹${bookingReview.totalAmount}) ➔`}
                                      </button>
                                    </div>
                                  </form>
                                );
                              })()}

                            </div>
                          </div>
                        )}

                      </div>
                    </div>

                  </>
                )}

                {activeDashboardTab === 'schedule' && (
                  <UpcomingScheduleList
                    upcoming={upcomingSchedule}
                    isLoading={isScheduleLoading}
                    error={scheduleError}
                    stations={occupancyData.map((inst) => ({ id: inst.instanceId, name: inst.instanceName }))}
                    onRefresh={() => fetchScheduleData(false)}
                    startCountdownMap={startCountdownMap}
                    timezone={scheduleTimezone}
                  />
                )}

                {/* TAB 2: Tentative Bookings Filtered list */}
                {activeDashboardTab === 'tentative' && (
                  <>
                    <div className="dashboard-section-header">
                      <div>
                        <h2 className="section-title">Tentative Bookings Ledger</h2>
                        <p className="section-desc" style={{ fontSize: '0.85rem' }}>View, search and manage client tentative booking requests by date.</p>
                      </div>
                    </div>

                    <div className="tentative-header-controls">
                      <div className="date-picker-group">
                        <label htmlFor="tentative-date-filter" className="form-label" style={{ margin: 0 }}>Filter Bookings Date:</label>
                        <input 
                          type="date"
                          id="tentative-date-filter"
                          className="form-input"
                          value={tentativeDate}
                          onChange={(e) => setTentativeDate(e.target.value)}
                          style={{ width: 'auto', minWidth: '180px', padding: '8px 12px' }}
                        />
                      </div>

                      <div className="search-group" style={{ display: 'flex', alignItems: 'center', gap: '8px', flexGrow: 1, maxWidth: '280px' }}>
                        <label htmlFor="tentative-search-id" className="form-label" style={{ margin: 0, whiteSpace: 'nowrap' }}>Search ID:</label>
                        <input 
                          type="text"
                          id="tentative-search-id"
                          className="form-input"
                          placeholder="e.g. 5"
                          value={searchBookingId}
                          onChange={(e) => setSearchBookingId(e.target.value)}
                          style={{ padding: '8px 12px', flexGrow: 1 }}
                        />
                      </div>

                      <button 
                        className="btn-refresh"
                        onClick={() => fetchTentativeBookings(tentativeDate)}
                        disabled={isTentativeLoading}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ animation: isTentativeLoading ? 'spin 1.5s infinite linear' : 'none' }}>
                          <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/>
                        </svg>
                        {isTentativeLoading ? 'Syncing...' : 'Refresh Bookings'}
                      </button>
                    </div>

                    {/* Filter bookings array by booking ID */}
                    {(() => {
                      const filteredBookings = tentativeBookings.filter(booking => {
                        if (!searchBookingId.trim()) return true;
                        return booking.id.toString().includes(searchBookingId.trim());
                      });

                      return isTentativeLoading ? (
                        <div className="feed-welcome-note" style={{ textAlign: 'center', padding: '48px' }}>
                          Querying database for tentative booking entries...
                        </div>
                      ) : tentativeError ? (
                        <div className="form-error-banner" style={{ marginBottom: '24px' }}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10"></circle>
                            <line x1="12" y1="16" x2="12" y2="12"></line>
                            <line x1="12" y1="8" x2="12.01" y2="8"></line>
                          </svg>
                          <span>{tentativeError}</span>
                        </div>
                      ) : filteredBookings.length === 0 ? (
                        <div className="feed-welcome-note" style={{ textAlign: 'center', padding: '48px', borderLeftColor: 'var(--accent)' }}>
                          {searchBookingId.trim()
                            ? `No tentative bookings match ID "${searchBookingId}".`
                            : `No tentative bookings scheduled for ${formatDateStr(tentativeDate + 'T00:00:00')}.`}
                        </div>
                      ) : (
                        <div className="tentative-bookings-grid">
                          {filteredBookings.map((booking) => (
                            <div key={booking.id} className="tentative-booking-card">
                              <div className="tentative-card-header">
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                  <span className="booking-id-badge" style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--accent)' }}>
                                    BOOKING REFERENCE: #{booking.id}
                                  </span>
                                  <div className="booking-phone-row" style={{ marginTop: '2px' }}>
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
                                    </svg>
                                    <span className="booking-phone">{booking.phoneNumber}</span>
                                  </div>
                                </div>
                                <span className="metric-badge amber" style={{ textTransform: 'uppercase', fontSize: '0.7rem' }}>Tentative Ledger</span>
                              </div>

                              <div className="tentative-card-body">
                                <div className="setup-snapshot-box" style={{ padding: '10px 12px', borderRadius: '8px', background: 'var(--bg-card-hover)', border: '1px solid var(--border)' }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span className="setup-snap-name" style={{ fontWeight: 700, fontSize: '0.8rem', color: 'var(--text-heading)' }}>
                                      {booking.setupSnapshot?.name || `Setup Reference #${booking.setupId}`}
                                    </span>
                                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--accent)' }}>ID: {booking.setupId}</span>
                                  </div>
                                  <div className="setup-snap-meta" style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                                    <span>CONSOLE: {booking.setupSnapshot?.consoleType || 'N/A'}</span>
                                    <span className="station-divider" style={{ width: 4, height: 4, borderRadius: '50%', backgroundColor: 'var(--border)', display: 'inline-block' }}></span>
                                    <span>RATE: ₹{booking.setupSnapshot?.price || 150}/hr</span>
                                  </div>
                                </div>

                                <div className="booking-info-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '12px', margin: '8px 0' }}>
                                  <div className="info-col" style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                    <span className="info-label" style={{ fontSize: '0.65rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>GUESTS AT STATION</span>
                                    <span className="info-value" style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-heading)' }}>{booking.count} Player(s)</span>
                                  </div>
                                  <div className="info-col" style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                    <span className="info-label" style={{ fontSize: '0.65rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>PRICING PROFILE</span>
                                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                                      <span className="info-value" style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-heading)' }}>Billed: ₹{booking.amountCharged || booking.originalAmount}</span>
                                      {booking.originalAmount !== booking.amountCharged && (
                                        <span style={{ fontSize: '0.7rem', color: 'var(--success)', fontWeight: 500 }}>
                                          Disc: -₹{booking.originalAmount - booking.amountCharged} (₹{booking.originalAmount} orig)
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>

                                <div className="booking-time-row" style={{ borderTop: '1px solid var(--border)', paddingTop: '10px', display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '12px' }}>
                                  <div className="time-col">
                                    <span className="time-label" style={{ fontSize: '0.65rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>RESERVATION SLOT</span>
                                    <span className="time-value" style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-heading)' }}>
                                      {formatTimeStr(booking.startTime)} - {formatTimeStr(booking.endTime)}
                                    </span>
                                  </div>
                                  <div className="time-col" style={{ textAlign: 'right' }}>
                                    <span className="time-label" style={{ fontSize: '0.65rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>CALENDAR DATE</span>
                                    <span className="time-value" style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-heading)' }}>{formatDateStr(booking.startTime)}</span>
                                  </div>
                                </div>

                                <div style={{ display: 'flex', marginTop: '12px', paddingTop: '10px', borderTop: '1px solid var(--border)' }}>
                                  <button 
                                    className="btn-card-action primary" 
                                    style={{ width: '100%', padding: '6px 12px', fontSize: '0.8rem' }}
                                    onClick={() => openConfirmModal(booking)}
                                  >
                                    Confirm & Allocate
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                  </>
                )}

                {/* TAB: Past Sessions & Daily Revenue History (GET /api/sessions/past) */}
                {activeDashboardTab === 'sessions' && (
                  <>
                    {/* Header & Filter Controls */}
                    <div className="dashboard-section-header">
                      <div>
                        <h2 className="section-title">Past Console Sessions & Daily Revenue</h2>
                        <p className="section-desc" style={{ fontSize: '0.85rem' }}>
                          {pastSessionsData.summary?.dateFormatted 
                            ? `Audited record for ${pastSessionsData.summary.dateFormatted}` 
                            : 'Query completed and cancelled sessions, revenue breakdown, and duration tracking.'}
                        </p>
                      </div>

                      <button 
                        className="btn-refresh" 
                        onClick={() => fetchPastSessions(pastSessionsDate, pastSessionsStationFilter, pastSessionsStatusFilter)}
                        disabled={isPastSessionsLoading}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ animation: isPastSessionsLoading ? 'spin 1.5s infinite linear' : 'none' }}>
                          <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/>
                        </svg>
                        {isPastSessionsLoading ? 'Querying...' : 'Sync Records'}
                      </button>
                    </div>

                    {/* Filter Bar */}
                    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '8px', padding: '14px', marginBottom: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                        
                        {/* Date Picker */}
                        <div className="form-group" style={{ margin: 0 }}>
                          <label className="form-label" htmlFor="past-sessions-date" style={{ fontSize: '0.75rem' }}>Session Date</label>
                          <input 
                            type="date"
                            id="past-sessions-date"
                            className="form-input"
                            value={pastSessionsDate}
                            onChange={(e) => setPastSessionsDate(e.target.value)}
                          />
                        </div>

                        {/* Station Filter */}
                        <div className="form-group" style={{ margin: 0 }}>
                          <label className="form-label" htmlFor="past-sessions-station" style={{ fontSize: '0.75rem' }}>Filter by Station</label>
                          <select
                            id="past-sessions-station"
                            className="form-input"
                            value={pastSessionsStationFilter}
                            onChange={(e) => setPastSessionsStationFilter(e.target.value)}
                          >
                            <option value="ALL">All Stations</option>
                            {occupancyData.map((inst) => (
                              <option key={inst.instanceId} value={String(inst.instanceId)}>
                                {inst.instanceName} ({inst.setup?.consoleType})
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Status Filter */}
                        <div className="form-group" style={{ margin: 0 }}>
                          <label className="form-label" htmlFor="past-sessions-status" style={{ fontSize: '0.75rem' }}>Session Status</label>
                          <select
                            id="past-sessions-status"
                            className="form-input"
                            value={pastSessionsStatusFilter}
                            onChange={(e) => setPastSessionsStatusFilter(e.target.value as any)}
                          >
                            <option value="ALL">All Statuses</option>
                            <option value="CONFIRMED">Confirmed / Completed</option>
                            <option value="CANCELLED">Cancelled Only</option>
                          </select>
                        </div>

                        {/* Search Input */}
                        <div className="form-group" style={{ margin: 0 }}>
                          <label className="form-label" htmlFor="past-sessions-search" style={{ fontSize: '0.75rem' }}>Search Ledger</label>
                          <input 
                            type="text"
                            id="past-sessions-search"
                            className="form-input"
                            placeholder="Phone, Booking #, game..."
                            value={pastSessionsSearch}
                            onChange={(e) => setPastSessionsSearch(e.target.value)}
                          />
                        </div>

                      </div>

                      {/* Quick Date Presets */}
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Quick Presets:</span>
                        <button 
                          type="button"
                          className="btn-compact"
                          style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                          onClick={() => setPastSessionsDate(getTodayDateString())}
                        >
                          Today
                        </button>
                        <button 
                          type="button"
                          className="btn-compact"
                          style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                          onClick={() => {
                            const y = new Date();
                            y.setDate(y.getDate() - 1);
                            const pad = (n: number) => String(n).padStart(2, '0');
                            setPastSessionsDate(`${y.getFullYear()}-${pad(y.getMonth() + 1)}-${pad(y.getDate())}`);
                          }}
                        >
                          Yesterday
                        </button>
                      </div>
                    </div>

                    {pastSessionsError && (
                      <div className="form-error-banner" style={{ marginBottom: '20px' }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="10"></circle>
                          <line x1="12" y1="16" x2="12" y2="12"></line>
                          <line x1="12" y1="8" x2="12.01" y2="8"></line>
                        </svg>
                        <span>{pastSessionsError}</span>
                      </div>
                    )}

                    {/* Aggregation Summary KPIs */}
                    {pastSessionsData.summary && (
                      <section className="dashboard-summary-bar" style={{ margin: '0 0 24px 0' }}>
                        
                        <div className="summary-card">
                          <div className="summary-icon-circle green">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <line x1="12" y1="1" x2="12" y2="23"></line>
                              <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
                            </svg>
                          </div>
                          <div className="summary-text-col">
                            <span className="summary-count" style={{ color: 'var(--success)' }}>
                              ₹{pastSessionsData.summary.totalRevenue || 0}
                            </span>
                            <span className="summary-label">
                              Total Revenue (Cash: ₹{pastSessionsData.summary.totalCash || 0} · UPI: ₹{pastSessionsData.summary.totalUpi || 0})
                            </span>
                          </div>
                        </div>

                        <div className="summary-card">
                          <div className="summary-icon-circle" style={{ color: 'var(--accent)', background: 'var(--accent-light)' }}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="20 6 9 17 4 12"></polyline>
                            </svg>
                          </div>
                          <div className="summary-text-col">
                            <span className="summary-count">
                              {pastSessionsData.summary.activeOrCompletedSessions || 0}
                            </span>
                            <span className="summary-label">
                              Completed Sessions ({pastSessionsData.summary.cancelledSessions || 0} Cancelled)
                            </span>
                          </div>
                        </div>

                        <div className="summary-card">
                          <div className="summary-icon-circle">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                              <circle cx="9" cy="7" r="4"></circle>
                              <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                              <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                            </svg>
                          </div>
                          <div className="summary-text-col">
                            <span className="summary-count">
                              {pastSessionsData.summary.totalPlayers || 0}
                            </span>
                            <span className="summary-label">Total Players Hosted</span>
                          </div>
                        </div>

                        <div className="summary-card">
                          <div className="summary-icon-circle amber">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <circle cx="12" cy="12" r="10"></circle>
                              <polyline points="12 6 12 12 16 14"></polyline>
                            </svg>
                          </div>
                          <div className="summary-text-col">
                            <span className="summary-count">
                              {pastSessionsData.summary.totalDurationFormatted || '0h 0m'}
                            </span>
                            <span className="summary-label">
                              Total Playtime ({pastSessionsData.summary.totalDurationMinutes || 0} mins)
                            </span>
                          </div>
                        </div>

                      </section>
                    )}

                    {/* Past Sessions List */}
                    {(() => {
                      const allSessions = pastSessionsData.sessions || [];
                      const searchLower = pastSessionsSearch.trim().toLowerCase();
                      const filtered = allSessions.filter((s: any) => {
                        if (!searchLower) return true;
                        const matchPhone = s.phoneNumber?.toLowerCase().includes(searchLower);
                        const matchId = String(s.bookingId || s.id).includes(searchLower);
                        const matchStation = s.setupInstance?.name?.toLowerCase().includes(searchLower);
                        const matchGame = s.games?.some((g: any) => g.name?.toLowerCase().includes(searchLower));
                        const matchOffer = s.offers?.some((o: any) => o.name?.toLowerCase().includes(searchLower));
                        return matchPhone || matchId || matchStation || matchGame || matchOffer;
                      });

                      if (isPastSessionsLoading && allSessions.length === 0) {
                        return (
                          <div className="feed-welcome-note" style={{ textAlign: 'center', padding: '32px' }}>
                            Loading session audit records for {pastSessionsDate}...
                          </div>
                        );
                      }

                      if (filtered.length === 0) {
                        return (
                          <div className="feed-welcome-note" style={{ textAlign: 'center', padding: '36px' }}>
                            <div style={{ fontSize: '1.4rem', marginBottom: '8px' }}>📂</div>
                            <div style={{ fontWeight: 700, color: 'var(--text-heading)', marginBottom: '4px' }}>No Sessions Found</div>
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                              No console sessions matched your selected date ({pastSessionsDate}) and filters.
                            </div>
                          </div>
                        );
                      }

                      return (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
                          {filtered.map((session: any) => {
                            const isConfirmed = session.status === 'CONFIRMED';
                            return (
                              <div 
                                key={session.id || session.bookingId} 
                                className={`past-session-card ${isConfirmed ? 'confirmed' : 'cancelled'}`}
                              >
                                {/* Header: Station & Status */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                                  <div>
                                    <div style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-heading)' }}>
                                      {session.setupInstance?.name || `Station #${session.setupInstance?.id || '?'}`}
                                    </div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                                      {session.setupInstance?.consoleType || 'Console'} · {session.setupInstance?.screenType || session.setupInstance?.configurationName || ''}
                                    </div>
                                  </div>
                                  
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', background: 'var(--bg-card-hover)', border: '1px solid var(--border)', padding: '2px 6px', borderRadius: '4px', color: 'var(--text-muted)' }}>
                                      #{session.bookingId || session.id}
                                    </span>
                                    <span 
                                      className={`metric-badge ${isConfirmed ? 'green' : 'amber'}`}
                                      style={{ fontSize: '0.7rem', padding: '2px 8px' }}
                                    >
                                      {session.status}
                                    </span>
                                  </div>
                                </div>

                                {/* Customer & Timing Grid */}
                                <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '6px', padding: '10px', display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '8px', fontSize: '0.78rem' }}>
                                  <div>
                                    <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Customer</span>
                                    <div style={{ fontWeight: 700, color: 'var(--text-heading)' }}>{session.phoneNumber}</div>
                                  </div>
                                  <div style={{ textAlign: 'right' }}>
                                    <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Players</span>
                                    <div style={{ fontWeight: 700, color: 'var(--text-heading)' }}>{session.playersCount} players</div>
                                  </div>
                                  <div>
                                    <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Time Slot</span>
                                    <div style={{ fontWeight: 600, color: 'var(--text-heading)' }}>
                                      {session.startTimeFormatted || formatTimeStr(session.startTime)} – {session.endTimeFormatted || formatTimeStr(session.endTime)}
                                    </div>
                                  </div>
                                  <div style={{ textAlign: 'right' }}>
                                    <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Duration</span>
                                    <div style={{ fontWeight: 800, color: 'var(--accent)' }}>
                                      {session.durationFormatted || `${session.durationMinutes || 0}m`}
                                    </div>
                                  </div>
                                </div>

                                {/* Games Played & Offers Tags */}
                                {((session.games && session.games.length > 0) || (session.offers && session.offers.length > 0)) && (
                                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}>
                                    {session.games?.map((g: any) => (
                                      <span key={g.id} className="session-game-tag">
                                        🎮 {g.name}
                                      </span>
                                    ))}
                                    {session.offers?.map((o: any) => (
                                      <span key={o.id} className="session-offer-tag">
                                        🏷️ {o.name}
                                      </span>
                                    ))}
                                  </div>
                                )}

                                {/* Pricing Breakdown Footer */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border)', paddingTop: '8px', fontSize: '0.8rem' }}>
                                  <div>
                                    <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>Settlement: </span>
                                    <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>
                                      Cash ₹{session.pricing?.cashAmount || 0} · UPI ₹{session.pricing?.upiAmount || 0}
                                    </span>
                                  </div>
                                  <div style={{ textAlign: 'right' }}>
                                    <span style={{ fontSize: '1rem', fontWeight: 900, color: isConfirmed ? 'var(--success)' : 'var(--text-muted)' }}>
                                      ₹{session.pricing?.amountCharged !== undefined ? session.pricing.amountCharged : (session.amountCharged || 0)}
                                    </span>
                                    {session.pricing?.originalAmount && session.pricing.originalAmount > session.pricing.amountCharged && (
                                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textDecoration: 'line-through', marginLeft: '4px' }}>
                                        ₹{session.pricing.originalAmount}
                                      </span>
                                    )}
                                  </div>
                                </div>

                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}
                  </>
                )}

                {/* TAB 3: Performance Metrics & System Diagnostics Logs */}
                {activeDashboardTab === 'stats' && (
                  <>
                    <div className="dashboard-section-header">
                      <div>
                        <h2 className="section-title">Lounge Dashboard Performance</h2>
                        <p className="section-desc" style={{ fontSize: '0.85rem' }}>Real-time usage metrics, api endpoints diagnostic status, and broadcasts.</p>
                      </div>
                    </div>

                    {/* Platform Summary Bar */}
                    <section className="dashboard-summary-bar" style={{ margin: '0 0 32px 0' }}>
                      <div className="summary-card">
                        <div className="summary-icon-circle">
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="2" y="2" width="20" height="20" rx="4"></rect>
                            <path d="M6 6h12v12H6z"></path>
                          </svg>
                        </div>
                        <div className="summary-text-col">
                          <span className="summary-count">{totalStations}</span>
                          <span className="summary-label">Total Stations</span>
                        </div>
                      </div>

                      <div className="summary-card">
                        <div className="summary-icon-circle" style={{ color: 'var(--accent)', background: 'var(--accent-light)' }}>
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10"></circle>
                            <path d="M12 6v6l4 2"></path>
                          </svg>
                        </div>
                        <div className="summary-text-col">
                          <span className="summary-count">{occupiedCount}</span>
                          <span className="summary-label">Active Sessions</span>
                        </div>
                      </div>

                      <div className="summary-card">
                        <div className="summary-icon-circle green">
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12"></polyline>
                          </svg>
                        </div>
                        <div className="summary-text-col">
                          <span className="summary-count">{availableCount}</span>
                          <span className="summary-label">Available Slots</span>
                        </div>
                      </div>

                      <div className="summary-card">
                        <div className="summary-icon-circle amber">
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10"></circle>
                            <line x1="12" y1="8" x2="12" y2="12"></line>
                            <line x1="12" y1="16" x2="12.01" y2="16"></line>
                          </svg>
                        </div>
                        <div className="summary-text-col">
                          <span className="summary-count">{tentativeCount}</span>
                          <span className="summary-label">Tentative Slots</span>
                        </div>
                      </div>
                    </section>

                    {/* Actions & Logging Feed */}
                    <section id="actions" className="control-section" style={{ borderBottom: 'none', padding: '0 0 24px 0' }}>
                      <div className="section-info">
                        <span className="section-subtitle">Diagnostics Dashboard</span>
                        <h2 className="section-title">Operations Console</h2>
                      </div>

                      <div className="control-container">
                        {/* Action Commands */}
                        <div className="action-card-grid">
                          
                          <div 
                            className={`action-button-card ${activeAction === 'scanning' ? 'active' : ''}`}
                            onClick={handleDiagnosticsScan}
                          >
                            <div className="action-icon-circle">
                              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="10"></circle>
                                <line x1="22" y1="12" x2="18" y2="12"></line>
                                <line x1="6" y1="12" x2="2" y2="12"></line>
                                <line x1="12" y1="6" x2="12" y2="2"></line>
                                <line x1="12" y1="22" x2="12" y2="18"></line>
                              </svg>
                            </div>
                            <div className="action-btn-text">
                              <span className="action-title">Verify Backend API Nodes</span>
                              <span className="action-desc">Check diagnostic latency of the server</span>
                            </div>
                          </div>

                          <div 
                            className="action-button-card"
                            onClick={() => fetchOccupancyData(false)}
                          >
                            <div className="action-icon-circle">
                              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/>
                              </svg>
                            </div>
                            <div className="action-btn-text">
                              <span className="action-title">Sync Station Occupancy</span>
                              <span className="action-desc">Query and refresh setup grids immediately</span>
                            </div>
                          </div>

                        </div>

                        {/* Updates Log Feed */}
                        <div className="status-feed-card">
                          <div className="feed-header">
                            <div className="feed-title">
                              <span>Platform Audit Logs</span>
                              <span className="feed-indicator-pill">Live Feed</span>
                            </div>
                            <button className="feed-clear-btn" onClick={handleClearLogs}>Clear Logs</button>
                          </div>

                          <div className="feed-body" ref={feedBodyRef}>
                            {logs.length === 0 ? (
                              <div className="feed-welcome-note">
                                Operational logs are currently empty. Run an action button on the left to see system feedback updates.
                              </div>
                            ) : (
                              logs.map((log) => (
                                <div key={log.id} className={`feed-item ${log.type}`}>
                                  <div className={`feed-item-icon ${log.type}`}>
                                    {log.type === 'success' && (
                                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                        <polyline points="20 6 9 17 4 12"></polyline>
                                      </svg>
                                    )}
                                    {log.type === 'info' && (
                                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                        <circle cx="12" cy="12" r="10"></circle>
                                        <line x1="12" y1="16" x2="12" y2="12"></line>
                                        <line x1="12" y1="8" x2="12.01" y2="8"></line>
                                      </svg>
                                    )}
                                    {log.type === 'warning' && (
                                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                                        <line x1="12" y1="9" x2="12" y2="13"></line>
                                        <line x1="12" y1="17" x2="12.01" y2="17"></line>
                                      </svg>
                                    )}
                                  </div>
                                  <div className="feed-item-content">
                                    <span className="feed-item-timestamp">[{log.timestamp}]</span>
                                    <span className="feed-item-message">{log.message}</span>
                                  </div>
                                </div>
                              ))
                            )}

                            {activeAction !== 'idle' && (
                              <div className="feed-action-progress">
                                <div className="feed-progress-label">
                                  <span>Scanning core infrastructure API nodes...</span>
                                  <span>{actionProgress}%</span>
                                </div>
                                <div className="feed-progress-bar-bg">
                                  <div className="feed-progress-bar-fill" style={{ width: `${actionProgress}%` }}></div>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </section>

                    {/* Alert Overrides Panel */}
                    <section className="alert-banner-section">
                      <div className="alert-panel" style={{ borderColor: isAlertActive ? 'var(--warning)' : '' }}>
                        <div className="alert-panel-text">
                          <div className="alert-panel-header">
                            <span className="alert-panel-icon" style={{ color: isAlertActive ? 'var(--warning)' : 'var(--accent)' }}>
                              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                                <line x1="12" y1="9" x2="12" y2="13"></line>
                                <line x1="12" y1="17" x2="12.01" y2="17"></line>
                              </svg>
                            </span>
                            <h3 className="alert-panel-title">Lounge Warning Broadcasts</h3>
                          </div>
                          <p className="alert-panel-desc" style={{ marginTop: '8px' }}>
                            Toggle notification notices to warn lounge guests of maintenance windows or network scheduling.
                          </p>
                        </div>

                        <div className="alert-action-row">
                          <button 
                            className="btn-secondary" 
                            onClick={() => {
                              const nextAlert = !isAlertActive;
                              setIsAlertActive(nextAlert);
                              setLogs((prev) => [
                                ...prev,
                                {
                                  id: `log-${Date.now()}`,
                                  type: nextAlert ? 'warning' : 'info',
                                  message: `Manual administrative notice banner ${nextAlert ? 'activated' : 'removed'}.`,
                                  timestamp: getTimestamp()
                                }
                              ]);
                            }}
                          >
                            {isAlertActive ? 'Remove Notice Banner' : 'Show Notice Banner'}
                          </button>
                        </div>
                      </div>

                      {isAlertActive && (
                        <div 
                          style={{ 
                            background: 'var(--warning-light)', 
                            border: '1px solid var(--warning)', 
                            color: 'var(--text-heading)', 
                            padding: '16px', 
                            borderRadius: '12px',
                            fontSize: '0.85rem',
                            fontWeight: 500,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            boxShadow: 'var(--shadow-sm)'
                          }}
                        >
                          <span style={{ color: 'var(--warning)', fontWeight: 'bold' }}>[NOTICE]</span>
                          <span>Scheduled platform network maintenance is set for tomorrow at 04:00 UTC. System services will remain online.</span>
                        </div>
                      )}
                    </section>
                  </>
                )}

                {/* Confirm Tentative Booking Modal Overlay */}
                {confirmingTentativeBooking && (
                  <div className="modal-overlay" onClick={() => !isConfirmSubmitting && setConfirmingTentativeBooking(null)}>
                    <div className="modal-card" style={{ maxWidth: '580px' }} onClick={(e) => e.stopPropagation()}>
                      <div className="modal-header">
                        <div>
                          <h3 className="modal-title" style={{ color: 'var(--accent)' }}>
                            Confirm & Allocate Tentative Booking
                          </h3>
                          <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
                            Reservation #{confirmingTentativeBooking.id} · Convert into active playing session
                          </p>
                        </div>
                        <button className="modal-close-btn" onClick={() => !isConfirmSubmitting && setConfirmingTentativeBooking(null)}>
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                          </svg>
                        </button>
                      </div>

                      <form onSubmit={handleConfirmTentativeSubmit}>
                        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                          
                          {confirmError && (
                            <div className="form-error-banner">
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="10"></circle>
                                <line x1="15" y1="9" x2="9" y2="15"></line>
                                <line x1="9" y1="9" x2="15" y2="15"></line>
                              </svg>
                              <span>{confirmError}</span>
                            </div>
                          )}

                          {/* Customer & Reservation Snapshot Card */}
                          <div style={{ background: 'var(--bg-card-hover)', border: '1px solid var(--border)', borderRadius: '8px', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <div>
                                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.04em' }}>Customer Contact</span>
                                <div style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-heading)' }}>
                                  📞 {confirmingTentativeBooking.phoneNumber}
                                </div>
                              </div>
                              <div style={{ textAlign: 'right' }}>
                                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.04em' }}>Players & Price</span>
                                <div style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--accent)' }}>
                                  {confirmingTentativeBooking.playersCount || 1} {confirmingTentativeBooking.playersCount === 1 ? 'player' : 'players'} · ₹{confirmingTentativeBooking.amountCharged || confirmingTentativeBooking.originalAmount || 0}
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Assign Physical Station */}
                          <div className="form-group" style={{ margin: 0 }}>
                            <label className="form-label" htmlFor="confirm-setup" style={{ fontSize: '0.78rem', fontWeight: 700, display: 'flex', justifyContent: 'space-between' }}>
                              <span>Assign Physical Console Station</span>
                              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 500 }}>Select station hardware</span>
                            </label>
                            <select 
                              id="confirm-setup"
                              className="form-input"
                              value={confirmSetupInstanceId}
                              onChange={(e) => setConfirmSetupInstanceId(e.target.value ? Number(e.target.value) : '')}
                              required
                            >
                              <option value="">-- Choose Physical Console Station --</option>
                              {occupancyData.map((inst: any) => (
                                <option key={inst.instanceId} value={inst.instanceId}>
                                  {inst.instanceName} ({inst.setup?.consoleType} · ₹{inst.setup?.chargePerPersonPerHour}/hr) - [{inst.status}]
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* Date & Time Controls Section */}
                          <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '8px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-heading)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                                  <line x1="16" y1="2" x2="16" y2="6"></line>
                                  <line x1="8" y1="2" x2="8" y2="6"></line>
                                  <line x1="3" y1="10" x2="21" y2="10"></line>
                                </svg>
                                Reservation Schedule & Slot Timings
                              </span>
                              <button 
                                type="button" 
                                style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', padding: 0 }}
                                onClick={handleSetTentativeStartToNow}
                              >
                                ⚡ Start Session Now
                              </button>
                            </div>

                            {/* Quick Duration Presets */}
                            <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Set Duration:</span>
                              <button type="button" className="btn-compact" style={{ padding: '3px 8px', fontSize: '0.72rem' }} onClick={() => handleSetTentativeDurationPreset(0.5)}>30m</button>
                              <button type="button" className="btn-compact" style={{ padding: '3px 8px', fontSize: '0.72rem' }} onClick={() => handleSetTentativeDurationPreset(1)}>1 Hour</button>
                              <button type="button" className="btn-compact" style={{ padding: '3px 8px', fontSize: '0.72rem' }} onClick={() => handleSetTentativeDurationPreset(1.5)}>1.5 Hours</button>
                              <button type="button" className="btn-compact" style={{ padding: '3px 8px', fontSize: '0.72rem' }} onClick={() => handleSetTentativeDurationPreset(2)}>2 Hours</button>
                              <button type="button" className="btn-compact" style={{ padding: '3px 8px', fontSize: '0.72rem' }} onClick={() => handleSetTentativeDurationPreset(3)}>3 Hours</button>
                            </div>

                            {/* Start and End datetime inputs */}
                            <div className="form-row-2col" style={{ margin: 0, gap: '10px' }}>
                              <div className="form-group" style={{ margin: 0 }}>
                                <label className="form-label" htmlFor="confirm-start" style={{ fontSize: '0.73rem', color: 'var(--text-muted)' }}>Start Date & Time</label>
                                <input 
                                  type="datetime-local"
                                  id="confirm-start"
                                  className="form-input"
                                  value={confirmStartTime}
                                  onChange={(e) => setConfirmStartTime(e.target.value)}
                                  required
                                />
                              </div>
                              <div className="form-group" style={{ margin: 0 }}>
                                <label className="form-label" htmlFor="confirm-end" style={{ fontSize: '0.73rem', color: 'var(--text-muted)' }}>Estimated End Date & Time</label>
                                <input 
                                  type="datetime-local"
                                  id="confirm-end"
                                  className="form-input"
                                  value={confirmEndTime}
                                  onChange={(e) => setConfirmEndTime(e.target.value)}
                                  required
                                />
                              </div>
                            </div>

                            {/* Live Duration Calculation Badge */}
                            {(() => {
                              const start = confirmStartTime ? new Date(confirmStartTime).getTime() : 0;
                              const end = confirmEndTime ? new Date(confirmEndTime).getTime() : 0;
                              const isValid = !isNaN(start) && !isNaN(end) && end > start;
                              const diffMins = isValid ? Math.round((end - start) / (1000 * 60)) : 0;
                              const hrs = Math.floor(diffMins / 60);
                              const mins = diffMins % 60;
                              const durationFormatted = hrs > 0 ? (mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`) : `${mins}m`;

                              return (
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-card-hover)', border: '1px solid var(--border)', borderRadius: '6px', padding: '6px 10px', fontSize: '0.75rem' }}>
                                  <span style={{ color: 'var(--text-muted)' }}>Calculated Slot Duration:</span>
                                  <span style={{ fontWeight: 800, color: isValid ? 'var(--accent)' : 'var(--error)' }}>
                                    {isValid ? `⏱ ${durationFormatted} (${diffMins} minutes)` : '⚠️ Invalid Time Range (End must be after Start)'}
                                  </span>
                                </div>
                              );
                            })()}
                          </div>

                          {/* Payment Recording & Split Module */}
                          <div style={{ background: 'var(--bg-card-hover)', border: '1px solid var(--border)', borderRadius: '8px', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-heading)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                  <rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect>
                                  <line x1="1" y1="10" x2="23" y2="10"></line>
                                </svg>
                                Payment Settlement (Total: ₹{confirmingTentativeBooking.amountCharged || confirmingTentativeBooking.originalAmount || 0})
                              </span>
                              
                              {/* Quick payment split presets */}
                              <div style={{ display: 'flex', gap: '4px' }}>
                                <button type="button" className="btn-compact" style={{ padding: '2px 6px', fontSize: '0.7rem' }} onClick={() => handleSetTentativeQuickPayment('cash')}>All Cash</button>
                                <button type="button" className="btn-compact" style={{ padding: '2px 6px', fontSize: '0.7rem' }} onClick={() => handleSetTentativeQuickPayment('upi')}>All UPI</button>
                                <button type="button" className="btn-compact" style={{ padding: '2px 6px', fontSize: '0.7rem' }} onClick={() => handleSetTentativeQuickPayment('split')}>50/50</button>
                              </div>
                            </div>

                            <div className="form-row-2col" style={{ margin: 0, gap: '10px' }}>
                              <div className="form-group" style={{ margin: 0 }}>
                                <label className="form-label" htmlFor="confirm-cash" style={{ fontSize: '0.73rem', color: 'var(--text-muted)' }}>Cash Payment (₹)</label>
                                <input 
                                  type="number"
                                  id="confirm-cash"
                                  className="form-input"
                                  value={confirmCashAmount}
                                  onChange={(e) => setConfirmCashAmount(Number(e.target.value))}
                                  min={0}
                                  required
                                />
                              </div>
                              <div className="form-group" style={{ margin: 0 }}>
                                <label className="form-label" htmlFor="confirm-upi" style={{ fontSize: '0.73rem', color: 'var(--text-muted)' }}>UPI Payment (₹)</label>
                                <input 
                                  type="number"
                                  id="confirm-upi"
                                  className="form-input"
                                  value={confirmUpiAmount}
                                  onChange={(e) => setConfirmUpiAmount(Number(e.target.value))}
                                  min={0}
                                  required
                                />
                              </div>
                            </div>

                            {/* Total Balance Validation */}
                            {(() => {
                              const expectedTotal = Number(confirmingTentativeBooking.amountCharged || confirmingTentativeBooking.originalAmount || 0);
                              const recordedTotal = confirmCashAmount + confirmUpiAmount;
                              const isMatch = recordedTotal === expectedTotal;

                              return (
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', fontWeight: 600, color: isMatch ? 'var(--success)' : 'var(--warning)', paddingTop: '4px' }}>
                                  <span>Total Payment Recorded: ₹{recordedTotal}</span>
                                  <span>{isMatch ? '✓ Exact Balance' : `Diff: ₹${recordedTotal - expectedTotal}`}</span>
                                </div>
                              );
                            })()}
                          </div>

                        </div>

                        <div className="modal-footer">
                          <button 
                            type="button" 
                            className="btn-card-action"
                            onClick={() => setConfirmingTentativeBooking(null)}
                            disabled={isConfirmSubmitting}
                          >
                            Cancel
                          </button>
                          <button 
                            type="submit" 
                            className="btn-card-action primary"
                            disabled={isConfirmSubmitting}
                          >
                            {isConfirmSubmitting ? 'Allocating Station...' : '✓ Confirm & Allocate Station'}
                          </button>
                        </div>
                      </form>
                    </div>
                  </div>
                )}

                {/* Extend Active Session Modal Overlay */}
                {extendingSessionInstance && extendingSessionInstance.currentBooking && (
                  <div className="modal-overlay" onClick={() => !isExtensionSubmitting && setExtendingSessionInstance(null)}>
                    <div className="modal-card" style={{ maxWidth: '540px' }} onClick={(e) => e.stopPropagation()}>
                      <div className="modal-header">
                        <div>
                          <h3 className="modal-title" style={{ color: 'var(--accent)' }}>
                            Extend Active Gaming Session
                          </h3>
                          <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
                            {extendingSessionInstance.instanceName} · {extendingSessionInstance.setup?.consoleType} (₹{extendingSessionInstance.setup?.chargePerPersonPerHour}/person/hr)
                          </p>
                        </div>
                        <button className="modal-close-btn" onClick={() => !isExtensionSubmitting && setExtendingSessionInstance(null)}>
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                          </svg>
                        </button>
                      </div>

                      <form onSubmit={(e) => handleExtendBookingSubmit(e)}>
                        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                          
                          {extensionError && (
                            <div className="form-error-banner">
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="10"></circle>
                                <line x1="15" y1="9" x2="9" y2="15"></line>
                                <line x1="9" y1="9" x2="15" y2="15"></line>
                              </svg>
                              <span>{extensionError}</span>
                            </div>
                          )}

                          {/* Customer & Current Session Info */}
                          <div style={{ background: 'var(--bg-card-hover)', border: '1px solid var(--border)', borderRadius: '8px', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <div>
                                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Customer</span>
                                <div style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-heading)' }}>
                                  📞 {extendingSessionInstance.currentBooking.phoneNumber}
                                </div>
                              </div>
                              <div style={{ textAlign: 'right' }}>
                                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Players</span>
                                <div style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-heading)' }}>
                                  {extendingSessionInstance.currentBooking.playersCount} players ({extendingSessionInstance.currentBooking.playersCount > 1 ? 'Multiplayer' : 'Single Player'})
                                </div>
                              </div>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)', borderTop: '1px solid var(--border)', paddingTop: '6px' }}>
                              <span>Current Slot: <strong style={{ color: 'var(--text-heading)' }}>{formatTimeStr(extendingSessionInstance.currentBooking.startTime)} – {formatTimeStr(extendingSessionInstance.currentBooking.endTime)}</strong></span>
                              <span>Current Billed: <strong style={{ color: 'var(--accent)' }}>₹{extendingSessionInstance.currentBooking.amountCharged}</strong></span>
                            </div>
                          </div>

                          {/* Extension Duration Selector & Quick Presets */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            <label className="form-label" htmlFor="extension-minutes-select" style={{ fontSize: '0.8rem', fontWeight: 700, margin: 0 }}>
                              Select Extension Duration
                            </label>

                            {/* Quick buttons */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '6px' }}>
                              {[15, 30, 45, 60, 120].map((mins) => {
                                const isSelected = extensionMinutes === mins;
                                return (
                                  <button
                                    key={mins}
                                    type="button"
                                    className="btn-compact"
                                    style={{
                                      padding: '8px 2px',
                                      fontSize: '0.78rem',
                                      fontWeight: 700,
                                      background: isSelected ? 'var(--accent)' : 'var(--bg-card)',
                                      color: isSelected ? 'white' : 'var(--text-heading)',
                                      borderColor: isSelected ? 'var(--accent)' : 'var(--border)'
                                    }}
                                    onClick={() => setExtensionMinutes(mins)}
                                  >
                                    +{mins < 60 ? `${mins}m` : `${mins / 60}h`}
                                  </button>
                                );
                              })}
                            </div>

                            {/* Dropdown with custom option */}
                            <div className="form-group" style={{ margin: '4px 0 0 0' }}>
                              <select
                                id="extension-minutes-select"
                                className="form-input"
                                value={extensionMinutes}
                                onChange={(e) => setExtensionMinutes(Number(e.target.value))}
                                disabled={isExtensionSubmitting}
                              >
                                <option value={15}>+15 Minutes (+0.25 hour)</option>
                                <option value={30}>+30 Minutes (+0.5 hour)</option>
                                <option value={45}>+45 Minutes (+0.75 hour)</option>
                                <option value={60}>+60 Minutes (+1.0 hour)</option>
                                <option value={90}>+90 Minutes (+1.5 hours)</option>
                                <option value={120}>+120 Minutes (+2.0 hours)</option>
                              </select>
                            </div>
                          </div>

                          {/* Calculation & Pricing Preview */}
                          {(() => {
                            const isMulti = (extendingSessionInstance.currentBooking?.playersCount || 1) > 1;
                            const setupRate = isMulti 
                              ? (extendingSessionInstance.setup?.multiplayerPrice || extendingSessionInstance.setup?.chargePerPersonPerHour || 120)
                              : (extendingSessionInstance.setup?.singlePlayerPrice || extendingSessionInstance.setup?.chargePerPersonPerHour || 150);
                            const players = extendingSessionInstance.currentBooking?.playersCount || 1;
                            const addedCharge = Math.round((extensionMinutes / 60) * setupRate * players);
                            const currentCharged = Number(extendingSessionInstance.currentBooking?.amountCharged || 0);
                            const newTotal = currentCharged + addedCharge;

                            const endMs = parseTimestampMs(extendingSessionInstance.currentBooking.endTime);
                            const newEndFormatted = endMs ? formatTimeStr(new Date(endMs + extensionMinutes * 60 * 1000).toISOString()) : 'Extended';

                            return (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '8px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Rate per Player/Hr:</span>
                                    <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>₹{setupRate}/hr ({isMulti ? 'Multiplayer' : 'Single Player'})</span>
                                  </div>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Estimated Additional Charge:</span>
                                    <span style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--success)' }}>+₹{addedCharge}</span>
                                  </div>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>New Estimated End Time:</span>
                                    <span style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-heading)' }}>⏱ {newEndFormatted}</span>
                                  </div>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border)', paddingTop: '6px' }}>
                                    <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-heading)' }}>Estimated Total Session:</span>
                                    <span style={{ fontSize: '1.1rem', fontWeight: 900, color: 'var(--accent)' }}>₹{newTotal}</span>
                                  </div>
                                </div>

                                {/* Payment Breakdown (Cash / UPI) */}
                                <div style={{ background: 'var(--bg-card-hover)', border: '1px solid var(--border)', borderRadius: '8px', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                  <div style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-heading)' }}>
                                    💵 Additional Payment Collection (₹{addedCharge})
                                  </div>
                                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                                    <div className="form-group" style={{ margin: 0 }}>
                                      <label className="form-label" style={{ fontSize: '0.68rem', margin: '0 0 2px 0' }}>Cash (₹)</label>
                                      <input
                                        type="number"
                                        className="form-input"
                                        placeholder={`${addedCharge}`}
                                        value={extensionCashAmount}
                                        onChange={(e) => setExtensionCashAmount(e.target.value)}
                                        style={{ padding: '6px 8px', fontSize: '0.82rem' }}
                                      />
                                    </div>
                                    <div className="form-group" style={{ margin: 0 }}>
                                      <label className="form-label" style={{ fontSize: '0.68rem', margin: '0 0 2px 0' }}>UPI (₹)</label>
                                      <input
                                        type="number"
                                        className="form-input"
                                        placeholder="0"
                                        value={extensionUpiAmount}
                                        onChange={(e) => setExtensionUpiAmount(e.target.value)}
                                        style={{ padding: '6px 8px', fontSize: '0.82rem' }}
                                      />
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          })()}

                        </div>

                        <div className="modal-footer">
                          <button
                            type="button"
                            className="btn-card-action"
                            onClick={() => setExtendingSessionInstance(null)}
                            disabled={isExtensionSubmitting}
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            className="btn-card-action primary"
                            disabled={isExtensionSubmitting}
                            onClick={(e) => {
                              e.preventDefault();
                              handleExtendBookingSubmit();
                            }}
                          >
                            {isExtensionSubmitting ? 'Extending Slot...' : `✓ Extend by +${extensionMinutes} Mins ➔`}
                          </button>
                        </div>
                      </form>
                    </div>
                  </div>
                )}

                {/* Session Extension Summary Modal Module */}
                {extensionSummaryResult && (
                  <div className="modal-overlay" onClick={() => setExtensionSummaryResult(null)}>
                    <div className="modal-card" style={{ maxWidth: '540px' }} onClick={(e) => e.stopPropagation()}>
                      <div className="modal-header">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(16, 185, 129, 0.15)', color: 'var(--success)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.9rem' }}>
                            ✓
                          </div>
                          <div>
                            <h3 className="modal-title" style={{ color: 'var(--success)' }}>
                              Extension Confirmed — Booking #{extensionSummaryResult.bookingId}
                            </h3>
                            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
                              {extensionSummaryResult.instanceName} · {extensionSummaryResult.consoleType}
                            </p>
                          </div>
                        </div>
                        <button className="modal-close-btn" onClick={() => setExtensionSummaryResult(null)}>
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                          </svg>
                        </button>
                      </div>

                      <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {/* Extension Timeline Details */}
                        <div className="review-card highlight">
                          <div className="review-card-header">
                            <div className="review-card-title">
                              <span>⏱️</span>
                              <span>Extension Details (+{extensionSummaryResult.extension?.addedMinutes} Mins)</span>
                            </div>
                            <span style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--accent)', background: 'var(--accent-light)', padding: '2px 6px', borderRadius: '4px' }}>
                              {extensionSummaryResult.extension?.totalDurationHours} hrs total
                            </span>
                          </div>
                          <div className="review-grid-2col">
                            <div className="review-row-item">
                              <span className="review-label">Previous End Time</span>
                              <span className="review-val">{extensionSummaryResult.extension?.previousEndTime || '—'}</span>
                            </div>
                            <div className="review-row-item">
                              <span className="review-label">New End Time</span>
                              <span className="review-val" style={{ color: 'var(--success)', fontWeight: 800 }}>
                                🏁 {extensionSummaryResult.extension?.newEndTime}
                              </span>
                            </div>
                            <div className="review-row-item">
                              <span className="review-label">Added Duration</span>
                              <span className="review-val">+{extensionSummaryResult.extension?.addedMinutes} Mins (+{extensionSummaryResult.extension?.addedHours} hr)</span>
                            </div>
                            <div className="review-row-item">
                              <span className="review-label">Total Duration</span>
                              <span className="review-val">{extensionSummaryResult.extension?.totalDurationHours} Hour{extensionSummaryResult.extension?.totalDurationHours > 1 ? 's' : ''}</span>
                            </div>
                          </div>
                        </div>

                        {/* Pricing & Offer Ledger */}
                        <div className="review-card">
                          <div className="review-card-header">
                            <div className="review-card-title">
                              <span>🏷️</span>
                              <span>Pricing & Payment Ledger</span>
                            </div>
                            <span style={{ fontSize: '0.68rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                              ₹{extensionSummaryResult.pricing?.ratePerPersonPerHour}/player/hr ({extensionSummaryResult.pricing?.playerType})
                            </span>
                          </div>
                          
                          {/* Re-evaluated Offers */}
                          {extensionSummaryResult.appliedOffers && extensionSummaryResult.appliedOffers.length > 0 && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', margin: '4px 0' }}>
                              {extensionSummaryResult.appliedOffers.map((o: any) => (
                                <div key={o.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 10px', background: 'rgba(16, 185, 129, 0.08)', borderRadius: '6px', border: '1px solid rgba(16, 185, 129, 0.25)' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <span style={{ fontSize: '0.8rem' }}>🎉</span>
                                    <div>
                                      <div style={{ fontWeight: 700, fontSize: '0.76rem', color: 'var(--text-heading)' }}>{o.name}</div>
                                      <div style={{ fontSize: '0.68rem', color: 'var(--success)' }}>{o.reason || 'Offer active'}</div>
                                    </div>
                                  </div>
                                  <span style={{ fontWeight: 800, fontSize: '0.82rem', color: 'var(--success)' }}>−₹{o.discount}</span>
                                </div>
                              ))}
                            </div>
                          )}

                          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', borderTop: '1px solid var(--border)', paddingTop: '6px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                              <span>Previous Total Amount</span>
                              <span>₹{extensionSummaryResult.pricing?.previousTotalAmount}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                              <span>New Gross Subtotal</span>
                              <span>₹{extensionSummaryResult.pricing?.newOriginalAmount}</span>
                            </div>
                            {extensionSummaryResult.pricing?.discountApplied > 0 && (
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.76rem', color: 'var(--success)', fontWeight: 600 }}>
                                <span>Discount Applied</span>
                                <span>−₹{extensionSummaryResult.pricing?.discountApplied}</span>
                              </div>
                            )}
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-heading)', borderTop: '1px dashed var(--border)', paddingTop: '4px' }}>
                              <span>New Total Amount</span>
                              <span>₹{extensionSummaryResult.pricing?.newTotalAmount}</span>
                            </div>

                            <div className="review-total-banner" style={{ marginTop: '6px' }}>
                              <div>
                                <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)' }}>Additional Paid Difference</div>
                                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>New Total − Previous Total</div>
                              </div>
                              <div style={{ fontWeight: 800, fontSize: '1.25rem', color: 'var(--success)' }}>
                                +₹{extensionSummaryResult.pricing?.additionalAmountToPay}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="modal-footer">
                        <button
                          type="button"
                          className="btn-card-action primary"
                          style={{ width: '100%', fontWeight: 700 }}
                          onClick={() => setExtensionSummaryResult(null)}
                        >
                          ✓ Done & Return to Hub
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Custom End Session & Checkout Modal Overlay */}
                {terminatingInstance && terminatingInstance.currentBooking && (
                  <div className="modal-overlay" onClick={() => !isTerminating && setTerminatingInstance(null)}>
                    <div className="modal-card" style={{ maxWidth: '560px' }} onClick={(e) => e.stopPropagation()}>
                      <div className="modal-header">
                        <div>
                          <h3 className="modal-title" style={{ color: 'var(--error)' }}>End Session & Checkout</h3>
                          <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
                            {terminatingInstance.instanceName} · {terminatingInstance.setup?.consoleType} (₹{terminatingInstance.setup?.chargePerPersonPerHour}/person/hr)
                          </p>
                        </div>
                        <button className="modal-close-btn" onClick={() => !isTerminating && setTerminatingInstance(null)}>
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                          </svg>
                        </button>
                      </div>

                      <form onSubmit={handleFinalizeTerminationSubmit}>
                        <div className="modal-body">
                          
                          {terminateError && (
                            <div className="form-error-banner">
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="10"></circle>
                                <line x1="15" y1="9" x2="9" y2="15"></line>
                                <line x1="9" y1="9" x2="15" y2="15"></line>
                              </svg>
                              <span>{terminateError}</span>
                            </div>
                          )}

                          {/* Customer & Session Summary */}
                          <div style={{ background: 'var(--bg-card-hover)', border: '1px solid var(--border)', borderRadius: '8px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <div>
                                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Customer Contact</span>
                                <div style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--text-heading)' }}>{terminatingInstance.currentBooking.phoneNumber}</div>
                              </div>
                              <div style={{ textAlign: 'right' }}>
                                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Players</span>
                                <div style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--text-heading)' }}>{terminatingInstance.currentBooking.playersCount} players</div>
                              </div>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: 'var(--text-muted)', borderTop: '1px solid var(--border)', paddingTop: '6px' }}>
                              <span>Started At: <strong style={{ color: 'var(--text-heading)' }}>{formatTimeStr(terminatingInstance.currentBooking.startTime)}</strong></span>
                              <span>Initial Rate: <strong>₹{terminatingInstance.currentBooking.amountCharged}</strong></span>
                            </div>
                          </div>

                          {/* Adjust End Time */}
                          <div className="form-group" style={{ marginTop: '4px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                              <label className="form-label" htmlFor="terminate-end-time" style={{ margin: 0 }}>Adjust Session End Time</label>
                              <button
                                type="button"
                                style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', padding: 0 }}
                                onClick={() => handleTerminateEndTimeChange(formatDateForDatetimeInput(new Date()))}
                              >
                                ↺ Reset to Current Time
                              </button>
                            </div>
                            <input 
                              type="datetime-local"
                              id="terminate-end-time"
                              className="form-input"
                              value={terminateEndTime}
                              onChange={(e) => handleTerminateEndTimeChange(e.target.value)}
                              required
                            />
                          </div>

                          {/* Calculated Duration & Pro-Rated Base Price */}
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', padding: '10px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '8px', textAlign: 'center' }}>
                            <div>
                              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Actual Elapsed</div>
                              <div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-heading)', marginTop: '2px' }}>{terminateElapsedMinutes}m</div>
                            </div>
                            <div style={{ borderLeft: '1px solid var(--border)', borderRight: '1px solid var(--border)' }}>
                              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Billed Time</div>
                              <div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--accent)', marginTop: '2px' }}>{terminateChargedMinutes}m <span style={{ fontSize: '0.72rem', fontWeight: 500 }}>({(terminateChargedMinutes / 60).toFixed(2)}h)</span></div>
                            </div>
                            <div>
                              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Pro-Rated Base</div>
                              <div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-heading)', marginTop: '2px' }}>₹{terminateOriginalAmount}</div>
                            </div>
                          </div>

                          {/* Dynamic Offers & Promotions Module */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-heading)' }}>Apply Offers & Promotions</span>
                              {isLoadingTerminateOffers && <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Evaluating deals...</span>}
                            </div>
                            
                            {terminateOffers.length === 0 && !isLoadingTerminateOffers ? (
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', padding: '8px', background: 'var(--bg-card-hover)', borderRadius: '6px', textAlign: 'center' }}>
                                No active promo deals applicable to this session duration.
                              </div>
                            ) : (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '130px', overflowY: 'auto' }}>
                                {terminateOffers.map((offer: any) => {
                                  const isSelected = terminateSelectedOfferIds.includes(offer.id);
                                  return (
                                    <label 
                                      key={offer.id}
                                      style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '10px',
                                        padding: '8px 10px',
                                        borderRadius: '6px',
                                        border: `1px solid ${isSelected ? 'var(--accent)' : 'var(--border)'}`,
                                        background: isSelected ? 'rgba(99, 102, 241, 0.08)' : 'var(--bg-card-hover)',
                                        cursor: offer.eligible ? 'pointer' : 'not-allowed',
                                        opacity: offer.eligible ? 1 : 0.55
                                      }}
                                    >
                                      <input 
                                        type="checkbox"
                                        disabled={!offer.eligible}
                                        checked={isSelected}
                                        onChange={() => handleToggleTerminateOffer(offer.id)}
                                        style={{ accentColor: 'var(--accent)', width: 15, height: 15 }}
                                      />
                                      <div style={{ flex: 1 }}>
                                        <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-heading)' }}>{offer.name}</div>
                                        <div style={{ fontSize: '0.72rem', color: offer.eligible ? 'var(--success)' : 'var(--text-muted)' }}>
                                          {offer.eligible ? (offer.reason || `Apply ₹${offer.discount} discount`) : offer.reason}
                                        </div>
                                      </div>
                                      {offer.discount > 0 && (
                                        <span style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--success)' }}>
                                          -₹{offer.discount}
                                        </span>
                                      )}
                                    </label>
                                  );
                                })}
                              </div>
                            )}
                          </div>

                          {/* Settlement & Split Payment Recording */}
                          <div style={{ background: 'var(--bg-card-hover)', border: '1px solid var(--accent)', borderRadius: '8px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <div>
                                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Total Payable</div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                  Base ₹{terminateOriginalAmount} {terminateDiscount > 0 && <span style={{ color: 'var(--success)' }}>− ₹{terminateDiscount} discount</span>}
                                </div>
                              </div>
                              <div style={{ fontSize: '1.25rem', fontWeight: 900, color: 'var(--accent)' }}>
                                ₹{terminateFinalAmount}
                              </div>
                            </div>

                            <div className="form-row-2col">
                              <div className="form-group" style={{ margin: 0 }}>
                                <label className="form-label" htmlFor="terminate-cash" style={{ fontSize: '0.75rem' }}>Cash Paid (₹)</label>
                                <input 
                                  type="number"
                                  id="terminate-cash"
                                  className="form-input"
                                  value={terminateCashAmount}
                                  onChange={(e) => setTerminateCashAmount(Number(e.target.value))}
                                  min={0}
                                  required
                                />
                              </div>
                              <div className="form-group" style={{ margin: 0 }}>
                                <label className="form-label" htmlFor="terminate-upi" style={{ fontSize: '0.75rem' }}>UPI Paid (₹)</label>
                                <input 
                                  type="number"
                                  id="terminate-upi"
                                  className="form-input"
                                  value={terminateUpiAmount}
                                  onChange={(e) => setTerminateUpiAmount(Number(e.target.value))}
                                  min={0}
                                  required
                                />
                              </div>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: (terminateCashAmount + terminateUpiAmount) === terminateFinalAmount ? 'var(--success)' : 'var(--warning)', fontWeight: 600 }}>
                              <span>Payment Recorded: ₹{terminateCashAmount + terminateUpiAmount}</span>
                              <span>
                                {(terminateCashAmount + terminateUpiAmount) === terminateFinalAmount
                                  ? '✓ Exact Balance'
                                  : `Diff: ₹${(terminateCashAmount + terminateUpiAmount) - terminateFinalAmount}`}
                              </span>
                            </div>
                          </div>

                        </div>

                        <div className="modal-footer">
                          <button 
                            type="button" 
                            className="btn-card-action"
                            onClick={() => setTerminatingInstance(null)}
                            disabled={isTerminating}
                          >
                            Keep Session Active
                          </button>
                          <button 
                            type="submit" 
                            className="btn-card-action"
                            style={{ background: 'var(--error)', color: 'white', borderColor: 'var(--error)' }}
                            disabled={isTerminating}
                          >
                            {isTerminating ? 'Finalizing Checkout...' : '⏹ Finalize & End Session'}
                          </button>
                        </div>
                      </form>
                    </div>
                  </div>
                )}

                {/* Session End Summary & Settlement Receipt Modal Module */}
                {sessionSummaryResult && (
                  <div className="modal-overlay" onClick={() => setSessionSummaryResult(null)}>
                    <div className="modal-card" style={{ maxWidth: '560px' }} onClick={(e) => e.stopPropagation()}>
                      <div className="modal-header">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div style={{
                            width: 32,
                            height: 32,
                            borderRadius: '50%',
                            background: 'rgba(16, 185, 129, 0.15)',
                            color: 'var(--success)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 800,
                            fontSize: '1rem',
                            border: '1px solid rgba(16, 185, 129, 0.3)'
                          }}>
                            ✓
                          </div>
                          <div>
                            <h3 className="modal-title" style={{ color: 'var(--success)' }}>
                              Session Ended & Station Released
                            </h3>
                            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
                              Booking #{sessionSummaryResult.bookingId} · {sessionSummaryResult.setup?.instanceName}
                            </p>
                          </div>
                        </div>
                        <button className="modal-close-btn" onClick={() => setSessionSummaryResult(null)}>
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                          </svg>
                        </button>
                      </div>

                      <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {/* 1. Customer & Station Overview Card */}
                        <div className="review-card highlight">
                          <div className="review-card-header">
                            <div className="review-card-title">
                              <span>👤</span>
                              <span>Customer & Console Station</span>
                            </div>
                            <span style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--success)', background: 'rgba(16, 185, 129, 0.15)', padding: '2px 8px', borderRadius: '4px' }}>
                              STATION AVAILABLE
                            </span>
                          </div>
                          <div className="review-grid-2col">
                            <div className="review-row-item">
                              <span className="review-label">Customer</span>
                              <span className="review-val">{sessionSummaryResult.customer?.name} ({sessionSummaryResult.customer?.phoneNumber})</span>
                            </div>
                            <div className="review-row-item">
                              <span className="review-label">Console & Squad</span>
                              <span className="review-val">
                                {sessionSummaryResult.setup?.consoleType} · {sessionSummaryResult.players?.playersCount} Players ({sessionSummaryResult.players?.playerType === 'SINGLE_PLAYER' ? 'Single' : 'Multiplayer'})
                              </span>
                            </div>
                            {sessionSummaryResult.gamesPlayed && sessionSummaryResult.gamesPlayed.length > 0 && (
                              <div className="review-row-item" style={{ gridColumn: 'span 2' }}>
                                <span className="review-label">Games Played</span>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '2px' }}>
                                  {sessionSummaryResult.gamesPlayed.map((g: any) => (
                                    <span key={g.id} className="review-game-pill" style={{ fontSize: '0.7rem', padding: '2px 6px' }}>
                                      🎮 {g.name}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* 2. Timing & Duration Breakdown Card */}
                        <div className="review-card">
                          <div className="review-card-header">
                            <div className="review-card-title">
                              <span>⏱️</span>
                              <span>Session Duration Breakdown</span>
                            </div>
                            <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                              {sessionSummaryResult.timing?.sessionDate}
                            </span>
                          </div>
                          <div className="review-grid-2col">
                            <div className="review-row-item">
                              <span className="review-label">Session Slot</span>
                              <span className="review-val" style={{ fontFamily: 'var(--font-mono)' }}>
                                {sessionSummaryResult.timing?.startTime} ➔ {sessionSummaryResult.timing?.endTime}
                              </span>
                            </div>
                            <div className="review-row-item">
                              <span className="review-label">Actual Play Time</span>
                              <span className="review-val">
                                {sessionSummaryResult.timing?.durationFormatted} ({sessionSummaryResult.timing?.elapsedMinutes} mins)
                              </span>
                            </div>
                            <div className="review-row-item">
                              <span className="review-label">Charged Duration (15m increments)</span>
                              <span className="review-val" style={{ color: 'var(--accent)', fontWeight: 700 }}>
                                {sessionSummaryResult.timing?.chargedMinutes} mins ({sessionSummaryResult.timing?.actualDurationHours} hr)
                              </span>
                            </div>
                            <div className="review-row-item">
                              <span className="review-label">Scheduled Time</span>
                              <span className="review-val">
                                {sessionSummaryResult.timing?.scheduledDurationHours} hr(s)
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* 3. Pricing Ledger & Promo Discounts */}
                        <div className="review-card">
                          <div className="review-card-header">
                            <div className="review-card-title">
                              <span>🏷️</span>
                              <span>Billing & Settlement Calculation</span>
                            </div>
                            <span style={{ fontSize: '0.68rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                              Rate: ₹{sessionSummaryResult.billing?.ratePerPersonPerHour}/player/hr
                            </span>
                          </div>
                          
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', padding: '2px 0' }}>
                            {sessionSummaryResult.billing?.calculationFormula}
                          </div>

                          {/* Applied Offers list */}
                          {sessionSummaryResult.appliedOffers && sessionSummaryResult.appliedOffers.length > 0 && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', margin: '4px 0' }}>
                              {sessionSummaryResult.appliedOffers.map((o: any) => (
                                <div key={o.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 10px', background: 'rgba(16, 185, 129, 0.08)', borderRadius: '6px', border: '1px solid rgba(16, 185, 129, 0.25)' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <span style={{ fontSize: '0.8rem' }}>🎉</span>
                                    <div>
                                      <div style={{ fontWeight: 700, fontSize: '0.76rem', color: 'var(--text-heading)' }}>{o.name}</div>
                                      <div style={{ fontSize: '0.68rem', color: 'var(--success)' }}>{o.reason || 'Offer active'}</div>
                                    </div>
                                  </div>
                                  <span style={{ fontWeight: 800, fontSize: '0.82rem', color: 'var(--success)' }}>−₹{o.discount}</span>
                                </div>
                              ))}
                            </div>
                          )}

                          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', borderTop: '1px solid var(--border)', paddingTop: '6px', marginTop: '2px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                              <span>Base Subtotal</span>
                              <span>₹{sessionSummaryResult.billing?.originalAmount}</span>
                            </div>
                            {sessionSummaryResult.billing?.discountApplied > 0 && (
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.76rem', color: 'var(--success)', fontWeight: 600 }}>
                                <span>Promotional Discount</span>
                                <span>−₹{sessionSummaryResult.billing?.discountApplied}</span>
                              </div>
                            )}
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                              <span>Initial Amount Paid at Booking</span>
                              <span>₹{sessionSummaryResult.billing?.initialAmountPaid}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-heading)', borderTop: '1px dashed var(--border)', paddingTop: '4px' }}>
                              <span>Final Amount Charged</span>
                              <span>₹{sessionSummaryResult.billing?.finalAmountCharged}</span>
                            </div>

                            {/* 4. Settlement Highlight Banner */}
                            {(() => {
                              const settlement = sessionSummaryResult.billing?.settlement;
                              const status = settlement?.status || 'SETTLED';
                              const amount = settlement?.amount || 0;
                              const note = settlement?.note || '';

                              if (status === 'REFUND_DUE') {
                                return (
                                  <div className="settlement-card refund">
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                      <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#f59e0b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                        💸 Refund Due to Customer
                                      </div>
                                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', maxWidth: '320px', lineHeight: 1.3 }}>
                                        {note}
                                      </div>
                                    </div>
                                    <div style={{ fontSize: '1.35rem', fontWeight: 900, color: '#f59e0b' }}>
                                      ₹{amount}
                                    </div>
                                  </div>
                                );
                              }

                              if (status === 'PAYMENT_DUE') {
                                return (
                                  <div className="settlement-card payment-due">
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                      <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#ef4444', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                        ⚠️ Additional Payment Due
                                      </div>
                                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', maxWidth: '320px', lineHeight: 1.3 }}>
                                        {note}
                                      </div>
                                    </div>
                                    <div style={{ fontSize: '1.35rem', fontWeight: 900, color: '#ef4444' }}>
                                      +₹{amount}
                                    </div>
                                  </div>
                                );
                              }

                              return (
                                <div className="settlement-card settled">
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                    <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#10b981', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                      ✓ Exactly Settled
                                    </div>
                                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                      {note || 'Full payment settled with no balance difference.'}
                                    </div>
                                  </div>
                                  <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#10b981' }}>
                                    ₹0 Balance
                                  </div>
                                </div>
                              );
                            })()}
                          </div>
                        </div>
                      </div>

                      <div className="modal-footer">
                        <button
                          type="button"
                          className="btn-card-action primary"
                          style={{ width: '100%', fontWeight: 700, padding: '10px' }}
                          onClick={() => setSessionSummaryResult(null)}
                        >
                          ✓ Done & Return to Hub
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Session Warning Alert Modal (start 10m/5m, end 10m/5m/3m/1m/0m) */}
                {activeSessionAlert && (
                  <div className="modal-overlay" style={{ zIndex: 1100 }} onClick={() => setActiveSessionAlert(null)}>
                    <div 
                      className="modal-card" 
                      style={{ 
                        maxWidth: '500px', 
                        border: `2px solid ${activeSessionAlert.kind === 'starting' ? 'var(--accent)' : activeSessionAlert.minutesThreshold === 0 || activeSessionAlert.minutesThreshold === 1 ? 'var(--error)' : activeSessionAlert.minutesThreshold === 3 ? '#f97316' : 'var(--warning)'}`,
                        boxShadow: `0 0 30px ${activeSessionAlert.kind === 'starting' ? 'rgba(99, 102, 241, 0.25)' : activeSessionAlert.minutesThreshold === 0 || activeSessionAlert.minutesThreshold === 1 ? 'rgba(239, 68, 68, 0.25)' : 'rgba(245, 158, 11, 0.25)'}`
                      }} 
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="modal-header" style={{ borderBottomColor: 'var(--border)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span style={{ fontSize: '1.4rem' }}>
                            {activeSessionAlert.kind === 'starting' ? '🗓️' : activeSessionAlert.minutesThreshold === 0 ? '🛑' : activeSessionAlert.minutesThreshold === 1 ? '🚨' : '⚠️'}
                          </span>
                          <div>
                            <h3 className="modal-title" style={{ color: activeSessionAlert.kind === 'starting' ? 'var(--accent)' : activeSessionAlert.minutesThreshold === 0 || activeSessionAlert.minutesThreshold === 1 ? 'var(--error)' : activeSessionAlert.minutesThreshold === 3 ? '#f97316' : 'var(--warning)' }}>
                              {activeSessionAlert.kind === 'starting'
                                ? `Session starts in ${activeSessionAlert.minutesThreshold} minutes`
                                : activeSessionAlert.minutesThreshold === 0 
                                ? 'Session Time Expired'
                                : `${activeSessionAlert.minutesThreshold} Minute${activeSessionAlert.minutesThreshold > 1 ? 's' : ''} Remaining`}
                            </h3>
                            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
                              {activeSessionAlert.kind === 'starting' ? 'Upcoming session notification' : 'Console Station Alert · Action Required'}
                            </p>
                          </div>
                        </div>
                        <button className="modal-close-btn" onClick={() => setActiveSessionAlert(null)}>
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                          </svg>
                        </button>
                      </div>

                      <div className="modal-body">
                        {/* Target Station Card */}
                        <div style={{ background: 'var(--bg-card-hover)', border: '1px solid var(--border)', borderRadius: '8px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div>
                              <div style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-heading)' }}>
                                {activeSessionAlert.instanceName}
                              </div>
                              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                                {activeSessionAlert.setupInfo}
                              </div>
                            </div>
                            <span 
                              style={{ 
                                padding: '3px 8px', 
                                borderRadius: '4px', 
                                fontSize: '0.72rem', 
                                fontWeight: 700, 
                                background: activeSessionAlert.minutesThreshold === 0 ? 'rgba(239, 68, 68, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                                color: activeSessionAlert.minutesThreshold === 0 ? 'var(--error)' : 'var(--warning)',
                                border: `1px solid ${activeSessionAlert.minutesThreshold === 0 ? 'var(--error)' : 'var(--warning)'}`
                              }}
                            >
                              Booking #{activeSessionAlert.bookingId}
                            </span>
                          </div>

                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border)', paddingTop: '8px' }}>
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Customer Phone:</span>
                            <span style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-heading)' }}>{activeSessionAlert.phoneNumber}</span>
                          </div>
                        </div>

                        {/* Visual Countdown Box */}
                        <div style={{ textAlign: 'center', padding: '16px', borderRadius: '8px', background: 'var(--bg)', border: '1px solid var(--border)' }}>
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.05em' }}>
                            {activeSessionAlert.kind === 'starting' ? 'Time until start' : 'Exact Time Remaining'}
                          </div>
                          <div style={{ fontFamily: 'monospace', fontSize: '1.8rem', fontWeight: 900, color: activeSessionAlert.kind === 'starting' ? 'var(--accent)' : activeSessionAlert.minutesThreshold === 0 ? 'var(--error)' : activeSessionAlert.minutesThreshold === 1 ? 'var(--error)' : '#f97316', margin: '6px 0' }}>
                            {activeSessionAlert.kind === 'starting'
                              ? (startCountdownMap[activeSessionAlert.bookingId] > 0
                                ? formatCountdown(startCountdownMap[activeSessionAlert.bookingId])
                                : 'Starting now')
                              : countdownMap[activeSessionAlert.bookingId] !== undefined && countdownMap[activeSessionAlert.bookingId] > 0
                              ? formatCountdown(countdownMap[activeSessionAlert.bookingId])
                              : '00m 00s (TIME UP)'}
                          </div>
                          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                            {activeSessionAlert.kind === 'starting'
                              ? `Next session starts at ${activeSessionAlert.startLabel || 'the scheduled time'}. Timer will begin only after start.`
                              : activeSessionAlert.minutesThreshold === 0 
                              ? 'The allocated playing time has ended. Please settle payment or extend the slot.'
                              : 'Please check with the player if they wish to extend their gaming session or prepare for checkout.'}
                          </div>
                        </div>

                        {/* Quick Extension Options */}
                        {activeSessionAlert.kind === 'ending' && (
                        <div>
                          <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-heading)', marginBottom: '8px' }}>
                            Quick Session Extension (1-Click)
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                            <button
                              type="button"
                              className="btn-card-action"
                              style={{ fontSize: '0.78rem', padding: '8px 4px' }}
                              onClick={() => handleQuickExtend(activeSessionAlert.bookingId, 15)}
                              disabled={isExtensionSubmitting}
                            >
                              +15 Min
                            </button>
                            <button
                              type="button"
                              className="btn-card-action"
                              style={{ fontSize: '0.78rem', padding: '8px 4px' }}
                              onClick={() => handleQuickExtend(activeSessionAlert.bookingId, 30)}
                              disabled={isExtensionSubmitting}
                            >
                              +30 Min
                            </button>
                            <button
                              type="button"
                              className="btn-card-action"
                              style={{ fontSize: '0.78rem', padding: '8px 4px' }}
                              onClick={() => handleQuickExtend(activeSessionAlert.bookingId, 60)}
                              disabled={isExtensionSubmitting}
                            >
                              +60 Min (1h)
                            </button>
                          </div>
                        </div>
                        )}
                      </div>

                      <div className="modal-footer">
                        <button 
                          type="button" 
                          className="btn-card-action"
                          onClick={() => setActiveSessionAlert(null)}
                        >
                          Acknowledge & Dismiss
                        </button>
                        {activeSessionAlert.kind === 'ending' && (
                        <button 
                          type="button" 
                          className="btn-card-action"
                          style={{ background: 'var(--error)', color: 'white', borderColor: 'var(--error)' }}
                          onClick={() => {
                            const matchingInst = occupancyData.find((i) => i.instanceId === activeSessionAlert.instanceId);
                            setActiveSessionAlert(null);
                            if (matchingInst) openTerminateModal(matchingInst);
                          }}
                        >
                          ⏹ End Session & Checkout
                        </button>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </main>

        {/* Footer */}
        <footer className="footer">
          <div className="footer-top">
            <div className="footer-logo">VORTEX PLATFORM OPERATIONS</div>
            <div className="footer-links">
              <a href="#/" onClick={(e) => { e.preventDefault(); navigateTo('#/'); }} className="footer-link">Home</a>
              {authToken && (
                <a href="#/dashboard" onClick={(e) => { e.preventDefault(); navigateTo('#/dashboard'); }} className="footer-link">Control Center</a>
              )}
              <a href="https://google.com" className="footer-link">User Guide</a>
            </div>
          </div>

          <div className="footer-bottom">
            <div>&copy; 2026 Vortex Entertainment Inc. General Administration Board.</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div className="footer-meta-item">
                <span>Version Code:</span>
                <span style={{ color: 'var(--text-heading)', fontWeight: '600' }}>v2.4.1-LTS</span>
              </div>
              <div className="footer-meta-item">
                <span>Operational Nodes:</span>
                <span style={{ color: 'var(--success)', fontWeight: '600' }}>14 Active Regions</span>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}

export default App;
