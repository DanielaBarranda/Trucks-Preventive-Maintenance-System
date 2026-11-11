/* =====================================================================
   FleetPMTS — database schema
   Multi-organization fleet maintenance platform.

   Run against an EMPTY or existing FleetPMTS database (never the legacy
   Starqueen_PMTS database). Safe to re-run: it drops and recreates every
   object it owns. Use database/setup.ps1 to create the database and run
   schema.sql + seed.sql.
   ===================================================================== */
SET NOCOUNT ON;
SET QUOTED_IDENTIFIER ON;  -- required for filtered indexes (sqlcmd defaults it OFF)
SET ANSI_NULLS ON;
GO

/* ---------- Drop existing objects (dependency order) ---------- */
IF EXISTS (SELECT 1 FROM sys.security_policies WHERE name = 'TenantPolicy')
    DROP SECURITY POLICY security.TenantPolicy;
GO
DROP PROCEDURE IF EXISTS auth.FindUserByEmail;
DROP PROCEDURE IF EXISTS auth.CreateOrganization;
DROP PROCEDURE IF EXISTS dbo.rpt_FleetOverview;
DROP PROCEDURE IF EXISTS dbo.rpt_MaintenanceStatus;
DROP PROCEDURE IF EXISTS dbo.rpt_MonthlyExpenses;
DROP PROCEDURE IF EXISTS dbo.rpt_DriverActivity;
DROP FUNCTION  IF EXISTS security.fn_TenantPredicate;
GO
DROP TABLE IF EXISTS dbo.Notifications;
DROP TABLE IF EXISTS dbo.MaintenanceLogs;
DROP TABLE IF EXISTS dbo.Expenses;
DROP TABLE IF EXISTS dbo.Trips;
DROP TABLE IF EXISTS dbo.OdometerReadings;
DROP TABLE IF EXISTS dbo.MaintenanceSchedules;
DROP TABLE IF EXISTS dbo.ScheduleTemplates;
DROP TABLE IF EXISTS dbo.Vehicles;
DROP TABLE IF EXISTS dbo.VehicleTypes;
DROP TABLE IF EXISTS dbo.Users;
DROP TABLE IF EXISTS dbo.Organizations;
GO
DROP USER   IF EXISTS rls_auth;
DROP SCHEMA IF EXISTS auth;
DROP SCHEMA IF EXISTS security;
GO

/* =====================================================================
   TABLES
   Every tenant table has organization_id, defaulting to the organization
   set in SESSION_CONTEXT by the API. Child rows reference parents with
   composite (organization_id, id) foreign keys, so a row can never point
   at another organization's data.
   ===================================================================== */

CREATE TABLE dbo.Organizations (
    id             INT IDENTITY PRIMARY KEY,
    name           NVARCHAR(100) NOT NULL,
    currency_code  CHAR(3)       NOT NULL CONSTRAINT DF_Organizations_currency DEFAULT 'PHP',
    distance_unit  VARCHAR(2)    NOT NULL CONSTRAINT DF_Organizations_unit DEFAULT 'km'
                   CONSTRAINT CK_Organizations_unit CHECK (distance_unit IN ('km', 'mi')),
    created_at     DATETIME2     NOT NULL CONSTRAINT DF_Organizations_created DEFAULT SYSUTCDATETIME()
);
GO

CREATE TABLE dbo.Users (
    id                    INT IDENTITY PRIMARY KEY,
    organization_id       INT NOT NULL CONSTRAINT DF_Users_org DEFAULT CAST(SESSION_CONTEXT(N'organization_id') AS int)
                          CONSTRAINT FK_Users_org REFERENCES dbo.Organizations(id),
    full_name             NVARCHAR(100) NOT NULL,
    email                 NVARCHAR(255) NOT NULL CONSTRAINT UQ_Users_email UNIQUE,
    password_hash         NVARCHAR(255) NOT NULL,
    role                  VARCHAR(10)   NOT NULL CONSTRAINT CK_Users_role CHECK (role IN ('Owner', 'Admin', 'Driver')),
    must_change_password  BIT NOT NULL CONSTRAINT DF_Users_mustchange DEFAULT 0,
    is_active             BIT NOT NULL CONSTRAINT DF_Users_active DEFAULT 1,
    created_at            DATETIME2 NOT NULL CONSTRAINT DF_Users_created DEFAULT SYSUTCDATETIME(),
    CONSTRAINT UQ_Users_org_id UNIQUE (organization_id, id)
);
CREATE UNIQUE INDEX UX_Users_one_owner ON dbo.Users(organization_id) WHERE role = 'Owner';
GO

