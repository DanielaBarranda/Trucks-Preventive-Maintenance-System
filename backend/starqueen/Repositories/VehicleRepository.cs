using Dapper;
using Microsoft.Data.SqlClient;
using starqueen.Auth;
using starqueen.Data;
using starqueen.Models;

namespace starqueen.Repositories
{
    public class VehicleRepository
    {
        private const string Select = """
            SELECT v.id, v.name, v.plate_number, v.vehicle_type_id, vt.name AS vehicle_type,
                   v.assigned_driver_id, d.full_name AS assigned_driver_name, v.is_active
            FROM dbo.Vehicles v
            JOIN dbo.VehicleTypes vt ON vt.id = v.vehicle_type_id
            LEFT JOIN dbo.Users d ON d.id = v.assigned_driver_id
            """;

        private readonly IDbConnectionFactory _db;

        public VehicleRepository(IDbConnectionFactory db) => _db = db;

        public IEnumerable<Vehicle> List()
        {
            using var c = _db.CreateConnection();
            return c.Query<Vehicle>($"{Select} ORDER BY v.plate_number").ToList();
        }

        public Vehicle? Get(int id)
        {
            using var c = _db.CreateConnection();
            return c.QuerySingleOrDefault<Vehicle>($"{Select} WHERE v.id = @id", new { id });
        }

        // The vehicle assigned to a driver, if any
        public Vehicle? GetAssignedTo(int driverId)
        {
            using var c = _db.CreateConnection();
            return c.QuerySingleOrDefault<Vehicle>($"{Select} WHERE v.assigned_driver_id = @driverId", new { driverId });
        }

        // Returns the new id; Conflict = duplicate plate, Invalid = unknown vehicle type
        public (WriteResult Result, int Id) Create(string name, string plateNumber, int vehicleTypeId, bool isActive)
        {
            using var c = _db.CreateConnection();
            try
            {
                int id = c.QuerySingle<int>("""
                    INSERT dbo.Vehicles (name, plate_number, vehicle_type_id, is_active)
                    OUTPUT INSERTED.id VALUES (@name, @plateNumber, @vehicleTypeId, @isActive)
                    """, new { name, plateNumber, vehicleTypeId, isActive });
                return (WriteResult.Ok, id);
            }
            catch (SqlException ex) when (SqlErrors.IsDuplicate(ex)) { return (WriteResult.Conflict, 0); }
            catch (SqlException ex) when (SqlErrors.IsReferenceViolation(ex)) { return (WriteResult.Invalid, 0); }
        }

        public WriteResult Update(int id, string name, string plateNumber, int vehicleTypeId, bool isActive)
        {
            using var c = _db.CreateConnection();
            try
            {
                return c.Execute("""
                    UPDATE dbo.Vehicles
                    SET name = @name, plate_number = @plateNumber, vehicle_type_id = @vehicleTypeId, is_active = @isActive
                    WHERE id = @id
                    """, new { id, name, plateNumber, vehicleTypeId, isActive }) == 1 ? WriteResult.Ok : WriteResult.NotFound;
            }
            catch (SqlException ex) when (SqlErrors.IsDuplicate(ex)) { return WriteResult.Conflict; }
            catch (SqlException ex) when (SqlErrors.IsReferenceViolation(ex)) { return WriteResult.Invalid; }
        }

        // InUse when the vehicle has logs, trips or expenses (deactivate it instead)
        public WriteResult Delete(int id)
        {
            using var c = _db.CreateConnection();
            try
            {
                return c.Execute("DELETE dbo.Vehicles WHERE id = @id", new { id }) == 1 ? WriteResult.Ok : WriteResult.NotFound;
            }
            catch (SqlException ex) when (SqlErrors.IsReferenceViolation(ex)) { return WriteResult.InUse; }
        }

        // Assigns (or with null, unassigns) a driver.
        // NotFound = no such vehicle; Invalid = not an active driver of this organization;
        // Conflict = the driver already has another vehicle.
        public WriteResult Assign(int vehicleId, int? driverId)
        {
            using var c = _db.CreateConnection();
            if (c.ExecuteScalar<int>("SELECT COUNT(*) FROM dbo.Vehicles WHERE id = @vehicleId", new { vehicleId }) == 0)
                return WriteResult.NotFound;

            if (driverId is int d)
            {
                bool isActiveDriver = c.ExecuteScalar<int>(
                    "SELECT COUNT(*) FROM dbo.Users WHERE id = @d AND role = @role AND is_active = 1",
                    new { d, role = Roles.Driver }) == 1;
                if (!isActiveDriver) return WriteResult.Invalid;

                bool hasOtherVehicle = c.ExecuteScalar<int>(
                    "SELECT COUNT(*) FROM dbo.Vehicles WHERE assigned_driver_id = @d AND id <> @vehicleId",
                    new { d, vehicleId }) > 0;
                if (hasOtherVehicle) return WriteResult.Conflict;
            }

            try
            {
                c.Execute("UPDATE dbo.Vehicles SET assigned_driver_id = @driverId WHERE id = @vehicleId", new { vehicleId, driverId });
                return WriteResult.Ok;
            }
            catch (SqlException ex) when (SqlErrors.IsDuplicate(ex)) { return WriteResult.Conflict; }
        }
    }
}
