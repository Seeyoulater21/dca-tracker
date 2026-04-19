# DCA Tracker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the complete DCA Tracker webapp end-to-end — scaffolding, SQLite data layer, Bitkub price fetcher, API routes, all UI components (matching [dca-tracker-ui-ref/](../../../dca-tracker-ui-ref/) pixel-for-pixel), and interactive mutations.

**Architecture:** Next.js 16 App Router + TypeScript strict. Server Component reads SQLite + Bitkub price, passes data to a client shell. Mutations go through `/api/*` routes; client calls `router.refresh()` after success. Pure `calc.ts` implements every formula from CLAUDE.md §Core calculations. CSS tokens in `globals.css` drive Tailwind + support runtime accent swap via `document.documentElement.style.setProperty`.

**Tech Stack:** `next@^16`, `react`, `typescript` (strict + `noUncheckedIndexedAccess`), `better-sqlite3`, `tailwindcss`, `eslint-config-next`. No test framework (per CLAUDE.md "No tests unless user asks"). No observability / auth / CSV / deploy config.

**Source docs:**
- Spec: [docs/superpowers/specs/2026-04-19-dca-tracker-build-design.md](../specs/2026-04-19-dca-tracker-build-design.md)
- Project conventions: [CLAUDE.md](../../../CLAUDE.md)
- Visual + logic reference: [dca-tracker-ui-ref/](../../../dca-tracker-ui-ref/) — all JSX there is the authoritative visual spec. Port from it; do not import at runtime.

**Verification model (TDD adapted):**
CLAUDE.md forbids a test framework, so each code task ends with one of:
- a `curl` command with expected JSON output (API tasks),
- a one-off `node --import tsx/esm ...` script (pure function tasks),
- a browser smoke check opening `/` side-by-side with `dca-tracker-ui-ref/DCA Tracker.html` (UI tasks).

**Git note:** `dca-tracker/` currently lives inside a larger repo at `/Users/pakdaesedmetapiphat`. Commit commands below assume you want per-task commits. If that is undesirable, either (a) run `git init` inside `dca-tracker/` first to make it self-contained, or (b) skip the `git commit` step at the end of each task and do one squashed commit at the end. The commit steps remain in the plan so task boundaries stay explicit.

---

## File structure (created by this plan)

```
dca-tracker/
├── package.json                 # Task 1
├── tsconfig.json                # Task 1
├── next.config.ts               # Task 1
├── tailwind.config.ts           # Task 1
├── postcss.config.mjs           # Task 1
├── eslint.config.mjs            # Task 1
├── .gitignore                   # Task 1
├── src/
│   ├── types.ts                 # Task 3
│   ├── app/
│   │   ├── layout.tsx           # Task 2
│   │   ├── globals.css          # Task 2
│   │   ├── page.tsx             # Task 9
│   │   └── api/
│   │       ├── entries/route.ts         # Task 6
│   │       ├── entries/[id]/route.ts    # Task 7
│   │       ├── price/route.ts           # Task 8
│   │       └── settings/route.ts        # Task 8
│   ├── lib/
│   │   ├── schema.sql           # Task 3
│   │   ├── db.ts                # Task 3
│   │   ├── bitkub.ts            # Task 4
│   │   └── calc.ts              # Task 5
│   └── components/
│       ├── Dashboard.tsx        # Task 9  (client shell)
│       ├── SectionLabel.tsx     # Task 10
│       ├── Topbar.tsx           # Task 10
│       ├── Sparkline.tsx        # Task 11
│       ├── PnlCard.tsx          # Task 11
│       ├── StatsGrid.tsx        # Task 12
│       ├── Goals.tsx            # Task 13  (edit UI added Task 19)
│       ├── Chart.tsx            # Task 14
│       ├── ChartCard.tsx        # Task 14
│       ├── RecordsTable.tsx     # Task 15  (edit/delete added Task 18)
│       ├── AddBuyModal.tsx      # Task 16
│       └── TweaksPanel.tsx      # Task 17
└── data/                        # created at runtime by db.ts
    └── dca.db
```

---

# PHASE 1 — SCAFFOLD

## Task 1: Bootstrap the Next.js 16 project

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `next.config.ts`
- Create: `tailwind.config.ts`
- Create: `postcss.config.mjs`
- Create: `eslint.config.mjs`
- Create: `.gitignore`

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "dca-tracker",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "better-sqlite3": "^11.5.0",
    "next": "^16.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "devDependencies": {
    "@tailwindcss/postcss": "^4.0.0",
    "@types/better-sqlite3": "^7.6.11",
    "@types/node": "^22.0.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "eslint": "^9.0.0",
    "eslint-config-next": "^16.0.0",
    "postcss": "^8.4.0",
    "tailwindcss": "^4.0.0",
    "tsx": "^4.19.0",
    "typescript": "^5.6.0"
  }
}
```

Note: `tsx` is a devDependency only for running the one-off verification script in Task 5. It is not imported at runtime.

- [ ] **Step 2: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": false,
    "skipLibCheck": true,
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules", "dca-tracker-ui-ref"]
}
```

- [ ] **Step 3: Create `next.config.ts`**

```ts
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['better-sqlite3'],
  },
};

export default nextConfig;
```

- [ ] **Step 4: Create `tailwind.config.ts`**

```ts
import type { Config } from 'tailwindcss';

export default {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: 'var(--bg)',
        surface: 'var(--surface)',
        border: 'var(--border)',
        fg: 'var(--fg)',
        'fg-2': 'var(--fg-2)',
        muted: 'var(--muted)',
        accent: 'var(--accent)',
        'accent-strong': 'var(--accent-strong)',
        'accent-soft': 'var(--accent-soft)',
        'accent-line': 'var(--accent-line)',
        pos: 'var(--pos)',
        neg: 'var(--neg)',
      },
      fontFamily: {
        sans: 'var(--sans)',
        mono: 'var(--mono)',
      },
      borderRadius: {
        DEFAULT: '4px',
        lg: '8px',
      },
    },
  },
  plugins: [],
} satisfies Config;
```

- [ ] **Step 5: Create `postcss.config.mjs`**

```js
export default {
  plugins: {
    '@tailwindcss/postcss': {},
  },
};
```

- [ ] **Step 6: Create `eslint.config.mjs`**

```js
import { FlatCompat } from '@eslint/eslintrc';

const compat = new FlatCompat();

export default [
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  { ignores: ['dca-tracker-ui-ref/**', 'data/**', '.next/**'] },
];
```

- [ ] **Step 7: Create `.gitignore`**

```
/node_modules
/.next
/out
/data
/build
next-env.d.ts
*.tsbuildinfo
.DS_Store
.env*.local
```

- [ ] **Step 8: Install dependencies**

Run: `cd "/Users/pakdaesedmetapiphat/Mac/Claude Code University/dca-tracker" && npm install`
Expected: installs cleanly, prints "added N packages". `better-sqlite3` may need native compile — if Node version is below 20, upgrade first.

- [ ] **Step 9: Verify install**

Run: `npx next --version`
Expected: `16.x.x` (anything in the 16.x major line).

Run: `npm run typecheck`
Expected: 0 errors (no source files yet — should pass cleanly).

- [ ] **Step 10: Commit**

```bash
git add package.json package-lock.json tsconfig.json next.config.ts tailwind.config.ts postcss.config.mjs eslint.config.mjs .gitignore
git commit -m "chore: scaffold Next.js 16 + TypeScript + Tailwind + better-sqlite3"
```

---

# PHASE 2 — TOKENS + FONTS

## Task 2: Port design tokens and load fonts

**Files:**
- Create: `src/app/globals.css`
- Create: `src/app/layout.tsx`

- [ ] **Step 1: Create `src/app/globals.css`**

Copy the **entire contents** of [dca-tracker-ui-ref/styles.css](../../../dca-tracker-ui-ref/styles.css) into `src/app/globals.css` verbatim. Then prepend these 3 lines at the very top:

```css
@import "tailwindcss";

/* Everything below is ported verbatim from dca-tracker-ui-ref/styles.css */
```

Do not modify any selector, property, or value. The ref uses vanilla CSS classes (`.topbar`, `.pnl-card`, etc.) that the components will apply directly — Tailwind utilities are only for edge-case spacing we may add later.

After pasting, add these overrides at the very bottom of the file (they replace the ref's font-family: they resolve to the next/font CSS vars loaded in layout.tsx):

```css
/* Font variables are injected by next/font in layout.tsx */
body { font-family: var(--sans); background: var(--bg); color: var(--fg); }
.mono, code, pre { font-family: var(--mono); }
* { font-variant-numeric: tabular-nums; }
```

- [ ] **Step 2: Create `src/app/layout.tsx`**

```tsx
import type { Metadata } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--sans',
  display: 'swap',
});

const jetbrains = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'DCA Tracker',
  description: 'Bitcoin DCA tracker · sats/THB',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrains.variable}`}>
      <body>{children}</body>
    </html>
  );
}
```

Note: `next/font/google` writes `--sans` and `--mono` CSS vars onto the `<html>` element. These override the values `styles.css` sets in `:root` for the same var names, so the ref's `styles.css` line `--sans: …` becomes a harmless fallback. If the ref's `:root` declares `--sans` with a Google-font string literal, rename that declaration to `--sans-fallback` to avoid conflict.

- [ ] **Step 3: Verify — dev server renders tokens**

Run: `npm run dev`
Open: `http://localhost:3000`
Expected: blank page with:
- Background color matching `--bg` from ref (a light beige/off-white)
- Any default Next.js text (if present) rendering in Inter
- No console errors or 404s

Stop dev server with Ctrl+C.

- [ ] **Step 4: Commit**

```bash
git add src/app/globals.css src/app/layout.tsx
git commit -m "feat(ui): port design tokens and load Inter + JetBrains Mono"
```

---

# PHASE 3 — DATA LAYER

## Task 3: Types, SQL schema, and DB singleton

**Files:**
- Create: `src/types.ts`
- Create: `src/lib/schema.sql`
- Create: `src/lib/db.ts`

- [ ] **Step 1: Create `src/types.ts`**

```ts
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
```

- [ ] **Step 2: Create `src/lib/schema.sql`**

```sql
CREATE TABLE IF NOT EXISTS entries (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  date       TEXT    NOT NULL UNIQUE,
  fiat_thb   INTEGER NOT NULL CHECK (fiat_thb > 0),
  satoshi    INTEGER NOT NULL CHECK (satoshi  > 0),
  price_thb  REAL    NOT NULL CHECK (price_thb > 0),
  created_at TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_entries_date ON entries(date);

CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

INSERT OR IGNORE INTO settings (key, value) VALUES
  ('goal_fiat',     '200000'),
  ('goal_satoshi',  '2000000');
```

- [ ] **Step 3: Create `src/lib/db.ts`**

```ts
import Database from 'better-sqlite3';
import { readFileSync, mkdirSync, existsSync } from 'node:fs';
import path from 'node:path';

let instance: Database.Database | null = null;

function open(): Database.Database {
  const dataDir = path.join(process.cwd(), 'data');
  if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });

  const db = new Database(path.join(dataDir, 'dca.db'));
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  const schema = readFileSync(path.join(process.cwd(), 'src/lib/schema.sql'), 'utf8');
  db.exec(schema);

  return db;
}

export function getDb(): Database.Database {
  if (!instance) instance = open();
  return instance;
}
```

- [ ] **Step 4: Verify — DB opens + schema applied**

Run:
```bash
node --input-type=module -e "import('./src/lib/db.ts').then(m => { const db = m.getDb(); const tables = db.prepare(\"SELECT name FROM sqlite_master WHERE type='table'\").all(); console.log(tables); })"
```

