# DCA Tracker — Build Design

**Date:** 2026-04-19
**Status:** Approved (pending user review of this doc)
**Source of truth for calc/schema:** [CLAUDE.md](../../../CLAUDE.md)
**Source of truth for visuals:** [dca-tracker-ui-ref/](../../../dca-tracker-ui-ref/)

---

## 1. Context

DCA Tracker is a local-first single-user Next.js 16 webapp for logging daily Bitcoin DCA purchases in THB. CLAUDE.md already specifies the stack, file layout, SQLite schema, calculation formulas, and component port map. This document captures the decisions made during brainstorming that are **not** in CLAUDE.md, plus the execution sequence for the full build.

**Scope of this session:** build the entire app end-to-end (Approach 1 — layered), starting from an empty directory. Deliverable is a dev-runnable app that matches the visual reference pixel-for-pixel and implements every calculation in CLAUDE.md §Core calculations.

---

## 2. Decisions (from brainstorm)

| # | Decision | Rationale |
|---|---|---|
| D1 | **Full build in one session, layered (infra → data → UI → polish)** | Spec is complete enough; `calc.ts` is pure and can be verified standalone before UI; tokens-first means every component inherits the right design |
| D2 | **Empty DB on first launch — no seed data** | Personal tool: seeded mock values would corrupt real P&L from day one |
| D3 | **Fill all UI gaps CLAUDE.md API implies but ref omits** — edit entry, delete entry, edit goals | Every endpoint in CLAUDE.md §Folder structure exists for a reason; users need to fix typos and move goals |
| D4 | **Minimal, ref-compatible UI for gap features** — hover-reveal row actions, inline goal edit | Preserves ref's clean aesthetic (D1 of CLAUDE.md "Golden rule: UI fidelity") |

---

## 3. Build sequence (8 phases)

Each phase has a **hard verification gate**. Do not advance until gate passes.

### Phase 1 — Scaffold
**Files:** `package.json`, `tsconfig.json`, `next.config.ts`, `tailwind.config.ts`, `postcss.config.mjs`, `.gitignore`, `eslint.config.mjs`

Dependencies (exactly these, per CLAUDE.md §Memory/preferences):
- `next@^16`, `react`, `react-dom`
- `typescript`, `@types/react`, `@types/react-dom`, `@types/node`
- `better-sqlite3`, `@types/better-sqlite3`
- `tailwindcss`, `@tailwindcss/postcss`, `postcss`
- `eslint`, `eslint-config-next`

`.gitignore` must include `/data/`, `.next/`, `node_modules/`.

`tsconfig.json`: `"strict": true`, `"noUncheckedIndexedAccess": true`.

**Gate:** `npm install` completes; `npx next --version` reports 16.x.

### Phase 2 — Tokens + fonts
**Files:** `src/app/globals.css`, `src/app/layout.tsx`, `tailwind.config.ts`

- Port `:root` block from [dca-tracker-ui-ref/styles.css](../../../dca-tracker-ui-ref/styles.css) verbatim into `globals.css` (all CSS variables: `--bg`, `--surface`, `--border`, `--fg`, `--muted`, `--accent`, `--accent-strong`, `--pos`, `--neg`, `--sans`, `--mono`).
- Port all 6 accent presets (Bitcoin Orange, Saffron, Amber, Crimson, Forest, Ink) exact hex values.
- `layout.tsx`: load Inter + JetBrains Mono via `next/font/google`, assign to `--sans` and `--mono`.
- `tailwind.config.ts`: extend colors/fonts to read from CSS vars per CLAUDE.md §Design tokens.
- Add `font-variant-numeric: tabular-nums` to all numeric text (via `.mono` or global).

**Gate:** `npm run dev`; `/` renders blank with correct background color + Inter font visible.

### Phase 3 — Data layer (pure, no React)
**Files:** `src/lib/schema.sql`, `src/lib/db.ts`, `src/lib/bitkub.ts`, `src/lib/calc.ts`, `src/types.ts`

