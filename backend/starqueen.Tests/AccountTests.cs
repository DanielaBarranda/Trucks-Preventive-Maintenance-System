using System.Net;
using System.Net.Http.Json;
using static starqueen.Tests.DbFixtures;

namespace starqueen.Tests;

[Collection("api")]
public class AccountTests(ApiFactory api)
{
    static int UserIdOf(string email)
    {
        using var c = OpenAs(null);
        return (int)c.QuerySingle("EXEC auth.FindUserByEmail @email", new { email }).id;
    }

    static string NewEmail() => $"{Guid.NewGuid():N}@account.test";

    [Fact]
    public async Task Owner_CreatesAdmin_AdminMustChangePassword()
    {
        var owner = await api.LoginAs("owner@northwind.demo");
        string email = NewEmail();
        var res = await owner.PostAsJsonAsync("/api/admins",
            new { full_name = "New Admin", email, temporary_password = "TempPass123" });
        Assert.Equal(HttpStatusCode.Created, res.StatusCode);

        var login = await api.NewClient().PostAsJsonAsync("/api/auth/login", new { email, password = "TempPass123" });
        var body = await login.Json();
        Assert.Equal("Admin", body.GetProperty("user").GetProperty("role").GetString());
        Assert.True(body.GetProperty("user").GetProperty("must_change_password").GetBoolean());
    }

    [Fact]
    public async Task Admin_CannotManageAdmins_Gets403()
    {
        var admin = await api.LoginAs("admin@northwind.demo");
        Assert.Equal(HttpStatusCode.Forbidden, (await admin.GetAsync("/api/admins")).StatusCode);
        var create = await admin.PostAsJsonAsync("/api/admins",
            new { full_name = "X", email = NewEmail(), temporary_password = "TempPass123" });
        Assert.Equal(HttpStatusCode.Forbidden, create.StatusCode);
    }

    [Fact]
    public async Task Admin_CreatesDriver_DriverCanLogInAndMustChange()
    {
        var admin = await api.LoginAs("admin@northwind.demo");
        string email = NewEmail();
        var res = await admin.PostAsJsonAsync("/api/drivers",
            new { full_name = "New Driver", email, temporary_password = "TempPass123" });
        Assert.Equal(HttpStatusCode.Created, res.StatusCode);

        var body = await (await api.NewClient().PostAsJsonAsync("/api/auth/login",
            new { email, password = "TempPass123" })).Json();
        Assert.Equal("Driver", body.GetProperty("user").GetProperty("role").GetString());
        Assert.True(body.GetProperty("user").GetProperty("must_change_password").GetBoolean());
    }

    [Fact]
    public async Task Driver_CannotListDrivers_Gets403()
    {
        var driver = await api.LoginAs("driver1@northwind.demo");
        Assert.Equal(HttpStatusCode.Forbidden, (await driver.GetAsync("/api/drivers")).StatusCode);
    }

    [Fact]
    public async Task DriversList_NeverIncludesOtherOrganizations()
    {
        var owner = await api.LoginAs("owner@swiftriders.demo");
        var drivers = (await (await owner.GetAsync("/api/drivers")).Json()).EnumerateArray().ToList();
        Assert.Contains(drivers, d => d.GetProperty("email").GetString() == "rider1@swiftriders.demo");
        Assert.DoesNotContain(drivers, d => d.GetProperty("email").GetString()!.EndsWith("@northwind.demo"));
    }

    [Fact]
    public async Task DriversList_IncludesAssignedVehicle()
    {
        var owner = await api.LoginAs("owner@northwind.demo");
        var drivers = (await (await owner.GetAsync("/api/drivers")).Json()).EnumerateArray().ToList();
        var d1 = drivers.Single(d => d.GetProperty("email").GetString() == "driver1@northwind.demo");
        var d3 = drivers.Single(d => d.GetProperty("email").GetString() == "driver3@northwind.demo");
        Assert.NotEqual(System.Text.Json.JsonValueKind.Null, d1.GetProperty("assigned_vehicle_id").ValueKind);
        Assert.Equal(System.Text.Json.JsonValueKind.Null, d3.GetProperty("assigned_vehicle_id").ValueKind);
    }

    [Fact]
    public async Task UpdateDriver_FromOtherOrg_Gets404()
    {
        var admin = await api.LoginAs("admin@northwind.demo");
        int riderId = UserIdOf("rider1@swiftriders.demo");
        var res = await admin.PutAsJsonAsync($"/api/drivers/{riderId}",
            new { full_name = "Hacked", email = "rider1@swiftriders.demo", is_active = false });
        Assert.Equal(HttpStatusCode.NotFound, res.StatusCode);
    }

    [Fact]
    public async Task Owner_CannotBeEditedThroughAdminsEndpoint()
    {
        var owner = await api.LoginAs("owner@northwind.demo");
        int ownerId = UserIdOf("owner@northwind.demo");
        var res = await owner.PutAsJsonAsync($"/api/admins/{ownerId}",
            new { full_name = "Nina Reyes", email = "owner@northwind.demo", is_active = false });
        Assert.Equal(HttpStatusCode.NotFound, res.StatusCode);
    }

