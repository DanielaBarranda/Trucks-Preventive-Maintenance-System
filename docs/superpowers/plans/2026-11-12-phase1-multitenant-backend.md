# Phase 1 — Multi-Tenant Database + Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single-company StarQueen backend with a multi-organization fleet API on a new database with Row-Level Security, RBAC, sign-up, account management, and isolation tests.

**Architecture:** One new SQL Server database (`FleetPMTS_Dev`) with `organization_id` on every tenant table, enforced by an RLS security policy keyed on `SESSION_CONTEXT('organization_id')`. The ASP.NET Core API sets that context on every connection from the login cookie; only two `auth.*` procedures run as `rls_auth` to work before login. Repositories use explicit Dapper SQL (the reflection-based `GenericRepositories` is removed).

**Tech Stack:** .NET 8, ASP.NET Core, Dapper 2.1.66, Microsoft.Data.SqlClient 5.1.7, SQL Server LocalDB, xUnit 2.9.2, Microsoft.AspNetCore.Mvc.Testing 8.0.11.

**Spec:** `docs/superpowers/specs/2026-11-12-fleet-platform-design.md` (sections 1–4, 6, 7)

## Global Constraints

- **Never modify, drop, or write to the `Starqueen_PMTS` database.** All work uses `FleetPMTS_Dev` (app) and `FleetPMTS_Test` (tests). Reading it is allowed only for reference.
- Commit messages have **no** Co-Authored-By or other AI attribution. Ask the user before every commit and push (the executor batches the commit steps per task into one ask if the user prefers).
- Keep project names `starqueen` / `starqueenAPI` and their namespaces (renaming is Phase 3).
- JSON uses snake_case property names (`JsonNamingPolicy.SnakeCaseLower`); C# uses PascalCase; Dapper uses `DefaultTypeMap.MatchNamesWithUnderscores = true`.
- Roles are exactly `Owner`, `Admin`, `Driver`. Distance units exactly `km`, `mi`. Currency is an ISO 4217 code, default `PHP`.
- Template categories exactly `Truck`, `Van & Car`, `Motorcycle`.
- Passwords: minimum 8 characters for new/changed passwords; hashed with the existing `PasswordService`.
- Keep the existing cookie settings, upload limits (JPG/PNG, magic-byte check, 10 MB each), `TransactionScope` for multi-step writes, and ProblemDetails error handling.
- The old `web/` front end is not updated (it breaks in this phase by design — spec §6).

## Review Focus

1. **A request with no organization context** (logged-out, or a code path that forgets to set it) must see zero tenant rows, not all rows — RLS predicate returns nothing when `SESSION_CONTEXT` is NULL. Test: Task 2 `NoSessionContext_SeesNoRows`.
2. **A driver with no assigned vehicle** submitting a log gets a clear 409 `{ message: "No vehicle is assigned to you." }`, not a 500. Test: Task 9 `Driver_WithoutVehicle_Gets409`.
3. **Reassigning a vehicle that already has a driver, or a driver who already has a vehicle** returns 409 with a message instead of a unique-index SQL error (500). Test: Task 8 `Assign_DriverAlreadyAssigned_Gets409`.
4. **Signing up with an email that already exists in any organization** returns 409 "Email is already registered" (no 500, no partial organization left behind). Test: Task 5 `Signup_DuplicateEmail_Gets409AndCreatesNothing`.
5. **Odometer reading lower than the vehicle's latest reading** is rejected with 400 (typos would otherwise create negative distances and wrong statuses). Test: Task 9 `Odometer_LowerThanLatest_Gets400`.

---

## File Structure

```
database/
  schema.sql          tables, RLS, auth procedures, report procedures, templates (idempotent: drops+creates objects)
  seed.sql            demo organizations, users, vehicles, logs
  setup.ps1           creates FleetPMTS_Dev (or -Database name) and runs schema + seed
backend/
  starqueen/
    Data/DbConnectionFactory.cs     (modify) opens connection + sets SESSION_CONTEXT
    Data/ITenantContext.cs          (create) current org/user/role
    Auth/Roles.cs, Auth/Permissions.cs   (create; Roles moves here from starqueenAPI)
    Models/*.cs                     (replace) one file per aggregate: Organization, User, Vehicle, VehicleType,
                                    MaintenanceSchedule, OdometerReading, Trip, Expense, MaintenanceLog, Notification, Reports
    Repositories/*.cs               (replace) explicit SQL, one per aggregate
    Services/PasswordService.cs     (keep)
    Services/AccountService.cs      (create) users/admins/drivers
    Services/MaintenanceEvaluator.cs (create) status rules + alert generation
    Services/UploadStorage.cs       (create) per-org photo storage
  starqueenAPI/
    Program.cs                      (modify) tenant context, policies, JSON policy, gating middleware
    Infrastructure/HttpTenantContext.cs, Infrastructure/PasswordChangeGate.cs (create)
    Controllers/*.cs                (replace) Auth, Organization, Admins, Drivers, VehicleTypes, Vehicles,
                                    Schedules, OdometerReadings, Trips, Expenses, Maintenance, Notifications, Reports
  starqueen.Tests/                  (create) xUnit project
    TestDatabase.cs                 creates FleetPMTS_Test from schema+seed once per run
    ApiFactory.cs                   WebApplicationFactory pointed at FleetPMTS_Test
    *Tests.cs                       per task
```

