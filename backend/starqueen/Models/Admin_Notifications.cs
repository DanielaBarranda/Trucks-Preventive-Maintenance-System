using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace starqueen.Models
{
    [Table("Admin_Notifications")]
    public class Admin_Notifications
    {
        [Key]
        public int admin_notification_id { get; set; }

        [Column("truck_id")]
        public int truck_id { get; set; }

        [Column("maintenance_id")]
        public int? maintenance_id { get; set; } // nullable ✅

        [Column("type")]
        public required string type { get; set; }

        [Column("message")]
        public required string message { get; set; }

        [Column("maintenance_task")]
        public string? maintenance_task { get; set; } // ✅ added

        [Column("is_read")]
        public bool is_read { get; set; }

        [Column("is_resolved")]
        public bool is_resolved { get; set; }

        [Column("resolved_at")]
        public DateTime? resolved_at { get; set; }

        [Column("created_at")]
        public DateTime created_at { get; set; }
    }
}