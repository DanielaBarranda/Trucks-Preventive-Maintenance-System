using System.Net;
using static starqueen.Tests.DbFixtures;

namespace starqueen.Tests;

[Collection("api")]
public class ReportEndpointTests(ApiFactory api)
{
    static int UnreadCount(string ownerEmail)
    {
        using var c = OpenAs(SeedTests.OrgOf(ownerEmail));
        return c.ExecuteScalar<int>("SELECT COUNT(*) FROM dbo.Notifications WHERE is_read = 0");
    }

    [Fact]
    public async Task FleetOverview_ReturnsOnlyOwnVehicles()
    {
        var northwind = await api.LoginAs("owner@northwind.demo");
        var rows = (await (await northwind.GetAsync("/api/reports/fleet-overview")).Json()).EnumerateArray().ToList();
        Assert.Equal(4, rows.Count);
        Assert.All(rows, r => Assert.StartsWith("NWL-", r.GetProperty("plate_number").GetString()));

        var swift = await api.LoginAs("owner@swiftriders.demo");
        Assert.Equal(2, (await (await swift.GetAsync("/api/reports/fleet-overview")).Json()).GetArrayLength());
    }

    [Fact]
    public async Task MonthlyExpenses_FilterByYear()
    {
        var admin = await api.LoginAs("admin@northwind.demo");
        int year = DateTime.UtcNow.AddDays(-20).Year;   // seeded expenses are within the last 20 days
        var rows = (await (await admin.GetAsync($"/api/reports/monthly-expenses?year={year}")).Json()).EnumerateArray().ToList();
        Assert.NotEmpty(rows);
        Assert.All(rows, r => Assert.Equal(year, r.GetProperty("year").GetInt32()));

        Assert.Equal(0, (await (await admin.GetAsync("/api/reports/monthly-expenses?year=1999")).Json()).GetArrayLength());
    }

    [Fact]
    public async Task DriverActivity_ListsOwnDrivers()
    {
        var admin = await api.LoginAs("admin@northwind.demo");
        var rows = (await (await admin.GetAsync("/api/reports/driver-activity")).Json()).EnumerateArray().ToList();
        var ben = rows.Single(r => r.GetProperty("driver_name").GetString() == "Ben Cruz");
        Assert.Equal(3, ben.GetProperty("trips").GetInt32());
        Assert.DoesNotContain(rows, r => r.GetProperty("driver_name").GetString() == "Riley Quinn");
    }

    [Fact]
    public async Task Driver_CannotViewReports_Gets403()
    {
        var driver = await api.LoginAs("driver1@northwind.demo");
        Assert.Equal(HttpStatusCode.Forbidden, (await driver.GetAsync("/api/reports/fleet-overview")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await driver.GetAsync("/api/notifications")).StatusCode);
    }

    [Fact]
    public async Task Notifications_ListAndUnreadFilter()
    {
        var admin = await api.LoginAs("admin@northwind.demo");
        var all = (await (await admin.GetAsync("/api/notifications")).Json()).EnumerateArray().ToList();
        Assert.NotEmpty(all);
        Assert.DoesNotContain(all, n => n.GetProperty("message").GetString()!.Contains("SWR-"));

        var unread = (await (await admin.GetAsync("/api/notifications?unread_only=true")).Json()).EnumerateArray().ToList();
        Assert.All(unread, n => Assert.False(n.GetProperty("is_read").GetBoolean()));
    }

    [Fact]
    public async Task MarkRead_OwnWorks_OtherOrgGets404()
    {
        int swiftNotification;
        using (var c = OpenAs(SeedTests.OrgOf("owner@swiftriders.demo")))
            swiftNotification = c.QuerySingle<int>("""
                INSERT dbo.Notifications (type, message) OUTPUT INSERTED.id VALUES ('Information', 'Swift only')
                """);

        var northwind = await api.LoginAs("admin@northwind.demo");
        Assert.Equal(HttpStatusCode.NotFound, (await northwind.PutAsync($"/api/notifications/{swiftNotification}/read", null)).StatusCode);

        var swift = await api.LoginAs("owner@swiftriders.demo");
        Assert.Equal(HttpStatusCode.OK, (await swift.PutAsync($"/api/notifications/{swiftNotification}/read", null)).StatusCode);
    }

    [Fact]
    public async Task ReadAll_MarksOnlyOwnOrganization()
    {
        using (var c = OpenAs(SeedTests.OrgOf("owner@swiftriders.demo")))
            c.Execute("INSERT dbo.Notifications (type, message) VALUES ('Information', 'Stays unread')");
        int swiftBefore = UnreadCount("owner@swiftriders.demo");

        var northwind = await api.LoginAs("admin@northwind.demo");
        Assert.Equal(HttpStatusCode.OK, (await northwind.PutAsync("/api/notifications/read-all", null)).StatusCode);

        Assert.Equal(0, UnreadCount("owner@northwind.demo"));
        Assert.Equal(swiftBefore, UnreadCount("owner@swiftriders.demo"));
    }
}
