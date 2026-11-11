// ============================================================
//  STARQUEEN PMTS — TruckExpensesController.cs
// ============================================================

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using starqueen.Models;
using starqueen.Services;
using starqueen.Repositories;
using System.Globalization;

namespace starqueenAPI.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class TruckExpensesController : ControllerBase
    {
        readonly TruckExpensesServices _services;
        readonly AdminNotificationsRepository _notifRepo;
        readonly IWebHostEnvironment _env;
        readonly ILogger<TruckExpensesController> _logger;

        public TruckExpensesController(
            TruckExpensesServices services,
            AdminNotificationsRepository notifRepo,
            IWebHostEnvironment env,
            ILogger<TruckExpensesController> logger)
        {
            _services = services;
            _notifRepo = notifRepo;
            _env = env;
            _logger = logger;
        }

        // ── Standard CRUD ────────────────────────────────────────────────────

        // Accepted proof photos (matches accept="image/png,image/jpeg" on the driver form)
        static readonly string[] AllowedExtensions = { ".jpg", ".jpeg", ".png" };
        const long MaxPhotoBytes = 10 * 1024 * 1024; // 10 MB per photo

        [HttpPost]
        [Consumes("multipart/form-data")]
        [ApiExplorerSettings(IgnoreApi = true)]
        public async Task<IActionResult> AddExpense(
            [FromForm] string expense_date,
            [FromForm] string expense_type,
            [FromForm] decimal amount,
            [FromForm] string? notes,
            [FromForm] int truck_id,
            IFormFile? process_photo,
            IFormFile? receipt_photo)
        {
            // ── Validate input ───────────────────────────────────────────────
            if (!DateTime.TryParseExact(expense_date, "yyyy-MM-dd", CultureInfo.InvariantCulture,
                    DateTimeStyles.None, out var expenseDate))
                return BadRequest(new { message = "Invalid expense date (expected yyyy-MM-dd)." });

            if (string.IsNullOrWhiteSpace(expense_type))
                return BadRequest(new { message = "Expense type is required." });

            if (amount <= 0)
                return BadRequest(new { message = "Amount must be greater than zero." });

            if (truck_id <= 0)
                return BadRequest(new { message = "Invalid truck ID." });

            string? photoError = ValidatePhoto(process_photo, "Process photo")
                              ?? ValidatePhoto(receipt_photo, "Receipt photo");
            if (photoError != null)
                return BadRequest(new { message = photoError });

            // ── Save photos ─────────────────────────────────────────────────
            string uploadFolder = Path.Combine(_env.WebRootPath, "uploads");
            Directory.CreateDirectory(uploadFolder);

            string processFileName = Guid.NewGuid() + Path.GetExtension(process_photo!.FileName).ToLowerInvariant();
            string receiptFileName = Guid.NewGuid() + Path.GetExtension(receipt_photo!.FileName).ToLowerInvariant();
            string processPath = Path.Combine(uploadFolder, processFileName);
            string receiptPath = Path.Combine(uploadFolder, receiptFileName);

            try
            {
                using (var stream = new FileStream(processPath, FileMode.CreateNew))
                    await process_photo.CopyToAsync(stream);

                using (var stream = new FileStream(receiptPath, FileMode.CreateNew))
                    await receipt_photo.CopyToAsync(stream);

                var expense = new Truck_Expenses
                {
                    expense_date = expenseDate,
                    expense_type = expense_type.Trim(),
                    amount = amount,
                    notes = notes,
                    truck_id = truck_id,
                    process_photo = processFileName,
                    receipt_photo = receiptFileName,
                };

                if (!_services.AddExpense(expense))
                {
                    DeleteQuietly(processPath, receiptPath);
                    return BadRequest(new { message = "Failed to save expense." });
                }
            }
            catch
            {
                // Don't leave orphaned photos behind if the save failed
                DeleteQuietly(processPath, receiptPath);
                throw;
            }

            // Notifications are non-fatal: the expense is already saved
            try
            {
                _notifRepo.InsertExpenseNotification(truck_id, expense_type.Trim(), amount);
                _notifRepo.ResolveNotificationAndNotify(truck_id, expense_type.Trim());
            }
            catch (Exception notifEx)
            {
                _logger.LogError(notifEx, "Expense notification failed for truck {TruckId}", truck_id);
            }

            return Ok(new { message = "Expense submitted successfully." });
        }

        static string? ValidatePhoto(IFormFile? file, string label)
        {
            if (file == null || file.Length == 0) return $"{label} is required.";
            if (file.Length > MaxPhotoBytes) return $"{label} must be 10 MB or smaller.";

            string ext = Path.GetExtension(file.FileName).ToLowerInvariant();
            if (!AllowedExtensions.Contains(ext)) return $"{label} must be a JPG or PNG image.";

            // Check the file signature, not just the name
            Span<byte> header = stackalloc byte[8];
            using var s = file.OpenReadStream();
            int read = s.Read(header);
            bool isJpeg = read >= 3 && header[0] == 0xFF && header[1] == 0xD8 && header[2] == 0xFF;
            bool isPng = read >= 8 && header[0] == 0x89 && header[1] == 0x50 && header[2] == 0x4E && header[3] == 0x47;
            return isJpeg || isPng ? null : $"{label} is not a valid JPG or PNG image.";
        }

        static void DeleteQuietly(params string[] paths)
        {
            foreach (var path in paths)
                try { if (System.IO.File.Exists(path)) System.IO.File.Delete(path); } catch { }
        }

        [HttpGet]
        public List<Truck_Expenses> GetAllExpenses()
            => _services.GetAllExpenses();

        [HttpGet("{id}")]
        public ActionResult<Truck_Expenses> GetExpenseById(int id)
            => _services.GetExpenseById(id) is { } e ? e : NotFound();

        // Send the full record — every column is overwritten
        [HttpPut("{id}")]
        [Authorize(Roles = Roles.Admin)]
        public IActionResult UpdateExpense(int id, Truck_Expenses expense)
        {
            expense.expense_id = id;
            return _services.UpdateExpense(expense) ? Ok(true) : NotFound();
        }

        [HttpDelete("{id}")]
        [Authorize(Roles = Roles.Admin)]
        public IActionResult DeleteExpense(int id)
            => _services.DeleteExpense(id) ? Ok(true) : NotFound();

        // ── SP-based endpoints ───────────────────────────────────────────────

        // GET /api/truckexpenses/analysis
        // Calls SP_Expense_Analysis_with_Monthly_Filtering
        // Returns: total, count, max, min expense + latest date per truck
        [HttpGet("analysis")]
        public IActionResult GetExpenseAnalysis()
        
            => Ok(_services.GetExpenseAnalysis());

        // GET /api/truckexpenses/monthly-cost
        // Calls SP_Total_Monthly_Maintenance_Cost_Per_Trucks
        // Returns: monthly cost grouped by truck, year, month
        [HttpGet("monthly-cost")]
        public IActionResult GetMonthlyCost()
        
            => Ok(_services.GetMonthlyCost());

        // GET /api/truckexpenses/most-spent
        // Calls SP_Most_Spent_Truck_Maintenance_per_Month
        // Returns: highest single expense per truck per month
        [HttpGet("most-spent")]
        public IActionResult GetMostSpentPerMonth()
        
            => Ok(_services.GetMostSpentPerMonth());

        // GET /api/truckexpenses/yearly-cost
        // Calls SP_Total_Yearly_Maintenance_Cost_Per_Truck
        // Returns: yearly cost grouped by truck and year
        [HttpGet("yearly-cost")]
        public IActionResult GetYearlyCost()
        
            => Ok(_services.GetYearlyCost());

        // GET /api/truckexpenses/min-monthly-cost
        // Calls SP_Minimum_Monthly_Maintenance_Cost_Per_Truck
        // Returns: lowest expense recorded per truck per month
        [HttpGet("min-monthly-cost")]
        public IActionResult GetMinMonthlyCost()
        
            => Ok(_services.GetMinMonthlyCost());
    }
}