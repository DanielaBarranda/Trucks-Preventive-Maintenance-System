# Fleet Maintenance Platform — Design Spec

**Date:** 2026-11-12
**Status:** Draft for review
**Working name:** FleetPMTS (placeholder — final name and GitHub repo rename decided later)

## 1. Goal

Turn StarQueen PMTS — a truck maintenance tracker built for one company — into a
**general, multi-organization fleet maintenance platform** that any business with
vehicles and drivers can sign up for and use. Same core functionality, generalized.

**Audience:** both real daily use and a portfolio showcase. It must be reliable and
secure for real fleets, and polished enough to present.

**Target users:** businesses that run vehicles and drivers (logistics, delivery,
rentals, schools, construction). Not individual car owners.

**Success criteria**
- A new company can sign up, configure settings, add admins, drivers and vehicles,
  and start logging — without help.
- One organization can never see or change another organization's data
  (proven by automated tests).
- Drivers can do everything they need on a phone; admins on desktop or phone.
- Anyone can clone the repo, run two SQL scripts and `dotnet run`, and log in with
  documented demo accounts.

## 2. Decisions

| Topic | Decision |
|---|---|
| Tenancy | Multiple organizations, self-service sign-up |
| Vehicles | General vehicles ("Truck" → "Vehicle" everywhere); vehicle types editable per org |
| Roles | Owner, Admin, Driver (fixed), mapped to permissions in code (RBAC) |
| Who creates accounts | Owner creates Admins; Owner/Admin create Drivers with a temporary password; forced password change on first login |
| Vehicle assignment | One driver ↔ one vehicle at a time; admins can reassign; every log records vehicle **and** driver account |
| Maintenance schedules | New orgs get editable copies of default templates (by vehicle category) |
| Currency / units | Per-organization setting (default ₱ and km) |
| Isolation | One database, shared tables, `organization_id` on every tenant row, enforced by SQL Server Row-Level Security |
| Existing data | New database seeded with demo data only. **The original `Starqueen_PMTS` database is never modified or deleted.** |
| Front end | React + TypeScript redesign with landing page; driver side mobile-first, admin side desktop-first and fully responsive |

## 3. Database (new database, placeholder name `FleetPMTS_Dev`)

The original `Starqueen_PMTS` LocalDB stays untouched as an archive. The old project
(`c:\REPOSITORIES\StarQueen`) still points at it.

### 3.1 Tables

| Table | Key columns | Notes |
|---|---|---|
| `Organizations` | id, name, currency_code, distance_unit (`km`/`mi`), created_at | One row per company |
| `Users` | id, organization_id, full_name, email (globally unique), password_hash, role (`Owner`/`Admin`/`Driver`), must_change_password, is_active, created_at | Exactly one Owner per org |
| `VehicleTypes` | id, organization_id, name | Editable per org (e.g. "10-Wheeler", "Van") |
| `Vehicles` | id, organization_id, name, plate_number (unique per org), vehicle_type_id, assigned_driver_id (nullable, unique when not null), is_active | Replaces `Trucks` |
| `ScheduleTemplates` | id, category (`Truck`/`Van & Car`/`Motorcycle`), task, km_warning, km_replace, km_overdue, month_interval | Global, read-only; no organization_id |
| `MaintenanceSchedules` | id, organization_id, vehicle_type_id, task, km_warning, km_replace, km_overdue, month_interval | Replaces `Maintenance_Reference` |
| `OdometerReadings` | id, organization_id, vehicle_id, driver_id, reading, recorded_at | |
| `Trips` | id, organization_id, vehicle_id, driver_id, trip_date, pickup_location, pickup_address, destination, scheduled_time, departed_at, arrived_at | Replaces `Truck_Activity`; generalized fields; driver is an account, not free text |
| `Expenses` | id, organization_id, vehicle_id, driver_id, schedule_id (nullable), expense_date, category, amount, notes, process_photo, receipt_photo | Photos stored outside the public web root, per organization, and served only through an authorized endpoint |
| `MaintenanceLogs` | id, organization_id, vehicle_id, schedule_id, status (`Warning`/`Replace`/`Overdue`/`Done`), reading_at_log, resolved, resolved_at, created_by, created_at | Open alerts and service history (`Done` rows) |
| `Notifications` | id, organization_id, vehicle_id, maintenance_log_id, type (`Urgent`/`Warning`/`Information`), message, task, is_read, is_resolved, resolved_at, created_at | Replaces `Admin_Notifications` |

