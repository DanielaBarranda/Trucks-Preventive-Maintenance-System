using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace starqueen.Models
{
    [Table("Users")]
    public class Users
    {
        [Key]
        public int user_id { get; set; }

        [Column("username")]
        public required string username { get; set; }

        [Column("email")]
        public required string email { get; set; }

        [Column("password")]
        public required string password { get; set; }

        [Column("role")]
        public required string role { get; set; }
    }
}