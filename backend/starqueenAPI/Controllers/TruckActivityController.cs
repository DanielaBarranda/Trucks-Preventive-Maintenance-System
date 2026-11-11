// ============================================================
//  STARQUEEN PMTS — TruckActivityController.cs
// ============================================================

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
        readonly TruckActivityServices _services = new TruckActivityServices();
        readonly TruckActivityRepository _repo = new TruckActivityRepository();
        readonly AdminNotificationsRepository _notifRepo = new AdminNotificationsRepository();

        // ── Standard CRUD ────────────────────────────────────────────────────

        // POST /api/truckactivity
        // Saves activity + notifies admin
        [HttpPost]
        public IActionResult AddTruckActivity(Truck_Activity activity)
        {
            try
            {
                bool saved = _services.AddTruckActivity(activity);
                if (!saved) return BadRequest("Failed to save activity.");

                // Notify admin that driver logged a new activity
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
                    Console.WriteLine($"[Activity notification error] {notifEx.Message}");
                }

                return Ok(true);
            }
            catch (Exception ex)
            {
                return StatusCode(500, ex.Message);
            }
        }

        // GET /api/truckactivity
        [HttpGet]
        public List<Truck_Activity> GetAllTruckActivities()
            => _services.GetAllTruckActivities();

        // GET /api/truckactivity/{id}
        [HttpGet("{id}")]
        public Truck_Activity? GetTruckActivityById(int id)
            => _services.GetTruckActivityById(id);

        // PUT /api/truckactivity/{id}
        [HttpPut("{id}")]
        public bool UpdateTruckActivity(int id, Truck_Activity activity)
        {
            activity.truck_activity_id = id;
            return _services.UpdateTruckActivity(activity);
        }

        // DELETE /api/truckactivity/{id}
        [HttpDelete("{id}")]
        public bool DeleteTruckActivity(int id)
            => _services.DeleteTruckActivity(id);

        // ── SP-based endpoints ───────────────────────────────────────────────

        // GET /api/truckactivity/driver-summary
        // Calls SP_Driver_Performance_Activity_Summary
        [HttpGet("driver-summary")]
        public IActionResult GetDriverSummary()
        {
            try { return Ok(_repo.GetDriverPerformanceSummary()); }
            catch (Exception ex) { return StatusCode(500, ex.Message); }
        }

        // GET /api/truckactivity/trip-summary
        // Calls SP_Monitoring_The_First_And_Last_Trip_Of_A_Truck
        [HttpGet("trip-summary")]
        public IActionResult GetTripSummary()
        {
            try { return Ok(_repo.GetFirstAndLastTrip()); }
            catch (Exception ex) { return StatusCode(500, ex.Message); }
        }
    }
}