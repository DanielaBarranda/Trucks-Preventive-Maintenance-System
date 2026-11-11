// ============================================================
//  STARQUEEN PMTS — TruckExpensesServices.cs
// ============================================================

using starqueen.Models;
using starqueen.Repositories;

namespace starqueen.Services
{
    public class TruckExpensesServices
    {
        public readonly TruckExpensesRepository _repo = new TruckExpensesRepository();

        // ── Basic CRUD ───────────────────────────────────────────────────────

        public Truck_Expenses GetExpenseById(int id)
            => _repo.GetById(id);

        public bool AddExpense(Truck_Expenses expense)
            => _repo.Add(expense);

        public bool DeleteExpense(int id)
            => _repo.Delete(id);

        public List<Truck_Expenses> GetAllExpenses()
            => (List<Truck_Expenses>)_repo.GetAll();

        public bool UpdateExpense(Truck_Expenses expense)
            => _repo.Update(expense);

        // ── SP: SP_Expense_Analysis_with_Monthly_Filtering ───────────────────
        // Per-truck total, min, max, count, latest expense date
        public List<ExpenseAnalysis> GetExpenseAnalysis()
            => _repo.GetExpenseAnalysis();

        // ── SP: SP_Total_Monthly_Maintenance_Cost_Per_Trucks ─────────────────
        // Monthly cost breakdown per truck
        public List<MonthlyMaintenanceCost> GetMonthlyCost()
            => _repo.GetMonthlyCost();

        // ── SP: SP_Most_Spent_Truck_Maintenance_per_Month ────────────────────
        // Highest single expense per truck per month
        public List<MostSpentPerMonth> GetMostSpentPerMonth()
            => _repo.GetMostSpentPerMonth();

        // ── SP: SP_Total_Yearly_Maintenance_Cost_Per_Truck ───────────────────
        // Yearly cost grouped by truck and year
        public List<YearlyMaintenanceCost> GetYearlyCost()
            => _repo.GetYearlyCost();

        // ── SP: SP_Minimum_Monthly_Maintenance_Cost_Per_Truck ────────────────
        // Lowest expense recorded per truck per month
        public List<MinMonthlyMaintenanceCost> GetMinMonthlyCost()
            => _repo.GetMinMonthlyCost();
    }
}