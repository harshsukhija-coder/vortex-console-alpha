export type EvolutionArea = 'foundation' | 'booking' | 'operations' | 'insights';

export interface EvolutionMilestone {
  date: string;
  eyebrow: string;
  title: string;
  summary: string;
  area: EvolutionArea;
  shipped: string[];
}

export interface EvolutionTimelineProps {
  milestones: EvolutionMilestone[];
}

export const evolutionMilestones: EvolutionMilestone[] = [
  {
    date: '02 Sep 2026',
    eyebrow: 'Day one',
    title: 'The console took shape',
    summary: 'A React and TypeScript control surface became the starting point for lounge operations.',
    area: 'foundation',
    shipped: ['Vite application shell', 'Console station cards', 'Responsive visual system'],
  },
  {
    date: '03 Sep 2026',
    eyebrow: 'Pricing',
    title: 'Real station economics',
    summary: 'Single-player and multiplayer rates moved into the core station experience.',
    area: 'booking',
    shipped: ['Dual pricing', 'Setup rate visibility', 'Credential cleanup'],
  },
  {
    date: '06–08 Sep 2026',
    eyebrow: 'Access',
    title: 'Authentication became operational',
    summary: 'Admin access, role-aware behavior, token expiry, and automatic logout secured the console.',
    area: 'foundation',
    shipped: ['JWT authentication', 'Admin and Super Admin roles', 'Automatic session expiry'],
  },
  {
    date: '10 Sep 2026',
    eyebrow: 'Booking engine',
    title: 'Bookings became a guided workflow',
    summary: 'Customer lookup, players, games, slots, offers, review, and confirmation became one connected flow.',
    area: 'booking',
    shipped: ['Multi-step booking', 'Offer eligibility', 'Conflict review', 'Tentative booking ledger'],
  },
  {
    date: '10 Sep 2026',
    eyebrow: 'Live sessions',
    title: 'The dashboard learned time',
    summary: 'Live countdowns, warnings, extensions, graceful termination, and settlement arrived.',
    area: 'operations',
    shipped: ['Live occupancy', 'Session extensions', 'Termination guard', 'Cash and UPI settlement'],
  },
  {
    date: '10 Sep 2026',
    eyebrow: 'Intelligence',
    title: 'Operations became measurable',
    summary: 'Session analytics turned lounge activity into trends, rankings, utilization, and exports.',
    area: 'insights',
    shipped: ['Daily and monthly analytics', 'Player and game insights', 'Chart downloads', 'Excel exports'],
  },
  {
    date: '14 Sep 2026',
    eyebrow: 'Daily discipline',
    title: 'Meter operations joined the console',
    summary: 'Daily evidence-backed readings and Super Admin consumption analytics closed an operational gap.',
    area: 'operations',
    shipped: ['Daily reading reminders', 'Image evidence', 'Historical corrections', 'Consumption analytics'],
  },
  {
    date: '15 Sep 2026',
    eyebrow: 'Commerce',
    title: 'Sessions expanded beyond gameplay',
    summary: 'Add-ons became part of booking, live service, checkout, and the final receipt.',
    area: 'booking',
    shipped: ['Add-on catalog', 'Booking add-ons', 'In-session ordering', 'Receipt breakdown'],
  },
  {
    date: '15 Sep 2026',
    eyebrow: 'Server authority',
    title: 'Checkout moved to one source of truth',
    summary: 'Timing, flooring, offers, add-ons, payments, refunds, and dues now come from the checkout API.',
    area: 'operations',
    shipped: ['Read-only checkout preview', 'Server-calculated billing', 'Exact balance status', 'Adjusted timing'],
  },
];

export const currentCapabilities = [
  { value: 'Live', label: 'Occupancy and timers' },
  { value: '8 step', label: 'Booking workflow' },
  { value: '2 roles', label: 'Access control' },
  { value: '3 modes', label: 'Analytics ranges' },
  { value: '15 min', label: 'Billing intervals' },
  { value: 'IST', label: 'Operational timezone' },
];

export const nextHorizons = [
  {
    title: 'Inventory-aware add-ons',
    text: 'Track stock, low inventory, wastage, and supplier replenishment.',
  },
  {
    title: 'Customer self-service',
    text: 'Let players reserve stations, choose games, and manage sessions directly.',
  },
  {
    title: 'Predictive operations',
    text: 'Forecast peak demand, staffing needs, energy usage, and station maintenance.',
  },
];
