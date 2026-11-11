namespace starqueen.Tests;

// Small helpers for building test data directly in SQL, as a given organization.
internal static class DbFixtures
{
    public static SqlConnection OpenAs(int? organizationId) => RlsTests.OpenAs(organizationId);

    public static int AddDriver(int orgId, string? email = null)
    {
        using var c = OpenAs(orgId);
        return c.QuerySingle<int>("""
            INSERT dbo.Users (full_name, email, password_hash, role)
            OUTPUT INSERTED.id VALUES ('Test Driver', @email, 'hash', 'Driver')
            """, new { email = email ?? $"{Guid.NewGuid():N}@test.local" });
    }

    public static int ScheduleId(int orgId, string task)
    {
        using var c = OpenAs(orgId);
        return c.QuerySingle<int>("SELECT TOP 1 id FROM dbo.MaintenanceSchedules WHERE task = @task ORDER BY id", new { task });
    }

    public static void AddReading(int orgId, int vehicleId, int driverId, int reading, DateTime? at = null)
    {
        using var c = OpenAs(orgId);
        c.Execute("""
            INSERT dbo.OdometerReadings (vehicle_id, driver_id, reading, recorded_at)
            VALUES (@vehicleId, @driverId, @reading, COALESCE(@at, SYSUTCDATETIME()))
            """, new { vehicleId, driverId, reading, at });
    }

    public static void AddServiceDone(int orgId, int vehicleId, int scheduleId, int? reading, DateTime serviceDate)
    {
        using var c = OpenAs(orgId);
        c.Execute("""
            INSERT dbo.MaintenanceLogs (vehicle_id, schedule_id, status, reading_at_log, resolved, resolved_at)
            VALUES (@vehicleId, @scheduleId, 'Done', @reading, 1, @serviceDate)
            """, new { vehicleId, scheduleId, reading, serviceDate });
    }

    public static void AddExpense(int orgId, int vehicleId, int driverId, decimal amount, DateTime date)
    {
        using var c = OpenAs(orgId);
        c.Execute("""
            INSERT dbo.Expenses (vehicle_id, driver_id, expense_date, category, amount, process_photo, receipt_photo)
            VALUES (@vehicleId, @driverId, @date, 'Fuel', @amount, 'p.jpg', 'r.jpg')
            """, new { vehicleId, driverId, amount, date });
    }

    public static string Status(int orgId, int vehicleId, string task)
    {
        using var c = OpenAs(orgId);
        // dynamic rows: Dapper maps tuples by position, not by column name
        return (string)c.Query("EXEC dbo.rpt_MaintenanceStatus @vehicle_id", new { vehicle_id = vehicleId })
                        .Single(r => (string)r.task == task).status;
    }
}