CREATE TABLE dbo.VehicleTypes (
    id               INT IDENTITY PRIMARY KEY,
    organization_id  INT NOT NULL CONSTRAINT DF_VehicleTypes_org DEFAULT CAST(SESSION_CONTEXT(N'organization_id') AS int)
                     CONSTRAINT FK_VehicleTypes_org REFERENCES dbo.Organizations(id),
    name             NVARCHAR(50) NOT NULL,
    CONSTRAINT UQ_VehicleTypes_org_id UNIQUE (organization_id, id),
    CONSTRAINT UQ_VehicleTypes_org_name UNIQUE (organization_id, name)
);
GO

CREATE TABLE dbo.Vehicles (
    id                  INT IDENTITY PRIMARY KEY,
    organization_id     INT NOT NULL CONSTRAINT DF_Vehicles_org DEFAULT CAST(SESSION_CONTEXT(N'organization_id') AS int)
                        CONSTRAINT FK_Vehicles_org REFERENCES dbo.Organizations(id),
    name                NVARCHAR(100) NOT NULL,
    plate_number        NVARCHAR(20)  NOT NULL,
    vehicle_type_id     INT NOT NULL,
    assigned_driver_id  INT NULL,
    is_active           BIT NOT NULL CONSTRAINT DF_Vehicles_active DEFAULT 1,
    created_at          DATETIME2 NOT NULL CONSTRAINT DF_Vehicles_created DEFAULT SYSUTCDATETIME(),
    CONSTRAINT UQ_Vehicles_org_id UNIQUE (organization_id, id),
    CONSTRAINT UQ_Vehicles_org_plate UNIQUE (organization_id, plate_number),
    CONSTRAINT FK_Vehicles_type   FOREIGN KEY (organization_id, vehicle_type_id)    REFERENCES dbo.VehicleTypes(organization_id, id),
    CONSTRAINT FK_Vehicles_driver FOREIGN KEY (organization_id, assigned_driver_id) REFERENCES dbo.Users(organization_id, id)
);
CREATE UNIQUE INDEX UX_Vehicles_assigned_driver ON dbo.Vehicles(assigned_driver_id) WHERE assigned_driver_id IS NOT NULL;
GO

-- Global starter schedules (not tenant data). Distances in km.
CREATE TABLE dbo.ScheduleTemplates (
    id              INT IDENTITY PRIMARY KEY,
    category        NVARCHAR(30)  NOT NULL CONSTRAINT CK_ScheduleTemplates_category CHECK (category IN (N'Truck', N'Van & Car', N'Motorcycle')),
    task            NVARCHAR(100) NOT NULL,
    km_warning      INT NULL,
    km_replace      INT NULL,
    km_overdue      INT NULL,
    month_interval  INT NULL
);
GO

CREATE TABLE dbo.MaintenanceSchedules (
    id               INT IDENTITY PRIMARY KEY,
    organization_id  INT NOT NULL CONSTRAINT DF_MaintenanceSchedules_org DEFAULT CAST(SESSION_CONTEXT(N'organization_id') AS int)
                     CONSTRAINT FK_MaintenanceSchedules_org REFERENCES dbo.Organizations(id),
    vehicle_type_id  INT NOT NULL,
    task             NVARCHAR(100) NOT NULL,
    km_warning       INT NULL,
    km_replace       INT NULL,
    km_overdue       INT NULL,
    month_interval   INT NULL,
    CONSTRAINT UQ_MaintenanceSchedules_org_id UNIQUE (organization_id, id),
    CONSTRAINT FK_MaintenanceSchedules_type FOREIGN KEY (organization_id, vehicle_type_id) REFERENCES dbo.VehicleTypes(organization_id, id)
);
GO