---

### Task 1: Test project + schema tables

**Files:**
- Create: `database/schema.sql` (tables section), `database/setup.ps1`
- Create: `backend/starqueen.Tests/starqueen.Tests.csproj`, `TestDatabase.cs`, `SchemaTests.cs`
- Modify: `backend/starqueen.slnx` (add test project)

**Interfaces:**
- Produces: `TestDatabase.ConnectionString` (static, `FleetPMTS_Test` on `(localdb)\MSSQLLocalDB`), `TestDatabase.EnsureCreated()` (drops and recreates `FleetPMTS_Test`, runs `schema.sql` then `seed.sql` once per test run; splits scripts on lines matching `^\s*GO\s*$`), `[Collection("db")]` collection definition so DB tests run serially.
- Produces: table/column names exactly as spec §3.1, with: `id INT IDENTITY PRIMARY KEY`; `organization_id INT NOT NULL DEFAULT CAST(SESSION_CONTEXT(N'organization_id') AS int)` FK → `Organizations(id)` on every tenant table; `Users.email NVARCHAR(255)` unique; `Vehicles` unique `(organization_id, plate_number)` and filtered unique index on `assigned_driver_id WHERE assigned_driver_id IS NOT NULL`; `MaintenanceLogs.status` CHECK in (`Warning`,`Replace`,`Overdue`,`Done`); `Users.role` CHECK in (`Owner`,`Admin`,`Driver`); `Organizations.distance_unit` CHECK in (`km`,`mi`); money `DECIMAL(12,2)`; timestamps `DATETIME2` default `SYSUTCDATETIME()`.

- [ ] **Step 1: Create the test project** — `dotnet new xunit -n starqueen.Tests -o backend/starqueen.Tests -f net8.0`; reference `../starqueenAPI/starqueenAPI.csproj`; add packages `Microsoft.AspNetCore.Mvc.Testing 8.0.11`, `xunit 2.9.2`, `xunit.runner.visualstudio 2.8.2`, `Microsoft.NET.Test.Sdk 17.11.1`; copy `database/*.sql` to output (`<None Include="..\..\database\*.sql" CopyToOutputDirectory="PreserveNewest" LinkBase="database" />`). Add to `starqueen.slnx`.

- [ ] **Step 2: Write the failing test**

```csharp
[Collection("db")]
public class SchemaTests
{
    [Theory]
    [InlineData("Organizations")] [InlineData("Users")] [InlineData("VehicleTypes")] [InlineData("Vehicles")]
    [InlineData("ScheduleTemplates")] [InlineData("MaintenanceSchedules")] [InlineData("OdometerReadings")]
    [InlineData("Trips")] [InlineData("Expenses")] [InlineData("MaintenanceLogs")] [InlineData("Notifications")]
    public void Table_Exists(string table)
    {
        TestDatabase.EnsureCreated();
        using var c = new SqlConnection(TestDatabase.ConnectionString);
        Assert.Equal(1, c.ExecuteScalar<int>("SELECT COUNT(*) FROM sys.tables WHERE name = @table", new { table }));
    }

    [Fact]
    public void LegacyDatabase_IsUntouched()   // guards the global constraint
    {
        Assert.DoesNotContain("Starqueen_PMTS", TestDatabase.ConnectionString, StringComparison.OrdinalIgnoreCase);
    }
}
```

- [ ] **Step 3: Run to verify it fails** — `dotnet test backend/starqueen.Tests --filter SchemaTests` → FAIL (schema.sql missing / tables missing).

- [ ] **Step 4: Implement** `TestDatabase` and the tables section of `schema.sql` (start the file with `DROP` of every object it creates, in dependency order, so it can be re-run). Create an empty `seed.sql` placeholder (`-- filled in Task 4`). `setup.ps1`: params `-Database FleetPMTS_Dev -Server "(localdb)\MSSQLLocalDB"`; refuses to run when `-Database` equals `Starqueen_PMTS` (case-insensitive); creates the DB if missing; runs `sqlcmd -b -i schema.sql` then `seed.sql`.

- [ ] **Step 5: Run to verify it passes** — `dotnet test backend/starqueen.Tests --filter SchemaTests` → PASS (12 tests).

- [ ] **Step 6: Commit** — `git add database backend/starqueen.Tests backend/starqueen.slnx && git commit -m "Add multi-tenant schema tables and test project"`

---

### Task 2: Row-Level Security + auth procedures

**Files:**
- Modify: `database/schema.sql` (security section)
- Create: `backend/starqueen.Tests/RlsTests.cs`

