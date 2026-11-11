// ============================================================
//  STARQUEEN PMTS — TruckMaintenanceLogsController.cs
// ============================================================

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using starqueen.Models;
using starqueen.Services;

namespace starqueenAPI.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class TruckMaintenanceLogsController : ControllerBase
    {
        readonly TruckMaintenanceLogsServices _services;

        public TruckMaintenanceLogsController(TruckMaintenanceLogsServices services)
        {
            _services = services;
        }

        // ── Standard CRUD ────────────────────────────────────────────────────

        [HttpPost]
        [Authorize(Roles = Roles.Admin)]
        public IActionResult AddMaintenanceLog(Truck_Maintenance_Logs log)
            => _services.AddMaintenanceLog(log) ? Ok(true) : BadRequest("Failed to add maintenance log.");

        [HttpGet]
        public List<Truck_Maintenance_Logs> GetAllMaintenanceLogs()
            => _services.GetAllMaintenanceLogs();

        [HttpGet("{id}")]
        public ActionResult<Truck_Maintenance_Logs> GetMaintenanceLogById(int id)
            => _services.GetMaintenanceLogById(id) is { } log ? log : NotFound();

        // Send the full record — every column is overwritten
        [HttpPut("{id}")]
        [Authorize(Roles = Roles.Admin)]
        public IActionResult UpdateMaintenanceLog(int id, Truck_Maintenance_Logs log)
        {
            log.maintenance_id = id;
            return _services.UpdateMaintenanceLog(log) ? Ok(true) : NotFound();
        }

        [HttpDelete("{id}")]
        [Authorize(Roles = Roles.Admin)]
        public IActionResult DeleteMaintenanceLog(int id)
            => _services.DeleteMaintenanceLog(id) ? Ok(true) : NotFound();

        // ── SP-based endpoints ───────────────────────────────────────────────

        // GET /api/truckmaintenancelogs/alerts
        // Calls SP_Maintenance_Monitoring_Alert_Detection
        // Returns: per-component status, KM difference, overdue/replace counts
        [HttpGet("alerts")]
        public IActionResult GetMaintenanceAlerts()
        
            => Ok(_services.GetMaintenanceAlerts());

        // GET /api/truckmaintenancelogs/near-replacement
        // Calls SP_Trucks_With_Multiple_Near_Replacement
        // Returns: trucks with more than 1 component in Warning/Replace/Overdue
        [HttpGet("near-replacement")]
        public IActionResult GetNearReplacement()
        
            => Ok(_services.GetNearReplacement());

        // GET /api/truckmaintenancelogs/oldest-components
        // Calls SP_Oldest_Installed_Components_Per_Month
        // Returns: oldest maintenance log entry per truck
        [HttpGet("oldest-components")]
        public IActionResult GetOldestComponents()
        
            => Ok(_services.GetOldestComponents());

        // GET /api/truckmaintenancelogs/overdue-replacement
        // Calls SP_Components_Overdue_for_Replacement
        // Returns: trucks with components marked as Replace/Overdue status
        [HttpGet("overdue-replacement")]
        public IActionResult GetComponentsOverdueForReplacement()
        
            => Ok(_services.GetComponentsOverdueForReplacement());

        // GET /api/truckmaintenancelogs/good-status
        // Calls SP_Number_Of_Truck_Components_With_Good_Status
        // Returns: count of components in Good condition per truck
        [HttpGet("good-status")]
        public IActionResult GetComponentsWithGoodStatus()
        
            => Ok(_services.GetComponentsWithGoodStatus());

        // GET /api/truckmaintenancelogs/total-components
        // Calls SP_Total_Number_Of_Components_Installed_On_Each_Truck
        // Returns: total maintenance components installed per truck
        [HttpGet("total-components")]
        public IActionResult GetTotalComponentsPerTruck()
        
            => Ok(_services.GetTotalComponentsPerTruck());

        // GET /api/truckmaintenancelogs/last-submission/{truckId}
        // Returns: last month-based submission date per component for a specific truck
        // Used by: Truck Odometer (lock/unlock) + Maintenance Log (month status)
        // Pass truckId = 0 to return all (driver filters client-side)
        // FIXED: changed current_km = 0 to current_km IS NULL
        // because month-based logs now save current_km = NULL (not 0)
        [HttpGet("last-submission/{truckId}")]
        public IActionResult GetLastSubmissionPerComponent(int truckId)
        
            => Ok(_services.GetLastSubmissionPerComponent(truckId));
    }
}