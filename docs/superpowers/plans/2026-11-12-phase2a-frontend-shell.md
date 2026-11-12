# Phase 2 · Milestone A — React Working Shell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A working React + TypeScript front end where users can sign up or log in and see real data on the admin dashboard and the driver home screen.

**Architecture:** A Vite app in `frontend/` talks to the Phase 1 API through one fetch wrapper (cookies included, errors mapped to `ApiError`, 401 → logout). A session context loads `GET /api/auth/me`; route guards use the returned `permissions`. In development Vite proxies `/api` to the API; the API can also serve the built app with an `index.html` fallback.

**Tech Stack:** Vite 5.4.11, React 18.3.1, TypeScript 5.6, Tailwind CSS 3.4, React Router 6.28, TanStack Query 5.60, React Hook Form 7.53 + Zod 3.23 + @hookform/resolvers 3.9, Vitest 2.1 + @testing-library/react 16 + jsdom 25.

**Spec:** `docs/superpowers/specs/2026-11-12-react-frontend-design.md` (Milestone A) and parent `docs/superpowers/specs/2026-11-12-fleet-platform-design.md` §5.

## Global Constraints

- Style A: page background `bg-slate-100`, white cards `bg-white border border-slate-200 rounded-lg`, primary `blue-700` (hover `blue-800`), active nav `bg-blue-50 text-blue-700`. Red/amber/green **only** for maintenance status: Overdue & Replace → red (`bg-red-100 text-red-700`), Warning → amber (`bg-amber-100 text-amber-700`), Good → green (`bg-green-100 text-green-700`), No Data → slate.
- TypeScript `strict: true`. API types keep the API's snake_case field names (no case conversion layer).
- Every request: `credentials: 'include'`, JSON. Guards check `permissions`, never role names.
- Money via `Intl.NumberFormat(undefined, { style: 'currency', currency })`; distances as `"16,000 km"` / `"mi"` from the session's organization.
- No Co-Authored-By/AI attribution in commits. Work on local branch `phase2a-frontend`; never push.
- Never touch the `Starqueen_PMTS` database.

## Review Focus

1. **Session revoked or expired while a page is open** (any API call returns 401) → session cleared and user sent to `/login`, not an error screen. Test: Task 2 `apiFetch calls unauthorized handler on 401` + Task 3 `401 during a page sends user to login`.
2. **Driver with no assigned vehicle** (`/api/vehicles/mine` 404) → home shows "No vehicle assigned yet", no crash. Test: Task 6 `shows no-vehicle message`.
3. **Account with `must_change_password`** → every route redirects to `/change-password` until changed. Test: Task 3 `must-change user is redirected to change password`.
4. **Wrong-area URLs** (driver opens `/admin`, owner opens `/driver`) → redirected to their own area. Test: Task 3 `driver visiting /admin lands on /driver`.
5. **Brand-new organization with zero vehicles** → dashboard shows an empty state with zeros. Test: Task 5 `empty organization shows empty state`.

---

## File Structure

```
frontend/
  package.json, vite.config.ts, tsconfig.json, tailwind.config.js, postcss.config.js, index.html
  src/
    main.tsx                  React root: QueryClientProvider + BrowserRouter + SessionProvider + AppRoutes
    index.css                 Tailwind directives
    test/setup.ts             jest-dom matchers; test/mockFetch.ts  fetch stub by "METHOD /path"
    api/client.ts             apiFetch, ApiError, setUnauthorizedHandler
    api/types.ts              Session, FleetOverviewRow, MaintenanceStatusRow, NotificationItem, Vehicle, MonthlyExpenseRow
    api/auth.ts, api/fleet.ts resource functions
    lib/format.ts             formatMoney, formatDistance, statusTone
    auth/SessionProvider.tsx  useSession
    auth/guards.tsx           RequireAuth, RequirePermission, homePathFor
    routes.tsx                AppRoutes
    components/ui.tsx         Button, Card, Input, Field, Badge, StatusBadge, Alert, Spinner
    layouts/PublicLayout.tsx, AdminLayout.tsx, DriverLayout.tsx
    pages/public/Landing.tsx, Login.tsx, Signup.tsx, ChangePassword.tsx
    pages/admin/Dashboard.tsx
    pages/driver/Home.tsx
backend/starqueenAPI/Program.cs  SPA fallback to index.html
```

---

### Task 1: Scaffold the app

**Files:** Create everything under `frontend/` listed above except `src/api`, `src/auth`, `src/pages`, `src/layouts`, `src/components`; `src/App.test.tsx`.