Dropped: `Truck_Notifications` (empty, unused).

Distances are stored in the organization's chosen unit; the UI labels them with it.

### 3.2 Reports (stored procedures)

The old database's 16 project procedures and 9 views overlap heavily (for example,
monthly min, max and total cost are three procedures) and one reads the dropped
`Truck_Notifications` table. They are consolidated into four report procedures that
return the same information, all covered by Row-Level Security:

| Procedure | Replaces | Returns per row |
|---|---|---|
| `rpt_FleetOverview` | dashboard overview, expense analysis | vehicle, latest reading, total/min/max/count of expenses, last expense date, open alerts, unread notifications, last trip |
| `rpt_MaintenanceStatus` | maintenance view, alert detection, overdue, good-status, total components, near-replacement, oldest components | vehicle × schedule: last service date/reading, distance and months since, status (`Good`/`Warning`/`Replace`/`Overdue`/`No Data`) |
| `rpt_MonthlyExpenses` | monthly total/min/max, yearly total | vehicle, year, month, total, min, max, count |
| `rpt_DriverActivity` | driver performance, first/last trip | driver, vehicle, trips, departures, arrivals, distinct destinations, expenses, first and last trip |

### 3.2.1 Maintenance status rules
- Thresholds (`km_warning`, `km_replace`, `km_overdue`, `month_interval`) are measured
  **since the last service**, not as absolute odometer values. The old app compared
  against absolute readings, so a vehicle stayed "overdue" forever after its first
  service.
- Last service = the latest `MaintenanceLogs` row with status `Done` for that vehicle
  and schedule (its reading and date). With no service yet: the vehicle's **first
  recorded odometer reading** and the vehicle's `created_at` (so a used vehicle added
  at 150,000 km is not overdue on day one). A service recorded without a reading uses
  the latest reading on or before the service date.
- Distance status: `Overdue` if distance ≥ km_overdue, else `Replace` if ≥ km_replace,
  else `Warning` if ≥ km_warning, else `Good`. With no odometer reading: `No Data`.
- Month status (when `month_interval` is set): whole months since last service ≥
  interval + 1 → `Overdue`; ≥ interval → `Replace`; ≥ 80% of interval (rounded down)
  → `Warning`. The worse of distance and month status wins.
- A service is recorded either by an admin (`POST /api/vehicles/{id}/services`) or by
  a driver's expense linked to a schedule (`Expenses.schedule_id`). Recording a
  service resolves that schedule's open alerts. No more guessing from free-text
  expense categories.
- Template thresholds are stored in km; when an organization uses miles, sign-up
  converts them (× 0.621371, rounded to the nearest 100).
- The distance unit can only be changed before any odometer readings exist; changing
  it converts the organization's schedule thresholds the same way.

### 3.3 Tenant isolation (Row-Level Security)

- An inline predicate function returns rows only where
  `organization_id = CAST(SESSION_CONTEXT(N'organization_id') AS int)`.
- A security policy applies it as a FILTER and BLOCK predicate to every tenant table.
- The API sets `SESSION_CONTEXT('organization_id')` (read-only for the session) every
  time it opens a connection for a logged-in request.
- **Pre-login path:** login (find user by email) and sign-up (create org + owner)
  run before an organization is known. They go through two narrow stored procedures
  (`auth_FindUserByEmail`, `auth_CreateOrganization`) declared
  `WITH EXECUTE AS` a dedicated database user (`rls_auth`) that owns no login. The
  predicate function also allows rows when `USER_NAME() = 'rls_auth'`, so only code
  running inside those two procedures can see across organizations. No other code
  path bypasses isolation.

### 3.4 Scripts (committed to the repo)

- `database/schema.sql` — creates the database objects, RLS policy, and templates.
- `database/seed.sql` — two demo organizations (to prove separation), demo vehicles,
  logs and expenses, and documented demo logins. No real StarQueen data.
- The README documents: create database → run schema → run seed → `dotnet run`.

## 4. Backend (ASP.NET Core 8 API)

