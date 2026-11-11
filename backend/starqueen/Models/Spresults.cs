using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

// ============================================================
//  STARQUEEN PMTS — SP Result Models
//  Place this file in: starqueen/Models/SpResults.cs
// ============================================================

namespace starqueen.Models
{
    // SP_Driver_Performance_Activity_Summary
    public class DriverPerformanceSummary
    {
        public int user_id { get; set; }
        public string full_name { get; set; } = "";
        public string plate_number { get; set; } = "";
        public int total_departures { get; set; }
        public int total_arrivals { get; set; }
        public decimal? total_expenses_recorded { get; set; }
        public int total_routes_handled { get; set; }
        public DateTime? latest_activity { get; set; }
    }

    // SP_Monitoring_The_First_And_Last_Trip_Of_A_Truck
    public class TripSummary
    {
        public int truck_id { get; set; }
        public string plate_number { get; set; } = "";
        public DateTime? first_activity_date { get; set; }
        public DateTime? last_activity_date { get; set; }
    }

    // SP_Expense_Analysis_with_Monthly_Filtering
    public class ExpenseAnalysis
    {
        public int truck_id { get; set; }
        public string plate_number { get; set; } = "";
        public string truck_name { get; set; } = "";
        public string truck_type { get; set; } = "";
        public decimal? total_expenses { get; set; }
        public int expense_count { get; set; }
        public decimal? max_expense { get; set; }
        public decimal? min_expense { get; set; }
        public DateTime? latest_expense_date { get; set; }
    }

    // SP_Total_Monthly_Maintenance_Cost_Per_Trucks
    public class MonthlyMaintenanceCost
    {
        public int truck_id { get; set; }
        public string plate_number { get; set; } = "";
        public int year { get; set; }
        public int month { get; set; }
        public decimal monthly_truck_cost { get; set; }
    }

    // SP_Maintenance_Monitoring_Alert_Detection
    public class MaintenanceAlert
    {
        public string plate_number { get; set; } = "";
        public string maintenance_item { get; set; } = "";
        public string status { get; set; } = "";
        public int? next_due_km { get; set; }
        public int? latest_km { get; set; }
        public int? km_difference { get; set; }
        public int total_maintenance_items { get; set; }
        public int overdue_count { get; set; }
        public int replacement_count { get; set; }
    }

    // SP_Trucks_With_Multiple_Near_Replacement
    public class NearReplacement
    {
        public int truck_id { get; set; }
        public string plate_number { get; set; } = "";
        public int near_limit_items { get; set; }
    }

    // SP_Oldest_Installed_Components_Per_Month
    public class OldestComponent
    {
        public int truck_id { get; set; }
        public string plate_number { get; set; } = "";
        public string maintenance_task { get; set; } = "";
        public DateTime oldest_maintenance_date { get; set; }
    }

    // SP_Admin_Dashboard_Truck_Overview
    public class DashboardTruckOverview
    {
        public int truck_id { get; set; }
        public string plate_number { get; set; } = "";
        public string model { get; set; } = "";
        public int? latest_km { get; set; }
        public decimal? total_expenses { get; set; }
        public int unresolved_maintenance { get; set; }
        public int unread_notifications { get; set; }
        public DateTime? last_activity_time { get; set; }
    }

    // SP_Unread_Maintenance_Notifications_Per_Truck
    public class UnreadNotificationSummary
    {
        public int truck_id { get; set; }
        public string truck_name { get; set; } = "";
        public int unread_alerts { get; set; }
    }
}
