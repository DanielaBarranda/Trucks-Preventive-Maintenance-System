# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

**Primary: the fleet owner or admin** of a small-to-mid business that runs vehicles and drivers (logistics, delivery, rentals, schools, construction). They watch alerts, expenses and reports and decide what gets serviced, mostly at a desktop but also on a phone. When an admin need and a driver need conflict, the admin's wins.

**Secondary: the driver**, who logs odometer readings, trips and expenses (with photo proof) for the one vehicle assigned to them, from a phone, usually beside the vehicle.

Not for individual car owners.

The project also serves as a portfolio piece, so people evaluating the work are a real audience for the public pages and the demo accounts.

## Product Purpose

A preventive maintenance and tracking platform for any business with vehicles and drivers: trucks, vans, cars, motorcycles, buses. It began as StarQueen PMTS, a truck maintenance tracker for one company, and is being rebuilt as a general, multi-organization product.

Success means:

- A new company can sign up, configure settings, add admins, drivers and vehicles, and start logging without help.
- One organization can never see or change another organization's data.
- Drivers can do everything they need on a phone; admins on desktop or phone.
- Maintenance is caught before it becomes overdue.

## Positioning

**Simple for small fleets.** A small business can sign up and run its fleet without training, unlike heavy enterprise fleet software. Every screen should be judged against that claim.

## Operating Context

- **Admin side:** office desk first, phone second. The daily ritual is checking what needs attention (overdue and due-soon maintenance, new notifications, spend this month), then managing vehicles, drivers, schedules, expenses and reports.
- **Driver side:** a phone, beside or inside the vehicle. Confirmed conditions:
  - low-end Android phones (small screens, slow processors, limited storage);
  - outdoors in bright sun, often one-handed or with dirty hands;
  - patchy mobile data, where photo uploads can fail;
  - drivers are more comfortable in Tagalog/Taglish than formal English, so wording must be plain and short.
- **Photo proof:** drivers photograph the work in progress and the receipt for each expense.
- **Accounts:** the Owner signs up the organization and creates Admins; Owners and Admins create Drivers with a temporary password that must be changed at first login.
- **Defaults:** Philippine peso (₱) and kilometres, changeable per organization.

## Capabilities and Constraints

- **Roles:** Owner, Admin, Driver (fixed), mapped to permissions. The interface gates on permissions, never role names.
- **Vehicles:** one driver per vehicle at a time; admins reassign. The word is "vehicle" everywhere, never "truck".
- **Maintenance status:** Good, Warning, Replace, Overdue, No Data. Measured by distance and by months since the last service; the worse of the two wins.
- **Recording a service:** by an admin, or by a driver's expense linked to a maintenance task. Either clears that task's open alerts.
- **Schedules:** new organizations start from editable templates (Truck, Van & Car, Motorcycle); vehicle types are editable per organization.
- **Units and money:** distances are labelled with the organization's unit (km or mi) and money with its currency. The unit can only be changed before any odometer reading exists.
- **Photos:** JPG/PNG only, up to 10 MB each, stored privately per organization and shown only through an authorized endpoint.
- **Reports:** fleet overview, monthly expenses, driver activity, maintenance status per vehicle.
- **Stack already in place:** React 18 + TypeScript + Vite + Tailwind CSS 3 + TanStack Query + React Router + React Hook Form/Zod in `frontend/`; ASP.NET Core 8 API in `backend/`.
- **Build state:** sign-up, login, change password, admin dashboard and driver home work. Driver actions and admin management screens are still to be built.

**Undecided**

- Final product name and repository name.
- Whether the interface will be translated into Tagalog. Translations, dark mode, offline mode and push notifications are currently out of scope; the confirmed driver conditions (patchy data, Tagalog comfort) may reopen offline handling and translation.

## Brand Commitments

- **Name:** "FleetPMTS" is a placeholder. Do not build identity work that depends on it.
- **No StarQueen branding.** The product is general, not tied to the original company.
- **Voice:** plain, short, direct wording that a driver reading in a second language understands at a glance.
- No logo or other brand assets exist yet.

## Evidence on Hand

- Demo data only: two seeded demo organizations with vehicles, logs and expenses, and documented demo logins (`database/seed.sql`).
- Design specs: `docs/superpowers/specs/2026-11-12-fleet-platform-design.md` and `docs/superpowers/specs/2026-11-12-react-frontend-design.md`.
- There are **no** customers, testimonials, usage numbers, pricing, press or case studies. Future work must not invent any. The landing page's "Start free" is existing copy; no pricing model has been decided.
- The original StarQueen database holds real company data and is never used, shown, modified or deleted.

## Product Principles

1. **No training needed.** If a small-business owner or a driver needs an explanation to use a screen, the screen is wrong.
2. **The admin's attention comes first.** What needs action today is the first thing an admin sees; everything else is one step away.
3. **Driver tasks survive the road.** Every driver action must work in sunlight, on a slow phone, on a bad connection, in few taps.
4. **Status means one thing.** Maintenance status is the product's core signal; nothing else competes with it or borrows its language.
5. **Privacy is assumed, not advertised at the user's expense.** Each company's data is separate by construction, and the interface never hints at other organizations.

## Accessibility & Inclusion

- Driver screens must stay readable in direct sunlight and usable one-handed with large touch targets.
- Wording is plain enough for readers more comfortable in Tagalog/Taglish.
- Must stay usable on low-end Android phones and slow connections.
- No formal standard (such as a WCAG level) has been set.