**Interfaces:**
- Produces (SQL): schema `security`; `security.fn_TenantPredicate(@organization_id INT)` returning `SELECT 1 AS ok WHERE @organization_id = CAST(SESSION_CONTEXT(N'organization_id') AS int) OR USER_NAME() = N'rls_auth'`; policy `security.TenantPolicy` with FILTER and BLOCK (AFTER INSERT, AFTER UPDATE, BEFORE DELETE) predicates on every tenant table (on `Organizations.id` for `Organizations`); `CREATE USER rls_auth WITHOUT LOGIN` with SELECT/INSERT on tenant tables and SELECT on `ScheduleTemplates`.
- Produces (SQL): schema `auth`;
  - `auth.FindUserByEmail @email NVARCHAR(255)` `WITH EXECUTE AS 'rls_auth'` → one row: `id, organization_id, full_name, email, password_hash, role, must_change_password, is_active` or none.
  - `auth.CreateOrganization @org_name NVARCHAR(100), @currency_code CHAR(3), @distance_unit VARCHAR(2), @owner_name NVARCHAR(100), @email NVARCHAR(255), @password_hash NVARCHAR(255), @template_categories NVARCHAR(200)` (comma-separated) `WITH EXECUTE AS 'rls_auth'` → one row `organization_id, user_id`. In one transaction: insert org, Owner user (`must_change_password = 0`), one `VehicleTypes` row per selected category (name = category), and copy matching `ScheduleTemplates` into `MaintenanceSchedules` for that type, converting km values × 0.621371 rounded to nearest 100 when `@distance_unit = 'mi'`. Raises error 50001 `'Email is already registered.'` if the email exists (checked before inserting).

- [ ] **Step 1: Write the failing tests** (`RlsTests`, `[Collection("db")]`; helper `OpenAs(int? orgId)` opens a connection and, when orgId has a value, runs `sp_set_session_context 'organization_id', orgId, @read_only = 1`). Each test creates its own two orgs via `auth.CreateOrganization` with unique emails (`$"{Guid.NewGuid():N}@test.local"`).
  - `NoSessionContext_SeesNoRows`: as `null`, `SELECT COUNT(*) FROM Vehicles` and `FROM Users` == 0 even though both orgs have users.
  - `OrgA_SeesOnlyOwnRows`: insert a vehicle in A and one in B; as A, all plates returned belong to A.
  - `OrgA_CannotInsertIntoOrgB`: as A, `INSERT Vehicles(organization_id, …) VALUES (@b, …)` throws `SqlException` (block predicate).
  - `OrgA_CannotUpdateOrDeleteOrgB`: as A, `UPDATE`/`DELETE` of B's vehicle id affect 0 rows.
  - `DefaultOrganizationId_ComesFromSessionContext`: as A, insert without `organization_id`; row's `organization_id` == A.
  - `FindUserByEmail_WorksWithoutContext`: as `null`, `EXEC auth.FindUserByEmail` returns the owner of B.
  - `CreateOrganization_CopiesTemplates`: categories `"Truck,Motorcycle"` → as the new org, `VehicleTypes` count 2 and `MaintenanceSchedules` count == templates in those categories.
  - `CreateOrganization_Miles_ConvertsThresholds`: with `'mi'`, the "Engine Oil & Filter Replacement" Truck schedule has `km_replace = 11800` (19000 × 0.621371 → 11806 → 11800).
  - `CreateOrganization_DuplicateEmail_Raises50001`: a second call with the same email throws `SqlException` with `Number == 50001`, and `auth.FindUserByEmail` still returns the first organization's id (nothing partially created).

- [ ] **Step 2: Run to verify they fail** — `dotnet test backend/starqueen.Tests --filter RlsTests` → FAIL.

- [ ] **Step 3: Implement** the security section and `ScheduleTemplates` inserts. Templates (task, km_warning, km_replace, km_overdue, month_interval):
  - **Truck** (from the old 10W Truck set): Engine Oil & Filter Replacement 15200/19000/19001/3; Fuel Filter Replacement 32000/40000/40001/6; Air Filter Cleaning / Replacement 32000/40000/40001/6; Brake System Inspection & Adjustment 15200/19000/19001/6; Tire Pressure & Condition Check 10200/12800/12801/6; Chassis & Suspension Lubrication 10200/12800/12801/6; Coolant Level & Condition Check 32000/40000/40001/6; Transmission Fluid Check 32000/40000/40001/12; Differential / Drivetrain Inspection 64000/80000/80001/6; Battery & Electrical System Check 40000/50000/50001/12.
  - **Van & Car**: Engine Oil & Filter Replacement 8000/10000/10001/6; Air Filter Replacement 16000/20000/20001/12; Brake Inspection 8000/10000/10001/6; Tire Rotation & Pressure Check 8000/10000/10001/6; Coolant Check 32000/40000/40001/24; Battery & Electrical Check 32000/40000/40001/12.
  - **Motorcycle**: Engine Oil Change 2400/3000/3001/3; Chain Cleaning & Lubrication 800/1000/1001/1; Brake Pads Inspection 4000/5000/5001/6; Spark Plug Replacement 6400/8000/8001/12; Air Filter Cleaning 4000/5000/5001/6; Tire Pressure & Condition Check 800/1000/1001/1.