- `schema.sql`: verbatim DDL from CLAUDE.md §Data model (entries + settings + seed defaults `goal_fiat=200000`, `goal_satoshi=2000000`).
- `db.ts`: singleton `better-sqlite3` instance, opens `data/dca.db`, runs schema on open (idempotent). Node runtime only. Creates `data/` directory if missing.
- `bitkub.ts`: `fetchCurrentPrice(): Promise<number | null>` — hits `https://api.bitkub.com/api/market/ticker?sym=THB_BTC`, returns `data.THB_BTC.last` or `null` on failure.
- `calc.ts`: pure functions, zero React/Next imports. Implement exactly per CLAUDE.md §Core calculations:
  - `enrichEntries(rows: Entry[]): EnrichedEntry[]` — walks oldest→newest, adds `cumSat`, `cumFiat`, `portfolioValue`, `invested`, `unrealized`, `pctUnrealized`, `satPerTHB`
  - `computeSummary(enriched, currentPrice, goals): Summary` — spend, totalSatoshi, numberOfDays, averageCost, todaySatPerTHB, marketValue, pctProfitLoss, maxDrawdown, progressFiat, progressBTC
  - `delta24(enriched): { delta, pct } | null` — null if `< 2` entries
- `types.ts`: `Entry`, `EnrichedEntry`, `Summary`, `Goals`, `ApiResult<T>`.

Cross-check against reference implementation `App.jsx` lines 463-490 — formulas must produce identical output for identical input.

**Gate:** Manual — insert 2-3 rows via SQLite CLI (`sqlite3 data/dca.db`), call `enrichEntries` + `computeSummary` via a one-off script, confirm outputs match hand-calculated values.

### Phase 4 — API routes
**Files:** 4 route files under `src/app/api/`

All routes: `export const runtime = 'nodejs'`, `export const dynamic = 'force-dynamic'`. Response envelope `{ ok: true, data }` or `{ ok: false, error }`.

| Route | Methods | Notes |
|---|---|---|
| `entries/route.ts` | GET, POST | GET returns all entries ASC by date. POST validates, computes `satoshi = floor(fiat / price * 1e8)`, inserts; 409 on `UNIQUE constraint failed` with `error: "duplicate_date"` |
| `entries/[id]/route.ts` | PATCH, DELETE | PATCH updates `fiat_thb` + `price_thb` (not date), recomputes `satoshi`. DELETE removes row |
| `price/route.ts` | GET | Calls `fetchCurrentPrice()`. On failure returns `{ ok: false, error: "bitkub_unavailable", fallbackPrice: <latestEntry.price_thb ?? null> }` (HTTP 200, not 5xx, so client code is simpler) |
| `settings/route.ts` | GET, PATCH | GET returns `{ goal_fiat, goal_satoshi }` as numbers. PATCH accepts partial `{ goal_fiat?, goal_satoshi? }` |

**Validation (API boundary only):**
- `fiat_thb`: positive integer, ≤ 10,000,000
- `price_thb`: positive number, ≤ 100,000,000
- `date`: `/^\d{4}-\d{2}-\d{2}$/`
- Goal values: positive integer, ≤ 1,000,000,000
- On invalid: 400 with `error: "invalid_<field>"`

**Gate:** `curl` each endpoint with valid + invalid payloads. Duplicate date returns 409. Invalid JSON returns 400. All return JSON envelope.

### Phase 5 — Page shell (server component)
**Files:** `src/app/page.tsx`

Server component:
1. Open DB, SELECT entries ASC by date, SELECT settings
2. Call `enrichEntries`
3. Call `bitkub.fetchCurrentPrice()` (parallel with DB if possible)
4. If `currentPrice === null` and `records.length > 0`: use `records[last].price_thb` as fallback, set `priceStale: true`
5. If `records.length > 0`: compute summary; else `summary = null`
6. Render `<Dashboard records={records} summary={summary} currentPrice={...} priceStale={...} goals={...} />` (client component shell)

`export const dynamic = 'force-dynamic'`, `export const runtime = 'nodejs'`.

**Gate:** Empty DB — page renders without throwing. Non-empty DB — all values visible.

### Phase 6 — Display components
**Files:** 9 components under `src/components/`

