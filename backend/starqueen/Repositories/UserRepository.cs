using Dapper;
using starqueen.Data;
using starqueen.Models;

namespace starqueen.Repositories
{
    public class UserRepository
    {
        private const string Columns =
            "id, organization_id, full_name, email, password_hash, role, must_change_password, is_active";

        private readonly IDbConnectionFactory _db;

        public UserRepository(IDbConnectionFactory db) => _db = db;

        // Login lookup across organizations (runs inside auth.FindUserByEmail)
        public User? FindByEmailForLogin(string email)
        {
            using var c = _db.CreateConnection();
            return c.QuerySingleOrDefault<User>("EXEC auth.FindUserByEmail @email", new { email });
        }

        // Any account using this email, in any organization
        public bool EmailExists(string email) => FindByEmailForLogin(email) != null;

        public User? GetById(int id)
        {
            using var c = _db.CreateConnection();
            return c.QuerySingleOrDefault<User>($"SELECT {Columns} FROM dbo.Users WHERE id = @id", new { id });
        }

        public User? GetById(int organizationId, int id)
        {
            using var c = _db.CreateConnectionFor(organizationId);
            return c.QuerySingleOrDefault<User>($"SELECT {Columns} FROM dbo.Users WHERE id = @id", new { id });
        }

        public bool UpdatePassword(int id, string hash, bool mustChange)
        {
            using var c = _db.CreateConnection();
            return c.Execute(
                "UPDATE dbo.Users SET password_hash = @hash, must_change_password = @mustChange WHERE id = @id",
                new { id, hash, mustChange }) == 1;
        }
    }
}
