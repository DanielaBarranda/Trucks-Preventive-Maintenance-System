using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace starqueen.Models
{
    // This maps to the Admin_Maintenance_View SQL VIEW (read-only)
    // Used for Pending Maintenance page on the dashboard
    [Table("Admin_Maintenance_View")]
    public class Admin_Maintenance_View
    {
      
        [Key]
        public int truck_id { get; set; }

        public string? truck_name { get; set; }

        public string? plate_number { get; set; }

        public string? truck_type { get; set; }

        public int? current_km { get; set; }

        public string? maintenance_task { get; set; }

        // Values: 'Yes', 'No'
        public string? resolved { get; set; }

        public DateTime? created_at { get; set; }

        // Values: 'Good', 'Warning', 'Replace', 'Overdue'
        public string? status { get; set; }
    }
}