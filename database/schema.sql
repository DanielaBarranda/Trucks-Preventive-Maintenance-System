/* =====================================================================
   FleetPMTS — database schema
   Multi-organization fleet maintenance platform.

   Run against an EMPTY or existing FleetPMTS database (never the legacy
   Starqueen_PMTS database). Safe to re-run: it drops and recreates every
   object it owns. Use database/setup.ps1 to create the database and run
   schema.sql + seed.sql.
   ===================================================================== */
SET NOCOUNT ON;
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
