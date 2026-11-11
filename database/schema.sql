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
