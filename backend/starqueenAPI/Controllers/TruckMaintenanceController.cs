using Dapper;
// ============================================================
//  STARQUEEN PMTS — TruckMaintenanceLogsController.cs
// ============================================================

using Microsoft.AspNetCore.Mvc;
using starqueen.Models;
using starqueen.Services;
using starqueen.Repositories;

namespace starqueenAPI.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class TruckMaintenanceLogsController : ControllerBase
    {
        readonly TruckMaintenanceLogsServices _services = new TruckMaintenanceLogsServices();
        readonly TruckMaintenanceLogsRepository _repo = new TruckMaintenanceLogsRepository();

        // ── Standard CRUD ────────────────────────────────────────────────────

        [HttpPost]
        public bool AddMaintenanceLog(Truck_Maintenance_Logs log)
            => _services.AddMaintenanceLog(log);

        [HttpGet]
        public List<Truck_Maintenance_Logs> GetAllMaintenanceLogs()
            => _services.GetAllMaintenanceLogs();

        [HttpGet("{id}")]
        public Truck_Maintenance_Logs? GetMaintenanceLogById(int id)
            => _services.GetMaintenanceLogById(id);

        [HttpPut("{id}")]
        public bool UpdateMaintenanceLog(int id, Truck_Maintenance_Logs log)
        {
            log.maintenance_id = id;
            return _services.UpdateMaintenanceLog(log);
        }

        [HttpDelete("{id}")]
        public bool DeleteMaintenanceLog(int id)
            => _services.DeleteMaintenanceLog(id);

        // ── SP-based endpoints ───────────────────────────────────────────────

        // GET /api/truckmaintenancelogs/alerts
        // Calls SP_Maintenance_Monitoring_Alert_Detection
        // Returns: per-component status, KM difference, overdue/replace counts
        [HttpGet("alerts")]
        public IActionResult GetMaintenanceAlerts()
        {
            try { return Ok(_services.GetMaintenanceAlerts()); }
            catch (Exception ex) { return StatusCode(500, ex.Message); }
        }

        // GET /api/truckmaintenancelogs/near-replacement
        // Calls SP_Trucks_With_Multiple_Near_Replacement
        // Returns: trucks with more than 1 component in Warning/Replace/Overdue
        [HttpGet("near-replacement")]
        public IActionResult GetNearReplacement()
        {
            try { return Ok(_services.GetNearReplacement()); }
            catch (Exception ex) { return StatusCode(500, ex.Message); }
        }

        // GET /api/truckmaintenancelogs/oldest-components
        // Calls SP_Oldest_Installed_Components_Per_Month
        // Returns: oldest maintenance log entry per truck
        [HttpGet("oldest-components")]
        public IActionResult GetOldestComponents()
        {
            try { return Ok(_services.GetOldestComponents()); }
            catch (Exception ex) { return StatusCode(500, ex.Message); }
        }

        // GET /api/truckmaintenancelogs/overdue-replacement
        // Calls SP_Components_Overdue_for_Replacement
        // Returns: trucks with components marked as Replace/Overdue status
        [HttpGet("overdue-replacement")]
        public IActionResult GetComponentsOverdueForReplacement()
        {
            try { return Ok(_services.GetComponentsOverdueForReplacement()); }
            catch (Exception ex) { return StatusCode(500, ex.Message); }
        }

        // GET /api/truckmaintenancelogs/good-status
        // Calls SP_Number_Of_Truck_Components_With_Good_Status
        // Returns: count of components in Good condition per truck
        [HttpGet("good-status")]
        public IActionResult GetComponentsWithGoodStatus()
        {
            try { return Ok(_services.GetComponentsWithGoodStatus()); }
            catch (Exception ex) { return StatusCode(500, ex.Message); }
        }

        // GET /api/truckmaintenancelogs/total-components
        // Calls SP_Total_Number_Of_Components_Installed_On_Each_Truck
        // Returns: total maintenance components installed per truck
        [HttpGet("total-components")]
        public IActionResult GetTotalComponentsPerTruck()
        {
            try { return Ok(_services.GetTotalComponentsPerTruck()); }
            catch (Exception ex) { return StatusCode(500, ex.Message); }
        }

        // GET /api/truckmaintenancelogs/last-submission/{truckId}
        // Returns: last month-based submission date per component for a specific truck
        // Used by: Truck Odometer (lock/unlock) + Maintenance Log (month status)
        // Pass truckId = 0 to return all (driver filters client-side)
        // FIXED: changed current_km = 0 to current_km IS NULL
        // because month-based logs now save current_km = NULL (not 0)
        [HttpGet("last-submission/{truckId}")]
        public IActionResult GetLastSubmissionPerComponent(int truckId)
        {
            try
            {
                using var connection = new Microsoft.Data.SqlClient.SqlConnection(
                    "Server=(localdb)\\MSSQLLocalDB;Database=Starqueen_PMTS;" +
                    "Trusted_Connection=True;MultipleActiveResultSets=True");

                var sql = truckId > 0
                    ? @"SELECT tml.truck_id, tml.reference_id,
                               MAX(tml.created_at) AS last_submitted_at,
                               mr.month_interval
                        FROM Truck_Maintenance_Logs tml
                        JOIN Maintenance_Reference mr ON mr.reference_id = tml.reference_id
                        WHERE tml.truck_id     = @TruckId
                          AND tml.current_km IS NULL
                        GROUP BY tml.truck_id, tml.reference_id, mr.month_interval"
                    : @"SELECT tml.truck_id, tml.reference_id,
                               MAX(tml.created_at) AS last_submitted_at,
                               mr.month_interval
                        FROM Truck_Maintenance_Logs tml
                        JOIN Maintenance_Reference mr ON mr.reference_id = tml.reference_id
                        WHERE tml.current_km IS NULL
                        GROUP BY tml.truck_id, tml.reference_id, mr.month_interval";

                var result = connection.Query<dynamic>(sql,
                    truckId > 0 ? (object)new { TruckId = truckId } : new { }
                );

                return Ok(result);
            }
            catch (Exception ex) { return StatusCode(500, ex.Message); }
        }
    }
}