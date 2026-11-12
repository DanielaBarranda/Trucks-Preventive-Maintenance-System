# Phase 2 Milestone B — Driver Actions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Drivers can log odometer readings, create and run trips, submit expenses with two camera photos (optionally linked to a maintenance task), and see their vehicle's full maintenance status, all from a phone.

**Architecture:** New driver routes under `/driver/*`, each one page file using the existing `DriverLayout`, UI kit and `apiFetch`. One new API module `api/driver.ts`. Photos are shrunk in the browser before upload. No backend changes: every endpoint already exists (`DriverLogControllers.cs`).

**Tech Stack:** React 18, TypeScript strict, Tailwind 3 (cobalt `accent-*`, `stone-*`, `ink`), TanStack Query 5, React Router 6, React Hook Form + Zod, Vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-11-12-react-frontend-design.md` (section 6, Milestone B) and `PRODUCT.md` (driver operating context).

## Global Constraints

- Branch `phase2b-driver-actions`. No backend or database changes.
- Look: the committed minimal style. Cobalt (`accent-600`) only for actions, focus, selection, and the active tab; red/amber/green only for maintenance status. Icons are inline SVG line icons, never emoji or Unicode glyphs.
- Driver screens: touch targets at least 44px high, primary action full width, `inputMode="numeric"` / `"decimal"` for number fields, one task per screen.
- Copy: plain, short English a Taglish reader understands at a glance ("Save reading", "Take photo", "Upload failed. Check your signal and tap Save again.").
- Distances use `formatDistance(value, session.organization.distance_unit)`; money uses `formatMoney(value, session.organization.currency_code)`.
- Timestamps from the API are UTC without a zone suffix: parse with the same rule as `timeAgo` (append `Z`). Date-only fields (`trip_date`, `expense_date`, `"YYYY-MM-DDT00:00:00"`) are displayed from their first 10 characters, never through `new Date()` time-zone conversion.
- Every form disables its submit button while saving (no double submit) and keeps all entered values, including chosen photos, when saving fails.
- The API's 409 `"No vehicle is assigned to you."` shows the same "No vehicle assigned yet" card as Home on every driver page.
- `npm run check` (typecheck + all tests) passes at the end of every task. Auto-commit per task on this branch only if approved; no co-author line.

## Review Focus

1. A tap on Save while the previous save is still running must not create a second record.
2. Upload failure on patchy data: the form, both photos and the chosen task stay; the message says to check the signal and tap Save again.
3. Odometer typo with an extra digit (e.g. 160000 after 16000): the driver is asked to confirm before saving any increase over 5,000 (in the org's unit).
4. A phone photo of 8–12 MB, or a PNG screenshot: it is shrunk to at most 1600px JPEG before upload; when the browser cannot decode it, the original file is sent if it is a JPG/PNG under 10 MB, otherwise a clear message is shown.
5. Dates: an expense or trip dated today shows today's date on a phone set to UTC+8 (no shift to yesterday).

---

### Task 1: Driver navigation, API module, success notice

**Files:**
- Create: `frontend/src/api/driver.ts`, `frontend/src/components/DriverPage.tsx`, `frontend/src/lib/dates.ts`, `frontend/src/lib/dates.test.ts`, `frontend/src/driverNav.test.tsx`
- Modify: `frontend/src/api/types.ts`, `frontend/src/routes.tsx`, `frontend/src/layouts/DriverLayout.tsx`, `frontend/src/pages/driver/Home.tsx`, `frontend/src/lib/format.ts` (reuse the UTC rule), `.gitignore` (add `frontend/.vite/`), spec section 2 (record the minimal cobalt style that replaced Style A)

**Interfaces:**
- Produces (`api/types.ts`): `OdometerReading { id; vehicle_id; driver_id; reading: number; recorded_at: string }`, `Trip { id; vehicle_id; driver_id; driver_name: string|null; trip_date: string; pickup_location; pickup_address; destination; scheduled_time: string|null; departed_at: string|null; arrived_at: string|null }`, `Expense { id; vehicle_id; driver_id; schedule_id: number|null; expense_date: string; category; amount: number; notes: string|null; created_at: string }`.
- Produces (`api/driver.ts`): `getReadings(): Promise<OdometerReading[]>`, `addReading(reading: number): Promise<{ id: number; new_alerts: number }>`, `getTrips(): Promise<Trip[]>`, `createTrip(t: NewTrip): Promise<{ id: number }>`, `departTrip(id)`, `arriveTrip(id)`, `getExpenses(): Promise<Expense[]>`, `createExpense(form: FormData): Promise<{ id: number }>`, `expensePhotoUrl(id: number, kind: 'process'|'receipt'): string`.
- Produces (`lib/dates.ts`): `parseServerTime(iso: string): Date` (appends `Z` when no zone), `dateOnly(value: string): string` (`"2026-11-12"`), `formatDateOnly(value: string): string` (e.g. "Thu, Nov 12", built from the parts, no zone shift), `todayLocal(): string` (`YYYY-MM-DD` in the device's zone), `formatTime(iso: string): string` ("3:41 PM" from a server timestamp).
- Produces (`components/DriverPage.tsx`): `DriverPage({ title, back?: string, children })` — page title with an optional back link, wrapped in `DriverLayout`; `useMyVehicleGate()` returning `{ vehicle, gate: ReactNode | null }`, where `gate` is the spinner / retry / "No vehicle assigned yet" element to render instead of the page.
- Produces: success notice via router state — `navigate('/driver', { state: { notice: string } })`; Home shows it as a success `Alert` once.

- [ ] **Step 1: Write failing tests**
  - `dates.test.ts`: `parseServerTime('2026-11-12T03:28:11')` equals `Date.UTC(2026,10,12,3,28,11)`; a value with `Z` or `+08:00` is unchanged; `dateOnly('2026-11-12T00:00:00') === '2026-11-12'`; `formatDateOnly('2026-11-12T00:00:00')` contains `12` and `Nov` with `process.env.TZ` irrelevant (no `Date` parsing of the full string).
  - `driverNav.test.tsx` (driver session fixture): the tab bar has links `Home`, `Trips`, `Expenses`, `Status`; clicking `Trips` shows the Trips page heading and marks the tab `aria-current="page"`; Home's `+ Log odometer` is a link to `/driver/odometer` (enabled); a driver with no vehicle visiting `/driver/odometer` sees "No vehicle assigned yet"; Home shows `Reading saved` when rendered with router state `{ notice: 'Reading saved' }`.
- [ ] **Step 2: Run, expect FAIL** — `npx vitest run src/lib/dates.test.ts src/driverNav.test.tsx` → modules/routes missing.
- [ ] **Step 3: Implement.** Routes: `/driver`, `/driver/odometer`, `/driver/trips`, `/driver/trips/new`, `/driver/expenses`, `/driver/expenses/new`, `/driver/status`, all under `RequirePermission(logs.submit)`. Tabs become `NavLink`s (`end` on Home; Trips/Expenses active for their sub-routes). Home buttons become links (`buttonClass`), drop the "coming soon" line. Placeholder pages for routes later tasks fill (title only). `renderApp` accepts router state if needed for the notice test.
- [ ] **Step 4: Run, expect PASS** — `npm run check`.
- [ ] **Step 5: Commit** — "Add driver routes, tab navigation and driver API module".

### Task 2: Log odometer

**Files:** Create `frontend/src/pages/driver/Odometer.tsx`, `frontend/src/pages/driver/Odometer.test.tsx`.

**Interfaces:** Consumes `getReadings`, `addReading`, `DriverPage`, `useMyVehicleGate`, `formatDistance`, `parseServerTime`.

- [ ] **Step 1: Write failing tests**
  - shows the latest reading `16,000 km` and the last 5 readings with dates;
  - entering `15000` shows `Can't be lower than your last reading (16,000 km).` and does not POST;
  - entering `16500` and tapping `Save reading` POSTs `{ reading: 16500 }`, then lands on `/driver` showing `Reading saved`;
  - when the response has `new_alerts: 2`, the notice is `Reading saved. 2 new maintenance alerts.`;
  - entering `160000` shows a confirm step `That's 144,000 km more than last time. Is it correct?` with `Yes, save` / `Change it`; only `Yes, save` POSTs;
  - a server 400 shows its `message`; a network failure shows `Can't reach the server.` and keeps the typed value;
  - the button is disabled while saving (second click → still one POST).
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement.** Large numeric input (`text-3xl num`, `inputMode="numeric"`, unit suffix). On success invalidate `['odometer-readings']`, `['maintenance-status']`, `['maintenance-evaluate']`, `['my-vehicle']`. Confirm threshold 5,000 in the org's unit. No readings yet → any value ≥ 0 allowed, copy "First reading for this vehicle".
- [ ] **Step 4: Run, expect PASS** — `npm run check`.
- [ ] **Step 5: Commit** — "Let drivers log odometer readings".

