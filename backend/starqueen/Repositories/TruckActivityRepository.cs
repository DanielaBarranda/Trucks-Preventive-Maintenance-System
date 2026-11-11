// ============================================================
//  STARQUEEN PMTS — TruckActivityRepository.cs
//  Extends GenericRepositories with SP-based methods
// ============================================================

using Dapper;
using starqueen.Data;
using starqueen.Models;
using System.Data;

namespace starqueen.Repositories
{
    public class TruckActivityRepository : GenericRepositories<Truck_Activity>
    {
        public TruckActivityRepository(IDbConnectionFactory db) : base(db) { }

        // ── SP_Driver_Performance_Activity_Summary ──────────────────────────
        public List<DriverPerformanceSummary> GetDriverPerformanceSummary()
        {
            using IDbConnection connection = CreateConnection();
            return connection.Query<DriverPerformanceSummary>(
                "EXEC SP_Driver_Performance_Activity_Summary"
            ).ToList();
        }

        // ── SP_Monitoring_The_First_And_Last_Trip_Of_A_Truck ────────────────
        public List<TripSummary> GetFirstAndLastTrip()
        {
            using IDbConnection connection = CreateConnection();
            return connection.Query<TripSummary>(
                "EXEC SP_Monitoring_The_First_And_Last_Trip_Of_A_Truck"
            ).ToList();
        }
    }
}