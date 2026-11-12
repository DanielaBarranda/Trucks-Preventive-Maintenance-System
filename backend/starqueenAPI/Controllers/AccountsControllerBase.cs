using Microsoft.AspNetCore.Mvc;
using starqueen.Models;
using starqueen.Services;
using System.ComponentModel.DataAnnotations;

namespace starqueenAPI.Controllers
{
    public record CreateAccountRequest(
        [Required, MaxLength(100)] string FullName,
        [Required, EmailAddress, MaxLength(255)] string Email,
        [Required, MinLength(AuthController.MinPasswordLength)] string TemporaryPassword);

    public record UpdateAccountRequest(
        [Required, MaxLength(100)] string FullName,
        [Required, EmailAddress, MaxLength(255)] string Email,
        bool IsActive = true);

    public record ResetPasswordRequest(
        [Required, MinLength(AuthController.MinPasswordLength)] string TemporaryPassword);

    // Shared list/create/update/reset endpoints for one account role
    [ApiController]
    public abstract class AccountsControllerBase : ControllerBase
    {
        private readonly AccountService _accounts;
        private readonly string _role;

        protected AccountsControllerBase(AccountService accounts, string role)
        {
            _accounts = accounts;
            _role = role;
        }

        [HttpGet]
        public IEnumerable<AccountSummary> List() => _accounts.List(_role);

        [HttpPost]
        public IActionResult Create(CreateAccountRequest request)
        {
            try
            {
                int id = _accounts.Create(_role, request.FullName.Trim(), request.Email.Trim(), request.TemporaryPassword);
                return StatusCode(StatusCodes.Status201Created, new { id });
            }
            catch (DuplicateEmailException ex)
            {
                return Conflict(new { message = ex.Message });
            }
        }

        [HttpPut("{id:int}")]
        public IActionResult Update(int id, UpdateAccountRequest request)
        {
            try
            {
                return _accounts.Update(id, _role, request.FullName.Trim(), request.Email.Trim(), request.IsActive)
                    ? Ok(true) : NotFound();
            }
            catch (DuplicateEmailException ex)
            {
                return Conflict(new { message = ex.Message });
            }
        }

        [HttpPost("{id:int}/reset-password")]
        public IActionResult ResetPassword(int id, ResetPasswordRequest request)
            => _accounts.ResetPassword(id, _role, request.TemporaryPassword)
                ? Ok(new { message = "Temporary password set. The user must change it at next login." })
                : NotFound();
    }
}
