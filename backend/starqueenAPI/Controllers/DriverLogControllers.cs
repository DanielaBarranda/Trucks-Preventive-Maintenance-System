using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using starqueen.Auth;
using starqueen.Data;
using starqueen.Models;
using starqueen.Repositories;
using starqueen.Services;
using starqueenAPI.Infrastructure;
using System.ComponentModel.DataAnnotations;
using System.Globalization;
using System.Transactions;

namespace starqueenAPI.Controllers
{
    // Shared helpers for endpoints drivers use. Drivers always act on their assigned
    // vehicle; no endpoint accepts a vehicle id from a driver.
    [ApiController]
    public abstract class DriverLogControllerBase : ControllerBase
    {
        protected readonly VehicleRepository Vehicles;

        protected DriverLogControllerBase(VehicleRepository vehicles) => Vehicles = vehicles;

        protected bool IsDriver => User.IsInRole(Roles.Driver);

        protected ObjectResult NoVehicle() =>
            Conflict(new { message = "No vehicle is assigned to you." });

        protected Vehicle? MyVehicle() => Vehicles.GetAssignedTo(User.GetUserId());
    }

    // ── /api/odometer-readings ───────────────────────────────────────────────
    [Route("api/odometer-readings")]
    public class OdometerReadingsController : DriverLogControllerBase
    {
        public record ReadingRequest([Range(0, int.MaxValue)] int Reading);

        private readonly OdometerRepository _readings;
        private readonly MaintenanceEvaluator _evaluator;
        private readonly NotificationRepository _notifications;
        private readonly OrganizationRepository _organizations;

        public OdometerReadingsController(VehicleRepository vehicles, OdometerRepository readings,
            MaintenanceEvaluator evaluator, NotificationRepository notifications, OrganizationRepository organizations)
            : base(vehicles)
        {
            _readings = readings;
            _evaluator = evaluator;
            _notifications = notifications;
            _organizations = organizations;
        }

        // POST — driver logs a reading for their vehicle; maintenance alerts are re-evaluated
        [HttpPost]
        [Authorize(Policy = Permissions.LogsSubmit)]
        public IActionResult Add(ReadingRequest r)
        {
            var vehicle = MyVehicle();
            if (vehicle == null) return NoVehicle();

            int? latest = _readings.Latest(vehicle.Id);
            if (latest is int l && r.Reading < l)
                return BadRequest(new { message = $"Reading can't be lower than the latest reading ({l:N0})." });

            int id = _readings.Add(vehicle.Id, User.GetUserId(), r.Reading);
            int newAlerts = _evaluator.Evaluate(vehicle.Id);

            string unit = _organizations.GetCurrent()?.DistanceUnit ?? "km";
            _notifications.AddInformation(vehicle.Id,
                $"Odometer updated: {vehicle.Name} ({vehicle.PlateNumber}) logged {r.Reading:N0} {unit}.", "Odometer Update");

            return StatusCode(StatusCodes.Status201Created, new { id, new_alerts = newAlerts });
        }

        // GET ?vehicle_id= — drivers see their own vehicle's readings
        [HttpGet]
        public IActionResult List([FromQuery(Name = "vehicle_id")] int? vehicleId)
        {
            if (IsDriver)
            {
                var vehicle = MyVehicle();
                return vehicle == null ? NoVehicle() : Ok(_readings.List(vehicle.Id));
            }
            return Ok(_readings.List(vehicleId));
        }
    }

    // ── /api/trips ───────────────────────────────────────────────────────────
    [Route("api/trips")]
    public class TripsController : DriverLogControllerBase
    {
        public record TripRequest(
            DateTime TripDate,
            [Required, MaxLength(100)] string PickupLocation,
            [Required, MaxLength(255)] string PickupAddress,
            [Required, MaxLength(100)] string Destination,
            string? ScheduledTime = null);

        private readonly TripRepository _trips;

        public TripsController(VehicleRepository vehicles, TripRepository trips) : base(vehicles) => _trips = trips;

