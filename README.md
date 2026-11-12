# FleetPMTS

*Working name. A final name is coming.*

A preventive maintenance and tracking platform for businesses that run vehicles and drivers: trucks, vans, motorcycles, buses. Any company can sign up, set up its own fleet, and keep its data completely separate from every other company.

- **Owners and admins** manage vehicles, drivers, and maintenance schedules, and watch alerts, expenses, and reports.
- **Drivers** log odometer readings, trips, and expenses (with photo proof) for the vehicle assigned to them.
- **Maintenance alerts** are raised automatically when a vehicle is due, by distance or by time **since its last service**.

> **Status:** the backend (database + API) is complete. The new React front end has sign-up, login and the admin dashboard, and the driver app is complete (log odometer readings, add and run trips, submit expenses with camera photos, see maintenance status). Admin management screens are next. The old `web/` pages are obsolete and will be removed.

## Features

- **Multi-organization (multi-tenant).** Self-service sign-up creates an organization and its Owner account.
- **Tenant isolation enforced by the database.** Every table carries `organization_id`, and SQL Server **Row-Level Security** hides other organizations' rows, even if a query forgets to filter. Composite foreign keys stop a row from pointing at another organization's data.
- **Role-based access control.** Fixed roles map to permissions:

  | Permission | Owner | Admin | Driver |
  |---|:-:|:-:|:-:|
  | Organization settings, manage admins | ✅ | | |
  | Manage drivers, vehicles, schedules | ✅ | ✅ | |
  | Reports and alerts | ✅ | ✅ | |
  | Submit logs (own assigned vehicle only) | | | ✅ |

- **Accounts.** The Owner creates Admins; Owners and Admins create Drivers with a temporary password, which must be changed at first login.
- **Maintenance schedules.** New organizations start from editable templates (Truck, Van & Car, Motorcycle). Distances are in km or miles per organization.
- **Expenses with photo proof.** JPG/PNG only (checked by file content), up to 10 MB each, stored privately per organization. An expense can be linked to the maintenance task it paid for, which records the service and clears its alert.
- **Reports.** Fleet overview, monthly expenses, driver activity, and maintenance status per vehicle.

## Tech stack

| Layer | Technology |
|---|---|
| Backend | ASP.NET Core 8 Web API (C#) |
| Data access | Dapper + Microsoft.Data.SqlClient |
| Database | SQL Server (LocalDB for development) with Row-Level Security |
| Auth | HttpOnly cookie (SameSite=Strict), PBKDF2 password hashing (ASP.NET Core Identity's `PasswordHasher`) |
| Tests | xUnit + `WebApplicationFactory`, running against a real SQL Server test database |
| API docs | Swagger / OpenAPI (Development only) |
| Front end | React + TypeScript (in progress) |

## Running locally

**Requirements:** .NET 8 SDK, SQL Server LocalDB (included with Visual Studio), and `sqlcmd`.

1. **Create the database** with demo data:
   ```powershell
   powershell -ExecutionPolicy Bypass -File database/setup.ps1
   ```
   This creates `FleetPMTS_Dev` on `(localdb)\MSSQLLocalDB`, then runs `database/schema.sql` and `database/seed.sql`. Re-running it resets the database to the demo data.

2. **Trust the local HTTPS certificate** (one time only):
   ```
   dotnet dev-certs https --trust
   ```

3. **Run the API:**
   ```
   cd backend/starqueenAPI
   dotnet run --launch-profile https
   ```

4. **Open Swagger** at https://localhost:7273/swagger. Call `POST /api/auth/login` first; the login cookie is then sent with every other call. `backend/starqueenAPI/starqueenAPI.http` has ready-made requests too.

The connection string is `ConnectionStrings:DefaultConnection` in `backend/starqueenAPI/appsettings.json`. For any other database, set it with `dotnet user-secrets` or the `ConnectionStrings__DefaultConnection` environment variable. Never commit real credentials.

### Running the front end

**Requirements:** Node.js 20+.

```
cd frontend
npm install
```

- **Development (live reload):** keep the API running, then `npm run dev` and open http://localhost:5173. API calls are forwarded to https://localhost:7273, so the login cookie works.
- **Single app:** `npm run build` writes `frontend/dist`; the API then serves the whole site at https://localhost:7273 (including direct links like `/admin`).
- **Checks:** `npm run check` runs the TypeScript compiler and the tests.

### Demo accounts

Every demo account's password is **`Demo1234!`**.

| Organization | Email | Role |
|---|---|---|
| Northwind Logistics (PHP, km) | `owner@northwind.demo` | Owner |
| | `admin@northwind.demo` | Admin |
| | `driver1@northwind.demo` … `driver4@northwind.demo` | Drivers (driver3 has no vehicle) |
| Swift Riders Delivery (USD, mi) | `owner@swiftriders.demo` | Owner |
| | `rider1@swiftriders.demo` | Driver |

### Running the tests

```
dotnet test backend/starqueen.Tests
```

The tests create (and recreate) their own `FleetPMTS_Test` database. They include an isolation sweep that tries every endpoint with another organization's IDs and fails if anything leaks.

## Project structure

```
database/
  schema.sql        Tables, Row-Level Security, auth and report procedures, templates
  seed.sql          Demo organizations and data
  setup.ps1         Creates the database and runs both scripts
backend/
  starqueen/        Data access, models, services (password hashing, maintenance alerts, uploads)
  starqueenAPI/     API controllers, authentication, authorization
  starqueen.Tests/  Integration tests
docs/superpowers/   Design spec and implementation plans
web/                Previous front end (being replaced)
```

## Credits

This started as a school group project. The original team:

- Daniela Barranda ([@DanielaBarranda](https://github.com/DanielaBarranda))
- [@heartdenise](https://github.com/heartdenise)
- [@dhanicka](https://github.com/dhanicka)
- [@Cil816](https://github.com/Cil816)

This repository is the updated version, independently maintained and enhanced by Daniela Barranda, separate from the original school project repositories.