### Task 3: Trips

**Files:** Create `frontend/src/pages/driver/Trips.tsx`, `frontend/src/pages/driver/NewTrip.tsx`, `frontend/src/pages/driver/Trips.test.tsx`.

**Interfaces:** Consumes `getTrips`, `createTrip`, `departTrip`, `arriveTrip`, `dates.ts`.

- [ ] **Step 1: Write failing tests**
  - list groups: **On the road** (departed, not arrived) first with `Mark arrived`; **Planned** (not departed) with `Mark departed`; **Done** (arrived) last, showing depart/arrive times;
  - `Mark departed` sends `PUT /api/trips/3/depart` and the trip moves to On the road after refetch; a 400 shows the server message on that trip card;
  - New trip form: date defaults to today (`todayLocal()`), pickup place, pickup address, destination required (`Enter the pickup place` etc.), optional time (`<input type="time">`); submit POSTs `{ trip_date, pickup_location, pickup_address, destination, scheduled_time }` (`scheduled_time` omitted when empty) and returns to `/driver/trips` with notice `Trip added`;
  - empty list shows `No trips yet` with a `+ New trip` button.
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement.** One trip card per trip: destination as title, pickup below, date + scheduled time, a status word (`Planned` / `On the road` / `Done`) in neutral text (these are not maintenance statuses, so no red/amber/green). The one action button per card is full width. While a trip is On the road, its `Mark arrived` is the only primary (cobalt) button; Planned trips' `Mark departed` buttons are secondary (the API still allows departing them).
- [ ] **Step 4: Run, expect PASS** — `npm run check`.
- [ ] **Step 5: Commit** — "Let drivers add and run trips".

