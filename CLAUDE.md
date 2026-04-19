# DCA Tracker

A local-first webapp for tracking daily Bitcoin DCA purchases in THB. Single user, no auth, no deploy — runs on the owner's machine via `npm run dev`.

Data reference: [DCA-ref.jpg](DCA-ref.jpg) (spreadsheet screenshot that defines every metric the app must compute).

---

## Golden rule: UI fidelity

The folder [dca-tracker-ui-ref/](dca-tracker-ui-ref/) is the **authoritative visual spec**.

- Match it pixel-for-pixel: layout, spacing, typography, colors, interactions.
- Port the React logic from [App.jsx](dca-tracker-ui-ref/App.jsx) and [Chart.jsx](dca-tracker-ui-ref/Chart.jsx) into typed Next.js components.
- Port the CSS tokens from [styles.css](dca-tracker-ui-ref/styles.css) into `globals.css` verbatim (variable names, values, all 6 accent presets).
- Do not invent new visual treatments, extra decoration, or alternative layouts. Simple and functional — the ref is already the design.
- If a ref detail conflicts with a calculation in this doc, the calculation wins (the ref uses seeded mock data; the formulas are the source of truth).

---

## Stack

- **Next.js 16** App Router + **TypeScript** (strict)
- **Tailwind CSS** (theme extended via CSS variables so the Tweaks panel can swap accents at runtime)
- **better-sqlite3** — synchronous, file-backed, fits a single-user local app
- **Bitkub API** for live BTC/THB price (no key required)
- Node.js runtime for all API routes (Edge does not support `better-sqlite3`)

**Non-goals:** auth, deploy to Vercel, multi-crypto, multi-currency, CSV import/export, tests, PPR / Cache Components / caching layers. Everything is dynamic because it is local and single-user.

---

## Folder structure

```
dca-tracker/
├── CLAUDE.md
├── DCA-ref.jpg                    # data/metrics reference
├── dca-tracker-ui-ref/            # UI reference (do not import at runtime)
├── package.json
├── next.config.ts
├── tsconfig.json
├── tailwind.config.ts
├── .gitignore                     # /data/, .next/, node_modules/
├── data/
│   └── dca.db                     # SQLite file (gitignored)
└── src/
    ├── app/
    │   ├── layout.tsx
    │   ├── page.tsx               # single dashboard page
    │   ├── globals.css            # design tokens ported from ref
    │   └── api/
    │       ├── entries/route.ts         # GET list, POST new
    │       ├── entries/[id]/route.ts    # PATCH, DELETE
    │       ├── price/route.ts           # GET current BTC/THB from Bitkub
    │       └── settings/route.ts        # GET, PATCH goals
    ├── components/
    │   ├── Topbar.tsx
    │   ├── SectionLabel.tsx       # 01 / 02 / 03 numbered headers
    │   ├── PnlCard.tsx
    │   ├── ChartCard.tsx
    │   ├── Chart.tsx
    │   ├── Sparkline.tsx
    │   ├── StatsGrid.tsx
    │   ├── Goals.tsx
    │   ├── RecordsTable.tsx
    │   ├── AddBuyModal.tsx
    │   └── TweaksPanel.tsx
    ├── lib/
    │   ├── db.ts                  # better-sqlite3 singleton + migrate-on-open
    │   ├── schema.sql             # DDL + seed
    │   ├── bitkub.ts              # price fetcher
    │   └── calc.ts                # all metric formulas (no framework deps)
    └── types.ts
```

Rules:
- `dca-tracker-ui-ref/` is a reference, never import from it. Re-type and re-write each component under `src/components/`.
- Keep every component focused. If one grows past ~200 lines, split it.
- `src/lib/calc.ts` must be pure functions with no React / Next imports — easy to reason about, easy to unit-test later if needed.

---

## Commands

```bash
npm run dev      # Next.js dev server on http://localhost:3000
npm run build    # production build (not deployed, but used for sanity)
npm run lint     # ESLint
npm run typecheck  # tsc --noEmit
```

First-time setup also needs: `npm install`, then the DB file is created on first request (see [src/lib/db.ts](src/lib/db.ts)).

---

## Data model (SQLite)

```sql
-- entries: one row per purchase day
CREATE TABLE IF NOT EXISTS entries (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  date       TEXT    NOT NULL UNIQUE,           -- 'YYYY-MM-DD'
  fiat_thb   INTEGER NOT NULL CHECK (fiat_thb > 0),
  satoshi    INTEGER NOT NULL CHECK (satoshi  > 0),
  price_thb  REAL    NOT NULL CHECK (price_thb > 0),
  created_at TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_entries_date ON entries(date);

-- settings: key-value for goals (and future prefs)
CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
INSERT OR IGNORE INTO settings (key, value) VALUES
  ('goal_fiat',     '200000'),
  ('goal_satoshi',  '2000000');
```

Notes:
- `date` is unique — one entry per day. Duplicate POST returns 409.
- `satoshi` is an integer (1 BTC = 100,000,000 sat). Compute from user input: `satoshi = floor(fiat_thb / price_thb * 1e8)`.
- `price_thb` is stored so historical `portfolio_value` is reproducible.

---

## Core calculations (`src/lib/calc.ts`)

The entry list is enriched in chronological order. All formulas match the ref.

**Per-entry cumulative fields**, walking oldest → newest:

```
cumSat      = running sum of satoshi
cumFiat     = running sum of fiat_thb
portfolioValue = (cumSat / 1e8) * entry.price_thb      // uses that day's price
invested       = cumFiat
unrealized     = portfolioValue - invested
pctUnrealized  = unrealized / invested * 100
satPerTHB      = 1e8 / entry.price_thb
```

**Summary** (uses last entry + `currentPrice` from Bitkub):