CREATE TABLE dbo.OdometerReadings (
    id               INT IDENTITY PRIMARY KEY,
    organization_id  INT NOT NULL CONSTRAINT DF_OdometerReadings_org DEFAULT CAST(SESSION_CONTEXT(N'organization_id') AS int)
                     CONSTRAINT FK_OdometerReadings_org REFERENCES dbo.Organizations(id),
    vehicle_id       INT NOT NULL,
    driver_id        INT NOT NULL,
    reading          INT NOT NULL CONSTRAINT CK_OdometerReadings_reading CHECK (reading >= 0),
    recorded_at      DATETIME2 NOT NULL CONSTRAINT DF_OdometerReadings_recorded DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_OdometerReadings_vehicle FOREIGN KEY (organization_id, vehicle_id) REFERENCES dbo.Vehicles(organization_id, id),
    CONSTRAINT FK_OdometerReadings_driver  FOREIGN KEY (organization_id, driver_id)  REFERENCES dbo.Users(organization_id, id)
);
GO

CREATE TABLE dbo.Trips (
    id               INT IDENTITY PRIMARY KEY,
    organization_id  INT NOT NULL CONSTRAINT DF_Trips_org DEFAULT CAST(SESSION_CONTEXT(N'organization_id') AS int)
                     CONSTRAINT FK_Trips_org REFERENCES dbo.Organizations(id),
    vehicle_id       INT NOT NULL,
    driver_id        INT NOT NULL,
    trip_date        DATE NOT NULL,
    pickup_location  NVARCHAR(100) NOT NULL,
    pickup_address   NVARCHAR(255) NOT NULL,
    destination      NVARCHAR(100) NOT NULL,
    scheduled_time   TIME(0) NULL,
    departed_at      DATETIME2 NULL,
    arrived_at       DATETIME2 NULL,
    created_at       DATETIME2 NOT NULL CONSTRAINT DF_Trips_created DEFAULT SYSUTCDATETIME(),
    CONSTRAINT UQ_Trips_org_id UNIQUE (organization_id, id),
    CONSTRAINT FK_Trips_vehicle FOREIGN KEY (organization_id, vehicle_id) REFERENCES dbo.Vehicles(organization_id, id),
    CONSTRAINT FK_Trips_driver  FOREIGN KEY (organization_id, driver_id)  REFERENCES dbo.Users(organization_id, id)
);
GO

CREATE TABLE dbo.Expenses (
    id               INT IDENTITY PRIMARY KEY,
    organization_id  INT NOT NULL CONSTRAINT DF_Expenses_org DEFAULT CAST(SESSION_CONTEXT(N'organization_id') AS int)
                     CONSTRAINT FK_Expenses_org REFERENCES dbo.Organizations(id),
    vehicle_id       INT NOT NULL,
    driver_id        INT NOT NULL,
    schedule_id      INT NULL,
    expense_date     DATE NOT NULL,
    category         NVARCHAR(100) NOT NULL,
    amount           DECIMAL(12, 2) NOT NULL CONSTRAINT CK_Expenses_amount CHECK (amount > 0),
    notes            NVARCHAR(500) NULL,
    process_photo    NVARCHAR(255) NOT NULL,
    receipt_photo    NVARCHAR(255) NOT NULL,
    created_at       DATETIME2 NOT NULL CONSTRAINT DF_Expenses_created DEFAULT SYSUTCDATETIME(),
    CONSTRAINT UQ_Expenses_org_id UNIQUE (organization_id, id),
    CONSTRAINT FK_Expenses_vehicle  FOREIGN KEY (organization_id, vehicle_id)  REFERENCES dbo.Vehicles(organization_id, id),
    CONSTRAINT FK_Expenses_driver   FOREIGN KEY (organization_id, driver_id)   REFERENCES dbo.Users(organization_id, id),
    CONSTRAINT FK_Expenses_schedule FOREIGN KEY (organization_id, schedule_id) REFERENCES dbo.MaintenanceSchedules(organization_id, id)
);
GO