**Interfaces:**
- Produces: `npm test` (= `vitest run`), `npm run dev` (port 5173, proxy `/api` → `https://localhost:7273` with `secure: false`), `npm run build` (→ `frontend/dist`), test setup with `@testing-library/jest-dom`; `src/test/mockFetch.ts`: `mockFetch(routes: Record<string, (body: unknown) => { status?: number; json?: unknown }>): void` stubbing `globalThis.fetch`, keyed `"GET /api/auth/me"`; unknown routes return 404.

- [ ] **Step 1:** Create `frontend/` with `npm create vite@5.4.1 frontend -- --template react-ts` (or equivalent files), add the pinned dependencies from the header, Tailwind config with `content: ['./index.html','./src/**/*.{ts,tsx}']`, `vite.config.ts` with the proxy and `test: { environment: 'jsdom', setupFiles: './src/test/setup.ts', globals: true }`. Add `frontend/node_modules` and `frontend/dist` to `.gitignore`.
- [ ] **Step 2: Write the failing test** `src/App.test.tsx`: `it('renders the brand on the landing page')` renders `<AppRoutes/>` inside the providers at `/` and expects text `FleetPMTS`.
- [ ] **Step 3:** `npm test` → FAIL (AppRoutes missing). Create a temporary `routes.tsx` exporting `AppRoutes` that renders `<h1>FleetPMTS</h1>` at `/`.
- [ ] **Step 4:** `npm test` → PASS; `npm run build` → succeeds.
- [ ] **Step 5: Commit** `Scaffold React front end (Vite, Tailwind, Vitest)`.

---

### Task 2: API client and types

**Files:** Create `src/api/client.ts`, `src/api/types.ts`, `src/api/auth.ts`, `src/api/fleet.ts`, `src/lib/format.ts`; tests `src/api/client.test.ts`, `src/lib/format.test.ts`.

**Interfaces:**
- Produces:
  - `class ApiError extends Error { status: number }` (message = server `message`, else `title`, else `"Request failed (<status>)"`; network failure → status 0, message `"Can't reach the server."`).
  - `apiFetch<T>(path: string, init?: RequestInit & { json?: unknown }): Promise<T>` — sets `credentials: 'include'`, JSON body/header when `json` given, returns `undefined as T` for 204.
  - `setUnauthorizedHandler(fn: () => void): void` — called on any 401 **except** paths starting `/api/auth/login` or `/api/auth/signup`.
  - `types.ts`: `Session { user: { id: number; full_name: string; email: string; role: string; must_change_password: boolean }; organization: { id: number; name: string; currency_code: string; distance_unit: 'km' | 'mi' }; permissions: string[] }`; `FleetOverviewRow`, `MaintenanceStatusRow`, `NotificationItem`, `Vehicle`, `MonthlyExpenseRow` with the API's snake_case fields (see `backend/starqueen/Models/Reports.cs`, `DriverLogs.cs`, `Vehicle.cs`).
  - `auth.ts`: `getMe(): Promise<Session>`, `login(email, password): Promise<Session>` (throws `ApiError(401, message)` when the body has `success: false`), `signup(input: SignupInput): Promise<Session>`, `logout(): Promise<void>`, `changePassword(current_password, new_password): Promise<void>`. `SignupInput { organization_name; owner_name; email; password; currency_code; distance_unit; template_categories: string[] }`.
  - `fleet.ts`: `getFleetOverview()`, `getMaintenanceStatus()`, `evaluateMaintenance(): Promise<{ new_alerts: number }>`, `getNotifications(unreadOnly: boolean)`, `getMonthlyExpenses(year: number)`, `getMyVehicle(): Promise<Vehicle | null>` (404 → null).
  - `format.ts`: `formatMoney(amount: number, currency: string): string`, `formatDistance(value: number | null, unit: string): string` (`null` → `"—"`), `statusTone(status: string): 'red' | 'amber' | 'green' | 'slate'`.

- [ ] **Step 1: Write the failing tests**
  - `apiFetch returns parsed JSON and sends credentials` (assert `fetch` called with `credentials: 'include'`).
  - `apiFetch throws ApiError with server message` (`{status:409,json:{message:'Email is already registered.'}}` → `.status 409`, `.message` equal).
  - `apiFetch calls unauthorized handler on 401` (handler spy called once for `/api/vehicles`; **not** called for `/api/auth/login`).
  - `network failure becomes ApiError status 0`.
  - `login throws when success is false`.
  - `getMyVehicle returns null on 404`.
  - format: `formatDistance(16000,'km') === '16,000 km'`, `formatDistance(null,'km') === '—'`, `statusTone('Replace') === 'red'`, `statusTone('No Data') === 'slate'`.
- [ ] **Step 2:** `npm test` → FAIL. **Step 3:** implement. **Step 4:** `npm test` → PASS.
- [ ] **Step 5: Commit** `Add typed API client with error and 401 handling`.

---

### Task 3: Session, guards, routes

