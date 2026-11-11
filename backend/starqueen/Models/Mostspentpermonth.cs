// ============================================================
//  STARQUEEN PMTS — MostSpentPerMonth.cs (Model)
// ============================================================

namespace starqueen.Models
{
    // SP_Most_Spent_Truck_Maintenance_per_Month
    public class MostSpentPerMonth
    {
        public int truck_id { get; set; }
        public string truck_name { get; set; } = string.Empty;
        public int year { get; set; }
        public int month { get; set; }
        public decimal max_monthly_expense { get; set; }
    }

    // SP_Total_Yearly_Maintenance_Cost_Per_Truck
    public class YearlyMaintenanceCost
    {
        public int truck_id { get; set; }
        public string plate_number { get; set; } = string.Empty;
        public int year { get; set; }
        public decimal yearly_truck_cost { get; set; }
    }

    // SP_Minimum_Monthly_Maintenance_Cost_Per_Truck
    public class MinMonthlyMaintenanceCost
    {
        public int truck_id { get; set; }
        public string plate_number { get; set; } = string.Empty;
        public int expense_year { get; set; }
        public int expense_month { get; set; }
        public decimal min_monthly_expense { get; set; }
    }
}