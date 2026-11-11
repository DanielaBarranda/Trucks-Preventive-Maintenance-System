using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using starqueen.Auth;
using starqueen.Models;
using starqueen.Repositories;
using starqueenAPI.Infrastructure;
using System.ComponentModel.DataAnnotations;

namespace starqueenAPI.Controllers
{
    [Route("api/vehicles")]
    [ApiController]
    public class VehiclesController : ControllerBase
    {
        public record VehicleRequest(
            [Required, MaxLength(100)] string Name,
            [Required, MaxLength(20)] string PlateNumber,
            int VehicleTypeId,
            bool IsActive = true);

        public record AssignRequest(int? DriverId);

        public record ServiceRequest(int ScheduleId, DateTime ServiceDate, [Range(0, int.MaxValue)] int? Reading = null);

        private readonly VehicleRepository _vehicles;
        private readonly MaintenanceLogRepository _logs;

        public VehiclesController(VehicleRepository vehicles, MaintenanceLogRepository logs)
        {
            _vehicles = vehicles;
            _logs = logs;
        }

        // GET /api/vehicles — Owner/Admin
        [HttpGet]
        [Authorize(Policy = Permissions.ReportsView)]
        public IEnumerable<Vehicle> List() => _vehicles.List();

        // GET /api/vehicles/mine — the logged-in driver's assigned vehicle
        [HttpGet("mine")]
        [Authorize(Policy = Permissions.LogsSubmit)]
        public ActionResult<Vehicle> Mine()
            => _vehicles.GetAssignedTo(User.GetUserId()) is { } v ? v : NotFound(new { message = "No vehicle is assigned to you." });

        [HttpGet("{id:int}")]
        [Authorize(Policy = Permissions.ReportsView)]
        public ActionResult<Vehicle> Get(int id) => _vehicles.Get(id) is { } v ? v : NotFound();

        [HttpPost]
        [Authorize(Policy = Permissions.VehiclesManage)]
        public IActionResult Create(VehicleRequest r)
        {
            var (result, id) = _vehicles.Create(r.Name.Trim(), r.PlateNumber.Trim(), r.VehicleTypeId, r.IsActive);
            return result switch
            {
                WriteResult.Ok => StatusCode(StatusCodes.Status201Created, new { id }),
                WriteResult.Conflict => Conflict(new { message = "A vehicle with that plate number already exists." }),
                _ => BadRequest(new { message = "Unknown vehicle type." })
            };
        }

        [HttpPut("{id:int}")]
        [Authorize(Policy = Permissions.VehiclesManage)]
        public IActionResult Update(int id, VehicleRequest r) =>
            _vehicles.Update(id, r.Name.Trim(), r.PlateNumber.Trim(), r.VehicleTypeId, r.IsActive) switch
            {
                WriteResult.Ok => Ok(true),
                WriteResult.Conflict => Conflict(new { message = "A vehicle with that plate number already exists." }),
                WriteResult.Invalid => BadRequest(new { message = "Unknown vehicle type." }),
                _ => NotFound()
            };

        [HttpDelete("{id:int}")]
        [Authorize(Policy = Permissions.VehiclesManage)]
        public IActionResult Delete(int id) => _vehicles.Delete(id) switch
        {
            WriteResult.Ok => Ok(true),
            WriteResult.InUse => Conflict(new { message = "This vehicle has history. Deactivate it instead." }),
            _ => NotFound()
        };

        // PUT /api/vehicles/{id}/assign  { driver_id: int | null }
        [HttpPut("{id:int}/assign")]
        [Authorize(Policy = Permissions.VehiclesManage)]
        public IActionResult Assign(int id, AssignRequest r) => _vehicles.Assign(id, r.DriverId) switch
        {
            WriteResult.Ok => Ok(true),
            WriteResult.Conflict => Conflict(new { message = "That driver already has a vehicle." }),
            WriteResult.Invalid => BadRequest(new { message = "Driver not found or not active." }),
            _ => NotFound()
        };

        // POST /api/vehicles/{id}/services — record maintenance done; resolves open alerts
        [HttpPost("{id:int}/services")]
        [Authorize(Policy = Permissions.VehiclesManage)]
        public IActionResult RecordService(int id, ServiceRequest r)
        {
            if (r.ServiceDate.Date > DateTime.UtcNow.Date.AddDays(1))
                return BadRequest(new { message = "Service date cannot be in the future." });

            return _logs.RecordService(id, r.ScheduleId, r.ServiceDate, r.Reading, User.GetUserId()) switch
            {
                WriteResult.Ok => StatusCode(StatusCodes.Status201Created, new { message = "Service recorded." }),
                WriteResult.Invalid => BadRequest(new { message = "That schedule is for a different vehicle type." }),
                _ => NotFound()
            };
        }
    }
}
