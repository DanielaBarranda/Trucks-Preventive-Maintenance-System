using Microsoft.Data.SqlClient;
using System.Data;

namespace starqueen.Data
{
    // Creates a new database connection per call.
    // The connection string comes from configuration (appsettings.json →
    // ConnectionStrings:DefaultConnection) and is injected once at startup.
    public interface IDbConnectionFactory
    {
        IDbConnection CreateConnection();
    }

    public class SqlConnectionFactory : IDbConnectionFactory
    {
        private readonly string _connectionString;

        public SqlConnectionFactory(string? connectionString)
        {
            if (string.IsNullOrWhiteSpace(connectionString))
                throw new InvalidOperationException(
                    "Connection string 'DefaultConnection' is not configured. " +
                    "Set ConnectionStrings:DefaultConnection in appsettings.json, " +
                    "user secrets, or the ConnectionStrings__DefaultConnection environment variable.");

            _connectionString = connectionString;
        }

        public IDbConnection CreateConnection() => new SqlConnection(_connectionString);
    }
}