        [HttpPost]
        [Authorize(Policy = Permissions.LogsSubmit)]
        public IActionResult Create(TripRequest r)
        {
            var vehicle = MyVehicle();
            if (vehicle == null) return NoVehicle();

            TimeSpan? scheduled = null;
            if (!string.IsNullOrWhiteSpace(r.ScheduledTime))
            {
                if (!TimeSpan.TryParse(r.ScheduledTime, CultureInfo.InvariantCulture, out var t) || t < TimeSpan.Zero || t >= TimeSpan.FromDays(1))
                    return BadRequest(new { message = "Scheduled time must be HH:mm." });
                scheduled = t;
            }

            int id = _trips.Create(new Trip
            {
                VehicleId = vehicle.Id,
                DriverId = User.GetUserId(),
                TripDate = r.TripDate.Date,
                PickupLocation = r.PickupLocation.Trim(),
                PickupAddress = r.PickupAddress.Trim(),
                Destination = r.Destination.Trim(),
                ScheduledTime = scheduled
            });
            return StatusCode(StatusCodes.Status201Created, new { id });
        }

        // GET — admins see all trips; drivers see their own
        [HttpGet]
        public IActionResult List()
        {
            if (!IsDriver && !User.IsInRole(Roles.Owner) && !User.IsInRole(Roles.Admin)) return Forbid();
            return Ok(_trips.List(IsDriver ? User.GetUserId() : null));
        }

        [HttpPut("{id:int}/depart")]
        [Authorize(Policy = Permissions.LogsSubmit)]
        public IActionResult Depart(int id) => _trips.Depart(id, User.GetUserId()) switch
        {
            WriteResult.Ok => Ok(true),
            WriteResult.Invalid => BadRequest(new { message = "This trip has already departed." }),
            _ => NotFound()
        };

        [HttpPut("{id:int}/arrive")]
        [Authorize(Policy = Permissions.LogsSubmit)]
        public IActionResult Arrive(int id) => _trips.Arrive(id, User.GetUserId()) switch
        {
            WriteResult.Ok => Ok(true),
            WriteResult.Invalid => BadRequest(new { message = "Log the departure first (or the trip has already arrived)." }),
            _ => NotFound()
        };
    }

    // ── /api/expenses ────────────────────────────────────────────────────────
    [Route("api/expenses")]
    public class ExpensesController : DriverLogControllerBase
    {
        private readonly ExpenseRepository _expenses;
        private readonly ScheduleRepository _schedules;
        private readonly OdometerRepository _readings;
        private readonly MaintenanceLogRepository _logs;
        private readonly NotificationRepository _notifications;
        private readonly OrganizationRepository _organizations;
        private readonly UploadStorage _storage;
        private readonly ITenantContext _tenant;

        public ExpensesController(VehicleRepository vehicles, ExpenseRepository expenses, ScheduleRepository schedules,
            OdometerRepository readings, MaintenanceLogRepository logs, NotificationRepository notifications,
            OrganizationRepository organizations, UploadStorage storage, ITenantContext tenant) : base(vehicles)
        {
            _expenses = expenses;
            _schedules = schedules;
            _readings = readings;
            _logs = logs;
            _notifications = notifications;
            _organizations = organizations;
            _storage = storage;
            _tenant = tenant;
        }

        private int OrgId => _tenant.OrganizationId!.Value;

