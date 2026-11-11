// ============================================================
//  STARQUEEN PMTS — TruckExpensesController.cs
// ============================================================

using Microsoft.AspNetCore.Mvc;
using starqueen.Models;
using starqueen.Services;
using starqueen.Repositories;

namespace starqueenAPI.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class TruckExpensesController : ControllerBase
    {
        readonly TruckExpensesServices _services = new TruckExpensesServices();
        readonly TruckExpensesRepository _repo = new TruckExpensesRepository();
        readonly AdminNotificationsRepository _notifRepo = new AdminNotificationsRepository();

        // ── Standard CRUD ────────────────────────────────────────────────────

        [HttpPost]
        [Consumes("multipart/form-data")]
        [ApiExplorerSettings(IgnoreApi = true)]
        public async Task<IActionResult> AddExpense(
            [FromForm] string expense_date,
            [FromForm] string expense_type,
            [FromForm] decimal amount,
            [FromForm] string? notes,
            [FromForm] int truck_id,
            [FromForm] IFormFile process_photo,
            [FromForm] IFormFile receipt_photo)
        {
            try
            {
                string uploadFolder = Path.Combine(
                    Directory.GetCurrentDirectory(), "wwwroot", "uploads");
                Directory.CreateDirectory(uploadFolder);

                string processFileName = Guid.NewGuid() + Path.GetExtension(process_photo.FileName);
                string receiptFileName = Guid.NewGuid() + Path.GetExtension(receipt_photo.FileName);

                using (var stream = new FileStream(
                    Path.Combine(uploadFolder, processFileName), FileMode.Create))
                    await process_photo.CopyToAsync(stream);

                using (var stream = new FileStream(
                    Path.Combine(uploadFolder, receiptFileName), FileMode.Create))
                    await receipt_photo.CopyToAsync(stream);

                var expense = new Truck_Expenses
                {
                    expense_date = DateTime.Parse(expense_date),
                    expense_type = expense_type,
                    amount = amount,
                    notes = notes,
                    truck_id = truck_id,
                    process_photo = processFileName,
                    receipt_photo = receiptFileName,
                };

                bool result = _services.AddExpense(expense);
                if (!result) return BadRequest("Failed to save expense.");

                try
                {
                    _notifRepo.InsertExpenseNotification(truck_id, expense_type, amount);
                    _notifRepo.ResolveNotificationAndNotify(truck_id, expense_type);
                }
                catch (Exception notifEx)
                {
                    Console.WriteLine($"[Notification error] {notifEx.Message}");
                }

                return Ok(new { message = "Expense submitted successfully." });
            }
            catch (Exception ex)
            {
                return StatusCode(500, ex.Message);
            }
        }

        [HttpGet]
        public List<Truck_Expenses> GetAllExpenses()
            => _services.GetAllExpenses();

        [HttpGet("{id}")]
        public Truck_Expenses? GetExpenseById(int id)
            => _services.GetExpenseById(id);

        [HttpPut("{id}")]
        public bool UpdateExpense(int id, Truck_Expenses expense)
        {
            expense.expense_id = id;
            return _services.UpdateExpense(expense);
        }

        [HttpDelete("{id}")]
        public bool DeleteExpense(int id)
            => _services.DeleteExpense(id);

        // ── SP-based endpoints ───────────────────────────────────────────────

        // GET /api/truckexpenses/analysis
        // Calls SP_Expense_Analysis_with_Monthly_Filtering
        // Returns: total, count, max, min expense + latest date per truck
        [HttpGet("analysis")]
        public IActionResult GetExpenseAnalysis()
        {
            try { return Ok(_services.GetExpenseAnalysis()); }
            catch (Exception ex) { return StatusCode(500, ex.Message); }
        }

        // GET /api/truckexpenses/monthly-cost
        // Calls SP_Total_Monthly_Maintenance_Cost_Per_Trucks
        // Returns: monthly cost grouped by truck, year, month
        [HttpGet("monthly-cost")]
        public IActionResult GetMonthlyCost()
        {
            try { return Ok(_services.GetMonthlyCost()); }
            catch (Exception ex) { return StatusCode(500, ex.Message); }
        }

        // GET /api/truckexpenses/most-spent
        // Calls SP_Most_Spent_Truck_Maintenance_per_Month
        // Returns: highest single expense per truck per month
        [HttpGet("most-spent")]
        public IActionResult GetMostSpentPerMonth()
        {
            try { return Ok(_services.GetMostSpentPerMonth()); }
            catch (Exception ex) { return StatusCode(500, ex.Message); }
        }

        // GET /api/truckexpenses/yearly-cost
        // Calls SP_Total_Yearly_Maintenance_Cost_Per_Truck
        // Returns: yearly cost grouped by truck and year
        [HttpGet("yearly-cost")]
        public IActionResult GetYearlyCost()
        {
            try { return Ok(_services.GetYearlyCost()); }
            catch (Exception ex) { return StatusCode(500, ex.Message); }
        }

        // GET /api/truckexpenses/min-monthly-cost
        // Calls SP_Minimum_Monthly_Maintenance_Cost_Per_Truck
        // Returns: lowest expense recorded per truck per month
        [HttpGet("min-monthly-cost")]
        public IActionResult GetMinMonthlyCost()
        {
            try { return Ok(_services.GetMinMonthlyCost()); }
            catch (Exception ex) { return StatusCode(500, ex.Message); }
        }
    }
}