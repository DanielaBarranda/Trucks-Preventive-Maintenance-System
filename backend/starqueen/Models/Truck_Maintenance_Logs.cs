using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace starqueen.Models
{
    [Table("Truck_Maintenance_Logs")]
    public class Truck_Maintenance_Logs
    {
        [Key]
        public int maintenance_id { get; set; }

        [Column("current_km")]
        public int? current_km { get; set; }

        // Values: 'Good', 'Warning', 'Replace', 'Overdue'
        [Column("status")]
        public string status { get; set; } = "Good";

        // Values: 'Yes', 'No'
        [Column("resolved")]
        public string resolved { get; set; } = "No";

        [Column("truck_id")]
        public int truck_id { get; set; }

        [Column("reference_id")]
        public int reference_id { get; set; }

        [Column("created_at")]
        public DateTime created_at { get; set; } = DateTime.Now;
    }
}