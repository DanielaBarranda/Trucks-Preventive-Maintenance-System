using Dapper;
using starqueen.Data;
using starqueen.Models;
using System.Transactions;

namespace starqueen.Repositories
{
    public class MaintenanceLogRepository
    {
        private readonly IDbConnectionFactory _db;

        public MaintenanceLogRepository(IDbConnectionFactory db) => _db = db;

        // Current maintenance status per vehicle × schedule (all vehicles when vehicleId is null)
        public IEnumerable<MaintenanceStatusRow> Status(int? vehicleId)
        {
            using var c = _db.CreateConnection();
            return c.Query<MaintenanceStatusRow>("EXEC dbo.rpt_MaintenanceStatus @vehicle_id",
                new { vehicle_id = vehicleId }).ToList();
        }

        // Records that a schedule's maintenance was done on a vehicle, and resolves that
        // schedule's open alerts and their notifications — all or nothing.
        // NotFound = unknown vehicle or schedule; Invalid = schedule is for another vehicle type.
        public WriteResult RecordService(int vehicleId, int scheduleId, DateTime serviceDate, int? reading, int createdBy)
        {
            using var scope = new TransactionScope();
            using var c = _db.CreateConnection();

            var match = c.QuerySingleOrDefault<(int VehicleType, int? ScheduleType)>("""
                SELECT v.vehicle_type_id,
                       (SELECT s.vehicle_type_id FROM dbo.MaintenanceSchedules s WHERE s.id = @scheduleId)
                FROM dbo.Vehicles v WHERE v.id = @vehicleId
                """, new { vehicleId, scheduleId });
            if (match == default || match.ScheduleType is null) return WriteResult.NotFound;
            if (match.VehicleType != match.ScheduleType) return WriteResult.Invalid;

            c.Execute("""
                INSERT dbo.MaintenanceLogs (vehicle_id, schedule_id, status, reading_at_log, resolved, resolved_at, created_by)
                VALUES (@vehicleId, @scheduleId, 'Done', @reading, 1, @serviceDate, @createdBy)
                """, new { vehicleId, scheduleId, reading, serviceDate, createdBy });

            c.Execute("""
                UPDATE n SET is_resolved = 1, resolved_at = SYSUTCDATETIME()
                FROM dbo.Notifications n
                JOIN dbo.MaintenanceLogs l ON l.id = n.maintenance_log_id
                WHERE l.vehicle_id = @vehicleId AND l.schedule_id = @scheduleId
                  AND l.resolved = 0 AND l.status <> 'Done' AND n.is_resolved = 0
                """, new { vehicleId, scheduleId });

            c.Execute("""
                UPDATE dbo.MaintenanceLogs SET resolved = 1, resolved_at = SYSUTCDATETIME()
                WHERE vehicle_id = @vehicleId AND schedule_id = @scheduleId AND resolved = 0 AND status <> 'Done'
                """, new { vehicleId, scheduleId });

            scope.Complete();
            return WriteResult.Ok;
        }
    }
}
