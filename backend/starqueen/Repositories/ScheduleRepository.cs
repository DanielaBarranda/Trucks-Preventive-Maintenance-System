using Dapper;
using Microsoft.Data.SqlClient;
using starqueen.Data;
using starqueen.Models;

namespace starqueen.Repositories
{
    public class ScheduleRepository
    {
        private const string Columns = "id, vehicle_type_id, task, km_warning, km_replace, km_overdue, month_interval";
        private readonly IDbConnectionFactory _db;

        public ScheduleRepository(IDbConnectionFactory db) => _db = db;

        public IEnumerable<MaintenanceSchedule> List(int? vehicleTypeId)
        {
            using var c = _db.CreateConnection();
            return c.Query<MaintenanceSchedule>($"""
                SELECT {Columns} FROM dbo.MaintenanceSchedules
                WHERE @vehicleTypeId IS NULL OR vehicle_type_id = @vehicleTypeId
                ORDER BY vehicle_type_id, task
                """, new { vehicleTypeId }).ToList();
        }

        public MaintenanceSchedule? Get(int id)
        {
            using var c = _db.CreateConnection();
            return c.QuerySingleOrDefault<MaintenanceSchedule>(
                $"SELECT {Columns} FROM dbo.MaintenanceSchedules WHERE id = @id", new { id });
        }

        // Returns the new id, or null when the vehicle type isn't in this organization
        public int? Create(MaintenanceSchedule s)
        {
            using var c = _db.CreateConnection();
            try
            {
                return c.QuerySingle<int>("""
                    INSERT dbo.MaintenanceSchedules (vehicle_type_id, task, km_warning, km_replace, km_overdue, month_interval)
                    OUTPUT INSERTED.id
                    VALUES (@VehicleTypeId, @Task, @KmWarning, @KmReplace, @KmOverdue, @MonthInterval)
                    """, s);
            }
            catch (SqlException ex) when (SqlErrors.IsReferenceViolation(ex)) { return null; }
        }

        public WriteResult Update(MaintenanceSchedule s)
        {
            using var c = _db.CreateConnection();
            try
            {
                return c.Execute("""
                    UPDATE dbo.MaintenanceSchedules
                    SET vehicle_type_id = @VehicleTypeId, task = @Task, km_warning = @KmWarning,
                        km_replace = @KmReplace, km_overdue = @KmOverdue, month_interval = @MonthInterval
                    WHERE id = @Id
                    """, s) == 1 ? WriteResult.Ok : WriteResult.NotFound;
            }
            catch (SqlException ex) when (SqlErrors.IsReferenceViolation(ex)) { return WriteResult.Invalid; }
        }

        // Fails with InUse when service history or expenses reference the schedule
        public WriteResult Delete(int id)
        {
            using var c = _db.CreateConnection();
            try
            {
                return c.Execute("DELETE dbo.MaintenanceSchedules WHERE id = @id", new { id }) == 1
                    ? WriteResult.Ok : WriteResult.NotFound;
            }
            catch (SqlException ex) when (SqlErrors.IsReferenceViolation(ex)) { return WriteResult.InUse; }
        }
    }
}
