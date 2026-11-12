using Dapper;
using starqueen.Data;
using starqueen.Models;

namespace starqueen.Repositories
{
    public class OdometerRepository
    {
        private readonly IDbConnectionFactory _db;
        public OdometerRepository(IDbConnectionFactory db) => _db = db;

        public int? Latest(int vehicleId)
        {
            using var c = _db.CreateConnection();
            return c.QuerySingleOrDefault<int?>("""
                SELECT TOP 1 reading FROM dbo.OdometerReadings
                WHERE vehicle_id = @vehicleId ORDER BY recorded_at DESC, id DESC
                """, new { vehicleId });
        }

        public int Add(int vehicleId, int driverId, int reading)
        {
            using var c = _db.CreateConnection();
            return c.QuerySingle<int>("""
                INSERT dbo.OdometerReadings (vehicle_id, driver_id, reading)
                OUTPUT INSERTED.id VALUES (@vehicleId, @driverId, @reading)
                """, new { vehicleId, driverId, reading });
        }

        public IEnumerable<OdometerReading> List(int? vehicleId)
        {
            using var c = _db.CreateConnection();
            return c.Query<OdometerReading>("""
                SELECT id, vehicle_id, driver_id, reading, recorded_at FROM dbo.OdometerReadings
                WHERE @vehicleId IS NULL OR vehicle_id = @vehicleId
                ORDER BY recorded_at DESC, id DESC
                """, new { vehicleId }).ToList();
        }
    }

    public class TripRepository
    {
        private const string Select = """
            SELECT t.id, t.vehicle_id, t.driver_id, u.full_name AS driver_name, t.trip_date, t.pickup_location,
                   t.pickup_address, t.destination, t.scheduled_time, t.departed_at, t.arrived_at
            FROM dbo.Trips t JOIN dbo.Users u ON u.id = t.driver_id
            """;

        private readonly IDbConnectionFactory _db;
        public TripRepository(IDbConnectionFactory db) => _db = db;

        public int Create(Trip t)
        {
            using var c = _db.CreateConnection();
            return c.QuerySingle<int>("""
                INSERT dbo.Trips (vehicle_id, driver_id, trip_date, pickup_location, pickup_address, destination, scheduled_time)
                OUTPUT INSERTED.id
                VALUES (@VehicleId, @DriverId, @TripDate, @PickupLocation, @PickupAddress, @Destination, @ScheduledTime)
                """, t);
        }

        // All trips (driverId null) or one driver's trips
        public IEnumerable<Trip> List(int? driverId)
        {
            using var c = _db.CreateConnection();
            return c.Query<Trip>($"""
                {Select}
                WHERE @driverId IS NULL OR t.driver_id = @driverId
                ORDER BY t.trip_date DESC, t.id DESC
                """, new { driverId }).ToList();
        }

        // NotFound = not this driver's trip; Invalid = already departed / not departed yet / already arrived
        public WriteResult Depart(int id, int driverId) => SetTime(id, driverId,
            "UPDATE dbo.Trips SET departed_at = SYSUTCDATETIME() WHERE id = @id AND driver_id = @driverId AND departed_at IS NULL");

        public WriteResult Arrive(int id, int driverId) => SetTime(id, driverId,
            "UPDATE dbo.Trips SET arrived_at = SYSUTCDATETIME() WHERE id = @id AND driver_id = @driverId AND departed_at IS NOT NULL AND arrived_at IS NULL");

        private WriteResult SetTime(int id, int driverId, string sql)
        {
            using var c = _db.CreateConnection();
            if (c.ExecuteScalar<int>("SELECT COUNT(*) FROM dbo.Trips WHERE id = @id AND driver_id = @driverId", new { id, driverId }) == 0)
                return WriteResult.NotFound;
            return c.Execute(sql, new { id, driverId }) == 1 ? WriteResult.Ok : WriteResult.Invalid;
        }
    }

    public class ExpenseRepository
    {
        private const string Columns = """
            id, vehicle_id, driver_id, schedule_id, expense_date, category, amount, notes,
            process_photo, receipt_photo, created_at
            """;

        private readonly IDbConnectionFactory _db;
        public ExpenseRepository(IDbConnectionFactory db) => _db = db;

        public int Create(Expense e)
        {
            using var c = _db.CreateConnection();
            return c.QuerySingle<int>("""
                INSERT dbo.Expenses (vehicle_id, driver_id, schedule_id, expense_date, category, amount, notes, process_photo, receipt_photo)
                OUTPUT INSERTED.id
                VALUES (@VehicleId, @DriverId, @ScheduleId, @ExpenseDate, @Category, @Amount, @Notes, @ProcessPhoto, @ReceiptPhoto)
                """, e);
        }

        public IEnumerable<Expense> List(int? driverId)
        {
            using var c = _db.CreateConnection();
            return c.Query<Expense>($"""
                SELECT {Columns} FROM dbo.Expenses
                WHERE @driverId IS NULL OR driver_id = @driverId
                ORDER BY expense_date DESC, id DESC
                """, new { driverId }).ToList();
        }

        public Expense? Get(int id)
        {
            using var c = _db.CreateConnection();
            return c.QuerySingleOrDefault<Expense>($"SELECT {Columns} FROM dbo.Expenses WHERE id = @id", new { id });
        }
    }

    public class NotificationRepository
    {
        private readonly IDbConnectionFactory _db;
        public NotificationRepository(IDbConnectionFactory db) => _db = db;

        public IEnumerable<Notification> List(bool unreadOnly)
        {
            using var c = _db.CreateConnection();
            return c.Query<Notification>("""
                SELECT id, vehicle_id, maintenance_log_id, type, message, task, is_read, is_resolved, resolved_at, created_at
                FROM dbo.Notifications
                WHERE @unreadOnly = 0 OR is_read = 0
                ORDER BY created_at DESC, id DESC
                """, new { unreadOnly }).ToList();
        }

        public bool MarkRead(int id)
        {
            using var c = _db.CreateConnection();
            return c.Execute("UPDATE dbo.Notifications SET is_read = 1 WHERE id = @id", new { id }) == 1;
        }

        public int MarkAllRead()
        {
            using var c = _db.CreateConnection();
            return c.Execute("UPDATE dbo.Notifications SET is_read = 1 WHERE is_read = 0");
        }

        public void AddInformation(int? vehicleId, string message, string? task)
        {
            using var c = _db.CreateConnection();
            c.Execute("""
                INSERT dbo.Notifications (vehicle_id, type, message, task)
                VALUES (@vehicleId, 'Information', @message, @task)
                """, new { vehicleId, message, task });
        }
    }
}
