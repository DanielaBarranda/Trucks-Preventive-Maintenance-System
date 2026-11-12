namespace starqueen.Data
{
    // Who is making the current request. All values are null before login.
    public interface ITenantContext
    {
        int? OrganizationId { get; }
        int? UserId { get; }
        string? Role { get; }
    }
}
