// ============================================================
//  STARQUEEN PMTS — TruckExpensesRepository.cs
// ============================================================

using Dapper;
using starqueen.Data;
using starqueen.Models;
using System.Data;

namespace starqueen.Repositories
{
    public class TruckExpensesRepository : GenericRepositories<Truck_Expenses>
    {
        public TruckExpensesRepository(IDbConnectionFactory db) : base(db) { }

        // ── SP_Expense_Analysis_with_Monthly_Filtering ──────────────────────
        // Returns: total, count, max, min expense + latest date per truck
        // Used by: Expense Analysis table on Expenses page
        public List<ExpenseAnalysis> GetExpenseAnalysis()
        {
            using IDbConnection connection = CreateConnection();
            return connection.Query<ExpenseAnalysis>(
                "EXEC SP_Expense_Analysis_with_Monthly_Filtering"
            ).ToList();
        }

        // ── SP_Total_Monthly_Maintenance_Cost_Per_Trucks ────────────────────
        // Returns: monthly cost grouped by truck, year, month
        // Used by: Monthly Cost table on Expenses page
        public List<MonthlyMaintenanceCost> GetMonthlyCost()
        {
            using IDbConnection connection = CreateConnection();
            return connection.Query<MonthlyMaintenanceCost>(
                "EXEC SP_Total_Monthly_Maintenance_Cost_Per_Trucks"
            ).ToList();
        }

        // ── SP_Most_Spent_Truck_Maintenance_per_Month ───────────────────────
        // Returns: highest single expense per truck per month
        // Used by: Most Spent table on Expenses page
        public List<MostSpentPerMonth> GetMostSpentPerMonth()
        {
            using IDbConnection connection = CreateConnection();
            return connection.Query<MostSpentPerMonth>(
                "EXEC SP_Most_Spent_Truck_Maintenance_per_Month"
            ).ToList();
        }

        // ── SP_Total_Yearly_Maintenance_Cost_Per_Truck ──────────────────────
        // Returns: yearly cost grouped by truck and year
        // Used by: Yearly Cost table on Expenses page
        public List<YearlyMaintenanceCost> GetYearlyCost()
        {
            using IDbConnection connection = CreateConnection();
            return connection.Query<YearlyMaintenanceCost>(
                "EXEC SP_Total_Yearly_Maintenance_Cost_Per_Truck"
            ).ToList();
        }

        // ── SP_Minimum_Monthly_Maintenance_Cost_Per_Truck ───────────────────
        // Returns: lowest expense recorded per truck per month
        // Used by: Minimum Monthly Cost table on Expenses page
        public List<MinMonthlyMaintenanceCost> GetMinMonthlyCost()
        {
            using IDbConnection connection = CreateConnection();
            return connection.Query<MinMonthlyMaintenanceCost>(
                "EXEC SP_Minimum_Monthly_Maintenance_Cost_Per_Truck"
            ).ToList();
        }
    }
}