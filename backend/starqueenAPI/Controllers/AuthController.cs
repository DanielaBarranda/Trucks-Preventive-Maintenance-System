using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using starqueen.Auth;
using starqueen.Models;
using starqueen.Repositories;
using starqueen.Services;
using starqueenAPI.Infrastructure;
using System.ComponentModel.DataAnnotations;
using System.Security.Claims;

namespace starqueenAPI.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class AuthController : ControllerBase
    {
        public const int MinPasswordLength = 8;
        public static readonly string[] TemplateCategories = { "Truck", "Van & Car", "Motorcycle" };

        private readonly UserRepository _users;
        private readonly OrganizationRepository _organizations;
        private readonly PasswordService _passwords;

        public AuthController(UserRepository users, OrganizationRepository organizations, PasswordService passwords)
        {
            _users = users;
            _organizations = organizations;
            _passwords = passwords;
        }

        // ── DTOs ─────────────────────────────────────────────────────────────
        public record LoginRequest([Required] string Email, [Required] string Password);

        public record SignupRequest(
            [Required, MaxLength(100)] string OrganizationName,
            [Required, MaxLength(100)] string OwnerName,
            [Required, EmailAddress, MaxLength(255)] string Email,
            [Required, MinLength(MinPasswordLength)] string Password,
            [RegularExpression("^[A-Z]{3}$")] string CurrencyCode = "PHP",
            [RegularExpression("^(km|mi)$")] string DistanceUnit = "km",
            string[]? TemplateCategories = null);

        public record ChangePasswordRequest(
            [Required] string CurrentPassword,
            [Required, MinLength(MinPasswordLength)] string NewPassword);

        public record UserInfo(int Id, string FullName, string Email, string Role, bool MustChangePassword);
        public record OrganizationInfo(int Id, string Name, string CurrencyCode, string DistanceUnit);
        public record SessionResponse(bool Success, string Message, UserInfo? User = null,
            OrganizationInfo? Organization = null, IReadOnlyList<string>? Permissions = null);

        // ── Endpoints ────────────────────────────────────────────────────────

        // POST /api/auth/signup — creates an organization and its Owner, then logs in
        [HttpPost("signup")]
        [AllowAnonymous]
        public async Task<IActionResult> Signup([FromBody] SignupRequest request)
        {
            var categories = (request.TemplateCategories ?? Array.Empty<string>()).Distinct().ToArray();
            if (categories.Any(c => !TemplateCategories.Contains(c)))
                return BadRequest(new { message = $"Template categories must be: {string.Join(", ", TemplateCategories)}." });

            int orgId, userId;
            try
            {
                (orgId, userId) = _organizations.CreateWithOwner(
                    request.OrganizationName.Trim(), request.CurrencyCode, request.DistanceUnit,
                    request.OwnerName.Trim(), request.Email.Trim(), _passwords.Hash(request.Password), categories);
            }
            catch (DuplicateEmailException ex)
            {
                return Conflict(new { message = ex.Message });
            }

            var user = _users.GetById(orgId, userId)!;
            var org = _organizations.Get(orgId)!;
            await SignIn(user);
            return StatusCode(StatusCodes.Status201Created, Session(user, org, "Organization created"));
        }

        // POST /api/auth/login — verifies the password hash and issues an HttpOnly cookie
        [HttpPost("login")]
        [AllowAnonymous]
        public async Task<SessionResponse> Login([FromBody] LoginRequest request)
        {
            var user = _users.FindByEmailForLogin(request.Email.Trim());
            if (user == null || !_passwords.Verify(user.PasswordHash, request.Password))
                return new SessionResponse(false, "Invalid email or password");

            if (!user.IsActive)
                return new SessionResponse(false, "This account has been deactivated.");

            var org = _organizations.Get(user.OrganizationId)!;
            await SignIn(user);
            return Session(user, org, "Login successful");
        }

        // POST /api/auth/logout
        [HttpPost("logout")]
        [AllowAnonymous]
        public async Task<IActionResult> Logout()
        {
            await HttpContext.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
            return NoContent();
        }

        // GET /api/auth/me — the logged-in user, organization and permissions
        [HttpGet("me")]
        public ActionResult<SessionResponse> Me()
        {
            var user = _users.GetById(User.GetUserId());
            var org = _organizations.GetCurrent();
            if (user == null || org == null || !user.IsActive) return Unauthorized();
            return Session(user, org, "OK");
        }

        // POST /api/auth/change-password — for the logged-in user; clears the temporary-password flag
        [HttpPost("change-password")]
        public async Task<IActionResult> ChangePassword([FromBody] ChangePasswordRequest request)
        {
            var user = _users.GetById(User.GetUserId());
            if (user == null) return Unauthorized();
            if (!_passwords.Verify(user.PasswordHash, request.CurrentPassword))
                return BadRequest(new { message = "Current password is incorrect." });

            _users.UpdatePassword(user.Id, _passwords.Hash(request.NewPassword), mustChange: false);
            user.MustChangePassword = false;
            await SignIn(user);   // re-issue the cookie without the must-change flag
            return Ok(new { message = "Password changed successfully." });
        }

        // ── Helpers ──────────────────────────────────────────────────────────
        private Task SignIn(User user)
        {
            var claims = new List<Claim>
            {
                new(ClaimTypes.NameIdentifier, user.Id.ToString()),
                new(ClaimTypes.Name, user.FullName),
                new(ClaimTypes.Email, user.Email),
                new(ClaimTypes.Role, user.Role),
                new(AppClaims.OrganizationId, user.OrganizationId.ToString())
            };
            if (user.MustChangePassword)
                claims.Add(new(AppClaims.MustChangePassword, "true"));

            var identity = new ClaimsIdentity(claims, CookieAuthenticationDefaults.AuthenticationScheme);
            return HttpContext.SignInAsync(CookieAuthenticationDefaults.AuthenticationScheme, new ClaimsPrincipal(identity));
        }

        private static SessionResponse Session(User user, Organization org, string message) => new(
            true, message,
            new UserInfo(user.Id, user.FullName, user.Email, user.Role, user.MustChangePassword),
            new OrganizationInfo(org.Id, org.Name, org.CurrencyCode, org.DistanceUnit),
            Permissions.ForRole(user.Role));
    }
}
