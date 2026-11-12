/* =====================================================================
   FleetPMTS — demo data
   Two fictional organizations, to show that their data stays separate.
   Every demo account's password is:  Demo1234!

   Northwind Logistics (PHP, km)          Swift Riders Delivery (USD, mi)
     owner@northwind.demo    Owner          owner@swiftriders.demo  Owner
     admin@northwind.demo    Admin          rider1@swiftriders.demo Driver
     driver1..4@northwind.demo Drivers
       (driver3 has no vehicle assigned)
   ===================================================================== */
SET NOCOUNT ON;
SET QUOTED_IDENTIFIER ON;  -- required for filtered indexes (sqlcmd defaults it OFF)
SET ANSI_NULLS ON;
SET XACT_ABORT ON;

DECLARE @hash NVARCHAR(255) = N'AQAAAAIAAYagAAAAEOc4ywNThRcj6Erdw71AQTuwQ85vC08wgvlov8qQ6QIYfzKQe2uvHoqCGU2sz2MsMQ==';
DECLARE @now  DATETIME2 = SYSUTCDATETIME();
DECLARE @created TABLE (organization_id INT, user_id INT);
DECLARE @org INT;

/* ---------------------------------------------------------------------
   Northwind Logistics
   --------------------------------------------------------------------- */
INSERT @created EXEC auth.CreateOrganization
    @org_name = N'Northwind Logistics', @currency_code = 'PHP', @distance_unit = 'km',
    @owner_name = N'Nina Reyes', @email = N'owner@northwind.demo', @password_hash = @hash,
    @template_categories = N'Truck,Van & Car';
SELECT @org = organization_id FROM @created;
EXEC sp_set_session_context @key = N'organization_id', @value = @org;

DECLARE @admin INT, @d1 INT, @d2 INT, @d3 INT, @d4 INT;
INSERT dbo.Users (full_name, email, password_hash, role) VALUES (N'Arnel Santos', N'admin@northwind.demo', @hash, 'Admin');
SET @admin = SCOPE_IDENTITY();
INSERT dbo.Users (full_name, email, password_hash, role) VALUES (N'Ben Cruz', N'driver1@northwind.demo', @hash, 'Driver');
SET @d1 = SCOPE_IDENTITY();
INSERT dbo.Users (full_name, email, password_hash, role) VALUES (N'Carlo Dizon', N'driver2@northwind.demo', @hash, 'Driver');
SET @d2 = SCOPE_IDENTITY();
INSERT dbo.Users (full_name, email, password_hash, role) VALUES (N'Dan Ellis', N'driver3@northwind.demo', @hash, 'Driver');
SET @d3 = SCOPE_IDENTITY();
INSERT dbo.Users (full_name, email, password_hash, role) VALUES (N'Ella Flores', N'driver4@northwind.demo', @hash, 'Driver');
SET @d4 = SCOPE_IDENTITY();

DECLARE @truck INT = (SELECT id FROM dbo.VehicleTypes WHERE name = N'Truck');
DECLARE @van   INT = (SELECT id FROM dbo.VehicleTypes WHERE name = N'Van & Car');

DECLARE @v1 INT, @v2 INT, @v3 INT, @v4 INT;
INSERT dbo.Vehicles (name, plate_number, vehicle_type_id, assigned_driver_id) VALUES (N'Isuzu Forward', N'NWL-1001', @truck, @d1);
SET @v1 = SCOPE_IDENTITY();
INSERT dbo.Vehicles (name, plate_number, vehicle_type_id, assigned_driver_id) VALUES (N'Hino 500', N'NWL-1002', @truck, @d2);
SET @v2 = SCOPE_IDENTITY();
INSERT dbo.Vehicles (name, plate_number, vehicle_type_id, assigned_driver_id) VALUES (N'Toyota Hiace', N'NWL-2001', @van, @d4);
SET @v3 = SCOPE_IDENTITY();
INSERT dbo.Vehicles (name, plate_number, vehicle_type_id, assigned_driver_id) VALUES (N'Nissan Urvan', N'NWL-2002', @van, NULL);
SET @v4 = SCOPE_IDENTITY();

