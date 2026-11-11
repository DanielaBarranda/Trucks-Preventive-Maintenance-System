using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace starqueen.Models
{
    [Table("Truck_Activity")]
    public class Truck_Activity
    {
        [Key]
        public int truck_activity_id { get; set; }

        [Column("date")]
        public DateTime date { get; set; }

        [Column("farm")]
        public string? farm { get; set; }

        [Column("address")]
        public string? address { get; set; }

        [Column("call_time")]
        public string? call_time { get; set; }

        [Column("plant")]
        public string? plant { get; set; }

        [Column("driver_name")]
        public string? driver_name { get; set; }

        [Column("departure_time")]
        public string? departure_time { get; set; }

        [Column("arrival_time")]
        public string? arrival_time { get; set; }

        [Column("truck_id")]
        public int truck_id { get; set; }
    }
}