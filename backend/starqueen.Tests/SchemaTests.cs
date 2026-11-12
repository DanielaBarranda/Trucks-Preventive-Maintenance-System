namespace starqueen.Tests;

[Collection("db")]
public class SchemaTests
{
    [Theory]
    [InlineData("Organizations")]
    [InlineData("Users")]
    [InlineData("VehicleTypes")]
    [InlineData("Vehicles")]
    [InlineData("ScheduleTemplates")]
    [InlineData("MaintenanceSchedules")]
    [InlineData("OdometerReadings")]
    [InlineData("Trips")]
    [InlineData("Expenses")]
    [InlineData("MaintenanceLogs")]
    [InlineData("Notifications")]
    public void Table_Exists(string table)
    {
        TestDatabase.EnsureCreated();
        using var c = new SqlConnection(TestDatabase.ConnectionString);
        Assert.Equal(1, c.ExecuteScalar<int>("SELECT COUNT(*) FROM sys.tables WHERE name = @table", new { table }));
    }

    [Fact]
    public void LegacyDatabase_IsUntouched()
    {
        Assert.DoesNotContain("Starqueen_PMTS", TestDatabase.ConnectionString, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void SchemaScript_RefusesLegacyStarQueenDatabase()
    {
        // A database that looks like the legacy StarQueen one (has Truck_Activity)
        const string guardDb = "FleetPMTS_GuardTest";
        string master = TestDatabase.ConnectionString.Replace(TestDatabase.Name, "master");
        string target = TestDatabase.ConnectionString.Replace(TestDatabase.Name, guardDb);
        using (var m = new SqlConnection(master))
            m.Execute($"IF DB_ID('{guardDb}') IS NOT NULL BEGIN ALTER DATABASE [{guardDb}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE; DROP DATABASE [{guardDb}]; END CREATE DATABASE [{guardDb}];");
        try
        {
            using (var c = new SqlConnection(target))
                c.Execute("CREATE TABLE dbo.Truck_Activity (id INT); CREATE TABLE dbo.Users (id INT);");

            string sql = File.ReadAllText(Path.Combine(AppContext.BaseDirectory, "database", "schema.sql"));
            using (var c = new SqlConnection(target))
            {
                c.Open();
                Assert.ThrowsAny<SqlException>(() => { foreach (var b in TestDatabase.SplitBatches(sql)) c.Execute(b); });
            }

            using (var c = new SqlConnection(target))
                Assert.Equal(2, c.ExecuteScalar<int>("SELECT COUNT(*) FROM sys.tables WHERE name IN ('Truck_Activity', 'Users')"));
        }
        finally
        {
            SqlConnection.ClearAllPools();
            using var m = new SqlConnection(master);
            m.Execute($"ALTER DATABASE [{guardDb}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE; DROP DATABASE [{guardDb}];");
        }
    }
}