Port per CLAUDE.md §Component port map, in this order (dependencies first):

1. `SectionLabel.tsx` — `{num, title, hint}` props; renders 01/02/03 numbered header
2. `Topbar.tsx` — brand + "Last sync" clock + Tweaks + Add buy buttons
3. `Sparkline.tsx` — SVG sparkline extracted from inline ref
4. `PnlCard.tsx` — LIVE dot, 24h delta chip, market/invested split. **Empty state:** "No purchases yet" + current BTC price only
5. `StatsGrid.tsx` — 8 cards with sparklines on 6. **Empty state:** all values `—`, sparklines hidden
6. `Goals.tsx` — 2 progress bars with tick labels. Edit UI deferred to Phase 7
7. `Chart.tsx` + `ChartCard.tsx` — port `Chart.jsx` SVG; 3 modes × 3 timeframes. **Empty state:** blank SVG + overlay "Add your first buy to see chart"
8. `RecordsTable.tsx` — sort/search/paginate (30/50/100/250). Row actions deferred to Phase 7. **Empty state:** single row "No records. Click Add buy to start."

**Empty-state rule:** use `—` (em-dash, via `--muted` token) — never `0.00`, which implies "data exists and equals zero."

`Dashboard.tsx` (client shell) composes all 8 display components + holds `accent` state (localStorage) + modal visibility flags.

**Gate:** Open `/` in browser side-by-side with `dca-tracker-ui-ref/DCA Tracker.html`. Layout, spacing, typography, colors match. Zero TypeScript errors.

### Phase 7 — Interactive components + mutations
**Files:** `AddBuyModal.tsx`, `TweaksPanel.tsx`, updates to `RecordsTable.tsx` and `Goals.tsx`

**AddBuyModal:**
- Fields: `date` (input[type=date], default today), `fiat` (number, default 108), `price` (number, prefilled from `currentPrice`)
- Live preview: `sat = floor(fiat / price * 1e8)`, `satPerTHB = 1e8 / price`
- Submit: POST `/api/entries` → on 409 show inline error under Date field — "Already have a buy for this date"
- Success → `router.refresh()` + close

**RecordsTable row actions:**
- New last column, blank header, width ~60px
- On row `:hover`: reveal pencil + trash icons at opacity 0.4 → 1.0 on icon hover
- Edit: row becomes inline editable (`fiat` + `price` inputs only; `date` stays locked; `sat` recalculates live). Save/Cancel inline buttons. PATCH → refresh.
- Delete: `window.confirm("Delete entry for <date>?")` → DELETE → refresh

**Goals inline-edit:**
- Goal target text (e.g., `Goal · ฿200,000`) gets `cursor: pointer` + dotted underline on hover
- Click → becomes `<input type="number">` with same styling
- Enter or blur → PATCH `/api/settings` + refresh; Escape → cancel
- No pencil icon, no modal — lowest possible visual weight

**TweaksPanel:**
- Slide-in panel per ref
- 6 accent swatches; click updates 4 CSS vars (`--accent`, `--accent-strong`, `--accent-soft`, `--accent-line`) on `:root`
- Persist selected accent `.name` in `localStorage` (key: `dca.accent`); hydrate on mount

**Mutation error handling:** `try/catch` around fetch; on failure call `window.alert(errorMessage)`. Single-user local — no toast/snackbar library.

**Gate:** Full manual smoke — Add buy (success + duplicate) → Edit row → Delete row → Switch accent → Reload (goals persist in DB, accent persists in localStorage, records persist in DB).

### Phase 8 — Final verification
Run in order:
1. `npm run typecheck` → 0 errors
2. `npm run lint` → 0 errors
3. `npm run build` → successful production build
4. `npm run dev` → no runtime errors in server console
5. Browser smoke (see §5 below)

---

## 4. Empty-state handling

`records.length === 0` triggers degraded rendering in every consumer of summary/enriched data.

