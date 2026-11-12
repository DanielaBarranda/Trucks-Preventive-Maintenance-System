namespace starqueenAPI.Infrastructure
{
    // Accounts created with a temporary password must change it before using the API.
    // Only change-password, logout, "me" (and logging in as someone else) are allowed until then.
    public class PasswordChangeGate
    {
        private static readonly string[] AllowedPaths =
        {
            "/api/auth/change-password", "/api/auth/logout", "/api/auth/me",
            "/api/auth/login", "/api/auth/signup"   // someone else may log in on a shared device
        };

        private readonly RequestDelegate _next;

        public PasswordChangeGate(RequestDelegate next) => _next = next;

        public async Task InvokeAsync(HttpContext context)
        {
            var path = context.Request.Path;
            bool mustChange = context.User.HasClaim(AppClaims.MustChangePassword, "true");

            if (mustChange
                && path.StartsWithSegments("/api")
                && !AllowedPaths.Any(p => path.Equals(p, StringComparison.OrdinalIgnoreCase)))
            {
                context.Response.StatusCode = StatusCodes.Status403Forbidden;
                await context.Response.WriteAsJsonAsync(new { message = "Password change required." });
                return;
            }

            await _next(context);
        }
    }
}