CREATE TABLE dbo.MaintenanceLogs (
    id               INT IDENTITY PRIMARY KEY,
    organization_id  INT NOT NULL CONSTRAINT DF_MaintenanceLogs_org DEFAULT CAST(SESSION_CONTEXT(N'organization_id') AS int)
                     CONSTRAINT FK_MaintenanceLogs_org REFERENCES dbo.Organizations(id),
    vehicle_id       INT NOT NULL,
    schedule_id      INT NOT NULL,
    status           VARCHAR(10) NOT NULL CONSTRAINT CK_MaintenanceLogs_status CHECK (status IN ('Warning', 'Replace', 'Overdue', 'Done')),
    reading_at_log   INT NULL,
    resolved         BIT NOT NULL CONSTRAINT DF_MaintenanceLogs_resolved DEFAULT 0,
    resolved_at      DATETIME2 NULL,
    created_by       INT NULL,
    created_at       DATETIME2 NOT NULL CONSTRAINT DF_MaintenanceLogs_created DEFAULT SYSUTCDATETIME(),
    CONSTRAINT UQ_MaintenanceLogs_org_id UNIQUE (organization_id, id),
    CONSTRAINT FK_MaintenanceLogs_vehicle  FOREIGN KEY (organization_id, vehicle_id)  REFERENCES dbo.Vehicles(organization_id, id),
    CONSTRAINT FK_MaintenanceLogs_schedule FOREIGN KEY (organization_id, schedule_id) REFERENCES dbo.MaintenanceSchedules(organization_id, id),
    CONSTRAINT FK_MaintenanceLogs_creator  FOREIGN KEY (organization_id, created_by)  REFERENCES dbo.Users(organization_id, id)
);
GO

CREATE TABLE dbo.Notifications (
    id                  INT IDENTITY PRIMARY KEY,
    organization_id     INT NOT NULL CONSTRAINT DF_Notifications_org DEFAULT CAST(SESSION_CONTEXT(N'organization_id') AS int)
                        CONSTRAINT FK_Notifications_org REFERENCES dbo.Organizations(id),
    vehicle_id          INT NULL,
    maintenance_log_id  INT NULL,
    type                VARCHAR(12) NOT NULL CONSTRAINT CK_Notifications_type CHECK (type IN ('Urgent', 'Warning', 'Information')),
    message             NVARCHAR(500) NOT NULL,
    task                NVARCHAR(100) NULL,
    is_read             BIT NOT NULL CONSTRAINT DF_Notifications_read DEFAULT 0,
    is_resolved         BIT NOT NULL CONSTRAINT DF_Notifications_resolved DEFAULT 0,
    resolved_at         DATETIME2 NULL,
    created_at          DATETIME2 NOT NULL CONSTRAINT DF_Notifications_created DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_Notifications_vehicle FOREIGN KEY (organization_id, vehicle_id)         REFERENCES dbo.Vehicles(organization_id, id),
    CONSTRAINT FK_Notifications_log     FOREIGN KEY (organization_id, maintenance_log_id) REFERENCES dbo.MaintenanceLogs(organization_id, id)
);
GO

/* =====================================================================
   DEFAULT MAINTENANCE TEMPLATES (km). Copied into an organization at sign-up.
   ===================================================================== */
INSERT dbo.ScheduleTemplates (category, task, km_warning, km_replace, km_overdue, month_interval) VALUES
 (N'Truck', N'Engine Oil & Filter Replacement',        15200, 19000, 19001, 3),
 (N'Truck', N'Fuel Filter Replacement',                32000, 40000, 40001, 6),
 (N'Truck', N'Air Filter Cleaning / Replacement',      32000, 40000, 40001, 6),
 (N'Truck', N'Brake System Inspection & Adjustment',   15200, 19000, 19001, 6),
 (N'Truck', N'Tire Pressure & Condition Check',        10200, 12800, 12801, 6),
 (N'Truck', N'Chassis & Suspension Lubrication',       10200, 12800, 12801, 6),
 (N'Truck', N'Coolant Level & Condition Check',        32000, 40000, 40001, 6),
 (N'Truck', N'Transmission Fluid Check',               32000, 40000, 40001, 12),
 (N'Truck', N'Differential / Drivetrain Inspection',   64000, 80000, 80001, 6),
 (N'Truck', N'Battery & Electrical System Check',      40000, 50000, 50001, 12),
 (N'Van & Car', N'Engine Oil & Filter Replacement',     8000, 10000, 10001, 6),
 (N'Van & Car', N'Air Filter Replacement',             16000, 20000, 20001, 12),
 (N'Van & Car', N'Brake Inspection',                    8000, 10000, 10001, 6),
 (N'Van & Car', N'Tire Rotation & Pressure Check',      8000, 10000, 10001, 6),
 (N'Van & Car', N'Coolant Check',                      32000, 40000, 40001, 24),
 (N'Van & Car', N'Battery & Electrical Check',         32000, 40000, 40001, 12),
 (N'Motorcycle', N'Engine Oil Change',                  2400,  3000,  3001, 3),
 (N'Motorcycle', N'Chain Cleaning & Lubrication',        800,  1000,  1001, 1),
 (N'Motorcycle', N'Brake Pads Inspection',              4000,  5000,  5001, 6),
 (N'Motorcycle', N'Spark Plug Replacement',             6400,  8000,  8001, 12),
 (N'Motorcycle', N'Air Filter Cleaning',                4000,  5000,  5001, 6),
 (N'Motorcycle', N'Tire Pressure & Condition Check',     800,  1000,  1001, 1);