### Task 4: Expenses with camera photos

**Files:** Create `frontend/src/lib/image.ts`, `frontend/src/lib/image.test.ts`, `frontend/src/components/PhotoField.tsx`, `frontend/src/pages/driver/Expenses.tsx`, `frontend/src/pages/driver/NewExpense.tsx`, `frontend/src/pages/driver/Expenses.test.tsx`.

**Interfaces:**
- Produces (`lib/image.ts`): `fitWithin(w: number, h: number, max = 1600): { width: number; height: number }`; `prepareUpload(file: File): Promise<File>` — rejects (throws `Error` with copy) types other than JPG/PNG, tries canvas resize to ≤1600px JPEG quality 0.8, falls back to the original when decoding fails, throws `Photo is too big (max 10 MB).` if the result is over 10 MB.
- Produces (`PhotoField`): `PhotoField({ label, value: File | null, onChange(file|null), error? })` — `<input type="file" accept="image/jpeg,image/png" capture="environment">` behind a large `Take photo` button; after choosing, a thumbnail (object URL, revoked on change/unmount) with `Retake`.
- Consumes: `createExpense`, `getExpenses`, `getMaintenanceStatus` (task choices: unique `schedule_id` + `task` rows for this vehicle, urgent ones first), `formatMoney`, `dates.ts`.

