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

        // Changing the distance unit is only allowed before any odometer readings exist
        // (readings can't be converted reliably); schedule thresholds are converted with it.
        // Conflict = readings exist; NotFound = no organization in context.
        public WriteResult Update(string name, string currencyCode, string distanceUnit)
        {
            using var scope = DbTransactions.ReadCommitted();
            using var c = _db.CreateConnection();

            string? current = c.QuerySingleOrDefault<string>("SELECT distance_unit FROM dbo.Organizations");
            if (current == null) return WriteResult.NotFound;

            if (current != distanceUnit)
            {
                if (c.ExecuteScalar<int>("SELECT COUNT(*) FROM dbo.OdometerReadings") > 0)
                    return WriteResult.Conflict;

                // km → mi: × 0.621371;  mi → km: ÷ 0.621371  (rounded to the nearest 100)
                double factor = distanceUnit == "mi" ? 0.621371 : 1 / 0.621371;
                c.Execute("""
                    UPDATE dbo.MaintenanceSchedules SET
                        km_warning = CAST(ROUND(km_warning * @factor, -2) AS INT),
                        km_replace = CAST(ROUND(km_replace * @factor, -2) AS INT),
                        km_overdue = CAST(ROUND(km_overdue * @factor, -2) AS INT)
                    """, new { factor });
            }

            c.Execute(
                "UPDATE dbo.Organizations SET name = @name, currency_code = @currencyCode, distance_unit = @distanceUnit",
                new { name, currencyCode, distanceUnit });
            scope.Complete();
            return WriteResult.Ok;
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