```
spendFiat      = Σ fiat_thb
totalSatoshi   = Σ satoshi
numberOfDays   = count(entries)
averageCost    = totalSatoshi / spendFiat                       // sat per THB, across all buys
todaySatPerTHB = 1e8 / currentPrice
marketValue    = (totalSatoshi / 1e8) * currentPrice
pctProfitLoss  = (marketValue - spendFiat) / spendFiat * 100
maxDrawdown    = worst (pv - runningPeak) / runningPeak * 100   // walk entries, track peak of portfolioValue
progressFiat   = spendFiat    / goal_fiat    * 100
progressBTC    = totalSatoshi / goal_satoshi * 100
```

**24h delta** (PnL card):
```
delta24     = last.portfolioValue - prev.portfolioValue         // last two enriched entries
deltaPct24  = delta24 / prev.portfolioValue * 100
```

The canonical reference implementation lives in `App.jsx` lines 463–490. Do not drift from this logic when porting.

---

## Bitkub price API

```
GET https://api.bitkub.com/api/market/ticker?sym=THB_BTC
```

Response shape (ticker object keyed by symbol):
```json
{ "THB_BTC": { "last": 2398015, "high24hr": ..., "low24hr": ... } }
```

- Use `last` as `currentPrice`.
- No API key required. No CORS from the browser guaranteed — always call via `src/app/api/price/route.ts` so the server proxies it.
- On failure, `/api/price` returns `{ error, fallbackPrice: <last known from latest entry> }`. The UI shows a stale indicator; it should never crash.

---

## Component port map

| Ref (dca-tracker-ui-ref/) | Target (src/components/) | Notes |
|---|---|---|
| `App.jsx` `Topbar`       | `Topbar.tsx`       | "Add buy" opens modal, "Tweaks" toggles panel |
| `App.jsx` `PnlCard`      | `PnlCard.tsx`      | keep the LIVE dot and 24h delta chip |
| `App.jsx` `ChartCard`    | `ChartCard.tsx`    | 3 modes (portfolio / pnl / cost) × 3 timeframes (7D / 30D / ALL) |
| `Chart.jsx`              | `Chart.tsx`        | port the SVG chart; no new lib unless the ref uses one |
| `App.jsx` `StatsGrid`    | `StatsGrid.tsx`    | 8 cards, sparklines on 6 of them |
| (inline `Sparkline`)     | `Sparkline.tsx`    | extract to its own file |
| `App.jsx` `Goals`        | `Goals.tsx`        | two progress bars, tick labels |
| `App.jsx` `RecordsTable` | `RecordsTable.tsx` | sort / search / paginate (30 / 50 / 100 / 250) |
| `App.jsx` `AddBuyModal`  | `AddBuyModal.tsx`  | pre-fills `price` from `/api/price`, shows live sat preview |
| `App.jsx` `TweaksPanel`  | `TweaksPanel.tsx`  | 6 accent presets; persist selection in `localStorage` (not DB) |
| section label markup     | `SectionLabel.tsx` | takes `num`, `title`, `hint` |

---

## Rendering model

- `src/app/page.tsx` is a **Server Component**. It reads all entries from SQLite, enriches them with `calc.ts`, and fetches `currentPrice` from Bitkub (via `src/lib/bitkub.ts`). It renders a client shell with the data as props.
- `export const dynamic = 'force-dynamic'` on `page.tsx` and all API routes. No caching, no PPR, no `use cache`. This is a single-user local app; always render fresh.
- Mutations (add / patch / delete entry, update goals) go through API routes. After a successful mutation, the client calls `router.refresh()` to re-render the Server Component.
- `TweaksPanel` state lives in `localStorage` only — it is a personal cosmetic preference, not app data.

---

## Design tokens

Port [styles.css](dca-tracker-ui-ref/styles.css) `:root` block into `src/app/globals.css` verbatim — the Tailwind config then reads these vars:

```ts
// tailwind.config.ts (excerpt)
theme: {
  extend: {
    colors: {
      bg: 'var(--bg)', surface: 'var(--surface)', border: 'var(--border)',
      fg: 'var(--fg)', muted: 'var(--muted)',
      accent: 'var(--accent)', 'accent-strong': 'var(--accent-strong)',
      pos: 'var(--pos)', neg: 'var(--neg)',
    },
    fontFamily: { sans: 'var(--sans)', mono: 'var(--mono)' },
    borderRadius: { DEFAULT: '4px', lg: '8px' },
  }
}
```

Fonts: load **Inter** and **JetBrains Mono** via `next/font/google` in `layout.tsx`. All numeric values render with `font-variant-numeric: tabular-nums`.

Accent presets (exactly these 6, from `App.jsx` `ACCENTS`): Bitcoin Orange (default), Saffron, Amber, Crimson, Forest, Ink.

---

## Conventions

- TypeScript strict; no `any`. Prefer `type` aliases over `interface` for data shapes.
- Fetch from SQLite only in Server Components or API routes — never in a Client Component.
- API responses: `{ ok: true, data }` or `{ ok: false, error }`. Always return JSON.
- Dates: store as `'YYYY-MM-DD'` strings. Convert to `Date` only at the component boundary.
- Currency formatting: integer THB with `toLocaleString('en-US')`; 2-decimals where the ref shows them; `%` with leading sign.
- When a helper already exists in `calc.ts`, reuse it. Don't inline formulas in components.

---

## Memory / preferences

- Functional > beautiful. The ref is already the design — don't over-design past it.
- No tests unless the user asks. Single-user local means manual verification is enough.
- No new dependencies without a reason. Ship with: `next`, `react`, `typescript`, `better-sqlite3`, `tailwindcss`, `@types/*`. Charts use plain SVG per the ref.