- [ ] **Step 1: Write failing tests**
  - `image.test.ts`: `fitWithin(4000, 3000)` → `{ width: 1600, height: 1200 }`; `fitWithin(800, 600)` unchanged; `prepareUpload` of a `text/plain` file throws `Use a JPG or PNG photo.`; in jsdom (no canvas decode) a small JPEG file is returned unchanged.
  - Expenses list: rows show date (`formatDateOnly`), category, amount (`₱3,500.00`), linked task name when `schedule_id` matches a status row, and a `Receipt` link to `/api/expenses/1/photos/receipt`; empty → `No expenses yet`.
  - New expense: category chips `Fuel`, `Maintenance`, `Parts`, `Toll`, `Parking`, `Other` (Other reveals a text field); amount required and > 0; both photos required (`Take a photo of the work` / `Take a photo of the receipt`); picking a maintenance task sets category to `Maintenance`; submit sends `POST /api/expenses` with a `FormData` holding `expense_date`, `category`, `amount`, `notes`, `schedule_id` (only when chosen), `process_photo`, `receipt_photo`; success → `/driver` with notice `Expense saved`, and the `maintenance-status` query is invalidated when a task was linked;
  - a network failure shows `Upload failed. Check your signal and tap Save again.` and both thumbnails are still shown; a second tap re-sends;
  - the Save button shows `Uploading…` and is disabled while sending.
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement.** `mockFetch` passes `FormData` bodies through untouched (already true: only strings are parsed) — assert with `body instanceof FormData`. Amount field: currency symbol prefix from the org, `inputMode="decimal"`, two decimals max. Date defaults to `todayLocal()`, `max` = today. The task select is labelled `For a maintenance task? (optional)`.
- [ ] **Step 4: Run, expect PASS** — `npm run check`.
- [ ] **Step 5: Commit** — "Let drivers submit expenses with photos".

### Task 5: Maintenance status page

**Files:** Create `frontend/src/pages/driver/Status.tsx`, `frontend/src/pages/driver/Status.test.tsx`; modify `frontend/src/pages/driver/Home.tsx` (the due card gets `See all` → `/driver/status`).

**Interfaces:** Consumes `getMaintenanceStatus`, `evaluateMaintenance` (same query keys as Home), `StatusBadge`, `formatDistance`, `dates.ts`.

- [ ] **Step 1: Write failing tests**
  - every task is listed, sorted Overdue/Replace → Warning → No Data → Good, each with `StatusBadge`;
  - each row shows `X km since last service` and `Last done Nov 1` when known, `Never done` when `last_service_date` is null;
  - summary line: `2 overdue · 1 due soon · 3 good`;
  - error → `RetryAlert`; Home's due card links `See all` to `/driver/status`.
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run, expect PASS** — `npm run check`.
- [ ] **Step 5: Commit** — "Add the driver maintenance status page".

### Task 6: Real-API run, screenshots, docs

- [ ] Build; with the API running, as `driver1@northwind.demo` at 390px: log a reading (and the >5,000 confirm), add + depart + arrive a trip, submit an expense with two real JPGs linked to a task and see that task's alert clear on the admin dashboard; as `driver3@northwind.demo` see "No vehicle assigned yet" on each page. Screenshots of each page at 390px; fix what they show.
- [ ] Run the Impeccable detector over changed UI files; fix findings.
- [ ] README status line: Milestone B done. Commit — "Document Milestone B".
- [ ] Final whole-branch review (fresh reviewer, most capable model), one fix pass, then finishing-a-development-branch.
