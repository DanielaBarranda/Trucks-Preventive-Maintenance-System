using System.ComponentModel.DataAnnotations;

namespace starqueen.Models
{
    // What the API returns for a user — never includes the password hash.
    public class UserResponse
    {
        public int user_id { get; set; }
        public string username { get; set; } = string.Empty;
        public string email { get; set; } = string.Empty;
        public string role { get; set; } = string.Empty;

        public static UserResponse From(Users u) => new()
        {
            user_id = u.user_id,
            username = u.username,
            email = u.email,
            role = u.role
        };
    }

    // PUT /api/users/{id} body. Password changes go through /api/auth/change-password.
    public class UserUpdateRequest
    {
        [Required, MaxLength(50)]
        public string username { get; set; } = string.Empty;

        [Required, EmailAddress, MaxLength(255)]
        public string email { get; set; } = string.Empty;

        // Only an Admin can change roles; ignored for everyone else.
        public string? role { get; set; }
    }
}
