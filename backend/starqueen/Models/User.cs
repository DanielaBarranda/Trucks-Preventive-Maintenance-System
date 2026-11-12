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

    // An account as listed to Owners/Admins (never includes the password hash)
    public class AccountSummary
    {
        public int Id { get; set; }
        public string FullName { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public bool IsActive { get; set; }
        public bool MustChangePassword { get; set; }
        public int? AssignedVehicleId { get; set; }
    }
}
