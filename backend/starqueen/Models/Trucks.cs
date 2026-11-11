using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace starqueen.Models
{
    [Table("Trucks")]
    public class Trucks
    {
        [Key]
        [Column("truck_id")]
        public int truck_ID { get; set; }

        [Column("truck_name")]
        public string truckName { get; set; } = string.Empty;

        [Column("plate_number")]
        public string plateNumber { get; set; } = string.Empty;

        [Column("user_id")]
        public int userID { get; set; }

        [Column("truck_type")]
        public string truckType { get; set; } = string.Empty;
    }
}