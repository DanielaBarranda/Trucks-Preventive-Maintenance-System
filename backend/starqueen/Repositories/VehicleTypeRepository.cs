using Dapper;
using Microsoft.Data.SqlClient;
using starqueen.Data;
using starqueen.Models;

namespace starqueen.Repositories
{
    public class VehicleTypeRepository
    {
        private readonly IDbConnectionFactory _db;

        public VehicleTypeRepository(IDbConnectionFactory db) => _db = db;

        public IEnumerable<VehicleType> List()
        {
            using var c = _db.CreateConnection();
            return c.Query<VehicleType>("SELECT id, name FROM dbo.VehicleTypes ORDER BY name").ToList();
        }

        // Returns the new id, or null when the name already exists in this organization
        public int? Create(string name)
        {
            using var c = _db.CreateConnection();
            try
            {
                return c.QuerySingle<int>("INSERT dbo.VehicleTypes (name) OUTPUT INSERTED.id VALUES (@name)", new { name });
            }
            catch (SqlException ex) when (SqlErrors.IsDuplicate(ex)) { return null; }
        }

        public WriteResult Rename(int id, string name)
        {
            using var c = _db.CreateConnection();
            try
            {
                return c.Execute("UPDATE dbo.VehicleTypes SET name = @name WHERE id = @id", new { id, name }) == 1
                    ? WriteResult.Ok : WriteResult.NotFound;
            }
            catch (SqlException ex) when (SqlErrors.IsDuplicate(ex)) { return WriteResult.Conflict; }
        }

        // Deletes the type and its schedules, unless vehicles still use it
        public WriteResult Delete(int id)
        {
            using var c = _db.CreateConnection();
            if (c.ExecuteScalar<int>("SELECT COUNT(*) FROM dbo.VehicleTypes WHERE id = @id", new { id }) == 0)
                return WriteResult.NotFound;
            if (c.ExecuteScalar<int>("SELECT COUNT(*) FROM dbo.Vehicles WHERE vehicle_type_id = @id", new { id }) > 0)
                return WriteResult.InUse;

            using var tx = c.BeginTransaction();
            try
            {
                c.Execute("DELETE dbo.MaintenanceSchedules WHERE vehicle_type_id = @id", new { id }, tx);
                c.Execute("DELETE dbo.VehicleTypes WHERE id = @id", new { id }, tx);
                tx.Commit();
                return WriteResult.Ok;
            }
            catch (SqlException ex) when (SqlErrors.IsReferenceViolation(ex))
            {
                tx.Rollback();
                return WriteResult.InUse;
            }
        }
    }
}
