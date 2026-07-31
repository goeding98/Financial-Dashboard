# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Financial dashboard for a veterinary business (Dogspital) with three "sedes" (locations): Colseguros, Ciudad Jardin, and Santa Monica. Revenue comes live from the Siigo accounting API (invoices), expenses come from a Google Sheet ("egresos" tab), and the backend combines both into P&L, cash flow, KPIs, and revenue-by-service-type views.

## Commands

There is no root `package.json` — `backend/` and `frontend/` are independent npm projects, each with their own `node_modules`.

Backend (`backend/`):
- `npm run dev` — run with tsx watch (hot reload) on port 3001
- `npm run build` — compile TypeScript to `dist/`
- `npm start` — run compiled `dist/index.js`
- No test or lint scripts are configured.

Frontend (`frontend/`):
- `npm run dev` — Vite dev server on port 5173, proxies `/api/*` to `http://localhost:3001`
- `npm run build` — `tsc && vite build`
- `npm run preview` — preview the production build
- No test or lint scripts are configured.

Run both at once from the repo root with `start.bat` (Windows): kills anything on ports 3001/5173, launches backend and frontend in separate terminal windows, opens `http://localhost:5173`.

## Environment variables

Backend reads from `backend/.env` (gitignored, not present in repo — must be created manually):
- `SIIGO_USERNAME`, `SIIGO_ACCESS_KEY` — required; startup logs a critical warning if missing
- `SIIGO_PARTNER_ID` — defaults to `FinancialDashboard`
- `SIIGO_BASE_URL` — defaults to `https://api.siigo.com`
- `GOOGLE_SHEET_ID` — defaults to a hardcoded sheet ID in `sheets.ts`
- `PORT` — defaults to 3001
- `ALLOWED_ORIGINS` — comma-separated extra CORS origins (localhost and `*.vercel.app` are always allowed)

Frontend reads `VITE_API_URL` (Vite env) to point at a deployed backend; if unset, requests go to relative `/api` (dev proxy).

Deployment: backend → Railway (per code comments/logs), frontend → Vercel (`frontend/vercel.json` has an SPA rewrite; CORS explicitly allows `*.vercel.app`).

## Architecture

**Backend is a thin orchestration layer over two external data sources**, both wrapped in `NodeCache` instances registered with a shared cache registry (`backend/src/services/cache.ts`) so `POST /api/refresh` can flush everything at once:

- `services/siigo.ts` — Siigo API client. Handles OAuth token refresh, paginated invoice fetching (with 429/timeout retry), and all revenue logic. Invoice cache TTL is 8h; product-reference-map cache is 24h.
- `services/sheets.ts` — reads a public Google Sheet as CSV (`/export?format=csv`, not `/gviz`, because gviz caps at ~16 rows on large sheets) and turns rows into `PnLItem`s. Cache TTL is 30 min.
- `routes/financial.ts` — all `/api/*` endpoints; also contains `buildPnL()`, the single place that turns `(revenue, expenses[])` into a full P&L with COGS/OPEX/D&A/interest/tax breakdown and margins.

**Revenue attribution to a "sede" is the trickiest part of this codebase** and lives in `services/siigo.ts`:
- `SELLER_SEDE_MAP` — hardcoded seller-ID → sede mapping (there is no sede field on a Siigo invoice; it's inferred from the seller/vendor).
- `SELLER_SEDE_CHANGES` — sellers that switched sede on a specific date get retroactively bucketed correctly (`getSellerSede(sellerId, invoiceDate)` checks the invoice date against the change's `from` date).
- Seller 437 ("empresa"/accountant) doesn't belong to a sede — its invoices are prorated 70% Colseguros / 30% Ciudad Jardin (`PRORATE_SELLER_ID`, `PRORATE_COLSEGUROS`, `PRORATE_CIUDAD`).
- `EXCLUDED_SELLER_IDS` — sellers whose invoices should never count as revenue (non-billing accounts).
- When adding a new seller or a new sede, update `SELLER_SEDE_MAP` (and `SELLER_SEDE_CHANGES` if it's a mid-period reassignment) — this is the only place that mapping exists.

**Service-type classification** (Consultas, Cirugías, Vacunación, etc.) happens twice, independently, and must be kept in sync:
- `normalizeReference()` in `siigo.ts` — primary path, keys off Siigo's product "Referencia de Fábrica" via `getProductReferenceMap()`.
- `normalizeServiceType()` in `siigo.ts` — fallback when a product has no reference, keys off the invoice line description.
- The `/api/debug/types` and `/api/debug/items` routes in `financial.ts` reimplement the same classification inline for inspection — if you change the categorization rules, update those debug routes too or they'll report stale results.

**Expense classification** happens in `sheets.ts::classifyRow()`, driven entirely by two columns in the Sheet: "Tipo de Egreso" (free text label) and "Clasificacion Fin." (financial classification — `costo`→COGS, `gasto`→OPEX, `no ebitda`→D&A/interest/tax by keyword match on Tipo, `capex`→excluded from P&L and shown only in cash flow). Row shape is fixed by column position (see the column-index comment at the top of the file), not headers.

**Cash flow** (`GET /api/cashflow`) is derived, not stored separately: it reuses the same P&L build for EBITDA, pulls CAPEX rows from the same expense sheet (`Clasificacion Fin. = "CAPEX"`), and computes free cash flow as `ebitda - capex - workingCapital + extraordinary + other`.

**Frontend** is a standard Vite + React Router SPA (`App.tsx` defines routes: `/` Dashboard, `/pnl`, `/cashflow`, `/graficos`, all under `AppLayout`). Data fetching goes through one hook, `hooks/useApi.ts`:
- Wraps axios GET with loading/error/data state.
- Implements a global refresh bus (`triggerGlobalRefresh()`) — any component can force every mounted `useApi` call across the app to refetch simultaneously (used by the manual "Refresh" button, which also calls `POST /api/refresh` to flush backend caches first).

## Non-obvious conventions

- Months are 1-indexed everywhere (both backend and frontend), not 0-indexed.
- `toDay` query param (many endpoints) filters a month's invoices to `date <= toDay`, done in-memory after fetching the full month — Siigo's `date_end`/`created_end` filtering isn't reliable enough to trust for partial-month queries.
- Mock data generators (`getMockRevenue` in `financial.ts`, `getMockExpenses` in `sheets.ts`) exist only as fallbacks when Siigo/Sheets calls fail — not used in normal operation.
- There is intentionally no cache prewarming on server start (see comment in `index.ts`); caches fill lazily on first request to avoid hammering Siigo at boot.
