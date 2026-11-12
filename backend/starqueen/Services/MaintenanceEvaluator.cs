using Dapper;
using starqueen.Data;
using System.Data;
using System.Transactions;

namespace starqueen.Services
{
    // Turns maintenance status (dbo.rpt_MaintenanceStatus) into alerts:
    // one open MaintenanceLogs row + a notification per schedule that needs attention.
    // Runs after odometer readings and when dashboards load (so month-based alerts appear
    // without a background job).
    public class MaintenanceEvaluator
    {
        private static readonly string[] AlertStatuses = { "Warning", "Replace", "Overdue" };

        private readonly IDbConnectionFactory _db;

        public MaintenanceEvaluator(IDbConnectionFactory db) => _db = db;

        private static int Rank(string status) => Array.IndexOf(AlertStatuses, status);

        private record StatusRow(int ScheduleId, string Task, int? CurrentReading, string Status);
        private record OpenAlert(int Id, int ScheduleId, string Status);

        // Returns how many alerts were created or escalated for this vehicle
        public int Evaluate(int vehicleId)
        {
            using var scope = DbTransactions.ReadCommitted();
            using var c = _db.CreateConnection();
            DbTransactions.LockVehicle(c, vehicleId);   // concurrent evaluations of one vehicle run one at a time

            var vehicle = c.QuerySingleOrDefault<(string Name, string Plate)>(
                "SELECT name, plate_number FROM dbo.Vehicles WHERE id = @vehicleId", new { vehicleId });
            if (vehicle == default) return 0;

            var due = c.Query("EXEC dbo.rpt_MaintenanceStatus @vehicle_id", new { vehicle_id = vehicleId })
                .Select(r => new StatusRow((int)r.schedule_id, (string)r.task, (int?)r.current_reading, (string)r.status))
                .Where(r => Rank(r.Status) >= 0)
                .ToList();

            var open = c.Query<OpenAlert>("""
                SELECT id, schedule_id, status FROM dbo.MaintenanceLogs
                WHERE vehicle_id = @vehicleId AND resolved = 0 AND status <> 'Done'
                """, new { vehicleId }).ToDictionary(a => a.ScheduleId);

            int changed = 0;
            foreach (var row in due)
            {
                int logId;
                if (!open.TryGetValue(row.ScheduleId, out var existing))
                {
                    logId = c.QuerySingle<int>("""
                        INSERT dbo.MaintenanceLogs (vehicle_id, schedule_id, status, reading_at_log)
                        OUTPUT INSERTED.id VALUES (@vehicleId, @scheduleId, @status, @reading)
                        """, new { vehicleId, scheduleId = row.ScheduleId, status = row.Status, reading = row.CurrentReading });
                }
                else if (Rank(row.Status) > Rank(existing.Status))
                {
                    logId = existing.Id;
                    c.Execute("UPDATE dbo.MaintenanceLogs SET status = @status, reading_at_log = @reading WHERE id = @logId",
                        new { status = row.Status, reading = row.CurrentReading, logId });
                }
                else continue;

                Notify(c, vehicleId, logId, row, vehicle.Name, vehicle.Plate);
                changed++;
            }

            scope.Complete();
            return changed;
        }

        // Evaluates every active vehicle in the organization
        public int EvaluateAll()
        {
            List<int> vehicleIds;
            using (var c = _db.CreateConnection())
                vehicleIds = c.Query<int>("SELECT id FROM dbo.Vehicles WHERE is_active = 1").ToList();
            return vehicleIds.Sum(Evaluate);
        }

        private static void Notify(IDbConnection c, int vehicleId, int logId, StatusRow row, string name, string plate)
        {
            string type = row.Status == "Warning" ? "Warning" : "Urgent";
            string message = $"{row.Task} is {row.Status.ToLowerInvariant()} on {name} ({plate}).";
            c.Execute("""
                INSERT dbo.Notifications (vehicle_id, maintenance_log_id, type, message, task)
                VALUES (@vehicleId, @logId, @type, @message, @task)
                """, new { vehicleId, logId, type, message, task = row.Task });
        }
    }
}