- [ ] **Step 4: Run to verify they pass** — `dotnet test backend/starqueen.Tests --filter RlsTests` → PASS.

- [ ] **Step 5: Commit** — `git commit -m "Add row-level security, auth procedures, and schedule templates"`

---

### Task 3: Report procedures + maintenance status rules

**Files:**
- Modify: `database/schema.sql` (reports section)
- Create: `backend/starqueen.Tests/ReportProcedureTests.cs`

**Interfaces:**
- Produces (SQL), all `CREATE PROCEDURE` with no parameters except as noted, reading only through RLS (no `EXECUTE AS`):
  - `rpt_FleetOverview` → `vehicle_id, vehicle_name, plate_number, vehicle_type, assigned_driver_name, latest_reading, total_expenses, min_expense, max_expense, expense_count, last_expense_date, open_alerts, unread_notifications, last_trip_at`
  - `rpt_MaintenanceStatus @vehicle_id INT = NULL` → `vehicle_id, plate_number, schedule_id, task, last_service_date, last_service_reading, current_reading, distance_since, months_since, status` — status per spec §3.2.1 (worse of distance and month status; `No Data` when the vehicle has no odometer reading and the schedule has no `month_interval`). Months = whole calendar months, decremented when the current day-of-month < service day-of-month.
  - `rpt_MonthlyExpenses` → `vehicle_id, plate_number, year, month, total, min, max, count`
  - `rpt_DriverActivity` → `driver_id, driver_name, vehicle_id, plate_number, trips, departures, arrivals, distinct_destinations, total_expenses, first_trip_at, last_trip_at`

- [ ] **Step 1: Write the failing tests** — each creates an org via `auth.CreateOrganization("Truck")`, inserts fixtures as that org, then runs the procedure as that org:
  - `Status_Good_WhenUnderWarning`: reading 1000, no service → Engine Oil status `Good`.
  - `Status_Warning_Replace_Overdue_ByDistance`: readings 15200 / 19000 / 19001 → `Warning` / `Replace` / `Overdue`.
  - `Status_MeasuredSinceLastService`: `Done` log at reading 19000, current 20000 → `Good` (old absolute logic would say `Overdue`).
  - `Status_ByMonths`: Engine Oil (interval 3), last `Done` resolved_at 3 months ago, reading 0 distance → `Replace`; 4 months ago → `Overdue`; 2 months ago (80% of 3 = 2) → `Warning`.
  - `Status_WorseOfDistanceAndMonth`: distance `Warning`, months `Overdue` → `Overdue`.
  - `Status_NoData_WhenNoReadingAndNoInterval`: schedule with `month_interval NULL`, no readings → `No Data`.
  - `MonthlyExpenses_AggregatesPerVehicleMonth`: expenses 100 and 300 in the same month → total 400, min 100, max 300, count 2.
  - `Reports_OnlyIncludeOwnOrganization`: org B's vehicle never appears in A's `rpt_FleetOverview`.

- [ ] **Step 2: Run to verify they fail** — `dotnet test backend/starqueen.Tests --filter ReportProcedureTests` → FAIL.

- [ ] **Step 3: Implement** the four procedures. Use the legacy procedure bodies (read-only reference: export with `sqlcmd -S "(localdb)\MSSQLLocalDB" -d Starqueen_PMTS -y 0 -Q "SELECT m.definition FROM sys.sql_modules m"`) for the aggregate shapes.

- [ ] **Step 4: Run to verify they pass** → PASS.

- [ ] **Step 5: Commit** — `git commit -m "Add report procedures with since-last-service maintenance status"`

---

### Task 4: Seed data

**Files:**
- Modify: `database/seed.sql`
- Create: `backend/starqueen.Tests/SeedTests.cs`

**Interfaces:**
- Produces demo data (documented in README in Task 12). All demo passwords are `Demo1234!`.
  - Org 1 **"Northwind Logistics"** (PHP, km): Owner `owner@northwind.demo`, Admin `admin@northwind.demo`, Drivers `driver1@northwind.demo`, `driver2@northwind.demo`, `driver3@northwind.demo` (driver3 unassigned); types Truck + Van & Car; 4 vehicles (3 assigned); odometer readings producing at least one `Warning` and one `Overdue`; 6 trips; 5 expenses (2 linked to schedules); some notifications.
  - Org 2 **"Swift Riders Delivery"** (USD, mi): Owner `owner@swiftriders.demo`, Driver `rider1@swiftriders.demo`; type Motorcycle; 2 vehicles; a few readings and expenses.
  - Created via `EXEC auth.CreateOrganization`, then `sp_set_session_context` per org for the rest of its inserts.
  - Password hashes are literal `PasswordService.Hash("Demo1234!")` output generated once and pasted in.

