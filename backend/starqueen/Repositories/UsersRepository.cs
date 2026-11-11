using Dapper;
using starqueen.Data;
using starqueen.Models;
using System.Data;

namespace starqueen.Repositories
{
    public class UsersRepository : GenericRepositories<Users>
    {
        public UsersRepository(IDbConnectionFactory db) : base(db) { }

        public Users? GetByEmail(string email)
        {
            using IDbConnection connection = CreateConnection();
            return connection.QueryFirstOrDefault<Users>(
                $"SELECT {GetSelectClause()} FROM [Users] WHERE email = @Email",
                new { Email = email });
        }

        public bool UpdatePassword(int userId, string passwordHash)
        {
            using IDbConnection connection = CreateConnection();
            return connection.Execute(
                "UPDATE [Users] SET password = @Hash WHERE user_id = @Id",
                new { Hash = passwordHash, Id = userId }) == 1;
        }
    }
}
