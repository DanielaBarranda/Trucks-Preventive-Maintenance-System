using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using starqueen.Repositories;
using System.Security.Claims;

namespace starqueenAPI.Infrastructure
{
    // Runs for every request that carries a login cookie. The cookie alone would stay
    // valid for 24 hours, so the account is checked against the database each time:
    // - deactivated or deleted users are signed out (the request becomes 401)
    // - the "must change password" flag follows the database (e.g. after a reset)
    public static class SessionValidator
    {
        public static async Task ValidateAsync(CookieValidatePrincipalContext context)
        {
            var principal = context.Principal;
            if (principal == null) return;

            bool hasIds =
                int.TryParse(principal.FindFirstValue(ClaimTypes.NameIdentifier), out int userId) &
                int.TryParse(principal.FindFirstValue(AppClaims.OrganizationId), out int orgId);

            var user = hasIds
                ? context.HttpContext.RequestServices.GetRequiredService<UserRepository>().GetById(orgId, userId)
                : null;

            if (user == null || !user.IsActive)
            {
                context.RejectPrincipal();
                await context.HttpContext.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
                return;
            }

            bool cookieSaysMustChange = principal.HasClaim(AppClaims.MustChangePassword, "true");
            if (cookieSaysMustChange == user.MustChangePassword) return;

            // Bring the cookie in line with the database
            var claims = principal.Claims.Where(c => c.Type != AppClaims.MustChangePassword).ToList();
            if (user.MustChangePassword)
                claims.Add(new Claim(AppClaims.MustChangePassword, "true"));

            context.ReplacePrincipal(new ClaimsPrincipal(
                new ClaimsIdentity(claims, CookieAuthenticationDefaults.AuthenticationScheme)));
            context.ShouldRenew = true;
        }
    }
}
