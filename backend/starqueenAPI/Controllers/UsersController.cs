using Microsoft.AspNetCore.Mvc;
using starqueen.Models;
using starqueen.Services;

namespace starqueenAPI.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class UsersController : ControllerBase
    {
        readonly UsersServices _usersServices = new UsersServices();

        // POST /api/users
        [HttpPost]
        public bool AddUser(Users user)
        {
            return _usersServices.AddUser(user);
        }

        // GET /api/users
        [HttpGet]
        public List<Users> GetAllUsers()
        {
            return _usersServices.GetAllUsers();
        }

        // GET /api/users/{id}
        [HttpGet("{id}")]
        public Users? GetUserById(int id)
        {
            return _usersServices.GetUserById(id);
        }

        // PUT /api/users/{id}
        [HttpPut("{id}")]
        public bool UpdateUser(int id, Users user)
        {
            user.user_id = id;
            return _usersServices.UpdateUser(user);
        }

        // DELETE /api/users/{id}
        [HttpDelete("{id}")]
        public bool DeleteUser(int id)
        {
            return _usersServices.DeleteUser(id);
        }
    }
}