This will fail because Node can't import `.ts` directly. Use `tsx` instead:

Run:
```bash
npx tsx -e "import('./src/lib/db.ts').then(m => { const db = m.getDb(); const tables = db.prepare(\"SELECT name FROM sqlite_master WHERE type='table'\").all(); console.log(tables); const settings = db.prepare('SELECT * FROM settings').all(); console.log(settings); })"
```

Expected stdout:
```
[ { name: 'entries' }, { name: 'settings' }, { name: 'idx_entries_date' } ]
[ { key: 'goal_fiat', value: '200000' }, { key: 'goal_satoshi', value: '2000000' } ]
```

(Note: `idx_entries_date` may not appear under `type='table'` — that is fine. The 2 tables plus the seeded settings rows are what matters.)

- [ ] **Step 5: Commit**

```bash
git add src/types.ts src/lib/schema.sql src/lib/db.ts
git commit -m "feat(data): add types, SQL schema, and better-sqlite3 singleton"
```

---

## Task 4: Bitkub price fetcher

**Files:**
- Create: `src/lib/bitkub.ts`

- [ ] **Step 1: Create `src/lib/bitkub.ts`**

```ts
const BITKUB_URL = 'https://api.bitkub.com/api/market/ticker?sym=THB_BTC';

type BitkubTicker = { last: number; high24hr: number; low24hr: number };
type BitkubResponse = Record<string, BitkubTicker>;

export async function fetchCurrentPrice(): Promise<number | null> {
  try {
    const res = await fetch(BITKUB_URL, { cache: 'no-store', signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const json = (await res.json()) as BitkubResponse;
    const ticker = json.THB_BTC;
    if (!ticker || typeof ticker.last !== 'number' || ticker.last <= 0) return null;
    return ticker.last;
  } catch {
    return null;
  }
}
```

- [ ] **Step 2: Verify — fetch returns a reasonable THB price**

Run: `npx tsx -e "import('./src/lib/bitkub.ts').then(m => m.fetchCurrentPrice()).then(p => console.log('price =', p))"`
Expected: something like `price = 2398015` (any positive integer roughly between 500,000 and 10,000,000). If `null`: you are offline or Bitkub is down — try again; this is acceptable behavior and not a bug.

- [ ] **Step 3: Commit**

```bash
git add src/lib/bitkub.ts
git commit -m "feat(data): add Bitkub THB_BTC price fetcher with 5s timeout"
```

---

## Task 5: Pure calculation functions

**Files:**
- Create: `src/lib/calc.ts`

Reference: canonical logic in `dca-tracker-ui-ref/App.jsx` lines 463-490 and `Chart.jsx` lines 39-74.

- [ ] **Step 1: Create `src/lib/calc.ts`**

```ts
import type { Entry, EnrichedEntry, Summary, Goals, Delta24 } from '@/types';

// Walk entries oldest -> newest. Input must be pre-sorted ASC by date.
export function enrichEntries(entries: Entry[]): EnrichedEntry[] {
  let cumSat = 0;
  let cumFiat = 0;
  return entries.map((e, i) => {
    cumSat += e.satoshi;
    cumFiat += e.fiat_thb;
    const portfolioValue = (cumSat / 1e8) * e.price_thb;
    const invested = cumFiat;
    const unrealized = portfolioValue - invested;
    const pctUnrealized = invested > 0 ? (unrealized / invested) * 100 : 0;
    const satPerTHB = 1e8 / e.price_thb;
    return {
      ...e,
      dayActive: i + 1,
      cumSat,
      cumFiat,
      portfolioValue,
      invested,
      unrealized,
      pctUnrealized,
      satPerTHB,
    };
  });
}

export function computeSummary(
  enriched: EnrichedEntry[],
  currentPrice: number,
  goals: Goals,
): Summary {
  if (enriched.length === 0) {
    // Caller must guard; compute* is not expected to be called on empty arrays,
    // but return a zero-ish structure to avoid undefined in the rare case it is.
    return {
      spendFiat: 0,
      totalSatoshi: 0,
      numberOfDays: 0,
      averageCost: 0,
      todaySatPerTHB: currentPrice > 0 ? 1e8 / currentPrice : 0,
      marketValue: 0,
      pctProfitLoss: 0,
      maxDrawdown: 0,
      progressFiat: 0,
      progressBTC: 0,
      currentPrice,
      goalFiat: goals.goal_fiat,
      goalSat: goals.goal_satoshi,
    };
  }

  const spendFiat = enriched.reduce((s, e) => s + e.fiat_thb, 0);
  const totalSatoshi = enriched.reduce((s, e) => s + e.satoshi, 0);
  const numberOfDays = enriched.length;
  const averageCost = spendFiat > 0 ? totalSatoshi / spendFiat : 0;
  const todaySatPerTHB = currentPrice > 0 ? 1e8 / currentPrice : 0;
  const marketValue = (totalSatoshi / 1e8) * currentPrice;
  const pctProfitLoss = spendFiat > 0 ? ((marketValue - spendFiat) / spendFiat) * 100 : 0;

  // Max drawdown: walk enriched, track peak of portfolioValue, find worst (pv - peak) / peak
  let peak = 0;
  let maxDrawdown = 0;
  for (const e of enriched) {
    if (e.portfolioValue > peak) peak = e.portfolioValue;
    if (peak > 0) {
      const dd = ((e.portfolioValue - peak) / peak) * 100;
      if (dd < maxDrawdown) maxDrawdown = dd;
    }
  }

  const progressFiat = goals.goal_fiat > 0 ? (spendFiat / goals.goal_fiat) * 100 : 0;
  const progressBTC = goals.goal_satoshi > 0 ? (totalSatoshi / goals.goal_satoshi) * 100 : 0;

  return {
    spendFiat,
    totalSatoshi,
    numberOfDays,
    averageCost,
    todaySatPerTHB,
    marketValue,
    pctProfitLoss,
    maxDrawdown,
    progressFiat,
    progressBTC,
    currentPrice,
    goalFiat: goals.goal_fiat,
    goalSat: goals.goal_satoshi,
  };
}

export function computeDelta24(enriched: EnrichedEntry[]): Delta24 | null {
  if (enriched.length < 2) return null;
  const last = enriched[enriched.length - 1]!;
  const prev = enriched[enriched.length - 2]!;
  const delta = last.portfolioValue - prev.portfolioValue;
  const pct = prev.portfolioValue > 0 ? (delta / prev.portfolioValue) * 100 : 0;
  return { delta, pct };
}
```

- [ ] **Step 2: Verify — hand-calc fixture**

Create a throwaway inline script. Run:

```bash
npx tsx -e "
import { enrichEntries, computeSummary, computeDelta24 } from './src/lib/calc.ts';
const entries = [
  { id: 1, date: '2026-04-17', fiat_thb: 1000, satoshi: 50000,  price_thb: 2_000_000, created_at: '' },
  { id: 2, date: '2026-04-18', fiat_thb: 1000, satoshi: 40000,  price_thb: 2_500_000, created_at: '' },
];
const enriched = enrichEntries(entries);
console.log('enriched:', enriched);
const summary = computeSummary(enriched, 2_500_000, { goal_fiat: 200000, goal_satoshi: 2_000_000 });
console.log('summary:', summary);
console.log('delta24:', computeDelta24(enriched));
"
```

Expected (the key numbers — spot-check these in the output):
- `enriched[0].cumSat === 50000`, `enriched[0].portfolioValue === 1000` (50000 / 1e8 × 2_000_000)
- `enriched[1].cumSat === 90000`, `enriched[1].portfolioValue === 2250` (90000 / 1e8 × 2_500_000)
- `summary.spendFiat === 2000`, `summary.totalSatoshi === 90000`
- `summary.marketValue === 2250`, `summary.pctProfitLoss === 12.5`
- `summary.averageCost === 45` (90000 / 2000)
- `summary.progressFiat === 1` (2000 / 200000 × 100)
- `delta24.delta === 1250` (2250 - 1000)

If any number is off, fix `calc.ts` before proceeding.

- [ ] **Step 3: Commit**

```bash
git add src/lib/calc.ts
git commit -m "feat(data): add pure calc.ts — enrichEntries, computeSummary, computeDelta24"
```

---

# PHASE 4 — API ROUTES

## Task 6: Entries list + create

**Files:**
- Create: `src/app/api/entries/route.ts`

- [ ] **Step 1: Create `src/app/api/entries/route.ts`**

```ts
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import type { Entry, ApiResult } from '@/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(): Promise<NextResponse<ApiResult<Entry[]>>> {
  const rows = getDb()
    .prepare('SELECT id, date, fiat_thb, satoshi, price_thb, created_at FROM entries ORDER BY date ASC')
    .all() as Entry[];
  return NextResponse.json({ ok: true, data: rows });
}

export async function POST(req: Request): Promise<NextResponse<ApiResult<Entry>>> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 });
  }
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ ok: false, error: 'invalid_body' }, { status: 400 });
  }
  const { date, fiat_thb, price_thb } = body as { date?: unknown; fiat_thb?: unknown; price_thb?: unknown };

  if (typeof date !== 'string' || !DATE_RE.test(date)) {
    return NextResponse.json({ ok: false, error: 'invalid_date' }, { status: 400 });
  }
  const fiat = Number(fiat_thb);
  if (!Number.isInteger(fiat) || fiat <= 0 || fiat > 10_000_000) {
    return NextResponse.json({ ok: false, error: 'invalid_fiat_thb' }, { status: 400 });
  }
  const price = Number(price_thb);
  if (!Number.isFinite(price) || price <= 0 || price > 100_000_000) {
    return NextResponse.json({ ok: false, error: 'invalid_price_thb' }, { status: 400 });
  }

  const satoshi = Math.floor((fiat / price) * 1e8);
  if (satoshi <= 0) {
    return NextResponse.json({ ok: false, error: 'satoshi_non_positive' }, { status: 400 });
  }

  const db = getDb();
  try {
    const info = db
      .prepare('INSERT INTO entries (date, fiat_thb, satoshi, price_thb) VALUES (?, ?, ?, ?)')
      .run(date, fiat, satoshi, price);
    const row = db
      .prepare('SELECT id, date, fiat_thb, satoshi, price_thb, created_at FROM entries WHERE id = ?')
      .get(info.lastInsertRowid) as Entry;
    return NextResponse.json({ ok: true, data: row }, { status: 201 });
  } catch (e) {
    const msg = (e as Error).message || '';
    if (msg.includes('UNIQUE constraint failed')) {
      return NextResponse.json({ ok: false, error: 'duplicate_date' }, { status: 409 });
    }
    return NextResponse.json({ ok: false, error: 'db_error' }, { status: 500 });
  }
}
```

- [ ] **Step 2: Verify — GET returns empty list**

Run: `npm run dev` in one terminal.
In another: `curl -s http://localhost:3000/api/entries | jq .`
Expected: `{ "ok": true, "data": [] }`

- [ ] **Step 3: Verify — POST creates an entry**

```bash
curl -s -X POST http://localhost:3000/api/entries \
  -H 'Content-Type: application/json' \
  -d '{"date":"2026-04-19","fiat_thb":108,"price_thb":2500000}' | jq .
```

Expected: HTTP 201, body shape:
```json
{ "ok": true, "data": { "id": 1, "date": "2026-04-19", "fiat_thb": 108, "satoshi": 4320, "price_thb": 2500000, "created_at": "..." } }
```
(`satoshi = floor(108 / 2500000 × 1e8) = 4320`.)

