using Dapper;
using Microsoft.Data.SqlClient;
using System.Data;

namespace starqueen.Data
{
    // Opens connections that are scoped to the current organization.
    // The database's Row-Level Security policy uses SESSION_CONTEXT('organization_id')
    // to hide every other organization's rows.
    public interface IDbConnectionFactory
    {
        // Connection for the current request's organization (no organization before login)
        IDbConnection CreateConnection();

        // Connection for a specific organization. Only for login/sign-up, right after
        // the user's credentials have been verified.
        IDbConnection CreateConnectionFor(int organizationId);
    }

    public class SqlConnectionFactory : IDbConnectionFactory
    {
        private readonly string _connectionString;
        private readonly ITenantContext _tenant;

        // Database columns are snake_case, C# properties PascalCase. Set here (not only at API
        // startup) so every user of this library maps rows the same way.
        static SqlConnectionFactory() => DefaultTypeMap.MatchNamesWithUnderscores = true;

        public SqlConnectionFactory(string? connectionString, ITenantContext tenant)
        {
            if (string.IsNullOrWhiteSpace(connectionString))
                throw new InvalidOperationException(
                    "Connection string 'DefaultConnection' is not configured. " +
                    "Set ConnectionStrings:DefaultConnection in appsettings.json, " +
                    "user secrets, or the ConnectionStrings__DefaultConnection environment variable.");

            _connectionString = connectionString;
            _tenant = tenant;
        }

        public IDbConnection CreateConnection() => Open(_tenant.OrganizationId);

        public IDbConnection CreateConnectionFor(int organizationId) => Open(organizationId);

        private IDbConnection Open(int? organizationId)
        {
            var connection = new SqlConnection(_connectionString);
            connection.Open();
            if (organizationId is int id)
            {
                // read_only: nothing later on this connection can switch organizations
                connection.Execute(
                    "EXEC sp_set_session_context @key = N'organization_id', @value = @id, @read_only = 1",
                    new { id });
            }
            return connection;
        }
    }
}