| Component | Empty rendering |
|---|---|
| `PnlCard` | "No purchases yet" headline; LIVE dot + current BTC price only; no P&L value; no 24h chip |
| `StatsGrid` | Every value = `—`; sparklines hidden (SVG not rendered) |
| `Goals` | Progress bars at 0% width; tick labels show `฿0` and `Goal · ฿200,000` (target still visible and useful) |
| `Chart` | Empty SVG canvas; center overlay text (muted): "Add your first buy to see chart" |
| `RecordsTable` | Keep header; single tbody row spanning all columns: "No records. Click Add buy to start." |
| `PnlCard` 24h delta | `records.length < 2` → hide chip entirely |

**Invariant:** Never render `0.00`, `0%`, or `0 sat` when no data exists. `0` is a meaningful value that implies "we measured this." Use `—`.

---

## 5. Error handling

### Bitkub API down
- `/api/price` returns 200 with `{ ok: false, error: "bitkub_unavailable", fallbackPrice }` (not 5xx — simplifies client)
- `fallbackPrice = latestEntry.price_thb` (or `null` if DB empty)
- `page.tsx` uses fallback for summary calc; sets `priceStale: true`
- `PnlCard`: LIVE dot turns gray; `title` attribute: "Price stale — Bitkub unreachable"
- Empty DB + Bitkub down: `currentPrice = null`, summary not computed, PnlCard shows "Price unavailable"

### Duplicate date
- SQLite throws `UNIQUE constraint failed: entries.date` → API returns 409 with `error: "duplicate_date"`
- Modal surfaces inline error under Date field

### Missing/corrupt DB
- `db.ts` migrate-on-open is idempotent (`CREATE TABLE IF NOT EXISTS`) — silently recreates schema

### Mutation failures in UI
- `try/catch` around every fetch in client components
- On failure: `window.alert(error.message || "Something went wrong")`
- Acceptable for single-user local tool; no toast infrastructure needed

---

## 6. Verification plan

### Per-phase gates
Listed inline in §3 under each phase. Do not advance if gate fails.

### Final completion criteria (all must pass)
1. `npm run typecheck` — 0 errors
2. `npm run lint` — 0 errors
3. `npm run build` — successful
4. `npm run dev` — no runtime errors in terminal
5. Browser smoke:
   - Load `/` on empty DB — renders without error, all empty states correct
   - Add buy (today) — success, stats/chart/table update
   - Add buy (same date again) — 409, inline error shown
   - Add 2nd buy (yesterday) — 24h delta chip appears
   - Edit row — fiat/price update, sat recomputes, table reflects
   - Delete row — confirm dialog, row gone, stats update
   - Edit goal — inline input, saves on Enter, bar updates
   - Switch accent — all 6 swatches change CSS vars correctly
   - Reload — goals + records persist (DB); accent persists (localStorage)
   - Disconnect network → `/api/price` → observe stale indicator

---

## 7. Non-goals (per CLAUDE.md)

Explicitly will **not** be built:
- Authentication
- Deploy / Vercel config
- Multi-crypto or multi-currency
- CSV import/export
- PPR / Cache Components / `use cache`
- Unit tests (unless user requests later)
- Observability / Sentry / analytics
- Toast/snackbar UI library (using `alert` is fine)
- New dependencies beyond the list in Phase 1

---

## 8. Open risks & mitigations

| Risk | Mitigation |
|---|---|
| `better-sqlite3` native build fails on user's Node version | Document Node 20+ requirement in README; surface clear error if `require` throws |
| Next.js 16 App Router API shape differs from memory | Verify against official docs before writing route handlers; server component syntax drift |
| Ref CSS uses vanilla class names that conflict with Tailwind utilities | Port ref CSS into `globals.css` under scoped class names (no `@apply`); Tailwind used only for layout utilities where needed |
| Chart.jsx SVG geometry is pixel-tuned — porting to TS may break visual match | Keep Chart.tsx as close to line-for-line port as possible; add types without restructuring |
| `dynamic = 'force-dynamic'` + `better-sqlite3` both need Node runtime — make sure not accidentally declared `edge` anywhere | Add `runtime = 'nodejs'` to every route file |

---

## 9. Follow-up

After this spec is approved by user review, invoke `superpowers:writing-plans` skill to produce a detailed step-by-step implementation plan covering Phases 1-8.