-- Odometer readings. Isuzu at 16,000 km: oil change Warning, tire check Overdue.
INSERT dbo.OdometerReadings (vehicle_id, driver_id, reading, recorded_at) VALUES
 (@v1, @d1,     0, DATEADD(day, -60, @now)),   -- bought new
 (@v1, @d1, 12000, DATEADD(day, -30, @now)),
 (@v1, @d1, 16000, DATEADD(day,  -2, @now)),
 (@v2, @d2,  8000, DATEADD(day,  -5, @now)),
 (@v3, @d4,  9000, DATEADD(day,  -1, @now));

-- Services done (linked to expenses below)
DECLARE @vanOil INT = (SELECT id FROM dbo.MaintenanceSchedules WHERE vehicle_type_id = @van   AND task = N'Engine Oil & Filter Replacement');
DECLARE @brakes INT = (SELECT id FROM dbo.MaintenanceSchedules WHERE vehicle_type_id = @truck AND task = N'Brake System Inspection & Adjustment');
INSERT dbo.MaintenanceLogs (vehicle_id, schedule_id, status, reading_at_log, resolved, resolved_at, created_by) VALUES
 (@v3, @vanOil, 'Done', 1000, 1, DATEADD(day, -20, @now), @d4),
 (@v2, @brakes, 'Done', 7500, 1, DATEADD(day, -10, @now), @d2);

INSERT dbo.Trips (vehicle_id, driver_id, trip_date, pickup_location, pickup_address, destination, scheduled_time, departed_at, arrived_at) VALUES
 (@v1, @d1, CAST(DATEADD(day, -6, @now) AS DATE), N'Central Warehouse', N'12 Rizal Ave, Valenzuela', N'Port of Manila',   '06:00', DATEADD(hour, -142, @now), DATEADD(hour, -138, @now)),
 (@v1, @d1, CAST(DATEADD(day, -3, @now) AS DATE), N'Central Warehouse', N'12 Rizal Ave, Valenzuela', N'Batangas Depot',   '05:30', DATEADD(hour,  -70, @now), DATEADD(hour,  -64, @now)),
 (@v1, @d1, CAST(@now AS DATE),                   N'Central Warehouse', N'12 Rizal Ave, Valenzuela', N'Laguna Plant',     '07:00', DATEADD(hour,   -2, @now), NULL),
 (@v2, @d2, CAST(DATEADD(day, -4, @now) AS DATE), N'North Hub',         N'88 MacArthur Hwy, Malolos', N'Pampanga Market', '08:00', DATEADD(hour,  -94, @now), DATEADD(hour,  -90, @now)),
 (@v2, @d2, CAST(DATEADD(day, -1, @now) AS DATE), N'North Hub',         N'88 MacArthur Hwy, Malolos', N'Tarlac Branch',   '08:00', DATEADD(hour,  -22, @now), DATEADD(hour,  -18, @now)),
 (@v3, @d4, CAST(@now AS DATE),                   N'Office',            N'5 Ayala Ave, Makati',       N'Client site, BGC', '09:00', NULL, NULL);

INSERT dbo.Expenses (vehicle_id, driver_id, schedule_id, expense_date, category, amount, notes, process_photo, receipt_photo) VALUES
 (@v1, @d1, NULL,    CAST(DATEADD(day, -6,  @now) AS DATE), N'Fuel',                             3500.00, N'Full tank',          N'demo-process.jpg', N'demo-receipt.jpg'),
 (@v1, @d1, NULL,    CAST(DATEADD(day, -3,  @now) AS DATE), N'Toll',                              420.00, NULL,                  N'demo-process.jpg', N'demo-receipt.jpg'),
 (@v2, @d2, @brakes, CAST(DATEADD(day, -10, @now) AS DATE), N'Brake System Inspection & Adjustment', 2800.00, N'Pads adjusted', N'demo-process.jpg', N'demo-receipt.jpg'),
 (@v2, @d2, NULL,    CAST(DATEADD(day, -1,  @now) AS DATE), N'Fuel',                             3100.00, NULL,                  N'demo-process.jpg', N'demo-receipt.jpg'),
 (@v3, @d4, @vanOil, CAST(DATEADD(day, -20, @now) AS DATE), N'Engine Oil & Filter Replacement',  1950.00, N'Synthetic oil',      N'demo-process.jpg', N'demo-receipt.jpg');