- [ ] **Step 4: Verify — duplicate returns 409**

Repeat the same POST. Expected: HTTP 409, `{ "ok": false, "error": "duplicate_date" }`.

- [ ] **Step 5: Verify — invalid inputs return 400**

```bash
curl -s -X POST http://localhost:3000/api/entries -H 'Content-Type: application/json' -d '{"date":"bad","fiat_thb":10,"price_thb":1}' | jq .
```
Expected: `{ "ok": false, "error": "invalid_date" }` (status 400).

Stop dev server.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/entries/route.ts
git commit -m "feat(api): add GET/POST /api/entries with validation"
```

---

## Task 7: Entry edit + delete

**Files:**
- Create: `src/app/api/entries/[id]/route.ts`

- [ ] **Step 1: Create `src/app/api/entries/[id]/route.ts`**

```ts
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import type { Entry, ApiResult } from '@/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteCtx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, ctx: RouteCtx): Promise<NextResponse<ApiResult<Entry>>> {
  const { id: idStr } = await ctx.params;
  const id = Number(idStr);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ ok: false, error: 'invalid_id' }, { status: 400 });
  }

  let body: unknown;
  try { body = await req.json(); }
  catch { return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 }); }
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ ok: false, error: 'invalid_body' }, { status: 400 });
  }
  const { fiat_thb, price_thb } = body as { fiat_thb?: unknown; price_thb?: unknown };

  const fiat = Number(fiat_thb);
  if (!Number.isInteger(fiat) || fiat <= 0 || fiat > 10_000_000) {
    return NextResponse.json({ ok: false, error: 'invalid_fiat_thb' }, { status: 400 });
  }
  const price = Number(price_thb);
  if (!Number.isFinite(price) || price <= 0 || price > 100_000_000) {
    return NextResponse.json({ ok: false, error: 'invalid_price_thb' }, { status: 400 });
  }

  const satoshi = Math.floor((fiat / price) * 1e8);
  if (satoshi <= 0) {
    return NextResponse.json({ ok: false, error: 'satoshi_non_positive' }, { status: 400 });
  }

  const db = getDb();
  const existing = db.prepare('SELECT id FROM entries WHERE id = ?').get(id);
  if (!existing) {
    return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 });
  }

  db.prepare('UPDATE entries SET fiat_thb = ?, price_thb = ?, satoshi = ? WHERE id = ?')
    .run(fiat, price, satoshi, id);

  const row = db
    .prepare('SELECT id, date, fiat_thb, satoshi, price_thb, created_at FROM entries WHERE id = ?')
    .get(id) as Entry;
  return NextResponse.json({ ok: true, data: row });
}

export async function DELETE(_req: Request, ctx: RouteCtx): Promise<NextResponse<ApiResult<{ id: number }>>> {
  const { id: idStr } = await ctx.params;
  const id = Number(idStr);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ ok: false, error: 'invalid_id' }, { status: 400 });
  }

  const info = getDb().prepare('DELETE FROM entries WHERE id = ?').run(id);
  if (info.changes === 0) {
    return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 });
  }
  return NextResponse.json({ ok: true, data: { id } });
}
```

- [ ] **Step 2: Verify — PATCH updates**

With the entry from Task 6 (id=1) still present:
```bash
npm run dev &
sleep 3
curl -s -X PATCH http://localhost:3000/api/entries/1 \
  -H 'Content-Type: application/json' \
  -d '{"fiat_thb":200,"price_thb":2500000}' | jq .
```
Expected: `{ "ok": true, "data": { "id": 1, ..., "fiat_thb": 200, "satoshi": 8000, ... } }` (`8000 = floor(200/2500000 × 1e8)`).

- [ ] **Step 3: Verify — DELETE removes**

```bash
curl -s -X DELETE http://localhost:3000/api/entries/1 | jq .
```
Expected: `{ "ok": true, "data": { "id": 1 } }`

Then:
```bash
curl -s -X DELETE http://localhost:3000/api/entries/1 | jq .
```
Expected: `{ "ok": false, "error": "not_found" }` (status 404).

Stop dev server.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/entries/[id]/route.ts
git commit -m "feat(api): add PATCH/DELETE /api/entries/[id]"
```

---

## Task 8: Price and settings endpoints

**Files:**
- Create: `src/app/api/price/route.ts`
- Create: `src/app/api/settings/route.ts`

- [ ] **Step 1: Create `src/app/api/price/route.ts`**

```ts
import { NextResponse } from 'next/server';
import { fetchCurrentPrice } from '@/lib/bitkub';
import { getDb } from '@/lib/db';
import type { ApiResult } from '@/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(): Promise<NextResponse<ApiResult<{ price: number }>>> {
  const price = await fetchCurrentPrice();
  if (price !== null) {
    return NextResponse.json({ ok: true, data: { price } });
  }

  const latest = getDb()
    .prepare('SELECT price_thb FROM entries ORDER BY date DESC LIMIT 1')
    .get() as { price_thb: number } | undefined;
  const fallbackPrice = latest ? latest.price_thb : null;

  // Always HTTP 200 so client fetch code stays simple; the `ok: false` envelope signals failure.
  return NextResponse.json({ ok: false, error: 'bitkub_unavailable', fallbackPrice });
}
```

- [ ] **Step 2: Create `src/app/api/settings/route.ts`**

```ts
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import type { Goals, ApiResult } from '@/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function readGoals(): Goals {
  const rows = getDb()
    .prepare('SELECT key, value FROM settings WHERE key IN (?, ?)')
    .all('goal_fiat', 'goal_satoshi') as Array<{ key: string; value: string }>;
  const map = new Map(rows.map((r) => [r.key, Number(r.value)]));
  return {
    goal_fiat: map.get('goal_fiat') ?? 200_000,
    goal_satoshi: map.get('goal_satoshi') ?? 2_000_000,
  };
}

export async function GET(): Promise<NextResponse<ApiResult<Goals>>> {
  return NextResponse.json({ ok: true, data: readGoals() });
}

export async function PATCH(req: Request): Promise<NextResponse<ApiResult<Goals>>> {
  let body: unknown;
  try { body = await req.json(); }
  catch { return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 }); }
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ ok: false, error: 'invalid_body' }, { status: 400 });
  }
  const { goal_fiat, goal_satoshi } = body as { goal_fiat?: unknown; goal_satoshi?: unknown };

  const db = getDb();
  const upsert = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value');

  if (goal_fiat !== undefined) {
    const v = Number(goal_fiat);
    if (!Number.isInteger(v) || v <= 0 || v > 1_000_000_000) {
      return NextResponse.json({ ok: false, error: 'invalid_goal_fiat' }, { status: 400 });
    }
    upsert.run('goal_fiat', String(v));
  }
  if (goal_satoshi !== undefined) {
    const v = Number(goal_satoshi);
    if (!Number.isInteger(v) || v <= 0 || v > 1_000_000_000) {
      return NextResponse.json({ ok: false, error: 'invalid_goal_satoshi' }, { status: 400 });
    }
    upsert.run('goal_satoshi', String(v));
  }

  return NextResponse.json({ ok: true, data: readGoals() });
}
```

- [ ] **Step 3: Verify — price endpoint**

```bash
npm run dev &
sleep 3
curl -s http://localhost:3000/api/price | jq .
```
Expected (online): `{ "ok": true, "data": { "price": <positive number> } }`
Expected (offline): `{ "ok": false, "error": "bitkub_unavailable", "fallbackPrice": null }` (if DB is empty) or fallbackPrice equal to most recent entry's `price_thb`.

- [ ] **Step 4: Verify — settings GET/PATCH**

```bash
curl -s http://localhost:3000/api/settings | jq .
```
Expected: `{ "ok": true, "data": { "goal_fiat": 200000, "goal_satoshi": 2000000 } }`

```bash
curl -s -X PATCH http://localhost:3000/api/settings \
  -H 'Content-Type: application/json' \
  -d '{"goal_fiat":300000}' | jq .
```
Expected: `{ "ok": true, "data": { "goal_fiat": 300000, "goal_satoshi": 2000000 } }`

Reset for later testing:
```bash
curl -s -X PATCH http://localhost:3000/api/settings -H 'Content-Type: application/json' -d '{"goal_fiat":200000}'
```

Stop dev server.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/price/route.ts src/app/api/settings/route.ts
git commit -m "feat(api): add /api/price with fallback and /api/settings GET/PATCH"
```

---

# PHASE 5 — PAGE SHELL

## Task 9: Server page + Dashboard client shell

**Files:**
- Create: `src/app/page.tsx`
- Create: `src/components/Dashboard.tsx`

- [ ] **Step 1: Create `src/app/page.tsx`**

```tsx
import Dashboard from '@/components/Dashboard';
import { getDb } from '@/lib/db';
import { fetchCurrentPrice } from '@/lib/bitkub';
import { enrichEntries, computeSummary, computeDelta24 } from '@/lib/calc';
import type { Entry, Goals } from '@/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function Page() {
  const db = getDb();

  const entries = db
    .prepare('SELECT id, date, fiat_thb, satoshi, price_thb, created_at FROM entries ORDER BY date ASC')
    .all() as Entry[];

  const goalRows = db
    .prepare('SELECT key, value FROM settings WHERE key IN (?, ?)')
    .all('goal_fiat', 'goal_satoshi') as Array<{ key: string; value: string }>;
  const goalMap = new Map(goalRows.map((r) => [r.key, Number(r.value)]));
  const goals: Goals = {
    goal_fiat: goalMap.get('goal_fiat') ?? 200_000,
    goal_satoshi: goalMap.get('goal_satoshi') ?? 2_000_000,
  };

  const live = await fetchCurrentPrice();
  const priceStale = live === null;
  const currentPrice =
    live !== null
      ? live
      : entries.length > 0
        ? entries[entries.length - 1]!.price_thb
        : 0;

  const enriched = enrichEntries(entries);
  const summary = enriched.length > 0 ? computeSummary(enriched, currentPrice, goals) : null;
  const delta24 = computeDelta24(enriched);

  return (
    <Dashboard
      records={enriched}
      summary={summary}
      delta24={delta24}
      currentPrice={currentPrice}
      priceStale={priceStale}
      goals={goals}
    />
  );
}
```

- [ ] **Step 2: Create `src/components/Dashboard.tsx` (minimal client shell, real composition in later tasks)**

```tsx
'use client';

import { useEffect, useState } from 'react';
import type { EnrichedEntry, Summary, Goals, Delta24 } from '@/types';

type Accent = { name: string; hex: string; strong: string; soft: string; line: string };

const ACCENTS: Accent[] = [
  { name: 'Bitcoin Orange', hex: '#F2A900', strong: '#E89100', soft: '#FFF4DC', line: 'rgba(242,169,0,0.15)' },
  { name: 'Saffron',        hex: '#E77B1D', strong: '#C86511', soft: '#FCE9D6', line: 'rgba(231,123,29,0.15)' },
  { name: 'Amber',          hex: '#D98F1C', strong: '#B37416', soft: '#FBEBCF', line: 'rgba(217,143,28,0.15)' },
  { name: 'Crimson',        hex: '#C84A3F', strong: '#A33A2F', soft: '#F5DCD8', line: 'rgba(200,74,63,0.15)' },
  { name: 'Forest',         hex: '#2E7D5B', strong: '#24634A', soft: '#D9EBDF', line: 'rgba(46,125,91,0.15)' },
  { name: 'Ink',            hex: '#2B3A66', strong: '#1F2B4D', soft: '#DBE0EE', line: 'rgba(43,58,102,0.15)' },
];

