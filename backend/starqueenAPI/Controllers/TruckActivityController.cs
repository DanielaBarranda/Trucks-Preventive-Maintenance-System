// ============================================================
//  STARQUEEN PMTS — TruckActivityController.cs
// ============================================================

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using starqueen.Models;
using starqueen.Services;
using starqueen.Repositories;

namespace starqueenAPI.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class TruckActivityController : ControllerBase
    {
        readonly TruckActivityServices _services;
        readonly TruckActivityRepository _repo;
        readonly AdminNotificationsRepository _notifRepo;
        readonly ILogger<TruckActivityController> _logger;

        public TruckActivityController(
            TruckActivityServices services,
            TruckActivityRepository repo,
            AdminNotificationsRepository notifRepo,
            ILogger<TruckActivityController> logger)
        {
            _logger = logger;
            _services = services;
            _repo = repo;
            _notifRepo = notifRepo;
        }

        // ── Standard CRUD ────────────────────────────────────────────────────

        // POST /api/truckactivity
        // Saves activity + notifies admin
        [HttpPost]
        public IActionResult AddTruckActivity(Truck_Activity activity)
        {
            bool saved = _services.AddTruckActivity(activity);
            if (!saved) return BadRequest("Failed to save activity.");

            // Notify admin that driver logged a new activity (non-fatal if it fails)
            try
            {
                _notifRepo.InsertActivityNotification(
                    activity.truck_id,
                    activity.farm ?? "—",
                    activity.address ?? "—",
                    activity.driver_name ?? "—"
                );
            }
            catch (Exception notifEx)
            {
                _logger.LogError(notifEx, "Activity notification failed for truck {TruckId}", activity.truck_id);
            }

            return Ok(true);
        }

        // GET /api/truckactivity
        [HttpGet]
        public List<Truck_Activity> GetAllTruckActivities()
            => _services.GetAllTruckActivities();

        // GET /api/truckactivity/{id}
        [HttpGet("{id}")]
        public ActionResult<Truck_Activity> GetTruckActivityById(int id)
            => _services.GetTruckActivityById(id) is { } a ? a : NotFound();

        // PUT /api/truckactivity/{id}
        // Drivers use this to log departure/arrival. Send the full record.
        [HttpPut("{id}")]
        public IActionResult UpdateTruckActivity(int id, Truck_Activity activity)
        {
            activity.truck_activity_id = id;
            return _services.UpdateTruckActivity(activity) ? Ok(true) : NotFound();
        }

        // DELETE /api/truckactivity/{id}
        [HttpDelete("{id}")]
        [Authorize(Roles = Roles.Admin)]
        public IActionResult DeleteTruckActivity(int id)
            => _services.DeleteTruckActivity(id) ? Ok(true) : NotFound();

        // ── SP-based endpoints ───────────────────────────────────────────────

        // GET /api/truckactivity/driver-summary
        // Calls SP_Driver_Performance_Activity_Summary
        [HttpGet("driver-summary")]
        public IActionResult GetDriverSummary()
        
            => Ok(_repo.GetDriverPerformanceSummary());

        // GET /api/truckactivity/trip-summary
        // Calls SP_Monitoring_The_First_And_Last_Trip_Of_A_Truck
        [HttpGet("trip-summary")]
        public IActionResult GetTripSummary()
        
            => Ok(_repo.GetFirstAndLastTrip());
    }
}