- [ ] **Step 1: Write the failing tests**
  - `SeedPasswords_VerifyAgainstDemoPassword`: for every user row returned by `auth.FindUserByEmail` for the 7 demo emails, `new PasswordService().Verify(hash, "Demo1234!")` is true.
  - `Seed_HasTwoOrganizations_WithSeparateData`: as Northwind, `rpt_FleetOverview` returns 4 rows; as Swift Riders, 2 rows.
  - `Seed_ProducesWarningAndOverdue`: as Northwind, `rpt_MaintenanceStatus` contains at least one `Warning` and one `Overdue`.

- [ ] **Step 2: Run to verify they fail** → FAIL.
- [ ] **Step 3: Implement** `seed.sql` (generate the hash with a throwaway test or `dotnet` snippet calling `PasswordService.Hash`; do not commit the generator).
- [ ] **Step 4: Run** `dotnet test backend/starqueen.Tests` → all PASS. Then run `pwsh database/setup.ps1` (or `powershell -File`) to create `FleetPMTS_Dev`, and confirm `sqlcmd -S "(localdb)\MSSQLLocalDB" -d FleetPMTS_Dev -Q "EXEC auth.FindUserByEmail 'owner@northwind.demo'"` returns one row.
- [ ] **Step 5: Commit** — `git commit -m "Add demo seed data for two organizations"`

---

### Task 5: Backend foundation — tenant context, auth, sign-up

**Files:**
- Delete: all of `backend/starqueen/Models/*`, `Repositories/*`, `Services/*` except `Services/PasswordService.cs`; all controllers except `AuthController.cs`; `backend/starqueenAPI/Roles.cs` (moves).
- Create: `starqueen/Data/ITenantContext.cs`, `starqueen/Auth/Roles.cs`, `starqueen/Auth/Permissions.cs`, `starqueen/Models/User.cs`, `starqueen/Models/Organization.cs`, `starqueen/Repositories/UserRepository.cs`, `starqueen/Repositories/OrganizationRepository.cs`, `starqueenAPI/Infrastructure/HttpTenantContext.cs`, `starqueenAPI/Infrastructure/PasswordChangeGate.cs`
- Modify: `starqueen/Data/DbConnectionFactory.cs`, `starqueenAPI/Program.cs`, `starqueenAPI/Controllers/AuthController.cs`, `starqueenAPI/appsettings.json` (`Database=FleetPMTS_Dev`)
- Create: `backend/starqueen.Tests/ApiFactory.cs`, `AuthTests.cs`

**Interfaces:**
- Produces:
  - `interface ITenantContext { int? OrganizationId { get; } int? UserId { get; } string? Role { get; } }`
  - `SqlConnectionFactory(string connectionString, ITenantContext tenant)`; `CreateConnection()` returns an **open** connection with `organization_id` session context set (read-only) when `tenant.OrganizationId` has a value. Registered **scoped**.
  - Claims issued at login: `NameIdentifier` = user id, `Name`, `Email`, `Role`, `"org_id"`, and `"must_change_password"` = `"true"` only when set.
  - `static class Permissions` constants: `OrgManage = "org.manage"`, `AdminsManage = "admins.manage"`, `DriversManage = "drivers.manage"`, `VehiclesManage = "vehicles.manage"`, `SchedulesManage = "schedules.manage"`, `ReportsView = "reports.view"`, `AlertsManage = "alerts.manage"`, `LogsSubmit = "logs.submit"`; `static IReadOnlyList<string> ForRole(string role)` per spec §4.2; one authorization policy per permission, built as `RequireRole(rolesThatHave(permission))`.
  - `UserRepository`: `User? FindByEmailForLogin(string email)` (calls `auth.FindUserByEmail`), `User? GetById(int id)`, `bool UpdatePassword(int id, string hash, bool mustChange)`.
  - Endpoints: `POST /api/auth/signup` body `{ organization_name, owner_name, email, password, currency_code = "PHP", distance_unit = "km", template_categories: string[] }` → 201 and signs the owner in; `POST /api/auth/login` → `{ success, message, user: { id, full_name, email, role, must_change_password }, organization: { id, name, currency_code, distance_unit }, permissions: string[] }`; `POST /api/auth/logout` → 204; `GET /api/auth/me` → same shape as login's success body; `POST /api/auth/change-password` `{ current_password, new_password }` → 200, re-issues the cookie without `must_change_password`.
  - `PasswordChangeGate` middleware: when the user has claim `must_change_password`, any `/api/*` request except `/api/auth/change-password`, `/api/auth/logout`, `/api/auth/me` returns 403 `{ message: "Password change required." }`.
  - `ApiFactory : WebApplicationFactory<Program>` sets `ConnectionStrings:DefaultConnection` to `TestDatabase.ConnectionString`, environment `Testing`; helper `Task<HttpClient> LoginAs(string email, string password = "Demo1234!")` returns a client with the cookie (`BaseAddress = https://localhost`).

