using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using starqueen.Auth;
using starqueen.Models;
using starqueen.Repositories;
using System.ComponentModel.DataAnnotations;

namespace starqueenAPI.Controllers
{
    [Route("api/schedules")]
    [ApiController]
    public class SchedulesController : ControllerBase
    {
        public record ScheduleRequest(
            int VehicleTypeId,
            [Required, MaxLength(100)] string Task,
            [Range(0, int.MaxValue)] int? KmWarning = null,
            [Range(0, int.MaxValue)] int? KmReplace = null,
            [Range(0, int.MaxValue)] int? KmOverdue = null,
            [Range(1, 240)] int? MonthInterval = null);

        private readonly ScheduleRepository _schedules;

        public SchedulesController(ScheduleRepository schedules) => _schedules = schedules;

        // GET /api/schedules?vehicle_type_id=
        [HttpGet]
        public IEnumerable<MaintenanceSchedule> List([FromQuery(Name = "vehicle_type_id")] int? vehicleTypeId)
            => _schedules.List(vehicleTypeId);

        [HttpPost]
        [Authorize(Policy = Permissions.SchedulesManage)]
        public IActionResult Create(ScheduleRequest request)
        {
            if (Validate(request) is string error) return BadRequest(new { message = error });
            return _schedules.Create(ToModel(0, request)) is int id
                ? StatusCode(StatusCodes.Status201Created, new { id })
                : BadRequest(new { message = "Unknown vehicle type." });
        }

        [HttpPut("{id:int}")]
        [Authorize(Policy = Permissions.SchedulesManage)]
        public IActionResult Update(int id, ScheduleRequest request)
        {
            if (Validate(request) is string error) return BadRequest(new { message = error });
            return _schedules.Update(ToModel(id, request)) switch
            {
                WriteResult.Ok => Ok(true),
                WriteResult.Invalid => BadRequest(new { message = "Unknown vehicle type." }),
                _ => NotFound()
            };
        }

        [HttpDelete("{id:int}")]
        [Authorize(Policy = Permissions.SchedulesManage)]
        public IActionResult Delete(int id) => _schedules.Delete(id) switch
        {
            WriteResult.Ok => Ok(true),
            WriteResult.InUse => Conflict(new { message = "This schedule has service records or expenses." }),
            _ => NotFound()
        };

        // Thresholds must be in order, and the schedule must be due by distance or by time
        private static string? Validate(ScheduleRequest r)
        {
            if (r.KmReplace is null && r.MonthInterval is null)
                return "Set at least a replacement distance (km_replace) or a month interval.";

            var ordered = new[] { r.KmWarning, r.KmReplace, r.KmOverdue }.Where(v => v.HasValue).Select(v => v!.Value).ToList();
            for (int i = 1; i < ordered.Count; i++)
                if (ordered[i] < ordered[i - 1])
                    return "Distances must be in order: km_warning ≤ km_replace ≤ km_overdue.";
            return null;
        }

        private static MaintenanceSchedule ToModel(int id, ScheduleRequest r) => new()
        {
            Id = id,
            VehicleTypeId = r.VehicleTypeId,
            Task = r.Task.Trim(),
            KmWarning = r.KmWarning,
            KmReplace = r.KmReplace,
            KmOverdue = r.KmOverdue,
            MonthInterval = r.MonthInterval
        };
    }
}