GO

/* =====================================================================
   ROW-LEVEL SECURITY
   The API sets SESSION_CONTEXT('organization_id') on every connection.
   Rows of other organizations are invisible and cannot be written.
   Only the two auth.* procedures (running as rls_auth) see across
   organizations, for login and sign-up.
   ===================================================================== */
CREATE SCHEMA security;
GO
CREATE SCHEMA auth;
GO
CREATE USER rls_auth WITHOUT LOGIN;
GO

CREATE FUNCTION security.fn_TenantPredicate (@organization_id INT)
RETURNS TABLE
WITH SCHEMABINDING
AS
RETURN
    SELECT 1 AS ok
    WHERE @organization_id = CAST(SESSION_CONTEXT(N'organization_id') AS int)
       OR USER_NAME() = N'rls_auth';
GO

CREATE SECURITY POLICY security.TenantPolicy
    ADD FILTER PREDICATE security.fn_TenantPredicate(id)              ON dbo.Organizations,
    ADD BLOCK  PREDICATE security.fn_TenantPredicate(id)              ON dbo.Organizations AFTER UPDATE,
    ADD FILTER PREDICATE security.fn_TenantPredicate(organization_id) ON dbo.Users,
    ADD BLOCK  PREDICATE security.fn_TenantPredicate(organization_id) ON dbo.Users AFTER INSERT,
    ADD BLOCK  PREDICATE security.fn_TenantPredicate(organization_id) ON dbo.Users AFTER UPDATE,
    ADD FILTER PREDICATE security.fn_TenantPredicate(organization_id) ON dbo.VehicleTypes,
    ADD BLOCK  PREDICATE security.fn_TenantPredicate(organization_id) ON dbo.VehicleTypes AFTER INSERT,
    ADD BLOCK  PREDICATE security.fn_TenantPredicate(organization_id) ON dbo.VehicleTypes AFTER UPDATE,
    ADD FILTER PREDICATE security.fn_TenantPredicate(organization_id) ON dbo.Vehicles,
    ADD BLOCK  PREDICATE security.fn_TenantPredicate(organization_id) ON dbo.Vehicles AFTER INSERT,
    ADD BLOCK  PREDICATE security.fn_TenantPredicate(organization_id) ON dbo.Vehicles AFTER UPDATE,
    ADD FILTER PREDICATE security.fn_TenantPredicate(organization_id) ON dbo.MaintenanceSchedules,
    ADD BLOCK  PREDICATE security.fn_TenantPredicate(organization_id) ON dbo.MaintenanceSchedules AFTER INSERT,
    ADD BLOCK  PREDICATE security.fn_TenantPredicate(organization_id) ON dbo.MaintenanceSchedules AFTER UPDATE,
    ADD FILTER PREDICATE security.fn_TenantPredicate(organization_id) ON dbo.OdometerReadings,
    ADD BLOCK  PREDICATE security.fn_TenantPredicate(organization_id) ON dbo.OdometerReadings AFTER INSERT,
    ADD BLOCK  PREDICATE security.fn_TenantPredicate(organization_id) ON dbo.OdometerReadings AFTER UPDATE,
    ADD FILTER PREDICATE security.fn_TenantPredicate(organization_id) ON dbo.Trips,
    ADD BLOCK  PREDICATE security.fn_TenantPredicate(organization_id) ON dbo.Trips AFTER INSERT,
    ADD BLOCK  PREDICATE security.fn_TenantPredicate(organization_id) ON dbo.Trips AFTER UPDATE,
    ADD FILTER PREDICATE security.fn_TenantPredicate(organization_id) ON dbo.Expenses,
    ADD BLOCK  PREDICATE security.fn_TenantPredicate(organization_id) ON dbo.Expenses AFTER INSERT,
    ADD BLOCK  PREDICATE security.fn_TenantPredicate(organization_id) ON dbo.Expenses AFTER UPDATE,
    ADD FILTER PREDICATE security.fn_TenantPredicate(organization_id) ON dbo.MaintenanceLogs,
    ADD BLOCK  PREDICATE security.fn_TenantPredicate(organization_id) ON dbo.MaintenanceLogs AFTER INSERT,
    ADD BLOCK  PREDICATE security.fn_TenantPredicate(organization_id) ON dbo.MaintenanceLogs AFTER UPDATE,
    ADD FILTER PREDICATE security.fn_TenantPredicate(organization_id) ON dbo.Notifications,
    ADD BLOCK  PREDICATE security.fn_TenantPredicate(organization_id) ON dbo.Notifications AFTER INSERT,
    ADD BLOCK  PREDICATE security.fn_TenantPredicate(organization_id) ON dbo.Notifications AFTER UPDATE
    WITH (STATE = ON);
