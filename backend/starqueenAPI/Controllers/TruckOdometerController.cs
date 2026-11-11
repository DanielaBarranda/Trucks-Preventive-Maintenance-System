// ============================================================
//  STARQUEEN PMTS — TruckOdometerController.cs
//  Updated to support both KM and Month-based tracking
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
    public class TruckOdometerController : ControllerBase
    {
        readonly TruckOdometerServices _truckOdometerServices;
        readonly AdminNotificationsRepository _notifRepo;

        public TruckOdometerController(TruckOdometerServices truckOdometerServices, AdminNotificationsRepository notifRepo)
        {
            _truckOdometerServices = truckOdometerServices;
            _notifRepo = notifRepo;
        }

        // ── POST /api/truckodometer ───────────────────────────────────────────
        // KM-based tracking — existing behavior unchanged
        [HttpPost]
        public IActionResult AddOdometer(Truck_Odometer odometer)
        {
            if (!_truckOdometerServices.AddOdometer(odometer))
                return BadRequest("Failed to save odometer reading.");

            // Check maintenance thresholds by KM → insert Urgent/Warning notifications
            _notifRepo.CheckAndInsertNotifications(odometer.truck_id, odometer.current_km);

            // Always insert an Information notification for odometer history
            _notifRepo.InsertOdometerNotification(odometer.truck_id, odometer.current_km);

            return Ok(true);
        }

        // ── POST /api/truckodometer/month ─────────────────────────────────────
        // Month-based tracking — for trucks without working odometers
        // Body: { truck_id, components: [{ reference_id, last_maintenance_date }] }
        [HttpPost("month")]
        public IActionResult AddOdometerByMonth([FromBody] MonthOdometerRequest request)
        {
            if (request.truck_id <= 0)
                return BadRequest("Invalid truck ID.");

            if (request.components == null || !request.components.Any())
                return BadRequest("No component dates provided.");

            if (request.components.Any(c => c.last_maintenance_date > DateTime.Now))
                return BadRequest("Last maintenance date cannot be in the future.");

            // No dummy odometer record — month trucks don't use KM tracking
            // Only run month-based notification check
            _notifRepo.CheckAndInsertNotificationsByMonth(request.truck_id, request.components);

            // Insert information notification for month submission
            _notifRepo.InsertMonthOdometerNotification(
                request.truck_id,
                request.components.Min(c => c.last_maintenance_date)
            );

            return Ok(new { message = "Month-based maintenance check submitted successfully." });
        }

        // ── PUT /api/truckodometer/{id} ───────────────────────────────────────
        [HttpPut("{id}")]
        [Authorize(Roles = Roles.Admin)]
        public IActionResult UpdateOdometer(int id, Truck_Odometer odometer)
        {
            odometer.odometer_id = id;
            if (!_truckOdometerServices.UpdateOdometer(odometer)) return NotFound();

            _notifRepo.CheckAndInsertNotifications(odometer.truck_id, odometer.current_km);
            _notifRepo.InsertOdometerNotification(odometer.truck_id, odometer.current_km);
            return Ok(true);
        }

        // ── GET /api/truckodometer ────────────────────────────────────────────
        [HttpGet]
        public List<Truck_Odometer> GetAllOdometers()
            => _truckOdometerServices.GetAllOdometers();

        // ── GET /api/truckodometer/{id} ───────────────────────────────────────
        [HttpGet("{id}")]
        public ActionResult<Truck_Odometer> GetOdometerById(int id)
            => _truckOdometerServices.GetOdometerById(id) is { } o ? o : NotFound();

        // ── DELETE /api/truckodometer/{id} ────────────────────────────────────
        [HttpDelete("{id}")]
        [Authorize(Roles = Roles.Admin)]
        public IActionResult DeleteOdometer(int id)
            => _truckOdometerServices.DeleteOdometer(id) ? Ok(true) : NotFound();
    }

}