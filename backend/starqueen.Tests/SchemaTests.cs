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
}