    [Fact]
    public async Task ResetDriverPassword_SetsMustChange()
    {
        var admin = await api.LoginAs("admin@northwind.demo");
        string email = NewEmail();
        var created = await (await admin.PostAsJsonAsync("/api/drivers",
            new { full_name = "Reset Me", email, temporary_password = "TempPass123" })).Json();
        int id = created.GetProperty("id").GetInt32();

        var reset = await admin.PostAsJsonAsync($"/api/drivers/{id}/reset-password", new { temporary_password = "Another123" });
        Assert.Equal(HttpStatusCode.OK, reset.StatusCode);

        var body = await (await api.NewClient().PostAsJsonAsync("/api/auth/login",
            new { email, password = "Another123" })).Json();
        Assert.True(body.GetProperty("success").GetBoolean());
    }

    [Fact]
    public async Task DeactivatedDriver_CannotLogIn()
    {
        var admin = await api.LoginAs("admin@northwind.demo");
        string email = NewEmail();
        var created = await (await admin.PostAsJsonAsync("/api/drivers",
            new { full_name = "Leaving", email, temporary_password = "TempPass123" })).Json();
        int id = created.GetProperty("id").GetInt32();

        var update = await admin.PutAsJsonAsync($"/api/drivers/{id}", new { full_name = "Leaving", email, is_active = false });
        Assert.Equal(HttpStatusCode.OK, update.StatusCode);

        var body = await (await api.NewClient().PostAsJsonAsync("/api/auth/login",
            new { email, password = "TempPass123" })).Json();
        Assert.False(body.GetProperty("success").GetBoolean());
    }

    [Fact]
    public async Task Organization_Update_OnlyOwner()
    {
        var admin = await api.LoginAs("admin@northwind.demo");
        var denied = await admin.PutAsJsonAsync("/api/organization",
            new { name = "Nope", currency_code = "PHP", distance_unit = "km" });
        Assert.Equal(HttpStatusCode.Forbidden, denied.StatusCode);

        var owner = await api.SignupNewOrg();
        var ok = await owner.PutAsJsonAsync("/api/organization",
            new { name = "Renamed Org", currency_code = "USD", distance_unit = "mi" });
        Assert.Equal(HttpStatusCode.OK, ok.StatusCode);

        var org = await (await owner.GetAsync("/api/organization")).Json();
        Assert.Equal("Renamed Org", org.GetProperty("name").GetString());
        Assert.Equal("mi", org.GetProperty("distance_unit").GetString());
    }

    [Fact]
    public async Task CreateUser_DuplicateEmail_Gets409()
    {
        var admin = await api.LoginAs("admin@northwind.demo");
        var res = await admin.PostAsJsonAsync("/api/drivers",
            new { full_name = "Dup", email = "rider1@swiftriders.demo", temporary_password = "TempPass123" });
        Assert.Equal(HttpStatusCode.Conflict, res.StatusCode);
    }

    [Fact]
    public async Task DeactivatingDriver_EndsTheirLiveSession()
    {
        var owner = await api.SignupNewOrg();
        var (driver, driverId) = await api.NewDriver(owner);
        await ApiFactory.NewVehicle(owner, driverId);
        Assert.Equal(HttpStatusCode.OK, (await driver.GetAsync("/api/vehicles/mine")).StatusCode);

        var drivers = (await (await owner.GetAsync("/api/drivers")).Json()).EnumerateArray();
        string email = drivers.Single(d => d.GetProperty("id").GetInt32() == driverId).GetProperty("email").GetString()!;
        (await owner.PutAsJsonAsync($"/api/drivers/{driverId}", new { full_name = "Gone", email, is_active = false })).EnsureSuccessStatusCode();

        Assert.Equal(HttpStatusCode.Unauthorized, (await driver.GetAsync("/api/vehicles/mine")).StatusCode);
    }

    [Fact]
    public async Task ResettingPassword_ForcesChangeInLiveSession()
    {
        var owner = await api.SignupNewOrg();
        var (driver, driverId) = await api.NewDriver(owner);
        await ApiFactory.NewVehicle(owner, driverId);

        (await owner.PostAsJsonAsync($"/api/drivers/{driverId}/reset-password", new { temporary_password = "ResetPass123" }))
            .EnsureSuccessStatusCode();

        Assert.Equal(HttpStatusCode.Forbidden, (await driver.GetAsync("/api/vehicles/mine")).StatusCode);
    }

    [Fact]
    public async Task DistanceUnitChange_RefusedOnceReadingsExist()
    {
        var owner = await api.LoginAs("owner@northwind.demo");   // has odometer readings
        var res = await owner.PutAsJsonAsync("/api/organization",
            new { name = "Northwind Logistics", currency_code = "PHP", distance_unit = "mi" });
        Assert.Equal(HttpStatusCode.Conflict, res.StatusCode);
    }

    [Fact]
    public async Task DistanceUnitChange_BeforeAnyReadings_ConvertsSchedules()
    {
        var owner = await api.SignupNewOrg();   // km, Truck templates, no readings
        (await owner.PutAsJsonAsync("/api/organization",
            new { name = "Now in miles", currency_code = "USD", distance_unit = "mi" })).EnsureSuccessStatusCode();

        var oil = (await (await owner.GetAsync("/api/schedules")).Json()).EnumerateArray()
            .Single(s => s.GetProperty("task").GetString() == "Engine Oil & Filter Replacement");
        Assert.Equal(11800, oil.GetProperty("km_replace").GetInt32());   // 19000 km -> 11,800 mi
    }
}