- [ ] **Step 1: Write the failing tests** (`AuthTests`, uses seed users):
  - `Login_ValidDemoOwner_ReturnsOrgAndPermissions`: permissions contain `org.manage` and `admins.manage`; organization name "Northwind Logistics".
  - `Login_WrongPassword_ReturnsSuccessFalse`.
  - `Login_InactiveUser_ReturnsSuccessFalse` (set a user `is_active = 0` as Northwind first).
  - `Api_WithoutLogin_Returns401` (`GET /api/auth/me`).
  - `Signup_CreatesOrgAndLogsInOwner`: then `GET /api/auth/me` 200, role `Owner`.
  - `Signup_DuplicateEmail_Gets409AndCreatesNothing`: email `owner@northwind.demo` → 409 `{ message: "Email is already registered." }`.
  - `Signup_ShortPassword_Gets400`.
  - `MustChangePassword_BlocksOtherEndpoints_UntilChanged`: user with `must_change_password = 1` → `GET /api/reports/fleet-overview` 403; after change-password, the same call is not 403.
- [ ] **Step 2: Run** `dotnet test backend/starqueen.Tests --filter AuthTests` → FAIL.
- [ ] **Step 3: Implement.** Map SQL error 50001 to 409. Set `JsonNamingPolicy.SnakeCaseLower` for MVC JSON and `DefaultTypeMap.MatchNamesWithUnderscores = true` at startup. Remove `HashLegacyPasswords` and its startup call. Make `Program` accessible to tests (`public partial class Program { }`).
- [ ] **Step 4: Run** → PASS, and `dotnet build backend/starqueenAPI` → 0 warnings, 0 errors.
- [ ] **Step 5: Commit** — `git commit -m "Add tenant-aware connections, permission policies, sign-up and login"`

---

### Task 6: Organization settings + account management

**Files:**
- Create: `starqueen/Services/AccountService.cs`, `starqueenAPI/Controllers/OrganizationController.cs`, `AdminsController.cs`, `DriversController.cs`
- Modify: `starqueen/Repositories/UserRepository.cs`, `OrganizationRepository.cs`
- Test: `backend/starqueen.Tests/AccountTests.cs`

**Interfaces:**
- Consumes: Task 5 repositories, permissions, `PasswordService`.
- Produces:
  - `AccountService.Create(string role, string fullName, string email, string temporaryPassword) -> int` (sets `must_change_password = 1`; 409 on duplicate email — check `auth.FindUserByEmail` first), `Update(int id, string role, string fullName, string email, bool isActive) -> bool`, `ResetPassword(int id, string role, string temporaryPassword) -> bool` (sets `must_change_password = 1`). All operate only on users of the given role in the current org.
  - `GET/PUT /api/organization` (`org.manage` for PUT; GET for any logged-in user) body `{ name, currency_code, distance_unit }`.
  - `/api/admins` (`admins.manage`) and `/api/drivers` (`drivers.manage`): `GET` list `{ id, full_name, email, is_active, must_change_password, assigned_vehicle_id? (drivers only) }`, `POST { full_name, email, temporary_password }` → 201 `{ id }`, `PUT /{id} { full_name, email, is_active }`, `POST /{id}/reset-password { temporary_password }`.
  - The Owner cannot be edited or deactivated through these endpoints.

- [ ] **Step 1: Write the failing tests**
  - `Owner_CreatesAdmin_AdminMustChangePassword`.
  - `Admin_CannotManageAdmins_Gets403`.
  - `Admin_CreatesDriver_DriverCanLogInAndMustChange`.
  - `Driver_CannotListDrivers_Gets403`.
  - `DriversList_NeverIncludesOtherOrganizations`: Swift Riders owner listing drivers sees only `rider1@swiftriders.demo`.
  - `UpdateDriver_FromOtherOrg_Gets404`: Northwind admin `PUT /api/drivers/{riderId}` → 404.
  - `Organization_Update_OnlyOwner`: admin PUT → 403; owner PUT with `distance_unit = "mi"` → 200.
  - `CreateUser_DuplicateEmail_Gets409`.
- [ ] **Step 2: Run** `--filter AccountTests` → FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** — `git commit -m "Add organization settings and admin/driver management"`

---

### Task 7: Vehicle types and maintenance schedules

**Files:**
- Create: `starqueen/Models/VehicleType.cs`, `MaintenanceSchedule.cs`, `starqueen/Repositories/VehicleTypeRepository.cs`, `ScheduleRepository.cs`, `starqueenAPI/Controllers/VehicleTypesController.cs`, `SchedulesController.cs`
- Test: `backend/starqueen.Tests/ScheduleTests.cs`

**Interfaces:**
- Produces: `/api/vehicle-types` — GET (any), POST/PUT/DELETE (`vehicles.manage`), body `{ name }`; DELETE returns 409 when vehicles use the type. `/api/schedules?vehicle_type_id=` — GET (any), POST/PUT/DELETE (`schedules.manage`), body `{ vehicle_type_id, task, km_warning?, km_replace?, km_overdue?, month_interval? }`; validation 400 unless `km_warning ≤ km_replace ≤ km_overdue` when all present and at least one of `km_replace`/`month_interval` is set.

