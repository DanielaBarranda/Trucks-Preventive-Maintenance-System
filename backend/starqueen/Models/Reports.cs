namespace starqueen.Models
{
    // dbo.rpt_FleetOverview
    public class FleetOverviewRow
    {
        public int VehicleId { get; set; }
        public string VehicleName { get; set; } = string.Empty;
        public string PlateNumber { get; set; } = string.Empty;
        public string VehicleType { get; set; } = string.Empty;
        public string? AssignedDriverName { get; set; }
        public int? LatestReading { get; set; }
        public decimal? TotalExpenses { get; set; }
        public decimal? MinExpense { get; set; }
        public decimal? MaxExpense { get; set; }
        public int ExpenseCount { get; set; }
        public DateTime? LastExpenseDate { get; set; }
        public int OpenAlerts { get; set; }
        public int UnreadNotifications { get; set; }
        public DateTime? LastTripAt { get; set; }
    }

    // dbo.rpt_MonthlyExpenses
    public class MonthlyExpenseRow
    {
        public int VehicleId { get; set; }
        public string PlateNumber { get; set; } = string.Empty;
        public int Year { get; set; }
        public int Month { get; set; }
        public decimal Total { get; set; }
        public decimal Min { get; set; }
        public decimal Max { get; set; }
        public int Count { get; set; }
    }

    // dbo.rpt_DriverActivity
    public class DriverActivityRow
    {
        public int DriverId { get; set; }
        public string DriverName { get; set; } = string.Empty;
        public int? VehicleId { get; set; }
        public string? PlateNumber { get; set; }
        public int Trips { get; set; }
        public int Departures { get; set; }
        public int Arrivals { get; set; }
        public int DistinctDestinations { get; set; }
        public decimal? TotalExpenses { get; set; }
        public DateTime? FirstTripAt { get; set; }
        public DateTime? LastTripAt { get; set; }
    }
}