Builds on the current code (Dapper, DI, cookie auth, hashing, upload validation,
transactions, error handling).

### 4.1 Auth and organization context
- Login: email + password → HttpOnly, SameSite=Strict cookie containing user id,
  organization id, role. Unchanged security settings.
- The connection factory sets `SESSION_CONTEXT` from the cookie's organization id.
- Accounts with `must_change_password` can call only change-password and logout until
  they change it.
- Deactivated users (`is_active = 0`) cannot log in.

### 4.2 Permissions (RBAC)

| Permission | Owner | Admin | Driver |
|---|:-:|:-:|:-:|
| `org.manage` | ✅ | | |
| `admins.manage` | ✅ | | |
| `drivers.manage` | ✅ | ✅ | |
| `vehicles.manage` | ✅ | ✅ | |
| `schedules.manage` | ✅ | ✅ | |
| `reports.view` | ✅ | ✅ | |
| `alerts.manage` | ✅ | ✅ | |
| `logs.submit` | | | ✅ (assigned vehicle only) |

The role → permission map lives in one place in code. Endpoints use
`[Authorize(Policy = "<permission>")]`. Drivers' `logs.submit` endpoints also check
that the vehicle is their assigned vehicle.

### 4.3 Endpoints (new or changed)
- `POST /api/auth/signup` — creates organization, Owner, default vehicle types and
  schedules from selected template categories.
- `POST /api/auth/login`, `logout`, `change-password`, `GET /api/auth/me` (adds
  organization info and permissions).
- `/api/admins` (Owner), `/api/drivers` (Owner/Admin): list, create (temporary
  password), update, deactivate, reset password.
- `/api/vehicles` CRUD + `PUT /api/vehicles/{id}/assign`.
- `/api/vehicle-types`, `/api/schedules` CRUD.
- `/api/organization` GET/PUT (Owner).
- Existing log, expense, notification and report endpoints renamed to the new
  resources and made organization-aware.

### 4.4 Testing
- New xUnit test project running against a real test database created from
  `schema.sql`.
- Required tests: cross-organization isolation (read and write) for every tenant
  table; each permission per role; driver limited to own vehicle; sign-up creates a
  working organization; forced password change.

## 5. Front end (React + TypeScript)

### 5.1 Stack
Vite, React, TypeScript, Tailwind CSS, shadcn/ui, TanStack Query, React Hook Form +
Zod, React Router, Recharts. Lives in `frontend/`.

### 5.2 Pages
- **Public:** Landing page, Log in, Sign up (create organization), Change password.
- **Owner/Admin:** Dashboard, Vehicles (with assignment), Drivers, Admins (Owner
  only), Maintenance (alerts + schedules), Expenses (with charts), Trips, Alerts,
  Organization settings, Profile.
- **Driver (mobile-first, bottom navigation):** Home (my vehicle status), Log
  odometer, Trips, Submit expense (camera upload), Maintenance status.

Navigation and buttons are shown or hidden from the permissions returned by
`/api/auth/me`; the server still enforces every permission.

### 5.3 Look and feel
Clean, professional: neutral base, one brand accent, status colors (green Good,
amber Warning, red Overdue), light and dark mode. Mockups are shown for approval
before building pages.

### 5.4 Running
- Development: Vite dev server (`localhost:5173`) proxies `/api` to the API.
- Production: the React build is served by the API — one app, one address.
- The old `web/` folder is deleted once the React version reaches parity.

## 6. Phases

This is too large for one implementation plan. Each phase gets its own plan:

1. **Database + backend:** new schema with RLS, seed data, multi-tenant API, RBAC,
   sign-up and account management, isolation tests. The old `web/` front end is not
   updated in this phase, so it stops working once the API switches to the new
   database; during Phase 1 the app is used through Swagger and the tests. The
   last working version of the old front end stays available in git history.
2. **React front end:** setup, layout, auth pages and landing page first, then driver
   pages, then admin pages.
3. **Finalize:** README with screenshots and demo logins, remove `web/`, choose the
   name, rename the GitHub repo, optional deployment.

## 7. Out of scope (v1)
Billing and subscription plans, email invitations or password-reset emails, custom
domains, platform-wide super-admin panel, custom roles, multiple vehicles per driver,
shift scheduling, importing the real StarQueen data.
