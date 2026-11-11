using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using starqueen.Models;
using starqueen.Services;
using System.Security.Claims;

namespace starqueenAPI.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class AuthController : ControllerBase
    {
        private readonly UsersServices _users;

        public AuthController(UsersServices users)
        {
            _users = users;
        }

        // POST /api/auth/login
        // Verifies the password hash and issues an HttpOnly auth cookie.
        [HttpPost("login")]
        [AllowAnonymous]
        public async Task<LoginResponse> Login([FromBody] LoginRequest request)
        {
            var user = _users.Authenticate(request.email.Trim(), request.password);
            if (user == null)
            {
                return new LoginResponse
                {
                    success = false,
                    message = "Invalid email or password"
                };
            }

            var claims = new List<Claim>
            {
                new(ClaimTypes.NameIdentifier, user.user_id.ToString()),
                new(ClaimTypes.Name, user.username),
                new(ClaimTypes.Email, user.email),
                new(ClaimTypes.Role, user.role)
            };
            var identity = new ClaimsIdentity(claims, CookieAuthenticationDefaults.AuthenticationScheme);
            await HttpContext.SignInAsync(
                CookieAuthenticationDefaults.AuthenticationScheme, new ClaimsPrincipal(identity));

            return new LoginResponse
            {
                success = true,
                message = "Login successful",
                role = user.role,
                user_id = user.user_id,
                username = user.username,
                email = user.email
            };
        }

        // POST /api/auth/logout
        [HttpPost("logout")]
        [AllowAnonymous]
        public async Task<IActionResult> Logout()
        {
            await HttpContext.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
            return NoContent();
        }

        // GET /api/auth/me — who is logged in (based on the cookie)
        [HttpGet("me")]
        public ActionResult<UserResponse> Me()
        {
            var user = _users.GetUserById(User.GetUserId());
            return user == null ? Unauthorized() : UserResponse.From(user);
        }

        // POST /api/auth/change-password — for the logged-in user
        [HttpPost("change-password")]
        public IActionResult ChangePassword([FromBody] ChangePasswordRequest request)
        {
            bool changed = _users.ChangePassword(
                User.GetUserId(), request.current_password, request.new_password);

            return changed
                ? Ok(new { message = "Password changed successfully." })
                : BadRequest(new { message = "Current password is incorrect." });
        }
    }

    public static class ClaimsPrincipalExtensions
    {
        public static int GetUserId(this ClaimsPrincipal user)
            => int.TryParse(user.FindFirstValue(ClaimTypes.NameIdentifier), out int id) ? id : 0;
    }
}
