using Dapper;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;
using starqueen.Models;

namespace starqueenAPI.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class AuthController : ControllerBase
    {
        private readonly string connectionString =
            "Server=(localdb)\\MSSQLLocalDB;Database=StarQueen_PMTS;" +
            "Trusted_Connection=True;MultipleActiveResultSets=True";

        // POST /api/auth/login
        [HttpPost("login")]
        public LoginResponse Login([FromBody] LoginRequest request)
        {
            using var connection = new SqlConnection(connectionString);

            // Find user by email
            var user = connection.QueryFirstOrDefault<Users>(
                "SELECT * FROM Users WHERE email = @email",
                new { email = request.email }
            );

            // User not found
            if (user == null)
            {
                return new LoginResponse
                {
                    success = false,
                    message = "Invalid email or password"
                };
            }

            // Wrong password
            if (user.password != request.password)
            {
                return new LoginResponse
                {
                    success = false,
                    message = "Invalid email or password"
                };
            }

            // Success
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
    }
}