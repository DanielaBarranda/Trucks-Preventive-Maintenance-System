namespace starqueen.Models
{
    public class OdometerReading
    {
        public int Id { get; set; }
        public int VehicleId { get; set; }
        public int DriverId { get; set; }
        public int Reading { get; set; }
        public DateTime RecordedAt { get; set; }
    }

    public class Trip
    {
        public int Id { get; set; }
        public int VehicleId { get; set; }
        public int DriverId { get; set; }
        public string? DriverName { get; set; }
        public DateTime TripDate { get; set; }
        public string PickupLocation { get; set; } = string.Empty;
        public string PickupAddress { get; set; } = string.Empty;
        public string Destination { get; set; } = string.Empty;
        public TimeSpan? ScheduledTime { get; set; }
        public DateTime? DepartedAt { get; set; }
        public DateTime? ArrivedAt { get; set; }
    }

    public class Expense
    {
        public int Id { get; set; }
        public int VehicleId { get; set; }
        public int DriverId { get; set; }
        public int? ScheduleId { get; set; }
        public DateTime ExpenseDate { get; set; }
        public string Category { get; set; } = string.Empty;
        public decimal Amount { get; set; }
        public string? Notes { get; set; }
        public string ProcessPhoto { get; set; } = string.Empty;
        public string ReceiptPhoto { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; }
    }

    public class Notification
    {
        public int Id { get; set; }
        public int? VehicleId { get; set; }
        public int? MaintenanceLogId { get; set; }
        public string Type { get; set; } = string.Empty;
        public string Message { get; set; } = string.Empty;
        public string? Task { get; set; }
        public bool IsRead { get; set; }
        public bool IsResolved { get; set; }
        public DateTime? ResolvedAt { get; set; }
        public DateTime CreatedAt { get; set; }
    }

    // One row of dbo.rpt_MaintenanceStatus
    public class MaintenanceStatusRow
    {
        public int VehicleId { get; set; }
        public string PlateNumber { get; set; } = string.Empty;
        public int ScheduleId { get; set; }
        public string Task { get; set; } = string.Empty;
        public DateTime? LastServiceDate { get; set; }
        public int? LastServiceReading { get; set; }
        public int? CurrentReading { get; set; }
        public int? DistanceSince { get; set; }
        public int? MonthsSince { get; set; }
        public string Status { get; set; } = string.Empty;
    }
}
