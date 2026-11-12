using Microsoft.Data.SqlClient;

namespace starqueen.Repositories
{
    // SQL Server error numbers the repositories translate into results
    public static class SqlErrors
    {
        // Foreign key / reference constraint violated (e.g. id from another organization, or row in use)
        public static bool IsReferenceViolation(SqlException ex) => ex.Number == 547;

        // Unique constraint or unique index violated
        public static bool IsDuplicate(SqlException ex) => ex.Number is 2627 or 2601;
    }
}