**Files:** Create `src/auth/SessionProvider.tsx`, `src/auth/guards.tsx`; replace `src/routes.tsx`; test `src/auth/guards.test.tsx`.

**Interfaces:**
- Consumes: Task 2 `auth.ts`, `setUnauthorizedHandler`.
- Produces:
  - `useSession(): { status: 'loading' | 'anonymous' | 'authenticated'; session: Session | null; login(email: string, password: string): Promise<Session>; signup(input: SignupInput): Promise<Session>; logout(): Promise<void>; refresh(): Promise<void> }`. On mount calls `getMe()` (401 → anonymous). Registers `setUnauthorizedHandler` that sets anonymous, clears the query cache and navigates to `/login`.
  - `homePathFor(session: Session): string` → `'/change-password'` if `must_change_password`; `'/admin'` if permissions include `reports.view`; `'/driver'` if `logs.submit`; else `'/login'`.
  - `<RequireAuth>` (anonymous → `/login`; must-change → `/change-password` unless already there), `<RequirePermission permission="…">` (missing → `homePathFor`).
  - Routes: `/` Landing, `/login`, `/signup`, `/change-password` (auth), `/admin` (`reports.view`, AdminLayout → Dashboard), `/driver` (`logs.submit`, DriverLayout → Home), `*` → `/`. Logged-in users opening `/login` or `/signup` go to `homePathFor`. (Pages may be placeholders until Tasks 4–6.)

- [ ] **Step 1: Write the failing tests** (render `AppRoutes` at a path with `mockFetch`):
  - `anonymous user opening /admin is sent to /login`.
  - `owner after login lands on /admin` and `driver lands on /driver`.
  - `driver visiting /admin lands on /driver`.
  - `must-change user is redirected to change password` (from `/admin`).
  - `401 during a page sends user to login` (`/api/auth/me` OK, then a page query returns 401 → login screen shown).
- [ ] **Step 2:** FAIL. **Step 3:** implement. **Step 4:** PASS.
- [ ] **Step 5: Commit** `Add session context, permission guards and routes`.

---

### Task 4: UI kit and public pages

**Files:** Create `src/components/ui.tsx`, `src/layouts/PublicLayout.tsx`, `src/pages/public/{Landing,Login,Signup,ChangePassword}.tsx`; test `src/pages/public/public.test.tsx`.

**Interfaces:**
- Produces: `Button({ variant?: 'primary' | 'secondary' | 'ghost'; loading?: boolean, ...button props })`, `Card`, `Input` (forwardRef), `Field({ label, error, children })`, `Badge({ tone })`, `StatusBadge({ status })` (uses `statusTone`), `Alert({ tone: 'error' | 'info' | 'success', children })`, `Spinner`.
- Page copy (from the approved mockups): Landing headline **"Never miss a maintenance date again."**, buttons **"Start free"** → `/signup` and **"Try the demo"** → `/login`, three feature cards (Alerts / Driver app / Your data). Login title **"Welcome back"**, demo hint `Demo: owner@northwind.demo / Demo1234!`. Signup fields: organization name, your name, email, password (min 8), currency (`PHP` default, `USD`, `EUR`), distance unit (`km`/`mi`), vehicle types checkboxes `Truck`, `Van & Car`, `Motorcycle` (Truck checked). Change password: current, new (min 8), confirm (must match).
- Forms use React Hook Form + Zod; server errors (`ApiError.message`) show in an `Alert`.

- [ ] **Step 1: Write the failing tests**
  - `landing shows headline and links to signup and login`.
  - `login shows server error on bad credentials` (login → `{success:false,message:'Invalid email or password'}` → text visible).
  - `login success navigates to the user home`.
  - `signup validates password length` (7 chars → "at least 8" error, no fetch).
  - `signup shows 409 message` (`Email is already registered.`).
  - `change password requires matching confirmation`.
- [ ] **Step 2:** FAIL. **Step 3:** implement. **Step 4:** PASS.
- [ ] **Step 5: Commit** `Add UI kit and landing, login, sign-up, change-password pages`.

---

### Task 5: Admin layout and dashboard

**Files:** Create `src/layouts/AdminLayout.tsx`, `src/pages/admin/Dashboard.tsx`; test `src/pages/admin/Dashboard.test.tsx`.

