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

        // Accounts of one role in the current organization (drivers include their vehicle)
        public IEnumerable<AccountSummary> ListByRole(string role)
        {
            using var c = _db.CreateConnection();
            return c.Query<AccountSummary>("""
                SELECT u.id, u.full_name, u.email, u.is_active, u.must_change_password,
                       v.id AS assigned_vehicle_id
                FROM dbo.Users u
                LEFT JOIN dbo.Vehicles v ON v.assigned_driver_id = u.id
                WHERE u.role = @role
                ORDER BY u.full_name
                """, new { role }).ToList();
        }

        public int Create(string role, string fullName, string email, string passwordHash, bool mustChangePassword)
        {
            using var c = _db.CreateConnection();
            return c.QuerySingle<int>("""
                INSERT dbo.Users (full_name, email, password_hash, role, must_change_password)
                OUTPUT INSERTED.id
                VALUES (@fullName, @email, @passwordHash, @role, @mustChangePassword)
                """, new { role, fullName, email, passwordHash, mustChangePassword });
        }

        // Updates an account of the given role only (so the Owner can't be edited as an Admin)
        public bool UpdateProfile(int id, string role, string fullName, string email, bool isActive)
        {
            using var c = _db.CreateConnection();
            return c.Execute("""
                UPDATE dbo.Users SET full_name = @fullName, email = @email, is_active = @isActive
                WHERE id = @id AND role = @role
                """, new { id, role, fullName, email, isActive }) == 1;
        }

        public bool SetPasswordForRole(int id, string role, string hash, bool mustChange)
        {
            using var c = _db.CreateConnection();
            return c.Execute(
                "UPDATE dbo.Users SET password_hash = @hash, must_change_password = @mustChange WHERE id = @id AND role = @role",
                new { id, role, hash, mustChange }) == 1;
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