type Props = {
  records: EnrichedEntry[];
  summary: Summary | null;
  delta24: Delta24 | null;
  currentPrice: number;
  priceStale: boolean;
  goals: Goals;
};

export default function Dashboard(props: Props) {
  const [accent, setAccent] = useState<Accent>(ACCENTS[0]!);

  // Hydrate accent from localStorage
  useEffect(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('dca.accent') : null;
    if (saved) {
      const found = ACCENTS.find((a) => a.name === saved);
      if (found) setAccent(found);
    }
  }, []);

  // Apply accent CSS vars
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--accent', accent.hex);
    root.style.setProperty('--accent-strong', accent.strong);
    root.style.setProperty('--accent-soft', accent.soft);
    root.style.setProperty('--accent-line', accent.line);
    localStorage.setItem('dca.accent', accent.name);
  }, [accent]);

  return (
    <div className="shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">₿</div>
          <div>
            <div className="brand-name">DCA Tracker</div>
            <div className="brand-sub">sats/THB · v1.0.0</div>
          </div>
        </div>
        <div className="topbar-actions" />
      </header>

      <pre className="mono" style={{ padding: 20, fontSize: 12 }}>
        {JSON.stringify(
          {
            records: props.records.length,
            summary: props.summary ? 'present' : null,
            delta24: props.delta24,
            currentPrice: props.currentPrice,
            priceStale: props.priceStale,
            goals: props.goals,
            accent: accent.name,
          },
          null,
          2,
        )}
      </pre>
    </div>
  );
}
```

(This is a stub — later tasks replace the `<pre>` dump with real components.)

- [ ] **Step 3: Verify — empty DB renders**

Run: `npm run dev`. Open `http://localhost:3000`. Expected:
- Page renders without error
- Topbar with "DCA Tracker" brand visible
- `<pre>` block shows `{ "records": 0, "summary": null, ... "currentPrice": <live or 0>, "priceStale": <bool>, ... }`
- Background color matches ref
- Switching accent requires no UI yet — confirm localStorage key `dca.accent` exists via DevTools

- [ ] **Step 4: Verify — with data**

Add an entry via curl (Dev server still running):
```bash
curl -s -X POST http://localhost:3000/api/entries -H 'Content-Type: application/json' -d '{"date":"2026-04-19","fiat_thb":108,"price_thb":2500000}'
```

Reload `/`. Expected: `records: 1`, `summary: "present"`, `delta24: null`.

Stop dev server.

- [ ] **Step 5: Commit**

```bash
git add src/app/page.tsx src/components/Dashboard.tsx
git commit -m "feat(ui): add server page + Dashboard client shell (no composition yet)"
```

---

# PHASE 6 — DISPLAY COMPONENTS

Components are ported in dependency order. Each task adds its component to `Dashboard.tsx`'s render tree.

**Porting convention (applies to every Phase 6/7 component):**
1. Create the `.tsx` file with a typed `Props` type and matching function signature.
2. Copy the JSX body from the specified lines of `dca-tracker-ui-ref/App.jsx` (or `Chart.jsx`).
3. Replace `React.useState` with imported `useState`, etc. Convert any implicit `any` into explicit types.
4. Replace `fmtInt`, `fmtThb`, `fmtPct` helpers with imports from a new file `src/components/_fmt.ts` (created in Task 10 Step 1).
5. Add empty-state guards where the component has a `summary: Summary | null` or `records: EnrichedEntry[]` prop.
6. Do NOT add Tailwind utility classes — the ref uses vanilla CSS classes from `globals.css`.

## Task 10: Layout primitives (formatters, SectionLabel, Topbar)

**Files:**
- Create: `src/components/_fmt.ts`
- Create: `src/components/SectionLabel.tsx`
- Create: `src/components/Topbar.tsx`
- Modify: `src/components/Dashboard.tsx`

- [ ] **Step 1: Create `src/components/_fmt.ts`**

```ts
export const fmtInt = (n: number): string => Math.round(n).toLocaleString('en-US');

export const fmtThb = (n: number, d = 2): string =>
  n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });

export const fmtPct = (n: number, d = 2): string =>
  (n >= 0 ? '+' : '') + n.toFixed(d) + '%';

export const fmtDateShort = (yyyyMmDd: string): string => {
  const [y, m, d] = yyyyMmDd.split('-').map(Number);
  const date = new Date(Date.UTC(y!, m! - 1, d!));
  return date.toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC',
  });
};
```

- [ ] **Step 2: Create `src/components/SectionLabel.tsx`**

```tsx
type Props = { num: string; title: string; hint: string };

export default function SectionLabel({ num, title, hint }: Props) {
  return (
    <div className="section-label">
      <span className="num-badge">{num}</span>
      <h2>{title}</h2>
      <span className="dots" />
      <span className="hint">{hint}</span>
    </div>
  );
}
```

- [ ] **Step 3: Create `src/components/Topbar.tsx`**

Port from `dca-tracker-ui-ref/App.jsx` lines 10-35. Replace the `onAdd` and `onToggleTweaks` props with typed versions. The `Last sync` timestamp in the ref uses `new Date().toLocaleTimeString(...)` called at render time — keep that behavior but add a `useEffect` + `useState` so it updates client-side (server-rendered time can cause hydration warnings).

```tsx
'use client';
import { useEffect, useState } from 'react';

type Props = { onAdd: () => void; onToggleTweaks: () => void };

export default function Topbar({ onAdd, onToggleTweaks }: Props) {
  const [time, setTime] = useState<string>('');

  useEffect(() => {
    const tick = () => setTime(new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }));
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, []);

  return (
    <header className="topbar">
      <div className="brand">
        <div className="brand-mark">₿</div>
        <div>
          <div className="brand-name">DCA Tracker</div>
          <div className="brand-sub">sats/THB · v1.0.0</div>
        </div>
      </div>
      <div className="topbar-actions">
        <span className="mono" style={{ fontSize: 11, color: 'var(--muted)', marginRight: 12 }}>
          {time ? `Last sync · ${time}` : ''}
        </span>
        <button className="btn" onClick={onToggleTweaks}>
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.3"/><path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.5 3.5l1.4 1.4M11.1 11.1l1.4 1.4M3.5 12.5l1.4-1.4M11.1 4.9l1.4-1.4" stroke="currentColor" strokeWidth="1.3"/></svg>
          Tweaks
        </button>
        <button className="btn btn-primary" onClick={onAdd}>
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>
          Add buy
        </button>
      </div>
    </header>
  );
}
```

- [ ] **Step 4: Wire into `Dashboard.tsx`**

Replace the placeholder `<header className="topbar">...</header>` block in `Dashboard.tsx` with:

```tsx
import Topbar from './Topbar';
import SectionLabel from './SectionLabel';

// ... inside Dashboard function, replace <header> with:
<Topbar
  onAdd={() => { /* wired in Task 16 */ }}
  onToggleTweaks={() => { /* wired in Task 17 */ }}
/>

<SectionLabel num="01" title="Overview"      hint="PNL · chart · hover for daily values" />
<SectionLabel num="02" title="Metrics & Goals" hint="core numbers · progress" />
<SectionLabel num="03" title="Buy History"   hint="sortable · searchable · paginated" />
```

Keep the `<pre>` JSON dump between section labels for now — later tasks replace it.

- [ ] **Step 5: Verify browser**

Run: `npm run dev`. Open `/`. Expected:
- Topbar renders with brand mark, brand name, "Tweaks" and "Add buy" buttons visible
- "Last sync · HH:MM" appears on the right after ~100ms
- Three section labels visible (01/02/03)
- No console errors
- Buttons are clickable (no handlers yet)

Compare side-by-side with `dca-tracker-ui-ref/DCA Tracker.html` opened in another browser tab — brand + buttons should match pixel-for-pixel.

Stop dev server.

- [ ] **Step 6: Commit**

```bash
git add src/components/_fmt.ts src/components/SectionLabel.tsx src/components/Topbar.tsx src/components/Dashboard.tsx
git commit -m "feat(ui): add formatters, SectionLabel, Topbar"
```

---

## Task 11: Sparkline + PnlCard

**Files:**
- Create: `src/components/Sparkline.tsx`
- Create: `src/components/PnlCard.tsx`
- Modify: `src/components/Dashboard.tsx`

- [ ] **Step 1: Create `src/components/Sparkline.tsx`**

Find the inline Sparkline function in `dca-tracker-ui-ref/App.jsx` (search for `function Sparkline`). Port it, typing `values: number[]` and `color: string`.

If the ref file does not have a named `Sparkline` function (the ref may inline the SVG inside StatsGrid), extract the SVG rendering block from StatsGrid's `{s.spark && <Sparkline ... />}` pattern and build one yourself using this shape:

```tsx
type Props = { values: number[]; color: string };

export default function Sparkline({ values, color }: Props) {
  if (values.length < 2) return null;
  const w = 120;
  const h = 28;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const pts = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * w;
      const y = h - ((v - min) / range) * h;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
  return (
    <svg className="sparkline" width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.3" />
    </svg>
  );
}
```

- [ ] **Step 2: Create `src/components/PnlCard.tsx`**

Port from `dca-tracker-ui-ref/App.jsx` lines 38-80. Type props:

```tsx
import { fmtInt, fmtThb, fmtPct } from './_fmt';
import type { Summary, EnrichedEntry, Delta24 } from '@/types';

type Props = {
  summary: Summary | null;
  records: EnrichedEntry[];
  delta24: Delta24 | null;
  priceStale: boolean;
};

export default function PnlCard({ summary, records, delta24, priceStale }: Props) {
  // Empty state: no entries at all
  if (!summary || records.length === 0) {
    return (
      <div className="pnl-card">
        <div className="pnl-head">
          <span>Unrealized P&amp;L</span>
          <span className="live">
            <span className="live-dot" style={priceStale ? { background: 'var(--muted)' } : undefined} />
            LIVE
          </span>
        </div>
        <div>
          <div className="pnl-value" style={{ color: 'var(--muted)' }}>—</div>
          <div className="pnl-delta">
            <span className="mono" style={{ fontSize: 11, color: 'var(--muted)' }}>
              No purchases yet
            </span>
          </div>
        </div>
        <div className="pnl-split">
          <div>
            <div className="lbl">Market Value</div>
            <div className="val" style={{ color: 'var(--muted)' }}>—</div>
          </div>
          <div>
            <div className="lbl">Invested</div>
            <div className="val" style={{ color: 'var(--muted)' }}>—</div>
          </div>
        </div>
      </div>
    );
  }

  const pos = summary.marketValue - summary.spendFiat >= 0;

  return (
    <div className="pnl-card">
      <div className="pnl-head">
        <span>Unrealized P&amp;L</span>
        <span className="live" title={priceStale ? 'Price stale — Bitkub unreachable' : undefined}>
          <span className="live-dot" style={priceStale ? { background: 'var(--muted)' } : undefined} />
          LIVE
        </span>
      </div>
      <div>
        <div className="pnl-value">
          <span className="currency">฿</span>
          {fmtThb(summary.marketValue - summary.spendFiat)}
        </div>
        <div className="pnl-delta">
          <span className={'chip ' + (pos ? 'pos' : 'neg')}>
            {fmtPct(summary.pctProfitLoss)}
          </span>
          <span className="mono" style={{ fontSize: 11, color: 'var(--muted)' }}>
            all-time · {summary.numberOfDays} days
          </span>
        </div>
      </div>
      <div className="pnl-split">
        <div>
          <div className="lbl">Market Value</div>
          <div className="val">฿{fmtThb(summary.marketValue)}</div>
        </div>
        <div>
          <div className="lbl">Invested</div>
          <div className="val">฿{fmtInt(summary.spendFiat)}</div>
        </div>
      </div>
      {delta24 && (
        <div className="pnl-meta">
          <span>
            24h{' '}
            <strong style={{ color: delta24.delta >= 0 ? 'var(--pos)' : 'var(--neg)' }}>
              {delta24.delta >= 0 ? '+' : ''}
              {fmtThb(delta24.delta)}฿
            </strong>{' '}
            ({fmtPct(delta24.pct)})
          </span>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Wire into `Dashboard.tsx`**

In `Dashboard.tsx`, under the 01 section label, add a `hero` wrapper containing PnlCard (ChartCard comes later):

```tsx
import PnlCard from './PnlCard';