- [ ] **Step 1: Write the failing tests** — `Schedules_ListForOrg_FromTemplates` (Northwind has Truck schedules), `CreateSchedule_InvalidThresholds_Gets400`, `Driver_CannotEditSchedules_Gets403`, `DeleteVehicleType_InUse_Gets409`, `Schedule_FromOtherOrg_Gets404`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** — `git commit -m "Add vehicle types and maintenance schedule endpoints"`

---

### Task 8: Vehicles, assignment, and service records

**Files:**
- Create: `starqueen/Models/Vehicle.cs`, `MaintenanceLog.cs`, `starqueen/Repositories/VehicleRepository.cs`, `MaintenanceLogRepository.cs`, `starqueenAPI/Controllers/VehiclesController.cs`
- Test: `backend/starqueen.Tests/VehicleTests.cs`

**Interfaces:**
- Produces:
  - `/api/vehicles` — GET (`reports.view`) list `{ id, name, plate_number, vehicle_type_id, vehicle_type, assigned_driver_id, assigned_driver_name, is_active }`; `GET /api/vehicles/mine` (Driver) → their vehicle or 404; POST/PUT/DELETE (`vehicles.manage`) body `{ name, plate_number, vehicle_type_id, is_active }`; duplicate plate in the org → 409.
  - `PUT /api/vehicles/{id}/assign { driver_id: int | null }` (`vehicles.manage`) — driver must be an active Driver in the org (else 400); 409 `{ message: "That driver already has a vehicle." }` when assigned elsewhere.
  - `POST /api/vehicles/{id}/services { schedule_id, service_date, reading? }` (`vehicles.manage`) — inserts a `Done` row and resolves that schedule's open alerts and notifications (one `TransactionScope`). Exposed as `MaintenanceLogRepository.RecordService(int vehicleId, int scheduleId, DateTime serviceDate, int? reading, int createdBy)`; reused by Task 9.

- [ ] **Step 1: Write the failing tests** — `CreateVehicle_DuplicatePlate_Gets409`, `Assign_DriverAlreadyAssigned_Gets409`, `Assign_DriverFromOtherOrg_Gets400`, `Unassign_SetsNull`, `Mine_ReturnsDriversVehicle`, `RecordService_ResolvesOpenAlerts` (open `Overdue` alert for that schedule → resolved, status now `Good` in `rpt_MaintenanceStatus`), `Vehicle_FromOtherOrg_Gets404`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** — `git commit -m "Add vehicles, driver assignment, and service records"`

---

### Task 9: Driver logs + maintenance evaluator

**Files:**
- Create: `starqueen/Models/OdometerReading.cs`, `Trip.cs`, `Expense.cs`, `Notification.cs`; `starqueen/Repositories/OdometerRepository.cs`, `TripRepository.cs`, `ExpenseRepository.cs`, `NotificationRepository.cs`; `starqueen/Services/MaintenanceEvaluator.cs`, `starqueen/Services/UploadStorage.cs`; `starqueenAPI/Controllers/OdometerReadingsController.cs`, `TripsController.cs`, `ExpensesController.cs`, `MaintenanceController.cs`
- Test: `backend/starqueen.Tests/DriverLogTests.cs`, `MaintenanceEvaluatorTests.cs`

