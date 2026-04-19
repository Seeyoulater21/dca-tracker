// Shared types — used by API routes, server components, and client components.

export type Entry = {
  id: number;
  date: string;         // 'YYYY-MM-DD'
  fiat_thb: number;     // positive integer
  satoshi: number;      // positive integer (1 BTC = 1e8 sat)
  price_thb: number;    // positive number
  created_at: string;
};

export type EnrichedEntry = Entry & {
  dayActive: number;    // 1-indexed across all entries after sort asc
  cumSat: number;
  cumFiat: number;
  portfolioValue: number;
  invested: number;
  unrealized: number;
  pctUnrealized: number;
  satPerTHB: number;
};

export type Summary = {
  spendFiat: number;
  totalSatoshi: number;
  numberOfDays: number;
  averageCost: number;       // sat per THB
  todaySatPerTHB: number;
  marketValue: number;
  pctProfitLoss: number;
  maxDrawdown: number;       // percent, <= 0
  progressFiat: number;      // percent
  progressBTC: number;       // percent
  currentPrice: number;      // duplicated for convenience in UI
  goalFiat: number;
  goalSat: number;
};

export type Goals = {
  goal_fiat: number;
  goal_satoshi: number;
};

export type Delta24 = { delta: number; pct: number };

export type ApiOk<T> = { ok: true; data: T };
export type ApiErr = { ok: false; error: string; fallbackPrice?: number | null };
export type ApiResult<T> = ApiOk<T> | ApiErr;