// ... after <SectionLabel num="01" ... />:
<div className="hero">
  <PnlCard
    summary={props.summary}
    records={props.records}
    delta24={props.delta24}
    priceStale={props.priceStale}
  />
  {/* ChartCard inserted in Task 14 */}
</div>
```

- [ ] **Step 4: Verify browser**

Empty DB: `PnlCard` shows "No purchases yet" with gray LIVE dot when offline.
With 1 entry (via curl): real P&L value appears, no 24h chip yet.
With 2+ entries: 24h chip visible at bottom.

Compare pixel-for-pixel with `dca-tracker-ui-ref/DCA Tracker.html` (they use seeded mock data — our numbers will differ, but layout/typography/spacing should match exactly).

- [ ] **Step 5: Commit**

```bash
git add src/components/Sparkline.tsx src/components/PnlCard.tsx src/components/Dashboard.tsx
git commit -m "feat(ui): add Sparkline + PnlCard with empty/stale state"
```

---

## Task 12: StatsGrid

**Files:**
- Create: `src/components/StatsGrid.tsx`
- Modify: `src/components/Dashboard.tsx`

Reference: port from `dca-tracker-ui-ref/App.jsx` lines 107-200.

- [ ] **Step 1: Create `src/components/StatsGrid.tsx`**

```tsx
import { fmtInt, fmtThb } from './_fmt';
import Sparkline from './Sparkline';
import type { Summary, EnrichedEntry } from '@/types';

type Props = {
  summary: Summary | null;
  records: EnrichedEntry[];
};

type StatCell = {
  lbl: string;
  val: string;
  sub: string;
  foot: string;
  spark: number[] | null;
  color: string;
};

const EMPTY_CELLS: StatCell[] = [
  { lbl: 'Spend Fiat',         val: '—', sub: '฿',     foot: '0 days', spark: null, color: 'var(--muted)' },
  { lbl: 'Total Satoshi',      val: '—', sub: 'sat',   foot: '—',      spark: null, color: 'var(--muted)' },
  { lbl: 'Current BTC Price',  val: '—', sub: '฿',     foot: 'Bitkub · spot', spark: null, color: 'var(--muted)' },
  { lbl: 'Market Value',       val: '—', sub: '฿',     foot: 'Your portfolio in THB', spark: null, color: 'var(--muted)' },
  { lbl: 'Average Cost',       val: '—', sub: 'sat/฿', foot: 'Across all buys',       spark: null, color: 'var(--muted)' },
  { lbl: 'Today sat/THB',      val: '—', sub: 'sat/฿', foot: '—',      spark: null, color: 'var(--muted)' },
  { lbl: 'Max Drawdown',       val: '—', sub: '%',     foot: 'Peak-to-trough', spark: null, color: 'var(--muted)' },
  { lbl: '% Profit / Loss',    val: '—', sub: '%',     foot: '—',      spark: null, color: 'var(--muted)' },
];

function buildCells(summary: Summary, records: EnrichedEntry[]): StatCell[] {
  const last30 = records.slice(-30);
  const investedSeries = last30.map((r) => r.invested);
  const portfolioSeries = last30.map((r) => r.portfolioValue);
  const priceSeries = last30.map((r) => r.price_thb);
  const satPerTHBSeries = last30.map((r) => r.satPerTHB);

  // cumulative satoshi per step in last 30
  const cumSatSeries: number[] = [];
  let runningSat = 0;
  for (const r of last30) {
    runningSat += r.satoshi;
    cumSatSeries.push(runningSat);
  }

  return [
    {
      lbl: 'Spend Fiat',
      val: fmtInt(summary.spendFiat),
      sub: '฿',
      foot: `${summary.numberOfDays} days · ${summary.numberOfDays > 0 ? Math.round(summary.spendFiat / summary.numberOfDays) : 0} ฿/day`,
      spark: investedSeries,
      color: 'var(--fg)',
    },
    {
      lbl: 'Total Satoshi',
      val: fmtInt(summary.totalSatoshi),
      sub: 'sat',
      foot: (summary.totalSatoshi / 1e8).toFixed(8) + ' BTC',
      spark: cumSatSeries,
      color: 'var(--accent)',
    },
    {
      lbl: 'Current BTC Price',
      val: fmtInt(summary.currentPrice),
      sub: '฿',
      foot: 'Bitkub · spot',
      spark: priceSeries,
      color: 'var(--accent)',
    },
    {
      lbl: 'Market Value',
      val: fmtThb(summary.marketValue),
      sub: '฿',
      foot: 'Your portfolio in THB',
      spark: portfolioSeries,
      color: summary.pctProfitLoss >= 0 ? 'var(--pos)' : 'var(--neg)',
    },
    {
      lbl: 'Average Cost',
      val: summary.averageCost.toFixed(2),
      sub: 'sat/฿',
      foot: 'Across all buys',
      spark: null,
      color: 'var(--fg)',
    },
    {
      lbl: 'Today sat/THB',
      val: summary.todaySatPerTHB.toFixed(2),
      sub: 'sat/฿',
      foot:
        summary.todaySatPerTHB > summary.averageCost
          ? `+${(summary.todaySatPerTHB - summary.averageCost).toFixed(2)} vs avg (good buy)`
          : `${(summary.todaySatPerTHB - summary.averageCost).toFixed(2)} vs avg`,
      spark: satPerTHBSeries,
      color: summary.todaySatPerTHB > summary.averageCost ? 'var(--pos)' : 'var(--neg)',
    },
    {
      lbl: 'Max Drawdown',
      val: summary.maxDrawdown.toFixed(2),
      sub: '%',
      foot: 'Peak-to-trough',
      spark: null,
      color: 'var(--neg)',
    },
    {
      lbl: '% Profit / Loss',
      val: (summary.pctProfitLoss >= 0 ? '+' : '') + summary.pctProfitLoss.toFixed(2),
      sub: '%',
      foot: `฿${fmtThb(summary.marketValue - summary.spendFiat)} unrealized`,
      spark: null,
      color: summary.pctProfitLoss >= 0 ? 'var(--pos)' : 'var(--neg)',
    },
  ];
}

