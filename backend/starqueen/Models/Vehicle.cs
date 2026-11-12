namespace starqueen.Models
{
    public class Vehicle
    {
        public int Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public string PlateNumber { get; set; } = string.Empty;
        public int VehicleTypeId { get; set; }
        public string VehicleType { get; set; } = string.Empty;
        public int? AssignedDriverId { get; set; }
        public string? AssignedDriverName { get; set; }
        public bool IsActive { get; set; }
    }
}
