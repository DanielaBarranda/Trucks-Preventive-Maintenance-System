namespace starqueen.Models
{
    public class VehicleType
    {
        public int Id { get; set; }
        public string Name { get; set; } = string.Empty;
    }

    public class MaintenanceSchedule
    {
        public int Id { get; set; }
        public int VehicleTypeId { get; set; }
        public string Task { get; set; } = string.Empty;
        public int? KmWarning { get; set; }
        public int? KmReplace { get; set; }
        public int? KmOverdue { get; set; }
        public int? MonthInterval { get; set; }
    }

    // Result of a write that can fail for a known reason
    public enum WriteResult { Ok, NotFound, InUse, Invalid, Conflict }
}