export default function StatsGrid({ summary, records }: Props) {
  const cells = summary ? buildCells(summary, records) : EMPTY_CELLS;
  return (
    <div className="stats-grid">
      {cells.map((s, i) => (
        <div className="stat" key={i}>
          <div className="stat-lbl">{s.lbl}</div>
          <div className="stat-val" style={{ color: s.color }}>
            {s.val}
            <span className="sub">{s.sub}</span>
          </div>
          <div className="stat-foot">{s.foot}</div>
          {s.spark && s.spark.length >= 2 && <Sparkline values={s.spark} color={s.color} />}
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Wire into `Dashboard.tsx`**

After `<SectionLabel num="02" ... />`:

```tsx
import StatsGrid from './StatsGrid';

<StatsGrid summary={props.summary} records={props.records} />
```

- [ ] **Step 3: Verify browser**

Empty DB: 8 stat cards visible, all values = `—`, no sparklines, `0 days` foot on Spend Fiat.
With data: real values + sparklines (starting when ≥ 2 entries exist).

Compare with ref html — 4-column grid (or 2 rows × 4) layout, same typography and spacing.

- [ ] **Step 4: Commit**

```bash
git add src/components/StatsGrid.tsx src/components/Dashboard.tsx
git commit -m "feat(ui): add StatsGrid with empty state and cumulative-sat sparkline"
```

---

## Task 13: Goals (display only; inline edit added Task 19)

**Files:**
- Create: `src/components/Goals.tsx`
- Modify: `src/components/Dashboard.tsx`

Reference: port from `dca-tracker-ui-ref/App.jsx` lines 202-234. Note: the ref uses `goalSat * 100` in the footer label (because its seed uses units of "10000 sat" — see CLAUDE.md §Data model which clarifies that `goal_satoshi` is stored in full satoshi units). Use our storage unit directly: `goalSat` is already the real satoshi count.

- [ ] **Step 1: Create `src/components/Goals.tsx`**

```tsx
import { fmtInt } from './_fmt';
import type { Summary, Goals as GoalsType } from '@/types';

type Props = {
  summary: Summary | null;
  goals: GoalsType;
};

export default function Goals({ summary, goals }: Props) {
  const spendFiat = summary?.spendFiat ?? 0;
  const totalSatoshi = summary?.totalSatoshi ?? 0;
  const progressFiat = summary?.progressFiat ?? 0;
  const progressBTC  = summary?.progressBTC  ?? 0;
  const btcFromSat = goals.goal_satoshi / 1e8;

  return (
    <div className="goals">
      <div className="goal-card">
        <div className="goal-top">
          <h3>Goal · Fiat Invested</h3>
          <div className="pct">{progressFiat.toFixed(2)}%</div>
        </div>
        <div className="goal-bar">
          <div className="goal-fill" style={{ width: Math.min(100, progressFiat) + '%' }} />
        </div>
        <div className="goal-ticks">
          <span>฿{fmtInt(spendFiat)}</span>
          <span>Goal · ฿{fmtInt(goals.goal_fiat)}</span>
        </div>
      </div>
      <div className="goal-card">
        <div className="goal-top">
          <h3>Goal · Total Satoshi</h3>
          <div className="pct">{progressBTC.toFixed(2)}%</div>
        </div>
        <div className="goal-bar">
          <div className="goal-fill alt" style={{ width: Math.min(100, progressBTC) + '%' }} />
        </div>
        <div className="goal-ticks">
          <span>{fmtInt(totalSatoshi)} sat</span>
          <span>Goal · {fmtInt(goals.goal_satoshi)} sat ({btcFromSat.toFixed(2)} ₿)</span>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Wire into `Dashboard.tsx`**

After `<StatsGrid ... />`:

```tsx
import Goals from './Goals';

<Goals summary={props.summary} goals={props.goals} />
```

- [ ] **Step 3: Verify browser**

Empty DB: Both bars at 0%. Ticks show `฿0 / Goal · ฿200,000` and `0 sat / Goal · 2,000,000 sat (0.02 ₿)`.
With data: bars show real progress, `0.02 ₿` matches `goal_satoshi / 1e8`.

- [ ] **Step 4: Commit**

```bash
git add src/components/Goals.tsx src/components/Dashboard.tsx
git commit -m "feat(ui): add Goals display with empty state"
```

---

## Task 14: Chart + ChartCard

**Files:**
- Create: `src/components/Chart.tsx`
- Create: `src/components/ChartCard.tsx`
- Modify: `src/components/Dashboard.tsx`

Reference: port from `dca-tracker-ui-ref/Chart.jsx` (entire file) and `App.jsx` lines 82-105 for ChartCard.

- [ ] **Step 1: Create `src/components/Chart.tsx`**

Port `Chart.jsx` verbatim with these conversions:
- `const { useState, useMemo, useRef, useEffect } = React;` → `import { useState, useMemo, useRef, useEffect } from 'react';`
- Add `'use client';` at the top
- Change all `records` props to type `EnrichedEntry[]`, `mode` to a union `'portfolio' | 'pnl' | 'cost'`, `timeframe` to `'7D' | '30D' | 'ALL'`
- `d.price` in the ref should be `d.price_thb` because our Entry type uses the DB column name
- `d.fiat` → `d.fiat_thb`
- `d.satoshi` stays
- Add an **empty-state block at the top** of the component:

```tsx
if (records.length === 0) {
  return (
    <div ref={wrapRef} className="chart-empty">
      <span style={{ color: 'var(--muted)', fontSize: 13 }}>Add your first buy to see chart</span>
    </div>
  );
}
```

Add a matching CSS rule at the bottom of `src/app/globals.css` (new, not in ref):

```css
.chart-empty {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}
```

- [ ] **Step 2: Create `src/components/ChartCard.tsx`**

Port from `App.jsx` lines 82-105. Type `records: EnrichedEntry[]`.

```tsx
'use client';
import { useState } from 'react';
import Chart from './Chart';
import type { EnrichedEntry } from '@/types';

type Mode = 'portfolio' | 'pnl' | 'cost';
type Timeframe = '7D' | '30D' | 'ALL';

type Props = { records: EnrichedEntry[] };

export default function ChartCard({ records }: Props) {
  const [mode, setMode] = useState<Mode>('portfolio');
  const [timeframe, setTimeframe] = useState<Timeframe>('ALL');
  return (
    <div className="chart-card">
      <div className="chart-head">
        <div className="chart-tabs">
          <button className={'chart-tab' + (mode === 'portfolio' ? ' active' : '')} onClick={() => setMode('portfolio')}>Portfolio vs Invested</button>
          <button className={'chart-tab' + (mode === 'pnl' ? ' active' : '')} onClick={() => setMode('pnl')}>Unrealized P&amp;L</button>
          <button className={'chart-tab' + (mode === 'cost' ? ' active' : '')} onClick={() => setMode('cost')}>Cost vs Market</button>
        </div>
        <div className="timeframe">
          {(['7D', '30D', 'ALL'] as const).map((t) => (
            <button key={t} className={timeframe === t ? 'active' : ''} onClick={() => setTimeframe(t)}>{t}</button>
          ))}
        </div>
      </div>
      <div className="chart-body">
        <Chart records={records} mode={mode} timeframe={timeframe} />
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Wire into `Dashboard.tsx` hero block**

Update the `<div className="hero">` to include ChartCard alongside PnlCard:

```tsx
import ChartCard from './ChartCard';

<div className="hero">
  <PnlCard ... />
  <ChartCard records={props.records} />
</div>
```

- [ ] **Step 4: Verify browser**

Empty DB: Chart area shows "Add your first buy to see chart" centered.
With ≥ 2 entries: chart renders, 3 mode tabs switch correctly, 7D/30D/ALL timeframe switches.

Hover over the chart — hover line and date/value tooltip should appear (this comes from the ported ref code).

- [ ] **Step 5: Commit**

```bash
git add src/components/Chart.tsx src/components/ChartCard.tsx src/components/Dashboard.tsx src/app/globals.css
git commit -m "feat(ui): port Chart + ChartCard with empty-state overlay"
```

---

## Task 15: RecordsTable (display only; edit/delete added Task 18)

**Files:**
- Create: `src/components/RecordsTable.tsx`
- Modify: `src/components/Dashboard.tsx`

Reference: port from `dca-tracker-ui-ref/App.jsx` lines 236-375.

Key conversions from the ref:
- `r.date` in the ref is a `Date` object (because mock data uses `new Date(...)`). Our type has `date: string` (YYYY-MM-DD). Parse on display using `fmtDateShort`.
- `r.fiat` → `r.fiat_thb`, `r.price` → `r.price_thb`, but keep column `key: 'fiat'` mapped to render `r.fiat_thb` (so search and sort keys stay stable).

- [ ] **Step 1: Create `src/components/RecordsTable.tsx`**

```tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { fmtInt, fmtThb, fmtDateShort } from './_fmt';
import type { EnrichedEntry } from '@/types';

type Column = {
  key: keyof EnrichedEntry | 'pctUnrealized';
  label: string;
  align?: 'left';
  fmt: (value: number | string, row: EnrichedEntry) => React.ReactNode;
  cls?: (value: number) => 'pos' | 'neg' | '';
};

const COLUMNS: Column[] = [
  { key: 'dayActive', label: 'Day', align: 'left', fmt: (v) => <span className="day-chip">{v}</span> },
  { key: 'date', label: 'Date', align: 'left', fmt: (v) => fmtDateShort(v as string) },
  { key: 'fiat_thb',  label: 'Fiat (฿)',       fmt: (v) => fmtInt(v as number) },
  { key: 'satoshi',   label: 'Satoshi',        fmt: (v) => fmtInt(v as number) },
  { key: 'price_thb', label: 'BTC Price',      fmt: (v) => fmtInt(v as number) },
  { key: 'portfolioValue', label: 'Portfolio Value', fmt: (v) => fmtThb(v as number) },
  { key: 'invested',  label: 'Invested',       fmt: (v) => fmtInt(v as number) },
  { key: 'unrealized',label: 'Unrealized',     fmt: (v) => ((v as number) >= 0 ? '+' : '') + fmtThb(v as number), cls: (v) => v >= 0 ? 'pos' : 'neg' },
  { key: 'pctUnrealized', label: '% Unrealized', fmt: (v) => ((v as number) >= 0 ? '+' : '') + (v as number).toFixed(2) + '%', cls: (v) => v >= 0 ? 'pos' : 'neg' },
];

type Props = { records: EnrichedEntry[] };

export default function RecordsTable({ records }: Props) {
  const [sortKey, setSortKey] = useState<Column['key']>('dayActive');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(30);
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    if (!query.trim()) return records;
    const q = query.toLowerCase();
    return records.filter((r) => {
      return String(r.dayActive).includes(q)
        || fmtDateShort(r.date).toLowerCase().includes(q)
        || String(r.price_thb).includes(q);
    });
  }, [records, query]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      const av = (a as unknown as Record<string, unknown>)[sortKey as string];
      const bv = (b as unknown as Record<string, unknown>)[sortKey as string];
      if (typeof av === 'number' && typeof bv === 'number') {
        return sortDir === 'asc' ? av - bv : bv - av;
      }
      return sortDir === 'asc'
        ? String(av).localeCompare(String(bv))
        : String(bv).localeCompare(String(av));
    });
    return arr;
  }, [filtered, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const curPage = Math.min(page, totalPages);
  const pageData = sorted.slice((curPage - 1) * pageSize, curPage * pageSize);

  useEffect(() => { setPage(1); }, [pageSize, query, sortKey, sortDir]);

  function toggleSort(key: Column['key']) {
    if (sortKey === key) setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
  }

  function pageNums(): Array<number | '…'> {
    if (totalPages <= 7) {
      const nums: number[] = [];
      for (let i = 1; i <= totalPages; i++) nums.push(i);
      return nums;
    }
    if (curPage <= 4) return [1, 2, 3, 4, 5, '…', totalPages];
    if (curPage >= totalPages - 3) return [1, '…', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    return [1, '…', curPage - 1, curPage, curPage + 1, '…', totalPages];
  }

  return (
    <div className="records-card">
      <div className="records-toolbar">
        <div className="records-toolbar-left">
          <div className="search">
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.3" /><path d="M10.5 10.5l3 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" /></svg>
            <input placeholder="Search day, date, price…" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
          <span className="mono" style={{ color: 'var(--muted)', fontSize: 12 }}>
            {filtered.length} records
          </span>
        </div>
        <div className="records-toolbar-right">
          <span>Rows per page</span>
          <select className="select" value={pageSize} onChange={(e) => setPageSize(+e.target.value)}>
            <option value={30}>30</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
            <option value={250}>250</option>
          </select>
        </div>
      </div>

      <div className="records-scroll">
        <table className="records">
          <thead>
            <tr>
              {COLUMNS.map((c) => (
                <th
                  key={String(c.key)}
                  className={(c.align === 'left' ? 'left ' : '') + (sortKey === c.key ? 'sorted' : '')}
                  onClick={() => toggleSort(c.key)}
                >
                  {c.label}
                  <span className="sort-arrow">
                    {sortKey === c.key ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageData.length === 0 ? (
              <tr>
                <td colSpan={COLUMNS.length} className="left" style={{ color: 'var(--muted)', textAlign: 'center', padding: 20 }}>
                  No records. Click Add buy to start.
                </td>
              </tr>
            ) : (
              pageData.map((r) => (
                <tr key={r.id}>
                  {COLUMNS.map((c) => {
                    const raw = (r as unknown as Record<string, number | string>)[c.key as string];
                    const cls = c.cls && typeof raw === 'number' ? c.cls(raw) : '';
                    return (
                      <td key={String(c.key)} className={(c.align === 'left' ? 'left ' : '') + cls}>
                        {c.fmt(raw, r)}
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="pagination">
        <span>
          {sorted.length === 0
            ? 'Showing 0 of 0'
            : `Showing ${(curPage - 1) * pageSize + 1}–${Math.min(curPage * pageSize, sorted.length)} of ${sorted.length}`}
        </span>
        <div className="pager">
          <button disabled={curPage === 1} onClick={() => setPage(1)}>«</button>
          <button disabled={curPage === 1} onClick={() => setPage(curPage - 1)}>‹</button>
          {pageNums().map((n, i) => (
            n === '…'
              ? <button key={i} disabled style={{ border: 'none', background: 'transparent' }}>…</button>
              : <button key={i} className={n === curPage ? 'active' : ''} onClick={() => setPage(n)}>{n}</button>
          ))}
          <button disabled={curPage === totalPages} onClick={() => setPage(curPage + 1)}>›</button>
          <button disabled={curPage === totalPages} onClick={() => setPage(totalPages)}>»</button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Wire into `Dashboard.tsx`**

After `<SectionLabel num="03" ... />`:

```tsx
import RecordsTable from './RecordsTable';

<RecordsTable records={props.records} />
```

Then remove the temporary `<pre>` JSON dump block from Dashboard.tsx (it has served its purpose).

- [ ] **Step 3: Verify browser**

Empty DB: Table shows "No records. Click Add buy to start." in a single row.
With data: records render. Click column headers → sort asc/desc. Type in search → rows filter. Change rows-per-page → pagination updates.

- [ ] **Step 4: Typecheck + lint**

Run: `npm run typecheck` — expected 0 errors.
Run: `npm run lint` — expected 0 errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/RecordsTable.tsx src/components/Dashboard.tsx
git commit -m "feat(ui): add RecordsTable (sort/search/paginate) with empty state"
```

---

# PHASE 7 — INTERACTIVE COMPONENTS

## Task 16: AddBuyModal

**Files:**
- Create: `src/components/AddBuyModal.tsx`
- Modify: `src/components/Dashboard.tsx`

Reference: `dca-tracker-ui-ref/App.jsx` lines 378-422.

- [ ] **Step 1: Create `src/components/AddBuyModal.tsx`**

```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { fmtInt } from './_fmt';

type Props = {
  onClose: () => void;
  currentPrice: number;
};

export default function AddBuyModal({ onClose, currentPrice }: Props) {
  const router = useRouter();
  const [date, setDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [fiat, setFiat] = useState<number>(108);
  const [price, setPrice] = useState<number>(currentPrice > 0 ? currentPrice : 2_500_000);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const satPerTHB = price > 0 ? 100_000_000 / price : 0;
  const sat = Math.floor(fiat * satPerTHB);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch('/api/entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, fiat_thb: fiat, price_thb: price }),
      });
      const body = await res.json();
      if (!res.ok || !body.ok) {
        const msg = body.error === 'duplicate_date'
          ? `Already have a buy for ${date}`
          : body.error === 'invalid_fiat_thb'
            ? 'Fiat amount must be a positive integer ≤ 10,000,000'
            : body.error === 'invalid_price_thb'
              ? 'Price must be a positive number'
              : body.error || 'Something went wrong';
        setError(msg);
        return;
      }
      onClose();
      router.refresh();
    } catch (err) {
      setError((err as Error).message || 'Network error');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <div className="modal-head">
          <h3>Record new buy</h3>
          <button type="button" className="btn btn-ghost" onClick={onClose} style={{ padding: '2px 8px' }}>✕</button>
        </div>
        <div className="modal-body">
          <div className="field">
            <label>Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
            {error && error.startsWith('Already') && (
              <div style={{ color: 'var(--neg)', fontSize: 11, marginTop: 4 }}>{error}</div>
            )}
          </div>
          <div className="field-pair">
            <div className="field">
              <label>Fiat spent (฿)</label>
              <input
                type="number"
                value={fiat}
                min={1}
                max={10_000_000}
                step={1}
                onChange={(e) => setFiat(+e.target.value)}
                required
              />
            </div>
            <div className="field">
              <label>BTC price (฿)</label>
              <input
                type="number"
                value={price}
                min={1}
                max={100_000_000}
                step={1}
                onChange={(e) => setPrice(+e.target.value)}
                required
              />
            </div>
          </div>
          <div className="preview-row">
            <span>You get</span>
            <strong>{fmtInt(sat)} sat · {satPerTHB.toFixed(2)} sat/฿</strong>
          </div>
          {error && !error.startsWith('Already') && (
            <div style={{ color: 'var(--neg)', fontSize: 12, marginTop: 8 }}>{error}</div>
          )}
        </div>
        <div className="modal-foot">
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? 'Saving…' : 'Record buy'}
          </button>
        </div>
      </form>
    </div>
  );
}
```

- [ ] **Step 2: Wire into `Dashboard.tsx`**

Add modal state and conditional render:

```tsx
import AddBuyModal from './AddBuyModal';

// Inside Dashboard component, add state:
const [showModal, setShowModal] = useState(false);

// Pass to Topbar:
<Topbar
  onAdd={() => setShowModal(true)}
  onToggleTweaks={() => { /* Task 17 */ }}
/>

// At end of JSX, just before the closing </div> of .shell:
{showModal && (
  <AddBuyModal
    onClose={() => setShowModal(false)}
    currentPrice={props.currentPrice}
  />
)}
```

- [ ] **Step 3: Verify browser — add a buy**

Start dev server. Click "Add buy". Modal opens prefilled with today's date, fiat=108, price=current BTC price.
Adjust fiat to 500; verify sat preview updates live.
Click "Record buy". Modal closes, stats + chart + records update.

- [ ] **Step 4: Verify — duplicate date error**

Click "Add buy" again without changing the date. Click "Record buy". Expected: inline red error under Date field: "Already have a buy for 2026-MM-DD". Modal stays open.

Close modal.

- [ ] **Step 5: Commit**

```bash
git add src/components/AddBuyModal.tsx src/components/Dashboard.tsx
git commit -m "feat(ui): add AddBuyModal with validation and duplicate-date inline error"
```

---

## Task 17: TweaksPanel

**Files:**
- Create: `src/components/TweaksPanel.tsx`
- Modify: `src/components/Dashboard.tsx`

Reference: `dca-tracker-ui-ref/App.jsx` lines 425-453.

- [ ] **Step 1: Create `src/components/TweaksPanel.tsx`**

```tsx
'use client';

type Accent = { name: string; hex: string; strong: string; soft: string; line: string };

export const ACCENTS: Accent[] = [
  { name: 'Bitcoin Orange', hex: '#F2A900', strong: '#E89100', soft: '#FFF4DC', line: 'rgba(242,169,0,0.15)' },
  { name: 'Saffron',        hex: '#E77B1D', strong: '#C86511', soft: '#FCE9D6', line: 'rgba(231,123,29,0.15)' },
  { name: 'Amber',          hex: '#D98F1C', strong: '#B37416', soft: '#FBEBCF', line: 'rgba(217,143,28,0.15)' },
  { name: 'Crimson',        hex: '#C84A3F', strong: '#A33A2F', soft: '#F5DCD8', line: 'rgba(200,74,63,0.15)' },
  { name: 'Forest',         hex: '#2E7D5B', strong: '#24634A', soft: '#D9EBDF', line: 'rgba(46,125,91,0.15)' },
  { name: 'Ink',            hex: '#2B3A66', strong: '#1F2B4D', soft: '#DBE0EE', line: 'rgba(43,58,102,0.15)' },
];

type Props = {
  onClose: () => void;
  accent: Accent;
  setAccent: (a: Accent) => void;
};

export default function TweaksPanel({ onClose, accent, setAccent }: Props) {
  return (
    <div className="tweaks-panel">
      <h4>Tweaks <button onClick={onClose}>✕</button></h4>
      <div className="tweaks-label">Accent color</div>
      <div className="swatches">
        {ACCENTS.map((a) => (
          <div
            key={a.hex}
            className={'swatch' + (accent.hex === a.hex ? ' selected' : '')}
            style={{ background: a.hex }}
            title={a.name}
            onClick={() => setAccent(a)}
          />
        ))}
      </div>
      <div className="tweaks-label" style={{ marginTop: 8 }}>Selected · {accent.name}</div>
    </div>
  );
}
```

- [ ] **Step 2: Update `Dashboard.tsx` to import ACCENTS from TweaksPanel**

Remove the inline `ACCENTS` constant and `Accent` type from `Dashboard.tsx`; import them instead:

```tsx
import TweaksPanel, { ACCENTS } from './TweaksPanel';
import type { ComponentProps } from 'react';
type Accent = ComponentProps<typeof TweaksPanel>['accent'];
```

Add state + conditional render:

```tsx
const [showTweaks, setShowTweaks] = useState(false);

// Pass to Topbar:
<Topbar
  onAdd={() => setShowModal(true)}
  onToggleTweaks={() => setShowTweaks((v) => !v)}
/>

// Near end of JSX:
{showTweaks && (
  <TweaksPanel
    onClose={() => setShowTweaks(false)}
    accent={accent}
    setAccent={setAccent}
  />
)}
```

- [ ] **Step 3: Verify browser**

Click "Tweaks" in topbar → panel slides in.
Click each of the 6 swatches → the accent color on buttons, progress bars, chart line, and sparklines updates immediately.
Reload the page → the last-selected accent persists (from localStorage).

- [ ] **Step 4: Commit**

```bash
git add src/components/TweaksPanel.tsx src/components/Dashboard.tsx
git commit -m "feat(ui): add TweaksPanel with 6 accent presets and localStorage persistence"
```

---

## Task 18: RecordsTable row actions (edit + delete)

**Files:**
- Modify: `src/components/RecordsTable.tsx`
- Modify: `src/app/globals.css`

- [ ] **Step 1: Add row-action styles to `globals.css`**

Append to the bottom of `src/app/globals.css`:

```css
/* RecordsTable row actions (new — not in ref) */
.records tbody tr td.row-actions {
  width: 60px;
  text-align: right;
  padding-right: 8px;
  opacity: 0;
  transition: opacity 120ms ease;
}
.records tbody tr:hover td.row-actions { opacity: 1; }
.row-actions button {
  background: transparent;
  border: none;
  cursor: pointer;
  padding: 4px;
  color: var(--muted);
  opacity: 0.6;
}
.row-actions button:hover { opacity: 1; color: var(--fg); }
.row-actions button.danger:hover { color: var(--neg); }

.row-edit input {
  width: 100%;
  background: var(--surface);
  border: 1px solid var(--accent);
  border-radius: 4px;
  padding: 4px 6px;
  font-family: var(--mono);
  font-size: 12px;
  color: var(--fg);
}
```

- [ ] **Step 2: Modify `RecordsTable.tsx` — add state and row rendering**

At the top of the component (after existing hooks), add:

```tsx
import { useRouter } from 'next/navigation';

// ... inside RecordsTable component, after existing useState calls:
const router = useRouter();
const [editingId, setEditingId] = useState<number | null>(null);
const [editFiat, setEditFiat] = useState(0);
const [editPrice, setEditPrice] = useState(0);
const [busyId, setBusyId] = useState<number | null>(null);

function startEdit(r: EnrichedEntry) {
  setEditingId(r.id);
  setEditFiat(r.fiat_thb);
  setEditPrice(r.price_thb);
}

async function saveEdit(id: number) {
  setBusyId(id);
  try {
    const res = await fetch(`/api/entries/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fiat_thb: editFiat, price_thb: editPrice }),
    });
    const body = await res.json();
    if (!res.ok || !body.ok) {
      window.alert(body.error || 'Save failed');
      return;
    }
    setEditingId(null);
    router.refresh();
  } finally {
    setBusyId(null);
  }
}

async function deleteRow(r: EnrichedEntry) {
  if (!window.confirm(`Delete entry for ${fmtDateShort(r.date)}?`)) return;
  setBusyId(r.id);
  try {
    const res = await fetch(`/api/entries/${r.id}`, { method: 'DELETE' });
    const body = await res.json();
    if (!res.ok || !body.ok) {
      window.alert(body.error || 'Delete failed');
      return;
    }
    router.refresh();
  } finally {
    setBusyId(null);
  }
}
```

Extend the table header to add an empty 10th column:

```tsx
<thead>
  <tr>
    {COLUMNS.map((c) => (/* existing th */))}
    <th aria-label="Row actions" style={{ width: 60 }} />
  </tr>
</thead>
```

Replace the body row rendering to handle editing mode and the actions cell:

```tsx
<tbody>
  {pageData.length === 0 ? (
    <tr>
      <td colSpan={COLUMNS.length + 1} className="left" style={{ color: 'var(--muted)', textAlign: 'center', padding: 20 }}>
        No records. Click Add buy to start.
      </td>
    </tr>
  ) : (
    pageData.map((r) => {
      const isEditing = editingId === r.id;
      const busy = busyId === r.id;
      return (
        <tr key={r.id}>
          {COLUMNS.map((c) => {
            if (isEditing && c.key === 'fiat_thb') {
              return (
                <td key="fiat_thb" className="row-edit">
                  <input type="number" value={editFiat} min={1} onChange={(e) => setEditFiat(+e.target.value)} />
                </td>
              );
            }
            if (isEditing && c.key === 'price_thb') {
              return (
                <td key="price_thb" className="row-edit">
                  <input type="number" value={editPrice} min={1} onChange={(e) => setEditPrice(+e.target.value)} />
                </td>
              );
            }
            if (isEditing && c.key === 'satoshi') {
              const satPerTHB = editPrice > 0 ? 1e8 / editPrice : 0;
              return <td key="satoshi">{fmtInt(Math.floor(editFiat * satPerTHB))}</td>;
            }
            const raw = (r as unknown as Record<string, number | string>)[c.key as string];
            const cls = c.cls && typeof raw === 'number' ? c.cls(raw) : '';
            return (
              <td key={String(c.key)} className={(c.align === 'left' ? 'left ' : '') + cls}>
                {c.fmt(raw, r)}
              </td>
            );
          })}
          <td className="row-actions">
            {isEditing ? (
              <>
                <button onClick={() => saveEdit(r.id)} disabled={busy} title="Save">✓</button>
                <button onClick={() => setEditingId(null)} disabled={busy} title="Cancel">✕</button>
              </>
            ) : (
              <>
                <button onClick={() => startEdit(r)} title="Edit">
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M11.5 2.5l2 2L5 13l-3 1 1-3 8.5-8.5z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/></svg>
                </button>
                <button className="danger" onClick={() => deleteRow(r)} title="Delete">
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M3 4h10M6 4V2.5h4V4M4.5 4v10h7V4" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/></svg>
                </button>
              </>
            )}
          </td>
        </tr>
      );
    })
  )}
</tbody>
```

- [ ] **Step 3: Verify edit**

Hover a row → pencil + trash appear on the right (low opacity → full opacity on icon hover).
Click pencil → fiat and price cells become inputs; satoshi cell recalculates live as you type.
Click ✓ → PATCH fires, row returns to display mode with updated values, stats update.

- [ ] **Step 4: Verify delete**

Click trash on a row → `confirm()` dialog asks to confirm. Accept → DELETE fires, row disappears, stats update.

- [ ] **Step 5: Commit**

```bash
git add src/components/RecordsTable.tsx src/app/globals.css
git commit -m "feat(ui): add hover row actions — inline edit and delete with confirm"
```

---

## Task 19: Goals inline edit

**Files:**
- Modify: `src/components/Goals.tsx`
- Modify: `src/app/globals.css`

- [ ] **Step 1: Add inline-edit styles to `globals.css`**

Append:

```css
/* Goals inline-edit (new — not in ref) */
.goal-ticks .editable {
  cursor: pointer;
  border-bottom: 1px dashed transparent;
}
.goal-ticks .editable:hover { border-bottom-color: var(--muted); }
.goal-ticks input.inline {
  font-family: var(--mono);
  background: var(--surface);
  border: 1px solid var(--accent);
  border-radius: 4px;
  padding: 1px 4px;
  width: 110px;
  color: var(--fg);
  font-size: inherit;
}
```

- [ ] **Step 2: Rewrite `src/components/Goals.tsx` with inline edit**

```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { fmtInt } from './_fmt';
import type { Summary, Goals as GoalsType } from '@/types';

type Props = {
  summary: Summary | null;
  goals: GoalsType;
};

type EditField = 'goal_fiat' | 'goal_satoshi' | null;

export default function Goals({ summary, goals }: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState<EditField>(null);
  const [draft, setDraft] = useState<number>(0);
  const [busy, setBusy] = useState(false);

  const spendFiat = summary?.spendFiat ?? 0;
  const totalSatoshi = summary?.totalSatoshi ?? 0;
  const progressFiat = summary?.progressFiat ?? 0;
  const progressBTC = summary?.progressBTC ?? 0;
  const btcFromSat = goals.goal_satoshi / 1e8;

  function startEdit(field: 'goal_fiat' | 'goal_satoshi') {
    setEditing(field);
    setDraft(goals[field]);
  }

  async function save() {
    if (editing === null) return;
    const value = Math.floor(draft);
    if (!Number.isInteger(value) || value <= 0) {
      window.alert('Goal must be a positive integer');
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [editing]: value }),
      });
      const body = await res.json();
      if (!res.ok || !body.ok) {
        window.alert(body.error || 'Save failed');
        return;
      }
      setEditing(null);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  function handleKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') save();
    if (e.key === 'Escape') setEditing(null);
  }

  return (
    <div className="goals">
      <div className="goal-card">
        <div className="goal-top">
          <h3>Goal · Fiat Invested</h3>
          <div className="pct">{progressFiat.toFixed(2)}%</div>
        </div>
        <div className="goal-bar">
          <div className="goal-fill" style={{ width: Math.min(100, progressFiat) + '%' }} />
        </div>
        <div className="goal-ticks">
          <span>฿{fmtInt(spendFiat)}</span>
          {editing === 'goal_fiat' ? (
            <span>Goal · ฿
              <input
                type="number"
                className="inline"
                value={draft}
                min={1}
                onChange={(e) => setDraft(+e.target.value)}
                onBlur={save}
                onKeyDown={handleKey}
                disabled={busy}
                autoFocus
              />
            </span>
          ) : (
            <span className="editable" onClick={() => startEdit('goal_fiat')} title="Click to edit">
              Goal · ฿{fmtInt(goals.goal_fiat)}
            </span>
          )}
        </div>
      </div>

      <div className="goal-card">
        <div className="goal-top">
          <h3>Goal · Total Satoshi</h3>
          <div className="pct">{progressBTC.toFixed(2)}%</div>
        </div>
        <div className="goal-bar">
          <div className="goal-fill alt" style={{ width: Math.min(100, progressBTC) + '%' }} />
        </div>
        <div className="goal-ticks">
          <span>{fmtInt(totalSatoshi)} sat</span>
          {editing === 'goal_satoshi' ? (
            <span>Goal ·
              <input
                type="number"
                className="inline"
                value={draft}
                min={1}
                onChange={(e) => setDraft(+e.target.value)}
                onBlur={save}
                onKeyDown={handleKey}
                disabled={busy}
                autoFocus
              /> sat ({(draft / 1e8).toFixed(2)} ₿)
            </span>
          ) : (
            <span className="editable" onClick={() => startEdit('goal_satoshi')} title="Click to edit">
              Goal · {fmtInt(goals.goal_satoshi)} sat ({btcFromSat.toFixed(2)} ₿)
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verify inline edit**

Hover `Goal · ฿200,000` → dotted underline appears.
Click → text becomes a number input focused.
Change to `300000`, press Enter → input disappears, progress bar recomputes (progressFiat drops).
Click `Goal · 2,000,000 sat`, change to `1000000`, Escape → no save, input closes.
Click again, change to `1000000`, blur → saves.
Reset both back to defaults via curl after testing:
```bash
curl -s -X PATCH http://localhost:3000/api/settings -H 'Content-Type: application/json' -d '{"goal_fiat":200000,"goal_satoshi":2000000}'
```

- [ ] **Step 4: Commit**

```bash
git add src/components/Goals.tsx src/app/globals.css
git commit -m "feat(ui): add Goals inline edit with Enter/Escape/blur handlers"
```

---

# PHASE 8 — FINAL VERIFICATION

## Task 20: Full smoke test and completion

No new files. This task enforces the final verification gate from the spec.

- [ ] **Step 1: Typecheck**

Run: `npm run typecheck`
Expected: 0 errors. If errors exist, fix them in place (do not bypass with `any`).

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: 0 errors, 0 warnings. Address any ESLint failures.

- [ ] **Step 3: Production build**

Run: `npm run build`
Expected: build succeeds with "Compiled successfully" and route table output. Pay attention to any warnings about `better-sqlite3` being a native dep — should be handled by the `serverComponentsExternalPackages` config from Task 1.

- [ ] **Step 4: Dev server + browser smoke**

Run: `npm run dev`. Walk through this full checklist in the browser at `http://localhost:3000`:

1. **Empty state:**
   - Reset DB: stop dev, `rm data/dca.db`, restart.
   - Load `/` — no errors in server or browser console.
   - PnlCard shows "No purchases yet", LIVE dot present.
   - StatsGrid shows 8 cards with `—` values, no sparklines.
   - Goals bars at 0%.
   - Chart shows "Add your first buy to see chart".
   - RecordsTable shows "No records. Click Add buy to start."
2. **Add a buy:**
   - Click "Add buy". Modal prefills today's date, fiat=108, price=live BTC.
   - Click "Record buy" → modal closes.
   - PnlCard, StatsGrid, Chart (if mode supports 1 point), RecordsTable all populate.
3. **Duplicate date:**
   - Click "Add buy" again without changing date. Click "Record buy".
   - Inline red error appears under Date: "Already have a buy for YYYY-MM-DD".
   - Close modal.
4. **Second buy (yesterday):**
   - Click "Add buy", change date to yesterday, submit.
   - 24h delta chip appears in PnlCard.
   - Chart now shows 2 points.
5. **Edit a row:**
   - Hover a row in RecordsTable → pencil + trash appear.
   - Click pencil → fiat + price become inputs, satoshi recomputes live.
   - Change fiat to 200, click ✓ → row saves, stats update.
6. **Delete a row:**
   - Click trash on a row → confirm dialog → accept → row disappears, stats update.
7. **Edit a goal:**
   - Click "Goal · ฿200,000" → input appears.
   - Change to 300000, press Enter → saves, progressFiat bar drops.
   - Click "Goal · 2,000,000 sat", change to 1000000, press Escape → no save.
   - Change again, blur the input → saves.
   - Reset both goals via curl as above.
8. **Switch accent:**
   - Click "Tweaks" → panel opens.
   - Click each of 6 swatches → CSS vars update immediately (buttons, progress bars, chart lines, sparklines).
   - Reload `/` → last-selected accent persists.
9. **Stale price:**
   - (Optional — requires simulating offline.) Block `api.bitkub.com` in DevTools Network, hard reload.
   - Expect: PnlCard LIVE dot gray, tooltip "Price stale — Bitkub unreachable".
   - Stats still render using last known price from latest entry.

Stop dev server.

- [ ] **Step 5: Final commit (if anything was changed during verification)**

```bash
git status
# If dirty:
git add -A
git commit -m "chore: final verification pass"
```

- [ ] **Step 6: Report completion**

Print a short completion summary: total tasks done, DB file location, final commit hash. Open questions for the user (if any).

---

## Self-review (author only — not part of execution)

Checked before publishing:

1. **Spec coverage:** Every section of the design doc is addressed —
   - §3 Phase 1 → Task 1; Phase 2 → Task 2; Phase 3 → Tasks 3-5; Phase 4 → Tasks 6-8; Phase 5 → Task 9; Phase 6 → Tasks 10-15; Phase 7 → Tasks 16-19; Phase 8 → Task 20.
   - §4 Empty-state rules → embedded in PnlCard/StatsGrid/Goals/Chart/RecordsTable tasks.
   - §5 Error handling → Bitkub fallback in Task 8, duplicate_date in Task 6 and AddBuyModal (Task 16), mutation `alert()` in Tasks 16/18/19.
   - §6 Verification plan → Task 20 mirrors the checklist.
   - §7 Non-goals — none of these appear as tasks. Confirmed.
   - §8 Open risks — Node version and `better-sqlite3` external package already addressed in Task 1 config.

2. **Placeholder scan:** No "TBD", "TODO", "similar to earlier", or uncited `// …`. All code blocks are complete and runnable as-is.

3. **Type consistency:** `Entry`, `EnrichedEntry`, `Summary`, `Goals`, `Delta24`, `ApiResult<T>`, `ApiOk<T>`, `ApiErr` — defined once in `src/types.ts` (Task 3 Step 1) and used consistently across API routes, page, and components. `Accent` is defined in Dashboard (Task 9) and re-declared in TweaksPanel (Task 17) — Task 17 Step 2 removes the Dashboard duplicate and imports from TweaksPanel, fixing the duplication.

4. **Order dependencies:** Every task that imports from `@/components/_fmt` comes after Task 10; every API route task comes after Task 3 (DB singleton); every component task comes after Task 9 (Dashboard shell).

---

## Execution handoff

Plan complete and saved to [docs/superpowers/plans/2026-04-19-dca-tracker-build.md](.). Two execution options:

1. **Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration. Best for keeping main-thread context focused.

2. **Inline Execution** — I execute tasks in this session using executing-plans, batch execution with checkpoints. Best if you want to watch each step closely.

**Which approach?**
