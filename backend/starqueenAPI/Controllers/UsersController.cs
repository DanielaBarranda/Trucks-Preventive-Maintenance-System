using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using starqueen.Models;
using starqueen.Services;

namespace starqueenAPI.Controllers
{
    // Passwords are never returned. Use /api/auth/change-password to change one.
    [Route("api/[controller]")]
    [ApiController]
    public class UsersController : ControllerBase
    {
        readonly UsersServices _usersServices;

        public UsersController(UsersServices usersServices)
        {
            _usersServices = usersServices;
        }

        bool IsAdmin => User.IsInRole(Roles.Admin);
        bool IsSelfOrAdmin(int id) => IsAdmin || User.GetUserId() == id;

        // POST /api/users  (password is hashed before saving)
        [HttpPost]
        [Authorize(Roles = Roles.Admin)]
        public IActionResult AddUser(Users user)
            => _usersServices.AddUser(user) ? Ok(true) : BadRequest("Failed to add user.");

        // GET /api/users
        [HttpGet]
        [Authorize(Roles = Roles.Admin)]
        public List<UserResponse> GetAllUsers()
            => _usersServices.GetAllUsers().Select(UserResponse.From).ToList();

        // GET /api/users/{id}  (your own account, or any account as Admin)
        [HttpGet("{id}")]
        public ActionResult<UserResponse> GetUserById(int id)
        {
            if (!IsSelfOrAdmin(id)) return Forbid();
            var user = _usersServices.GetUserById(id);
            return user == null ? NotFound() : UserResponse.From(user);
        }

        // PUT /api/users/{id}  (username/email; role only as Admin)
        [HttpPut("{id}")]
        public IActionResult UpdateUser(int id, UserUpdateRequest request)
        {
            if (!IsSelfOrAdmin(id)) return Forbid();
            return _usersServices.UpdateUser(id, request, allowRoleChange: IsAdmin)
                ? Ok(true)
                : NotFound();
        }

        // DELETE /api/users/{id}
        [HttpDelete("{id}")]
        [Authorize(Roles = Roles.Admin)]
        public IActionResult DeleteUser(int id)
            => _usersServices.DeleteUser(id) ? Ok(true) : NotFound();
    }
}