**Interfaces:**
- Consumes: Task 2 `fleet.ts`, `format.ts`; Task 4 UI kit; `useSession`.
- Produces:
  - AdminLayout: sidebar (organization name, nav Dashboard active; Vehicles, Drivers, Maintenance, Trips, Expenses, Reports shown but marked "Soon"; Admins only with `admins.manage`, Settings only with `org.manage`), user name + Log out at the bottom; on screens < `md` the sidebar becomes a top bar with a menu button toggling it.
  - Dashboard: on mount `evaluateMaintenance()` then queries fleet overview, maintenance status, notifications (unread), monthly expenses (current year). Greeting `Good morning|afternoon|evening, <first name>`. Tiles: **Vehicles** (= fleet rows), **Overdue** (= status rows with `Overdue` or `Replace`), **Due soon** (`Warning`), **Spent this month** (sum of `total` for the current month, `formatMoney`). "Needs attention": status rows not `Good`/`No Data`, worst first (Overdue, Replace, Warning), each `vehicle plate · task` + `StatusBadge`, max 8. "Latest alerts": newest 5 notifications (message + relative date). Empty org: tiles show 0 and a card "No vehicles yet" (adding vehicles comes in Milestone C).

- [ ] **Step 1: Write the failing tests**
  - `shows summary tiles from API data` (2 vehicles, statuses [Overdue, Replace, Warning, Good] → Overdue tile `2`, Due soon `1`).
  - `lists needs-attention items worst first`.
  - `calls evaluate on load` (fetch called with `POST /api/maintenance/evaluate`).
  - `empty organization shows empty state`.
  - `hides Admins and Settings without permissions` (admin session lacks `admins.manage`).
  - `log out returns to the landing page`.
- [ ] **Step 2:** FAIL. **Step 3:** implement. **Step 4:** PASS.
- [ ] **Step 5: Commit** `Add admin layout and dashboard`.

---

### Task 6: Driver layout and home

**Files:** Create `src/layouts/DriverLayout.tsx`, `src/pages/driver/Home.tsx`; test `src/pages/driver/Home.test.tsx`.

**Interfaces:**
- Consumes: `getMyVehicle`, `getMaintenanceStatus`, `evaluateMaintenance`, UI kit, `useSession`.
- Produces:
  - DriverLayout: phone-first column (max width `max-w-md`, centered on desktop), top bar with organization name + Log out, bottom tab bar Home (active), Trips, Expenses, Status (latter three disabled, "Soon").
  - Home: `Hi <first name> 👋`; vehicle card (name, plate, latest reading via `formatDistance` of the max `current_reading`); due card listing non-Good tasks (red when any Overdue/Replace, amber when only Warning, green "All maintenance is up to date" otherwise); buttons **+ Log odometer**, **▶ Start trip**, **₱/$ Add expense** (currency symbol from org) rendered disabled with "Coming soon". No vehicle (null) → card "No vehicle assigned yet. Ask your admin to assign one." and no buttons.

- [ ] **Step 1: Write the failing tests**
  - `shows assigned vehicle and latest reading` (`16,000 km`).
  - `lists overdue tasks in red card`.
  - `all good shows up-to-date message`.
  - `shows no-vehicle message` (`/api/vehicles/mine` → 404).
- [ ] **Step 2:** FAIL. **Step 3:** implement. **Step 4:** PASS.
- [ ] **Step 5: Commit** `Add driver layout and home screen`.

---

### Task 7: Serve the app from the API + docs

**Files:** Modify `backend/starqueenAPI/Program.cs`, `backend/starqueenAPI/appsettings.json` (`FrontEndPath` → `../../frontend/dist`), `README.md`; test `backend/starqueen.Tests/FrontEndHostingTests.cs`.

**Interfaces:**
- Produces: when the front-end folder exists, non-`/api` GET requests with no matching file return its `index.html` (SPA fallback via `MapFallbackToFile("index.html", new StaticFileOptions { FileProvider = webFiles })`); `/api/*` unknown routes are never answered with HTML.

- [ ] **Step 1: Write the failing tests** (ApiFactory variant setting `FrontEndPath` to a temp folder with `index.html` containing `SPA-OK`):
  - `ClientRoute_ServesIndexHtml` (`GET /admin` → 200, body contains `SPA-OK`).
  - `UnknownApiRoute_IsNotHtml` (`GET /api/nope` → not 200 and body lacks `SPA-OK`).
- [ ] **Step 2:** `dotnet test backend/starqueen.Tests --filter FrontEndHostingTests` → FAIL. **Step 3:** implement. **Step 4:** full `dotnet test backend/starqueen.Tests` → PASS.
- [ ] **Step 5: Manual run:** `powershell -File database/setup.ps1`; API `dotnet run --launch-profile https`; `npm run dev` in `frontend/`; at `http://localhost:5173`: log in as `owner@northwind.demo` (dashboard shows 4 vehicles and alerts), as `driver1@northwind.demo` (Isuzu NWL-1001, overdue tasks), as `driver3@northwind.demo` (no-vehicle message); sign up a new org (empty dashboard); check a 390px-wide window. Then `npm run build` and open `https://localhost:7273/admin` (served by the API).
- [ ] **Step 6:** README: "Running the front end" section (dev and built modes). **Commit** `Serve the React app from the API and document front-end setup`.
