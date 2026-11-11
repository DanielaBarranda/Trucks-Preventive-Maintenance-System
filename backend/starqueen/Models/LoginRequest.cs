using System.ComponentModel.DataAnnotations;

namespace starqueen.Models
{
    public class LoginRequest
    {
        [Required]
        public required string email { get; set; }

        [Required]
        public required string password { get; set; }
    }

    public class LoginResponse
    {
        public string email;

        public bool success { get; set; }
        public string? message { get; set; }
        public string? role { get; set; }
        public int? user_id { get; set; }
        public string? username { get; set; }
    }
}