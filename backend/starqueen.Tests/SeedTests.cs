using starqueen.Services;
using static starqueen.Tests.DbFixtures;

namespace starqueen.Tests;

[Collection("db")]
public class SeedTests
{
    public const string DemoPassword = "Demo1234!";

    public static readonly string[] DemoEmails =
    {
        "owner@northwind.demo", "admin@northwind.demo",
        "driver1@northwind.demo", "driver2@northwind.demo", "driver3@northwind.demo", "driver4@northwind.demo",
        "owner@swiftriders.demo", "rider1@swiftriders.demo"
    };

    public SeedTests() => TestDatabase.EnsureCreated();

    internal static int OrgOf(string email)
    {
        using var c = OpenAs(null);
        return (int)c.QuerySingle("EXEC auth.FindUserByEmail @email", new { email }).organization_id;
    }

    [Fact]
    public void SeedPasswords_VerifyAgainstDemoPassword()
    {
        var passwords = new PasswordService();
        using var c = OpenAs(null);
        foreach (var email in DemoEmails)
        {
            var user = c.QuerySingle("EXEC auth.FindUserByEmail @email", new { email });
            Assert.True(passwords.Verify((string)user.password_hash, DemoPassword), email);
        }
    }

    [Fact]
    public void Seed_HasTwoOrganizations_WithSeparateData()
    {
        int northwind = OrgOf("owner@northwind.demo");
        int swift = OrgOf("owner@swiftriders.demo");
        Assert.NotEqual(northwind, swift);

        using (var c = OpenAs(northwind))
            Assert.Equal(4, c.Query("EXEC dbo.rpt_FleetOverview").Count());
        using (var c = OpenAs(swift))
            Assert.Equal(2, c.Query("EXEC dbo.rpt_FleetOverview").Count());
    }

    [Fact]
    public void Seed_ProducesWarningAndOverdue()
    {
        using var c = OpenAs(OrgOf("owner@northwind.demo"));
        var statuses = c.Query("EXEC dbo.rpt_MaintenanceStatus").Select(r => (string)r.status).ToList();
        Assert.Contains("Warning", statuses);
        Assert.Contains("Overdue", statuses);
    }

    [Fact]
    public void Seed_Driver3_HasNoVehicle()
    {
        using var c = OpenAs(OrgOf("driver3@northwind.demo"));
        Assert.Equal(0, c.ExecuteScalar<int>("""
            SELECT COUNT(*) FROM dbo.Vehicles v JOIN dbo.Users u ON u.id = v.assigned_driver_id
            WHERE u.email = 'driver3@northwind.demo'
            """));
    }
}