INSERT dbo.Notifications (vehicle_id, type, message, task, created_at) VALUES
 (@v1, 'Information', N'Odometer updated: Isuzu Forward (NWL-1001) logged 16,000 km.', N'Odometer Update', DATEADD(day, -2, @now)),
 (@v2, 'Information', N'Expense submitted: Hino 500 (NWL-1002) - Fuel 3,100.00.',      N'Fuel',            DATEADD(day, -1, @now)),
 (@v3, 'Information', N'Maintenance done: Toyota Hiace (NWL-2001) - Engine Oil & Filter Replacement.', N'Engine Oil & Filter Replacement', DATEADD(day, -20, @now));

/* ---------------------------------------------------------------------
   Swift Riders Delivery
   --------------------------------------------------------------------- */
DELETE @created;
INSERT @created EXEC auth.CreateOrganization
    @org_name = N'Swift Riders Delivery', @currency_code = 'USD', @distance_unit = 'mi',
    @owner_name = N'Sam Porter', @email = N'owner@swiftriders.demo', @password_hash = @hash,
    @template_categories = N'Motorcycle';
SELECT @org = organization_id FROM @created;
EXEC sp_set_session_context @key = N'organization_id', @value = @org;

DECLARE @r1 INT;
INSERT dbo.Users (full_name, email, password_hash, role) VALUES (N'Riley Quinn', N'rider1@swiftriders.demo', @hash, 'Driver');
SET @r1 = SCOPE_IDENTITY();

DECLARE @moto INT = (SELECT id FROM dbo.VehicleTypes WHERE name = N'Motorcycle');
DECLARE @m1 INT, @m2 INT;
INSERT dbo.Vehicles (name, plate_number, vehicle_type_id, assigned_driver_id) VALUES (N'Honda Click 125', N'SWR-01', @moto, @r1);
SET @m1 = SCOPE_IDENTITY();
INSERT dbo.Vehicles (name, plate_number, vehicle_type_id, assigned_driver_id) VALUES (N'Yamaha NMAX', N'SWR-02', @moto, NULL);
SET @m2 = SCOPE_IDENTITY();

INSERT dbo.OdometerReadings (vehicle_id, driver_id, reading, recorded_at) VALUES
 (@m1, @r1,  900, DATEADD(day, -14, @now)),
 (@m1, @r1, 1200, DATEADD(day,  -1, @now));

INSERT dbo.Trips (vehicle_id, driver_id, trip_date, pickup_location, pickup_address, destination, scheduled_time, departed_at, arrived_at) VALUES
 (@m1, @r1, CAST(DATEADD(day, -1, @now) AS DATE), N'Downtown Kitchen', N'200 Main St', N'Riverside Apartments', '12:00', DATEADD(hour, -26, @now), DATEADD(hour, -25, @now));

INSERT dbo.Expenses (vehicle_id, driver_id, expense_date, category, amount, notes, process_photo, receipt_photo) VALUES
 (@m1, @r1, CAST(DATEADD(day, -7, @now) AS DATE), N'Fuel', 18.50, NULL, N'demo-process.jpg', N'demo-receipt.jpg'),
 (@m1, @r1, CAST(DATEADD(day, -1, @now) AS DATE), N'Fuel', 16.75, NULL, N'demo-process.jpg', N'demo-receipt.jpg');

EXEC sp_set_session_context @key = N'organization_id', @value = NULL;
