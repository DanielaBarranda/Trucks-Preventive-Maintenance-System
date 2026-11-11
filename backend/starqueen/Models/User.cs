namespace starqueen.Models
{
    public class User
    {
        public int Id { get; set; }
        public int OrganizationId { get; set; }
        public string FullName { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public string PasswordHash { get; set; } = string.Empty;
        public string Role { get; set; } = string.Empty;
        public bool MustChangePassword { get; set; }
        public bool IsActive { get; set; }
    }
}
