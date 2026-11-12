using System.Net;
using System.Net.Http.Json;
using static starqueen.Tests.DbFixtures;

namespace starqueen.Tests;

[Collection("api")]
public class AuthTests(ApiFactory api)
{
    // Creates a Northwind user with the demo password and the given flags
    static string NewNorthwindUser(string role = "Driver", bool mustChange = false, bool active = true)
    {
        string email = $"{Guid.NewGuid():N}@test.local";
        int org = SeedTests.OrgOf("owner@northwind.demo");
        string hash;
        using (var anon = OpenAs(null))
            hash = (string)anon.QuerySingle("EXEC auth.FindUserByEmail 'owner@northwind.demo'").password_hash;
        using var c = OpenAs(org);
        c.Execute("""
            INSERT dbo.Users (full_name, email, password_hash, role, must_change_password, is_active)
            VALUES ('Test User', @email, @hash, @role, @mustChange, @active)
            """, new { email, hash, role, mustChange, active });
        return email;
    }

    [Fact]
    public async Task Login_ValidDemoOwner_ReturnsOrgAndPermissions()
    {
        var res = await api.NewClient().PostAsJsonAsync("/api/auth/login",
            new { email = "owner@northwind.demo", password = SeedTests.DemoPassword });
        var body = await res.Json();

        Assert.True(body.GetProperty("success").GetBoolean());
        Assert.Equal("Owner", body.GetProperty("user").GetProperty("role").GetString());
        Assert.Equal("Northwind Logistics", body.GetProperty("organization").GetProperty("name").GetString());
        var permissions = body.GetProperty("permissions").EnumerateArray().Select(p => p.GetString()).ToList();
        Assert.Contains("org.manage", permissions);
        Assert.Contains("admins.manage", permissions);
        Assert.DoesNotContain("logs.submit", permissions);
    }

    [Fact]
    public async Task Login_WrongPassword_ReturnsSuccessFalse()
    {
        var res = await api.NewClient().PostAsJsonAsync("/api/auth/login",
            new { email = "owner@northwind.demo", password = "wrong-password" });
        Assert.False((await res.Json()).GetProperty("success").GetBoolean());
    }

    [Fact]
    public async Task Login_InactiveUser_ReturnsSuccessFalse()
    {
        string email = NewNorthwindUser(active: false);
        var res = await api.NewClient().PostAsJsonAsync("/api/auth/login",
            new { email, password = SeedTests.DemoPassword });
        Assert.False((await res.Json()).GetProperty("success").GetBoolean());
    }

    [Fact]
    public async Task Api_WithoutLogin_Returns401()
    {
        var res = await api.NewClient().GetAsync("/api/auth/me");
        Assert.Equal(HttpStatusCode.Unauthorized, res.StatusCode);
    }

    [Fact]
    public async Task Signup_CreatesOrgAndLogsInOwner()
    {
        var client = api.NewClient();
        var res = await client.PostAsJsonAsync("/api/auth/signup", new
        {
            organization_name = "Acme Haulers",
            owner_name = "Alex Acme",
            email = $"{Guid.NewGuid():N}@acme.test",
            password = "LongEnough1",
            currency_code = "PHP",
            distance_unit = "km",
            template_categories = new[] { "Truck" }
        });
        Assert.Equal(HttpStatusCode.Created, res.StatusCode);

        var me = await client.GetAsync("/api/auth/me");
        Assert.Equal(HttpStatusCode.OK, me.StatusCode);
        var body = await me.Json();
        Assert.Equal("Owner", body.GetProperty("user").GetProperty("role").GetString());
        Assert.Equal("Acme Haulers", body.GetProperty("organization").GetProperty("name").GetString());
    }

    [Fact]
    public async Task Signup_DuplicateEmail_Gets409AndCreatesNothing()
    {
        int before = SeedTests.OrgOf("owner@northwind.demo");
        var res = await api.NewClient().PostAsJsonAsync("/api/auth/signup", new
        {
            organization_name = "Copycat",
            owner_name = "Copy",
            email = "owner@northwind.demo",
            password = "LongEnough1",
            template_categories = new[] { "Truck" }
        });
        Assert.Equal(HttpStatusCode.Conflict, res.StatusCode);
        Assert.Equal("Email is already registered.", (await res.Json()).GetProperty("message").GetString());
        Assert.Equal(before, SeedTests.OrgOf("owner@northwind.demo"));
    }

    [Fact]
    public async Task Signup_ShortPassword_Gets400()
    {
        var res = await api.NewClient().PostAsJsonAsync("/api/auth/signup", new
        {
            organization_name = "Short",
            owner_name = "Short",
            email = $"{Guid.NewGuid():N}@short.test",
            password = "short",
            template_categories = new[] { "Truck" }
        });
        Assert.Equal(HttpStatusCode.BadRequest, res.StatusCode);
    }

    [Fact]
    public async Task MustChangePassword_BlocksOtherEndpoints_UntilChanged()
    {
        string email = NewNorthwindUser(role: "Admin", mustChange: true);
        var client = await api.LoginAs(email);

        Assert.Equal(HttpStatusCode.Forbidden, (await client.GetAsync("/api/reports/fleet-overview")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/api/auth/me")).StatusCode);

        var change = await client.PostAsJsonAsync("/api/auth/change-password",
            new { current_password = SeedTests.DemoPassword, new_password = "BrandNew123" });
        Assert.Equal(HttpStatusCode.OK, change.StatusCode);

        Assert.NotEqual(HttpStatusCode.Forbidden, (await client.GetAsync("/api/reports/fleet-overview")).StatusCode);
    }

    [Fact]
    public async Task Login_AllowedWhileMustChangeCookiePresent()
    {
        // Shared phone: the previous user still has to change their password
        var client = await api.LoginAs(NewNorthwindUser(mustChange: true));
        var res = await client.PostAsJsonAsync("/api/auth/login",
            new { email = "owner@northwind.demo", password = SeedTests.DemoPassword });
        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        Assert.True((await res.Json()).GetProperty("success").GetBoolean());
    }
}