GO

/* ---------- Pre-login procedures (the only cross-organization path) ---------- */

-- Login: find a user by email in any organization
CREATE PROCEDURE auth.FindUserByEmail
    @email NVARCHAR(255)
WITH EXECUTE AS 'rls_auth'
AS
BEGIN
    SET NOCOUNT ON;
    SELECT id, organization_id, full_name, email, password_hash, role, must_change_password, is_active
    FROM dbo.Users
    WHERE email = @email;
END
GO

-- Sign-up: create an organization, its Owner, vehicle types and schedules
CREATE PROCEDURE auth.CreateOrganization
    @org_name            NVARCHAR(100),
    @currency_code       CHAR(3),
    @distance_unit       VARCHAR(2),
    @owner_name          NVARCHAR(100),
    @email               NVARCHAR(255),
    @password_hash       NVARCHAR(255),
    @template_categories NVARCHAR(200)
WITH EXECUTE AS 'rls_auth'
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF EXISTS (SELECT 1 FROM dbo.Users WHERE email = @email)
        THROW 50001, N'Email is already registered.', 1;

    BEGIN TRANSACTION;

    DECLARE @org_id INT, @user_id INT;

    INSERT dbo.Organizations (name, currency_code, distance_unit)
    VALUES (@org_name, @currency_code, @distance_unit);
    SET @org_id = SCOPE_IDENTITY();

    INSERT dbo.Users (organization_id, full_name, email, password_hash, role)
    VALUES (@org_id, @owner_name, @email, @password_hash, 'Owner');
    SET @user_id = SCOPE_IDENTITY();

    DECLARE @types TABLE (id INT, name NVARCHAR(50));

    INSERT dbo.VehicleTypes (organization_id, name)
    OUTPUT INSERTED.id, INSERTED.name INTO @types
    SELECT DISTINCT @org_id, LTRIM(RTRIM(value))
    FROM STRING_SPLIT(@template_categories, ',')
    WHERE LTRIM(RTRIM(value)) IN (N'Truck', N'Van & Car', N'Motorcycle');

    -- Templates are in km; convert for organizations that use miles
    -- (x 0.621371, rounded to the nearest 100)
    INSERT dbo.MaintenanceSchedules
        (organization_id, vehicle_type_id, task, km_warning, km_replace, km_overdue, month_interval)
    SELECT @org_id, t.id, st.task,
           CASE WHEN @distance_unit = 'mi' THEN CAST(ROUND(st.km_warning * 0.621371, -2) AS INT) ELSE st.km_warning END,
           CASE WHEN @distance_unit = 'mi' THEN CAST(ROUND(st.km_replace * 0.621371, -2) AS INT) ELSE st.km_replace END,
           CASE WHEN @distance_unit = 'mi' THEN CAST(ROUND(st.km_overdue * 0.621371, -2) AS INT) ELSE st.km_overdue END,
           st.month_interval
    FROM @types t
    JOIN dbo.ScheduleTemplates st ON st.category = t.name;

    COMMIT;

    SELECT @org_id AS organization_id, @user_id AS user_id;
