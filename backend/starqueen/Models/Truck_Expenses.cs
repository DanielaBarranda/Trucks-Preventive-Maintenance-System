using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace starqueen.Models
{
    [Table("Truck_Expenses")]
    public class Truck_Expenses
    {
        [Key]
        public int expense_id { get; set; }

        [Column("expense_date")]
        public DateTime expense_date { get; set; }

        [Column("expense_type")]
        public required string expense_type { get; set; }

        [Column("amount")]
        public decimal amount { get; set; }

        [Column("notes")]
        public string? notes { get; set; }

        [Column("process_photo")]
        public string process_photo { get; set; } = string.Empty;

        [Column("receipt_photo")]
        public string receipt_photo { get; set; } = string.Empty;

        [Column("truck_id")]
        public int truck_id { get; set; }
    }
}