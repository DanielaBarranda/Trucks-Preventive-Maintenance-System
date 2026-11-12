using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Configuration;

namespace starqueen.Tests;

// Runs the real API in memory against FleetPMTS_Test.
public class ApiFactory : WebApplicationFactory<Program>
{
    public ApiFactory() => TestDatabase.EnsureCreated();

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");
        builder.ConfigureAppConfiguration((_, config) =>
            config.AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["ConnectionStrings:DefaultConnection"] = TestDatabase.ConnectionString
            }));
    }

    public HttpClient NewClient() => CreateClient(new WebApplicationFactoryClientOptions
    {
        BaseAddress = new Uri("https://localhost"),
        HandleCookies = true
    });

    // Signs up a brand-new organization; returns the Owner's logged-in client
    public async Task<HttpClient> SignupNewOrg(string categories = "Truck", string unit = "km")
    {
        var client = NewClient();
        var res = await client.PostAsJsonAsync("/api/auth/signup", new
        {
            organization_name = "Test Org " + Guid.NewGuid().ToString("N")[..6],
            owner_name = "Test Owner",
            email = $"{Guid.NewGuid():N}@owner.test",
            password = "LongEnough1",
            distance_unit = unit,
            template_categories = categories.Split(',')
        });
        res.EnsureSuccessStatusCode();
        return client;
    }

    // Owner creates a driver; the driver logs in and changes the temporary password.
    // Returns the driver's logged-in client and id.
    public async Task<(HttpClient Client, int Id)> NewDriver(HttpClient manager)
    {
        string email = $"{Guid.NewGuid():N}@driver.test";
        var created = await manager.PostAsJsonAsync("/api/drivers",
            new { full_name = "Fleet Driver", email, temporary_password = "TempPass123" });
        created.EnsureSuccessStatusCode();
        int id = (await created.Json()).GetProperty("id").GetInt32();

        var client = await LoginAs(email, "TempPass123");
        (await client.PostAsJsonAsync("/api/auth/change-password",
            new { current_password = "TempPass123", new_password = "DriverPass123" })).EnsureSuccessStatusCode();
        return (client, id);
    }

    // Owner creates a vehicle of the first (or named) type and assigns the driver to it
    public static async Task<int> NewVehicle(HttpClient owner, int? driverId = null, string? typeName = null)
    {
        var types = (await (await owner.GetAsync("/api/vehicle-types")).Json()).EnumerateArray().ToList();
        var type = typeName == null ? types.First() : types.Single(t => t.GetProperty("name").GetString() == typeName);
        var res = await owner.PostAsJsonAsync("/api/vehicles", new
        {
            name = "Test Vehicle",
            plate_number = "T-" + Guid.NewGuid().ToString("N")[..8],
            vehicle_type_id = type.GetProperty("id").GetInt32()
        });
        res.EnsureSuccessStatusCode();
        int id = (await res.Json()).GetProperty("id").GetInt32();
        if (driverId is int d)
            (await owner.PutAsJsonAsync($"/api/vehicles/{id}/assign", new { driver_id = d })).EnsureSuccessStatusCode();
        return id;
    }

    public static async Task<int> OrgIdOf(HttpClient client) =>
        (await (await client.GetAsync("/api/organization")).Json()).GetProperty("id").GetInt32();

    // Returns a client holding the login cookie for this user
    public async Task<HttpClient> LoginAs(string email, string password = SeedTests.DemoPassword)
    {
        var client = NewClient();
        var res = await client.PostAsJsonAsync("/api/auth/login", new { email, password });
        var body = await res.Content.ReadFromJsonAsync<JsonElement>();
        if (!body.GetProperty("success").GetBoolean())
            throw new InvalidOperationException($"Login failed for {email}: {body}");
        return client;
    }
}

[CollectionDefinition("api", DisableParallelization = true)]
public class ApiCollection : ICollectionFixture<ApiFactory> { }

internal static class JsonExtensions
{
    public static async Task<JsonElement> Json(this HttpResponseMessage res) =>
        await res.Content.ReadFromJsonAsync<JsonElement>();
}
