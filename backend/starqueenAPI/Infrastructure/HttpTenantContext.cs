using starqueen.Data;
using System.Security.Claims;

namespace starqueenAPI.Infrastructure
{
    // Claim types issued at login
    public static class AppClaims
    {
        public const string OrganizationId = "org_id";
        public const string MustChangePassword = "must_change_password";
    }

    // Reads the current organization/user/role from the login cookie
    public class HttpTenantContext : ITenantContext
    {
        private readonly IHttpContextAccessor _http;

        public HttpTenantContext(IHttpContextAccessor http) => _http = http;

        private ClaimsPrincipal? User =>
            _http.HttpContext?.User is { Identity.IsAuthenticated: true } u ? u : null;

        public int? OrganizationId => ParseInt(User?.FindFirstValue(AppClaims.OrganizationId));
        public int? UserId => ParseInt(User?.FindFirstValue(ClaimTypes.NameIdentifier));
        public string? Role => User?.FindFirstValue(ClaimTypes.Role);

        private static int? ParseInt(string? value) => int.TryParse(value, out int n) ? n : null;
    }

    public static class ClaimsPrincipalExtensions
    {
        public static int GetUserId(this ClaimsPrincipal user)
            => int.TryParse(user.FindFirstValue(ClaimTypes.NameIdentifier), out int id) ? id : 0;
    }
}
