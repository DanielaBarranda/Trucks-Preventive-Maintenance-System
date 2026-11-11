using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace starqueen.Models
{
    [Table("Truck_Notifications")]
    public class Truck_Notifications
    {
        [Key]
        public int truck_notification_id { get; set; }

        [Column("truck_id")]
        public int truck_id { get; set; }

        [Column("maintenance_id")]
        public int maintenance_id { get; set; }

        [Column("type")]
        public required string type { get; set; }

        [Column("message")]
        public required string message { get; set; }

        [Column("is_read")]
        public bool is_read { get; set; }

        [Column("created_at")]
        public DateTime created_at { get; set; }
    }
}