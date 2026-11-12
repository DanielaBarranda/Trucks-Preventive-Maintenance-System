# Phase 2 — React Front End — Design Spec

**Date:** 2026-11-12
**Status:** Draft for review
**Parent spec:** `2026-11-12-fleet-platform-design.md` (section 5). This document narrows it for building.

## 1. Goal

Replace the old `web/` pages with a React + TypeScript app that works with the Phase 1
API. **Working first, polish later**: the user wants to click through a real, working
interface soon. Visual refinement toward a more professional look is a later pass, and
the code is structured so that pass only touches styling.

**Success:** after Milestone A you can open the site, sign up or log in with the demo
accounts, and see real data on the admin dashboard and the driver home screen, on both
desktop and phone widths.

## 2. Look and feel (approved)

**Clean, modern minimal (replaced Style A after Milestone A):** warm neutral background
(`stone-50`), white surfaces with hairline `stone-200` borders, near-black text (`ink`).
One cobalt accent (`accent-600` #2F4FE0) for primary actions, focus, selection and the
active menu item or tab. Red / amber / green appear **only** for maintenance status
(Overdue / Warning / Good). Fonts: Inter for text, Inter Tight for headings and numbers
(tabular). Icons are inline SVG line icons. The approved mockups (landing, login, admin
dashboard, driver home, add expense) are the reference layouts.

## 3. Stack

| Need | Choice |
|---|---|
| Build | Vite 5 + React 18 + TypeScript (strict) |
| Styling | Tailwind CSS 3, with a small set of in-house UI components (`Button`, `Card`, `Input`, `Badge`, `Alert`) styled in the shadcn/ui manner |
| Server data | TanStack Query 5 (caching, loading/error states, refetch) |
| Routing | React Router 6 |
| Forms | React Hook Form + Zod |
| Charts | Recharts (Milestone C) |
| Tests | Vitest + React Testing Library, API calls mocked at the `fetch` boundary |

shadcn/ui itself is not pulled in now: the few components needed are written directly
with the same Tailwind conventions, so adopting shadcn later is a drop-in change.

## 4. Structure

```
frontend/
  src/
    api/          fetch wrapper (cookies, JSON, errors → ApiError), one file per resource, shared TS types
    auth/         session context: GET /api/auth/me, login, logout, signup, change password
    components/   UI building blocks (Button, Card, Input, Badge, StatusBadge, PageHeader…)
    layouts/      PublicLayout, AdminLayout (sidebar; menu button on phones), DriverLayout (bottom tabs)
    pages/        public/, admin/, driver/ — one file per screen
    routes.tsx    route table + guards
```

- **One API module** (`api/client.ts`) sends every request with `credentials: 'include'`,
  parses snake_case JSON into typed objects, and turns non-2xx responses into an
  `ApiError` carrying status and the server's `message`.
- **Session:** on load the app calls `GET /api/auth/me`. 401 → logged out.
  `must_change_password` → every route redirects to `/change-password`.
- **Route guards** use the `permissions` list from the API (never role names):
  admin pages need `reports.view`; driver pages need `logs.submit`; Admins page needs
  `admins.manage`; Settings needs `org.manage`. After login, users land on the area
  their permissions allow.
- **Any 401** from the API (expired or revoked session) clears the session and sends the
  user to `/login`.
- Distances are labeled with the organization's unit and money with its currency
  (`Intl.NumberFormat`), both from the session.

## 5. Running

- **Development:** `npm run dev` in `frontend/` (Vite on `http://localhost:5173`),
  proxying `/api` to `https://localhost:7273`, so the login cookie works unchanged.
- **Production / single app:** `npm run build` writes `frontend/dist`. The API serves
  that folder (`FrontEndPath` → `../../frontend/dist`) and falls back to `index.html`
  for client-side routes such as `/admin/vehicles`.
- The old `web/` folder is deleted at the end of Milestone C.

## 6. Milestones (each gets its own plan)

**A — Working shell (first):**
- Public: landing page, log in, sign up (organization + owner + template categories),
  change password (forced when `must_change_password`).
- Admin layout + **dashboard**: summary numbers (vehicles, overdue, due soon, spent this
  month) from `/api/reports/fleet-overview` and `/api/maintenance/status`, a "Needs
  attention" list, and a list of the latest notifications. The dashboard calls
  `POST /api/maintenance/evaluate` on load.
- Driver layout + **home**: assigned vehicle, latest reading, overdue/due tasks, and
  buttons for the Milestone B actions (disabled with "coming soon" until then).
  A driver with no vehicle sees a clear "No vehicle assigned yet" message.
- Logout; responsive at phone widths.

**B — Driver actions:** log odometer, trips (start / depart / arrive), add expense with
camera photos and optional maintenance task, maintenance status list.

**C — Admin management:** vehicles (add/edit, assign driver, record service), drivers,
admins (Owner), maintenance schedules and vehicle types, alerts inbox, expenses (with
photo viewer and charts), trips, reports, organization settings. Then serve the build
from the API and delete `web/`.

## 7. Error handling

- Loading: skeleton or spinner per section, never a blank page.
- API errors show the server's `message` in an inline alert or form error.
- Network failure shows "Can't reach the server" with a retry button.

## 8. Testing

- Unit/component tests (Vitest + RTL) for: the API client (error mapping, 401 handling),
  session/guards (redirects per permission and must-change state), and each page's
  main states (loading, data, error, empty).
- Each milestone ends with a manual run against the real API using the demo accounts,
  at desktop and phone widths.

## 9. Out of scope (for now)

Professional visual polish pass (later), dark mode, offline mode, push notifications,
translations, a separate deployment.