        // POST (multipart) — driver submits an expense with two photos.
        // With schedule_id, it also records that maintenance as done (resolving its alerts).
        [HttpPost]
        [Consumes("multipart/form-data")]
        [ApiExplorerSettings(IgnoreApi = true)]
        [Authorize(Policy = Permissions.LogsSubmit)]
        public async Task<IActionResult> Create(
            [FromForm(Name = "expense_date")] string expenseDate,
            [FromForm(Name = "category")] string category,
            [FromForm(Name = "amount")] decimal amount,
            [FromForm(Name = "notes")] string? notes,
            [FromForm(Name = "schedule_id")] int? scheduleId,
            [FromForm(Name = "process_photo")] IFormFile? processPhoto,
            [FromForm(Name = "receipt_photo")] IFormFile? receiptPhoto)
        {
            var vehicle = MyVehicle();
            if (vehicle == null) return NoVehicle();

            if (!DateTime.TryParseExact(expenseDate, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var date))
                return BadRequest(new { message = "Invalid expense date (expected yyyy-MM-dd)." });
            if (date.Date > DateTime.UtcNow.Date.AddDays(1))
                return BadRequest(new { message = "Expense date cannot be in the future." });
            if (string.IsNullOrWhiteSpace(category) || category.Length > 100)
                return BadRequest(new { message = "Category is required (max 100 characters)." });
            if (amount <= 0)
                return BadRequest(new { message = "Amount must be greater than zero." });
            if (notes?.Length > 500)
                return BadRequest(new { message = "Notes can be at most 500 characters." });

            if (scheduleId is int sid && _schedules.Get(sid)?.VehicleTypeId != vehicle.VehicleTypeId)
                return BadRequest(new { message = "That maintenance task doesn't apply to your vehicle." });

            if ((UploadStorage.Validate(processPhoto, "Process photo") ?? UploadStorage.Validate(receiptPhoto, "Receipt photo")) is string photoError)
                return BadRequest(new { message = photoError });

            string? processName = null, receiptName = null;
            int id;
            try
            {
                processName = await _storage.Save(OrgId, processPhoto!);
                receiptName = await _storage.Save(OrgId, receiptPhoto!);

                using var scope = DbTransactions.ReadCommitted();
                id = _expenses.Create(new Expense
                {
                    VehicleId = vehicle.Id,
                    DriverId = User.GetUserId(),
                    ScheduleId = scheduleId,
                    ExpenseDate = date,
                    Category = category.Trim(),
                    Amount = amount,
                    Notes = string.IsNullOrWhiteSpace(notes) ? null : notes.Trim(),
                    ProcessPhoto = processName,
                    ReceiptPhoto = receiptName
                });
                if (scheduleId is int s)
                    _logs.RecordService(vehicle.Id, s, date, _readings.Latest(vehicle.Id), User.GetUserId());
                scope.Complete();
            }
            catch
            {
                _storage.DeleteQuietly(OrgId, processName, receiptName);   // no orphaned photos
                throw;
            }

            string currency = _organizations.GetCurrent()?.CurrencyCode ?? "";
            _notifications.AddInformation(vehicle.Id,
                $"Expense submitted: {vehicle.Name} ({vehicle.PlateNumber}) - {category.Trim()} {amount:N2} {currency}.", category.Trim());

            return StatusCode(StatusCodes.Status201Created, new { id });
        }

        // GET — admins see all expenses; drivers see their own
        [HttpGet]
        public IActionResult List()
        {
            if (!IsDriver && !User.IsInRole(Roles.Owner) && !User.IsInRole(Roles.Admin)) return Forbid();
            return Ok(_expenses.List(IsDriver ? User.GetUserId() : null));
        }

        // GET /api/expenses/{id}/photos/{process|receipt} — streams the photo (own organization only)
        [HttpGet("{id:int}/photos/{kind}")]
        public IActionResult Photo(int id, string kind)
        {
            var expense = _expenses.Get(id);
            if (expense == null || (IsDriver && expense.DriverId != User.GetUserId())) return NotFound();

            string? fileName = kind switch
            {
                "process" => expense.ProcessPhoto,
                "receipt" => expense.ReceiptPhoto,
                _ => null
            };
            if (fileName == null) return NotFound();

            var stream = _storage.OpenRead(OrgId, fileName);
            return stream == null ? NotFound() : File(stream, UploadStorage.ContentType(fileName));
        }
    }

    // ── /api/maintenance ─────────────────────────────────────────────────────
    [Route("api/maintenance")]
    public class MaintenanceController : DriverLogControllerBase
    {
        private readonly MaintenanceLogRepository _logs;
        private readonly MaintenanceEvaluator _evaluator;

        public MaintenanceController(VehicleRepository vehicles, MaintenanceLogRepository logs, MaintenanceEvaluator evaluator)
            : base(vehicles)
        {
            _logs = logs;
            _evaluator = evaluator;
        }

        // GET /api/maintenance/status?vehicle_id= — drivers get their own vehicle only
        [HttpGet("status")]
        public IActionResult Status([FromQuery(Name = "vehicle_id")] int? vehicleId)
        {
            if (IsDriver)
            {
                var vehicle = MyVehicle();
                return vehicle == null ? NoVehicle() : Ok(_logs.Status(vehicle.Id));
            }
            return Ok(_logs.Status(vehicleId));
        }

        // POST /api/maintenance/evaluate — dashboards call this on load so month-based alerts appear
        [HttpPost("evaluate")]
        public IActionResult Evaluate()
        {
            if (IsDriver)
            {
                var vehicle = MyVehicle();
                return vehicle == null ? NoVehicle() : Ok(new { new_alerts = _evaluator.Evaluate(vehicle.Id) });
            }
            return Ok(new { new_alerts = _evaluator.EvaluateAll() });
        }
    }
}
