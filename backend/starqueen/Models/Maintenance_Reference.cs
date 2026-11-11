using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace starqueen.Models
{
    [Table("Maintenance_Reference")]
    public class Maintenance_Reference
    {
        [Key]
        public int reference_id { get; set; }

        [Column("truck_type")]
        public required string truck_type { get; set; }

        [Column("maintenance_task")]
        public required string maintenance_task { get; set; }

        [Column("km_good")]
        public int? km_good { get; set; }

        [Column("km_warning")]
        public int? km_warning { get; set; }

        [Column("km_replace")]
        public int? km_replace { get; set; }

        [Column("km_overdue")]
        public int? km_overdue { get; set; }

        public int? month_interval { get; set; }
    }
}