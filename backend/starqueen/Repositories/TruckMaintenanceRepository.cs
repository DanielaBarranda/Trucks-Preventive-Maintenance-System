// ============================================================
//  STARQUEEN PMTS — TruckMaintenanceLogsRepository.cs
// ============================================================

using Dapper;
using starqueen.Data;
using starqueen.Models;
using System.Data;

namespace starqueen.Repositories
{
    public class TruckMaintenanceLogsRepository : GenericRepositories<Truck_Maintenance_Logs>
    {
        public TruckMaintenanceLogsRepository(IDbConnectionFactory db) : base(db) { }

        // ── SP_Maintenance_Monitoring_Alert_Detection ───────────────────────
        // Returns: per-component status, KM difference, overdue/replace counts
        // Used by: Maintenance Alert Detection section on Pending Maintenance page
        public List<MaintenanceAlert> GetMaintenanceAlerts()
        {
            using IDbConnection connection = CreateConnection();
            return connection.Query<MaintenanceAlert>(
                "EXEC SP_Maintenance_Monitoring_Alert_Detection"
            ).ToList();
        }

        // ── SP_Trucks_With_Multiple_Near_Replacement ────────────────────────
        // Returns: trucks with more than 1 component in Warning/Replace/Overdue
        // Used by: Near Replacement section on Pending Maintenance page
        public List<NearReplacement> GetNearReplacement()
        {
            using IDbConnection connection = CreateConnection();
            return connection.Query<NearReplacement>(
                "EXEC SP_Trucks_With_Multiple_Near_Replacement"
            ).ToList();
        }

        // ── SP_Oldest_Installed_Components_Per_Month ────────────────────────
        // Returns: oldest maintenance log entry per truck
        // Used by: Oldest Components section on Pending Maintenance page
        public List<OldestComponent> GetOldestComponents()
        {
            using IDbConnection connection = CreateConnection();
            return connection.Query<OldestComponent>(
                "EXEC SP_Oldest_Installed_Components_Per_Month"
            ).ToList();
        }

        // ── SP_Components_Overdue_for_Replacement ───────────────────────────
        // Returns: trucks with components marked as Replace status
        // Used by: Components Overdue section on Pending Maintenance page
        public List<OverdueComponent> GetComponentsOverdueForReplacement()
        {
            using IDbConnection connection = CreateConnection();
            return connection.Query<OverdueComponent>(
                "EXEC SP_Components_Overdue_for_Replacement"
            ).ToList();
        }

        // ── SP_Number_Of_Truck_Components_With_Good_Status ──────────────────
        // Returns: count of components in Good condition per truck
        // Used by: Good Status Components section on Pending Maintenance page
        public List<GoodStatusComponent> GetComponentsWithGoodStatus()
        {
            using IDbConnection connection = CreateConnection();
            return connection.Query<GoodStatusComponent>(
                "EXEC SP_Number_Of_Truck_Components_With_Good_Status"
            ).ToList();
        }

        // ── SP_Total_Number_Of_Components_Installed_On_Each_Truck ───────────
        // Returns: total maintenance components installed per truck
        // Used by: Total Components section on Pending Maintenance page
        public List<TotalComponents> GetTotalComponentsPerTruck()
        {
            using IDbConnection connection = CreateConnection();
            return connection.Query<TotalComponents>(
                "EXEC SP_Total_Number_Of_Components_Installed_On_Each_Truck"
            ).ToList();
        }

        // ── Last month-based submission per component ───────────────────────
        // Month-based logs are saved with current_km = NULL.
        // truckId <= 0 returns all trucks (driver filters client-side).
        // Used by: Truck Odometer (lock/unlock) + Maintenance Log (month status)
        public IEnumerable<dynamic> GetLastSubmissionPerComponent(int truckId)
        {
            using IDbConnection connection = CreateConnection();
            return connection.Query<dynamic>(@"
                SELECT tml.truck_id, tml.reference_id,
                       MAX(tml.created_at) AS last_submitted_at,
                       mr.month_interval
                FROM   Truck_Maintenance_Logs tml
                JOIN   Maintenance_Reference mr ON mr.reference_id = tml.reference_id
                WHERE  tml.current_km IS NULL
                  AND  (@TruckId <= 0 OR tml.truck_id = @TruckId)
                GROUP BY tml.truck_id, tml.reference_id, mr.month_interval",
                new { TruckId = truckId }
            ).ToList();
        }
    }
}