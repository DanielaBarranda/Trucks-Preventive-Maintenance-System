using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace starqueen.Models
{
    [Table("Truck_Odometer")]
    public class Truck_Odometer
    {
        [Key]
        public int odometer_id { get; set; }

        [Column("current_km")]
        public int current_km { get; set; }

        [Column("recorded_at")]
        public DateTime recorded_at { get; set; } = DateTime.Now;

        [Column("truck_id")]
        public int truck_id { get; set; }
    }
}