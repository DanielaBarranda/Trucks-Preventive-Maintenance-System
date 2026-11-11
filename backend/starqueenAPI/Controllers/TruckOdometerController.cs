// ============================================================
//  STARQUEEN PMTS — TruckOdometerController.cs
//  Updated to support both KM and Month-based tracking
// ============================================================

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
        readonly TruckOdometerServices _truckOdometerServices = new TruckOdometerServices();
        readonly AdminNotificationsRepository _notifRepo = new AdminNotificationsRepository();

        // ── POST /api/truckodometer ───────────────────────────────────────────
        // KM-based tracking — existing behavior unchanged
        [HttpPost]
        public bool AddOdometer(Truck_Odometer odometer)
        {
            bool saved = _truckOdometerServices.AddOdometer(odometer);

            if (saved)
            {
                // Check maintenance thresholds by KM → insert Urgent/Warning notifications
                _notifRepo.CheckAndInsertNotifications(odometer.truck_id, odometer.current_km);

                // Always insert an Information notification for odometer history
                _notifRepo.InsertOdometerNotification(odometer.truck_id, odometer.current_km);
            }

            return saved;
        }

        // ── POST /api/truckodometer/month ─────────────────────────────────────
        // Month-based tracking — for trucks without working odometers
        // Body: { truck_id, components: [{ reference_id, last_maintenance_date }] }
        [HttpPost("month")]
        public IActionResult AddOdometerByMonth([FromBody] MonthOdometerRequest request)
        {
            try
            {
                if (request.truck_id <= 0)
                    return BadRequest("Invalid truck ID.");

                if (request.components == null || !request.components.Any())
                    return BadRequest("No component dates provided.");

                // No dummy odometer record — month trucks don't use KM tracking
                // Only run month-based notification check
                _notifRepo.CheckAndInsertNotificationsByMonth(
                    request.truck_id,
                    request.components
                );

                // Insert information notification for month submission
                _notifRepo.InsertMonthOdometerNotification(
                    request.truck_id,
                    request.components.Min(c => c.last_maintenance_date)
                );

                return Ok(new { message = "Month-based maintenance check submitted successfully." });
            }
            catch (Exception ex)
            {
                return StatusCode(500, ex.Message);
            }
        }

        // ── PUT /api/truckodometer/{id} ───────────────────────────────────────
        [HttpPut("{id}")]
        public bool UpdateOdometer(int id, Truck_Odometer odometer)
        {
            odometer.odometer_id = id;
            bool saved = _truckOdometerServices.UpdateOdometer(odometer);

            if (saved)
            {
                _notifRepo.CheckAndInsertNotifications(odometer.truck_id, odometer.current_km);
                _notifRepo.InsertOdometerNotification(odometer.truck_id, odometer.current_km);
            }

            return saved;
        }

        // ── GET /api/truckodometer ────────────────────────────────────────────
        [HttpGet]
        public List<Truck_Odometer> GetAllOdometers()
            => _truckOdometerServices.GetAllOdometers();

        // ── GET /api/truckodometer/{id} ───────────────────────────────────────
        [HttpGet("{id}")]
        public Truck_Odometer? GetOdometerById(int id)
            => _truckOdometerServices.GetOdometerById(id);

        // ── DELETE /api/truckodometer/{id} ────────────────────────────────────
        [HttpDelete("{id}")]
        public bool DeleteOdometer(int id)
            => _truckOdometerServices.DeleteOdometer(id);
    }

    // Models moved to starqueen.Models.OdometerModels
}