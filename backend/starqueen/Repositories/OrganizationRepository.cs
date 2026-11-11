using Dapper;
using Microsoft.Data.SqlClient;
using starqueen.Data;
using starqueen.Models;

namespace starqueen.Repositories
{
    public class OrganizationRepository
    {
        private const string Columns = "id, name, currency_code, distance_unit";
        private readonly IDbConnectionFactory _db;

        public OrganizationRepository(IDbConnectionFactory db) => _db = db;

        // Current organization (from the request's tenant context)
        public Organization? GetCurrent()
        {
            using var c = _db.CreateConnection();
            return c.QuerySingleOrDefault<Organization>($"SELECT {Columns} FROM dbo.Organizations");
        }

        // A specific organization, for login/sign-up right after credentials are verified
        public Organization? Get(int organizationId)
        {
            using var c = _db.CreateConnectionFor(organizationId);
            return c.QuerySingleOrDefault<Organization>($"SELECT {Columns} FROM dbo.Organizations");
        }

        public bool Update(string name, string currencyCode, string distanceUnit)
        {
            using var c = _db.CreateConnection();
            return c.Execute(
                "UPDATE dbo.Organizations SET name = @name, currency_code = @currencyCode, distance_unit = @distanceUnit",
                new { name, currencyCode, distanceUnit }) == 1;
        }

        // Sign-up: creates the organization, its Owner, vehicle types and schedules.
        // Throws DuplicateEmailException when the email is already registered.
        public (int OrganizationId, int UserId) CreateWithOwner(
            string orgName, string currencyCode, string distanceUnit,
            string ownerName, string email, string passwordHash, IEnumerable<string> templateCategories)
        {
            using var c = _db.CreateConnection();
            try
            {
                var row = c.QuerySingle(
                    "EXEC auth.CreateOrganization @orgName, @currencyCode, @distanceUnit, @ownerName, @email, @passwordHash, @categories",
                    new
                    {
                        orgName, currencyCode, distanceUnit, ownerName, email, passwordHash,
                        categories = string.Join(",", templateCategories)
                    });
                return ((int)row.organization_id, (int)row.user_id);
            }
            catch (SqlException ex) when (ex.Number == 50001 || ex.Number == 2627 || ex.Number == 2601)
            {
                throw new DuplicateEmailException();
            }
        }
    }
}