**Interfaces:**
- Consumes: `VehicleRepository` (assigned vehicle lookup), `MaintenanceLogRepository.RecordService`, `rpt_MaintenanceStatus`.
- Produces:
  - `MaintenanceEvaluator.Evaluate(int vehicleId) -> int` (number of new alerts): reads `rpt_MaintenanceStatus @vehicle_id`; for each schedule with status `Warning`/`Replace`/`Overdue` and no unresolved `MaintenanceLogs` row for that schedule, inserts the alert row plus a `Notifications` row (`Urgent` for `Replace`/`Overdue`, `Warning` for `Warning`; message `"{task} is {status lowercased} on {vehicle_name} ({plate_number})."`); for an existing unresolved alert whose status got worse, updates its status and inserts a new notification. One `TransactionScope` per vehicle.
  - Driver endpoints (`logs.submit`) always use the caller's assigned vehicle; none accept a `vehicle_id`. No assigned vehicle → 409 `{ message: "No vehicle is assigned to you." }`.
  - `POST /api/odometer-readings { reading }` → 400 when lower than the latest reading; then `Evaluate`; inserts an `Information` notification "Odometer updated…". `GET /api/odometer-readings?vehicle_id=` (`reports.view`; drivers get their own vehicle's list).
  - `POST /api/trips { trip_date, pickup_location, pickup_address, destination, scheduled_time }`; `PUT /api/trips/{id}/depart`, `PUT /api/trips/{id}/arrive` (driver's own trips only, else 404; arrive before depart → 400); `GET /api/trips` (admins: all; drivers: own).
  - `POST /api/expenses` multipart `{ expense_date (yyyy-MM-dd), category, amount, notes?, schedule_id?, process_photo, receipt_photo }` — existing validation rules; when `schedule_id` is given it must belong to the vehicle's type (else 400) and calls `RecordService(vehicle, schedule, expense_date, latestReading, me)`. `GET /api/expenses` (admins all, drivers own). `GET /api/expenses/{id}/photos/{process|receipt}` streams the file (404 for other orgs).
  - `UploadStorage.Save(int organizationId, IFormFile file) -> string fileName` under `{ContentRoot}/App_Data/uploads/{organizationId}/`; `OpenRead(int organizationId, string fileName) -> Stream?`. `App_Data/` added to `.gitignore`.
  - `GET /api/maintenance/status?vehicle_id=` (admins any vehicle; drivers own) → `rpt_MaintenanceStatus`; `POST /api/maintenance/evaluate` (admins: all org vehicles; drivers: own) → `{ new_alerts }` — called by dashboards on load so month-based alerts appear without a background job.

- [ ] **Step 1: Write the failing tests**
  - `MaintenanceEvaluatorTests`: `Evaluate_CreatesAlertOncePerSchedule` (evaluate twice → second returns 0), `Evaluate_EscalatesWarningToOverdue` (new notification inserted), `Evaluate_IgnoresGoodSchedules`.
  - `DriverLogTests`: `Driver_WithoutVehicle_Gets409` (driver3), `Odometer_LowerThanLatest_Gets400`, `Odometer_CrossingThreshold_CreatesNotification`, `Trip_DepartThenArrive_Works`, `Trip_OfOtherDriver_Gets404`, `Expense_WithSchedule_ResolvesAlert`, `Expense_ScheduleOfOtherType_Gets400`, `Expense_NonImagePhoto_Gets400`, `ExpensePhoto_FromOtherOrg_Gets404`, `Admin_CannotSubmitDriverLogs_Gets403`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** — `git commit -m "Add driver logs, maintenance evaluator, and per-organization uploads"`

---

### Task 10: Notifications and reports endpoints

**Files:**
- Create: `starqueen/Models/Reports.cs`, `starqueen/Repositories/ReportRepository.cs`, `starqueenAPI/Controllers/NotificationsController.cs`, `ReportsController.cs`
- Test: `backend/starqueen.Tests/ReportEndpointTests.cs`

**Interfaces:**
- Produces: `GET /api/notifications?unread_only=` , `PUT /api/notifications/{id}/read`, `PUT /api/notifications/read-all` (`alerts.manage`); `GET /api/reports/fleet-overview`, `/api/reports/monthly-expenses?year=`, `/api/reports/driver-activity` (`reports.view`) returning the procedure columns from Task 3 in snake_case.

- [ ] **Step 1: Write the failing tests** — `FleetOverview_ReturnsOnlyOwnVehicles` (Northwind 4, Swift Riders 2), `MonthlyExpenses_FilterByYear`, `Driver_CannotViewReports_Gets403`, `ReadAll_MarksOnlyOwnOrganization` (Swift Riders unread count unchanged after Northwind read-all).
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** — `git commit -m "Add notification and report endpoints"`

---

### Task 11: Cross-tenant sweep test

**Files:**
- Create: `backend/starqueen.Tests/IsolationSweepTests.cs`

**Interfaces:**
- Consumes: every `GET` list endpoint and every `/{id}` endpoint from Tasks 5–10.

- [ ] **Step 1: Write the test** — `EveryEndpoint_HidesOtherOrganization`: log in as the Swift Riders owner; collect ids from its own list endpoints (vehicles, drivers, schedules, vehicle-types, trips, expenses, notifications); log in as the Northwind owner; for each collected id call the corresponding `GET`/`PUT`/`DELETE` `/{id}` route → every response is 404 (never 200/204), and no Northwind list response contains any collected id.
- [ ] **Step 2: Run** `--filter IsolationSweepTests` → PASS expected (if it fails, the failing route is an isolation bug: fix it in its controller/repository before committing).
- [ ] **Step 3: Commit** — `git commit -m "Add cross-organization isolation sweep test"`

---

### Task 12: Docs, config, final verification

**Files:**
- Modify: `README.md` (setup via `database/setup.ps1`, demo logins table with `Demo1234!`, multi-tenant/RLS summary, note that the old `web/` front end is pending replacement in Phase 2), `backend/starqueenAPI/starqueenAPI.http` (demo login + a few calls)

- [ ] **Step 1: Full test run** — `dotnet test backend/starqueen.Tests` → all PASS; `dotnet build backend/starqueenAPI` → 0 warnings, 0 errors.
- [ ] **Step 2: Manual smoke** — `powershell -File database/setup.ps1`; `dotnet run --launch-profile https` in `backend/starqueenAPI`; in Swagger: sign up a new org, log in as `owner@northwind.demo`, `GET /api/reports/fleet-overview` shows 4 vehicles.
- [ ] **Step 3: Confirm legacy DB untouched** — `sqlcmd -S "(localdb)\MSSQLLocalDB" -d Starqueen_PMTS -Q "SELECT COUNT(*) FROM Users"` → 16.
- [ ] **Step 4: Update README and .http file.**
- [ ] **Step 5: Commit** — `git commit -m "Document multi-tenant setup and demo accounts"`