END
GO

/* =====================================================================
   REPORTS
   All run under Row-Level Security: they only ever see the caller's
   organization.
   ===================================================================== */

-- Per vehicle: readings, expenses, open alerts, unread notifications, last trip
CREATE PROCEDURE dbo.rpt_FleetOverview
AS
BEGIN
    SET NOCOUNT ON;
    SELECT
        v.id            AS vehicle_id,
        v.name          AS vehicle_name,
        v.plate_number,
        vt.name         AS vehicle_type,
        d.full_name     AS assigned_driver_name,
        lr.reading      AS latest_reading,
        ex.total_expenses, ex.min_expense, ex.max_expense,
        ISNULL(ex.expense_count, 0) AS expense_count,
        ex.last_expense_date,
        (SELECT COUNT(*) FROM dbo.MaintenanceLogs ml
          WHERE ml.vehicle_id = v.id AND ml.resolved = 0 AND ml.status <> 'Done') AS open_alerts,
        (SELECT COUNT(*) FROM dbo.Notifications n
          WHERE n.vehicle_id = v.id AND n.is_read = 0)                            AS unread_notifications,
        (SELECT MAX(COALESCE(t.arrived_at, t.departed_at)) FROM dbo.Trips t
          WHERE t.vehicle_id = v.id)                                              AS last_trip_at
    FROM dbo.Vehicles v
    JOIN dbo.VehicleTypes vt ON vt.id = v.vehicle_type_id
    LEFT JOIN dbo.Users d    ON d.id = v.assigned_driver_id
    OUTER APPLY (SELECT TOP 1 o.reading FROM dbo.OdometerReadings o
                 WHERE o.vehicle_id = v.id ORDER BY o.recorded_at DESC, o.id DESC) lr
    OUTER APPLY (SELECT SUM(e.amount) AS total_expenses, MIN(e.amount) AS min_expense,
                        MAX(e.amount) AS max_expense, COUNT(*) AS expense_count,
                        MAX(e.expense_date) AS last_expense_date
                 FROM dbo.Expenses e WHERE e.vehicle_id = v.id) ex
    ORDER BY v.plate_number;
END
GO

