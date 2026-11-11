using System.ComponentModel.DataAnnotations;

namespace starqueen.Models
{
    public class LoginRequest
    {
        [Required]
        public string email { get; set; } = string.Empty;

        [Required]
        public string password { get; set; } = string.Empty;
    }

    public class LoginResponse
    {
        public bool success { get; set; }
        public string? message { get; set; }
        public string? role { get; set; }
        public int? user_id { get; set; }
        public string? username { get; set; }
        public string? email { get; set; }
    }

    public class ChangePasswordRequest
    {
        [Required]
        public string current_password { get; set; } = string.Empty;

        [Required, MinLength(5)]
        public string new_password { get; set; } = string.Empty;
    }
}