-- Per vehicle x schedule: status measured since the last service
--   Distance: Overdue >= km_overdue, Replace >= km_replace, Warning >= km_warning, else Good
--   Months:   Overdue >= interval + 1, Replace >= interval, Warning >= floor(80% of interval) (when >= 1)
--   Result:   the worse of the two; "No Data" when neither can be computed
--   Last service: latest 'Done' log; otherwise reading 0 and the vehicle's created_at
CREATE PROCEDURE dbo.rpt_MaintenanceStatus
    @vehicle_id INT = NULL
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @now DATETIME2 = SYSUTCDATETIME();

    SELECT
        v.id           AS vehicle_id,
        v.plate_number,
        s.id           AS schedule_id,
        s.task,
        ls.service_date    AS last_service_date,
        ls.reading_at_log  AS last_service_reading,
        cr.reading         AS current_reading,
        dist.distance_since,
        mon.months_since,
        CASE (SELECT MAX(r) FROM (VALUES (dr.rank_), (mr.rank_)) AS x(r))
            WHEN 4 THEN 'Overdue'
            WHEN 3 THEN 'Replace'
            WHEN 2 THEN 'Warning'
            WHEN 1 THEN 'Good'
            ELSE 'No Data'
        END AS status
    FROM dbo.Vehicles v
    JOIN dbo.MaintenanceSchedules s ON s.vehicle_type_id = v.vehicle_type_id
    OUTER APPLY (SELECT TOP 1 o.reading FROM dbo.OdometerReadings o
                 WHERE o.vehicle_id = v.id ORDER BY o.recorded_at DESC, o.id DESC) cr
    OUTER APPLY (SELECT TOP 1 COALESCE(l.resolved_at, l.created_at) AS service_date, l.reading_at_log
                 FROM dbo.MaintenanceLogs l
                 WHERE l.vehicle_id = v.id AND l.schedule_id = s.id AND l.status = 'Done'
                 ORDER BY COALESCE(l.resolved_at, l.created_at) DESC, l.id DESC) ls
    CROSS APPLY (SELECT CASE WHEN cr.reading IS NULL THEN NULL
                             ELSE cr.reading - COALESCE(ls.reading_at_log, 0) END AS distance_since) dist
    CROSS APPLY (SELECT COALESCE(ls.service_date, v.created_at) AS since) b
    CROSS APPLY (SELECT CASE WHEN m.raw < 0 THEN 0 ELSE m.raw END AS months_since
                 FROM (SELECT DATEDIFF(month, b.since, @now)
                              - CASE WHEN DAY(@now) < DAY(b.since) THEN 1 ELSE 0 END AS raw) m) mon
    CROSS APPLY (SELECT CASE
        WHEN dist.distance_since IS NULL
          OR (s.km_warning IS NULL AND s.km_replace IS NULL AND s.km_overdue IS NULL) THEN 0
        WHEN s.km_overdue IS NOT NULL AND dist.distance_since >= s.km_overdue THEN 4
        WHEN s.km_replace IS NOT NULL AND dist.distance_since >= s.km_replace THEN 3
        WHEN s.km_warning IS NOT NULL AND dist.distance_since >= s.km_warning THEN 2
        ELSE 1 END AS rank_) dr
    CROSS APPLY (SELECT CASE
        WHEN s.month_interval IS NULL THEN 0
        WHEN mon.months_since >= s.month_interval + 1 THEN 4
        WHEN mon.months_since >= s.month_interval THEN 3
        WHEN FLOOR(s.month_interval * 0.8) >= 1
         AND mon.months_since >= FLOOR(s.month_interval * 0.8) THEN 2
        ELSE 1 END AS rank_) mr
    WHERE v.is_active = 1
      AND (@vehicle_id IS NULL OR v.id = @vehicle_id)
    ORDER BY v.plate_number, s.task;
END
GO

-- Per vehicle and month: total / min / max / count of expenses
CREATE PROCEDURE dbo.rpt_MonthlyExpenses
AS
BEGIN
    SET NOCOUNT ON;
    SELECT
        e.vehicle_id,
        v.plate_number,
        YEAR(e.expense_date)  AS [year],
        MONTH(e.expense_date) AS [month],
        SUM(e.amount)         AS total,
        MIN(e.amount)         AS [min],
        MAX(e.amount)         AS [max],
        COUNT(*)              AS [count]
    FROM dbo.Expenses e
    JOIN dbo.Vehicles v ON v.id = e.vehicle_id
    GROUP BY e.vehicle_id, v.plate_number, YEAR(e.expense_date), MONTH(e.expense_date)
    ORDER BY [year], [month], v.plate_number;
END
GO

-- Per driver: trips, departures, arrivals, destinations, expenses, first/last trip
CREATE PROCEDURE dbo.rpt_DriverActivity
AS
BEGIN
    SET NOCOUNT ON;
    SELECT
        u.id         AS driver_id,
        u.full_name  AS driver_name,
        v.id         AS vehicle_id,
        v.plate_number,
        ISNULL(t.trips, 0)                 AS trips,
        ISNULL(t.departures, 0)            AS departures,
        ISNULL(t.arrivals, 0)              AS arrivals,
        ISNULL(t.distinct_destinations, 0) AS distinct_destinations,
        (SELECT SUM(e.amount) FROM dbo.Expenses e WHERE e.driver_id = u.id) AS total_expenses,
        t.first_trip_at,
        t.last_trip_at
    FROM dbo.Users u
    LEFT JOIN dbo.Vehicles v ON v.assigned_driver_id = u.id
    OUTER APPLY (SELECT COUNT(*)                       AS trips,
                        COUNT(tr.departed_at)          AS departures,
                        COUNT(tr.arrived_at)           AS arrivals,
                        COUNT(DISTINCT tr.destination) AS distinct_destinations,
                        MIN(tr.departed_at)            AS first_trip_at,
                        MAX(tr.arrived_at)             AS last_trip_at
                 FROM dbo.Trips tr WHERE tr.driver_id = u.id) t
    WHERE u.role = 'Driver'
    ORDER BY u.full_name;
END
GO
